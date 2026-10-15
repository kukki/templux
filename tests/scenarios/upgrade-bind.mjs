// Run in the standard management image with the checkout mounted at /workspace.
// Real Compose interpolation; Docker operations are replaced only at the process seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const project=process.env.TEST_UPGRADE_PROJECT_DIR??'/workspace';
const env={...process.env,TEMPLUX_PROJECT_NAME:'t24-bind-test',TEMPLUX_PROJECT_DIR:project};
const config=e=>{
 const r=spawnSync('/usr/local/bin/docker',['compose','--env-file','/dev/null','--profile','tools','--project-directory',project,'-f',join(project,'compose.yaml'),'config','--format','json'],{env:e,encoding:'utf8'});
 assert.equal(r.status,0,'Compose render failed; full config intentionally withheld');return JSON.parse(r.stdout);
};
test('management projects the host backup bind separately from its container tool path',()=>{
 for(const path of ['/host/approved backups','./approved backups']){
  const c=config({...env,TEMPLUX_BACKUP_DIR:path});
  assert.equal(c.services.management.environment.TEMPLUX_BACKUP_DIR,'/opt/templux/backups');
  assert.equal(c.services.management.environment.TEMPLUX_BACKUP_BIND_DIR,path);
 }
});
for(const path of ['/host/approved backups','./approved backups'])test(`start keeps the approved backup bind through nested Compose: ${path}`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'t24-compose-'));
 try{
  writeFileSync(join(dir,'docker'),`#!/usr/local/bin/node
const{spawnSync}=require('node:child_process');
const r=spawnSync('/usr/local/bin/docker',['compose','--env-file','/dev/null','--profile','tools','--project-directory',process.env.TEMPLUX_PROJECT_DIR,'-f',process.env.TEMPLUX_PROJECT_DIR+'/compose.yaml','config','--format','json'],{encoding:'utf8',env:process.env});
if(r.status!==0)process.exit(51);
const c=JSON.parse(r.stdout);for(const name of ['migrate','management'])console.log('BACKUP_BIND='+JSON.stringify(c.services[name].volumes.find(v=>v.target==='/opt/templux/backups').source));
`,{mode:0o755});
  const r=spawnSync(process.execPath,['apps/api/dist/manage.js','start','--json'],{env:{...env,PATH:dir+':'+process.env.PATH,DATABASE_URL:'',TEMPLUX_BACKUP_DIR:'/opt/templux/backups',TEMPLUX_BACKUP_BIND_DIR:path},encoding:'utf8',timeout:20000});
  assert.equal(r.status,0,r.stdout);assert.equal(JSON.parse(r.stdout).ok,true);
  const sources=r.stderr.split('\n').filter(v=>v.startsWith('BACKUP_BIND=')).map(v=>JSON.parse(v.slice(12)));
  assert.ok(sources.length>0,'real Compose render must be observed');
  for(const source of sources)assert.equal(source,resolve(project,path));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
