import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync,existsSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {sha} from '../../../tools/release/verify.mjs';
import {propose} from '../../../tools/upgrade/propose.mjs';
function put(root,p,value){mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),value);}
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'t26-')),current=join(root,'current'),target=join(root,'target');
 const make=(p,v)=>{
  const skeleton={'Dockerfile':'COPY a/a/file /app\ntwo\nthree\nfour\n','apps/api/src/server.ts':'export const business="original";\n','config/project.json':'{"brand":"original"}\n','tools/behavior.mjs':'process.exit(0);\n'};
  for(const kind of ['api','web'])skeleton[`apps/${kind}/package.json`]=JSON.stringify({name:'project-'+kind,version:'1.0.0',scripts:{build:'node -e "process.exit(0)"'},dependencies:{['@templux/'+(kind==='api'?'core':'web')]:`file:../../vendor/templux-${kind==='api'?'core':'web'}-${v}.tgz`}})+'\n';
  skeleton['package.json']=JSON.stringify({name:'custom-business',version:'7.0.0',private:true,workspaces:['apps/api','apps/web'],scripts:{typecheck:'node -e "process.exit(0)"'}})+'\n';
  const files={};for(const [k,b]of Object.entries(skeleton)){put(p,k,b);put(p,'.templux/baseline/project/'+k,b);files[k]=sha(Buffer.from(b));}
  const sourceFiles=Object.fromEntries(Object.entries(files).map(([k,v])=>['project-template/'+k,v]));
  const packages=[];for(const kind of ['core','web']){const stage=join(root,v,kind,'package');put(stage,'package.json',JSON.stringify({name:'@templux/'+kind,version:v}));const file=`templux-${kind}-${v}.tgz`;mkdirSync(join(p,'vendor'),{recursive:true});assert.equal(spawnSync('tar',['-czf',join(p,'vendor',file),'-C',join(stage,'..'),'package']).status,0);const bytes=readFileSync(join(p,'vendor',file));packages.push({name:'@templux/'+kind,version:v,file,sha256:sha(bytes),integrity:'sha512-'+sha(bytes,'sha512')});}
  const source={commit:(v==='0.1.0'?'a':'b').repeat(40),treeSha256:sha(JSON.stringify(sourceFiles)),files:sourceFiles};
  const m={schemaVersion:1,version:v,compatibility:{protocol:1,config:1,schema:'0010',node:24,next:16},source,packages,upgrade:{from:['0.1.0']}};put(p,'vendor/manifest.json',JSON.stringify(m));const h=sha(readFileSync(join(p,'vendor/manifest.json')));put(p,'templux.lock.json',JSON.stringify({schemaVersion:1,version:v,manifestSha256:h,packages}));put(p,'.templux/baseline.json',JSON.stringify({schemaVersion:1,source,manifestSha256:h,files}));put(p,'.templux/verify.mjs',readFileSync(new URL('../../../tools/release/verify.mjs',import.meta.url)));
  return m;
 };
 make(current,'0.1.0');mkdirSync(target);make(join(target,'project'),'0.2.0-t26.1');cpSync(join(target,'project/vendor/manifest.json'),join(target,'manifest.json'));for(const p of JSON.parse(readFileSync(join(target,'manifest.json'))).packages)cpSync(join(target,'project/vendor',p.file),join(target,p.file));const hash=sha(readFileSync(join(target,'manifest.json')));put(target,'complete.json',JSON.stringify({version:'0.2.0-t26.1',manifestSha256:hash}));
 return{root,current,target,targetVersion:'0.2.0-t26.1',targetSha:hash,output:join(root,'out')};
}
function changeTarget(f,p,value){const root=join(f.target,'project');put(root,p,value);put(root,'.templux/baseline/project/'+p,value);const m=JSON.parse(readFileSync(join(f.target,'manifest.json'))),b=JSON.parse(readFileSync(join(root,'.templux/baseline.json')));m.source.files['project-template/'+p]=sha(Buffer.from(value));m.source.treeSha256=sha(JSON.stringify(m.source.files));put(f.target,'manifest.json',JSON.stringify(m));put(root,'vendor/manifest.json',JSON.stringify(m));f.targetSha=sha(readFileSync(join(f.target,'manifest.json')));b.source=m.source;b.files[p]=sha(Buffer.from(value));b.manifestSha256=f.targetSha;put(root,'.templux/baseline.json',JSON.stringify(b));const lock=JSON.parse(readFileSync(join(root,'templux.lock.json')));lock.manifestSha256=f.targetSha;put(root,'templux.lock.json',JSON.stringify(lock));put(f.target,'complete.json',JSON.stringify({version:f.targetVersion,manifestSha256:f.targetSha}));}

const f=fixture();try{
 changeTarget(f,'Dockerfile','COPY a/a/file /app\ntwo\nthree\nupdated-target\n');
 const r=await propose({...f,trustProjectCode:true,behavior:'tools/behavior.mjs'});
 assert.equal(r.directlyApplicable,true);assert.equal(r.patchValidation.status,'passed');
 const patch=readFileSync(join(f.output,'changes.patch'),'utf8');
 const check=spawnSync('git',['apply','--check',join(f.output,'changes.patch')],{cwd:f.current,encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);assert.ok(patch.includes('COPY a/a/file /app'));
 const applied=join(f.root,'applied');cpSync(f.current,applied,{recursive:true});assert.equal(spawnSync('git',['apply',join(f.output,'changes.patch')],{cwd:applied}).status,0);
 for(const p of r.vendor){cpSync(join(f.output,'candidate/vendor',p.file),join(applied,'vendor',p.file));rmSync(join(applied,'vendor',p.replaces));}
 const {readdirSync,lstatSync}=await import('node:fs');function inventory(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{const p=prefix+e.name,full=join(dir,e.name);return e.isDirectory()?Object.entries(inventory(full,p+'/')):[[p,{sha256:sha(readFileSync(full)),mode:lstatSync(full).mode&0o777}]];}));}
 assert.deepEqual(inventory(applied),inventory(join(f.output,'candidate')));
 console.log(JSON.stringify({directlyApplicable:r.directlyApplicable,passedChecks:r.checks.filter(x=>x.status==='passed').length,candidatePreservedLiteral:readFileSync(join(f.output,'candidate/Dockerfile'),'utf8').includes('COPY a/a/file /app'),patchPreservedLiteral:patch.includes('COPY a/a/file /app'),patchChangedLiteral:patch.includes('COPY a/file /app'),patchCheck:check.status,diagnostic:check.stderr.trim()},null,2));
}finally{rmSync(f.root,{recursive:true,force:true});}
