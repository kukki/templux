import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const base=process.env.TEST_REMOVAL_WEB_URL;assert.ok(base);const database=process.env.TEST_AUTH_DATABASE_URL;assert.ok(database?.endsWith('/templux_auth_test'));
test('physical example removal preserves normal login, protected page, management and audit',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'t10-removal-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const cli=(...args)=>spawnSync(process.execPath,['apps/api/dist/manage.js',...args,'--json','--non-interactive'],{env:{...process.env,DATABASE_URL:database,TEMPLUX_CREDENTIAL_DIR:directory,DEPLOYMENT_ENV:'DEV'},encoding:'utf8'});
 const created=cli('create-person','--username','t10-removal-admin','--name','移除验证管理员','--credential-file','admin.json','--confirm');assert.equal(created.status,0);
 const id=JSON.parse(created.stdout).accountId;assert.equal(cli('authorize','--account',id,'--roles','admin','--confirm').status,0);
 const credentials=JSON.parse(readFileSync(join(directory,'admin.json'),'utf8'));
 assert.equal((await fetch(base+'/login')).status,200);
 const login=await fetch(base+'/api/auth/password',{method:'POST',headers:{Origin:'http://localhost:31040','Content-Type':'application/json'},body:JSON.stringify(credentials)});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const get=path=>fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'});
 assert.equal((await get('/examples')).status,404);
 const account=await get('/account');assert.equal(account.status,200);assert.ok(!(await account.text()).includes('href="/examples"'));
 for(const path of ['/protected','/admin','/audit','/api/admin/accounts','/api/admin/audit'])assert.equal((await get(path)).status,200,path);
 const events=await (await get('/api/admin/audit')).json();assert.ok(events.events.some(x=>x.event==='login_succeeded'&&x.targetId===id));
});
