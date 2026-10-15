import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync,existsSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {sha} from '../../../tools/release/verify.mjs';
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

const f=fixture();try{
 put(f.current,'tools/check-behavior.mjs','process.exit(0);\n');
 const target=join(f.target,'project'),path='tools/behavior.mjs';
 rmSync(join(target,path));rmSync(join(target,'.templux/baseline/project',path));
 const m=JSON.parse(readFileSync(join(f.target,'manifest.json'))),b=JSON.parse(readFileSync(join(target,'.templux/baseline.json'))),lock=JSON.parse(readFileSync(join(target,'templux.lock.json')));
 delete m.source.files['project-template/'+path];m.source.treeSha256=sha(JSON.stringify(m.source.files));
 put(f.target,'manifest.json',JSON.stringify(m));put(target,'vendor/manifest.json',JSON.stringify(m));f.targetSha=sha(readFileSync(join(f.target,'manifest.json')));delete b.files[path];b.source=m.source;b.manifestSha256=f.targetSha;put(target,'.templux/baseline.json',JSON.stringify(b));lock.manifestSha256=f.targetSha;put(target,'templux.lock.json',JSON.stringify(lock));put(f.target,'complete.json',JSON.stringify({version:f.targetVersion,manifestSha256:f.targetSha}));
 const report=await propose({...f,trustProjectCode:true,behavior:'tools/check-behavior.mjs'});
 const applied=join(f.root,'applied');cpSync(f.current,applied,{recursive:true});const patch=join(f.output,'changes.patch');
 const check=spawnSync('git',['apply','--check',patch],{cwd:applied,encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 const apply=spawnSync('git',['apply',patch],{cwd:applied,encoding:'utf8'});assert.equal(apply.status,0,apply.stderr);
 for(const p of report.vendor){cpSync(join(f.output,'candidate/vendor',p.file),join(applied,'vendor',p.file));rmSync(join(applied,'vendor',p.replaces));}
 const next=await propose({...f,current:applied,output:join(f.root,'next-proposal')});
 const result={directlyApplicable:report.directlyApplicable,passedChecks:report.checks.filter(x=>x.status==='passed').length,patchCheck:check.status,patchApply:apply.status,candidateDeletedBaseline:!existsSync(join(f.output,'candidate/.templux/baseline/project',path)),appliedKeepsDeletedBaseline:existsSync(join(applied,'.templux/baseline/project',path)),nextProposalManual:next.manual};
 assert.equal(result.directlyApplicable,true);assert.equal(result.appliedKeepsDeletedBaseline,false);assert.equal(result.nextProposalManual[0].kind,'unsupported-path');assert.equal(report.patchValidation.status,'passed');
 console.log(JSON.stringify(result,null,2));
}finally{rmSync(f.root,{recursive:true,force:true});}
