import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync,existsSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {sha,verifyProject} from '../../../tools/release/verify.mjs';
import {propose} from '../../../tools/upgrade/propose.mjs';
function put(root,p,value){mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),value);}
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'t26-')),current=join(root,'current'),target=join(root,'target');
 const make=(p,v)=>{
  const skeleton={'Dockerfile':'one\ntwo\nthree\nfour\n','apps/api/src/server.ts':'export const business="original";\n','config/project.json':'{"brand":"original"}\n','tools/behavior.mjs':'process.exit(0);\n'};
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

const results=[];
for(const mode of ['workspace-metadata','vendor-after-check']){
 const f=fixture();try{
 const script=mode==='workspace-metadata'?`import{readFileSync,writeFileSync}from'node:fs';const p='apps/api/package.json',v=JSON.parse(readFileSync(p));v.version='9.9.9';writeFileSync(p,JSON.stringify(v));`:`import{readFileSync,appendFileSync}from'node:fs';const v=JSON.parse(readFileSync('templux.lock.json'));appendFileSync('vendor/'+v.packages[0].file,'late-check-bytes');`;
 put(f.current,'tools/behavior.mjs',script);
 const r=await propose({...f,trustProjectCode:true,behavior:'tools/behavior.mjs'});
 let finalVerificationPassed=true;try{verifyProject(join(f.output,'candidate'));}catch{finalVerificationPassed=false;}
 const version=JSON.parse(readFileSync(join(f.output,'candidate/apps/api/package.json'))).version;
 results.push({mode,directlyApplicable:r.directlyApplicable,passedChecks:r.checks.filter(x=>x.status==='passed').length,manual:r.manual,finalVerificationPassed,currentVersion:JSON.parse(readFileSync(join(f.current,'apps/api/package.json'))).version,candidateVersion:version});
 }finally{rmSync(f.root,{recursive:true,force:true});}
}
for(const r of results){assert.equal(r.directlyApplicable,false);assert.ok(r.manual.length);assert.equal(r.candidateVersion,r.currentVersion);assert.equal(r.finalVerificationPassed,true);}
console.log(JSON.stringify(results,null,2));
