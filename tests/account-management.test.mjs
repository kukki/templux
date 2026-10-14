import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRoles} from '../apps/api/dist/auth-config.js';
import {migrate} from '../apps/api/dist/database.js';
import {createApplication} from '../apps/api/dist/application.js';
import {hashPassword} from '../apps/api/dist/password.js';
import {authorizationLock} from '../apps/api/dist/auth-store.js';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;assert.ok(connectionString?.endsWith('/templux_auth_test'));
test('T06 real account management SQL/HTTP/CLI contract',async t=>{
 const pool=new pg.Pool({connectionString});t.after(()=>pool.end());await migrate(pool);
 await pool.query('TRUNCATE templux.login_method_requests,templux.password_failures,templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
 const previous={...process.env};process.env.DEPLOYMENT_ENV='DEV';process.env.APP_PUBLIC_URL='http://localhost:31000';delete process.env.AGENT_LOGIN_ENABLED;
 t.after(()=>{for(const k of Object.keys(process.env))if(!Object.hasOwn(previous,k))delete process.env[k];Object.assign(process.env,previous);});
 const password=randomBytes(32).toString('base64url');const hash=await hashPassword(password);
 const create=async(name,roles=[],kind='person',owner=null)=>{const id=(await pool.query('INSERT INTO templux.accounts(display_name,state,kind,responsible_person_id) VALUES($1,\'active\',$2,$3) RETURNING id',[name,kind,owner])).rows[0].id;await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash) VALUES($1,$2,$3)',[id,`manage-${id}`,hash]);for(const role of roles)await pool.query('INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,$2)',[id,role]);return id;};
 const admin=await create('Management admin',['admin']),backup=await create('Backup admin',['admin']),user=await create('Ordinary user',['user']),zero=await create('Zero roles'),agent=await create('Managed Agent',[],'agent',user);
 const app=await createApplication(pool,null);await app.listen({host:'0.0.0.0',port:0});t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
 const login=async id=>{const r=await fetch(base+'/api/auth/password',{method:'POST',headers:{Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({username:`manage-${id}`,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const get=(cookie,path='/api/admin/accounts')=>fetch(base+path,{headers:{Cookie:cookie??''}});
 const version=async id=>(await pool.query('SELECT auth_version FROM templux.accounts WHERE id=$1',[id])).rows[0].auth_version;
 const change=async(cookie,id,roles,state='active',extra={})=>fetch(base+`/api/admin/accounts/${id}/authorization`,{method:'POST',headers:{Cookie:cookie??'',Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({roles,state,expectedVersion:await version(id),confirm:true,...extra})});
 const cli=(id,roles,state='active')=>new Promise(resolve=>{const child=spawn(process.execPath,['apps/api/dist/manage.js','authorize','--account',id,'--roles',roles,'--state',state,'--confirm','--non-interactive','--json'],{env:{...process.env,DATABASE_URL:connectionString}});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('close',code=>resolve({code,out,err}));});
 await t.test('anonymous, ordinary and zero-role APIs deny access and cannot change accounts',async()=>{
  assert.equal((await get()).status,401);for(const id of [user,zero]){const c=await login(id);assert.equal((await get(c)).status,403);assert.equal((await change(c,agent,['user'])).status,403);}assert.equal((await change(null,agent,['admin'])).status,401);
 });
 await t.test('administrator queries identities, responsibility, roles, bounded pagination and literal search',async()=>{
  const r=await get(await login(admin),' /api/admin/accounts'.trim()+'?q=Managed&pageSize=5');assert.equal(r.status,200);const body=await r.json();assert.equal(body.total,1);assert.equal(body.accounts[0].id,agent);assert.equal(body.accounts[0].kind,'agent');assert.equal(body.accounts[0].responsiblePersonName,'Ordinary user');assert.deepEqual(body.accounts[0].roles,[]);assert.ok(body.roles.admin);assert.equal(JSON.stringify(body).includes(hash),false);
  assert.equal((await get(await login(admin),'/api/admin/accounts?pageSize=100000')).status,400);assert.equal((await get(await login(admin),'/api/admin/accounts?actor=spoof')).status,400);assert.equal((await (await get(await login(admin),'/api/admin/accounts?q=%25')).json()).total,0);
 });
 await t.test('origin, explicit confirmation, strict schema, version conflict and missing target do not commit',async()=>{
  const c=await login(admin),v=await version(agent);assert.equal((await change(c,agent,['user'],'active',{confirm:false})).status,400);assert.equal((await change(c,agent,['user'],'active',{actor:'spoof'})).status,400);assert.equal((await change(c,agent,['user'],'active',{expectedVersion:'999'})).status,409);
  const r=await fetch(base+`/api/admin/accounts/${agent}/authorization`,{method:'POST',headers:{Cookie:c,Origin:'https://other.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);assert.equal(await version(agent),v);
  assert.equal((await fetch(base+'/api/admin/accounts/9999999999999999999/authorization',{method:'POST',headers:{Cookie:c,Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({roles:[],state:'active',confirm:true,expectedVersion:'1'})})).status,400);
  assert.equal((await fetch(base+'/api/admin/accounts/999999/authorization',{method:'POST',headers:{Cookie:c,Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({roles:[],state:'active',confirm:true,expectedVersion:'1'})})).status,404);
 });
 await t.test('grant union then zero-role and disable commit audit and invalidate old sessions',async()=>{
  const c=await login(admin),old=await login(agent);let r=await change(c,agent,['user','admin']);assert.equal(r.status,200);assert.equal((await r.json()).selfChanged,false);assert.equal((await get(old,'/api/protected')).status,401);assert.equal((await get(await login(agent),'/api/admin/access')).status,200);
  const audit=(await pool.query("SELECT source,actor,details FROM templux.audit_events WHERE event='authorization_changed' AND account_id=$1 ORDER BY id DESC LIMIT 1",[agent])).rows[0];assert.equal(audit.source,'password');assert.equal(audit.actor,`account:${admin}`);assert.deepEqual(audit.details.after.roles,['user','admin']);
  assert.equal((await change(c,agent,[])).status,200);assert.equal((await get(await login(agent),'/api/protected')).status,403);assert.equal((await change(c,agent,[],'disabled')).status,200);
  assert.equal((await change(c,agent,[])).status,200);
 });
 await t.test('required audit failure rolls back state, roles and version without success or deleting cookie',async()=>{
  const c=await login(admin),v=await version(user);await pool.query("CREATE FUNCTION templux.t06_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='authorization_changed' THEN RAISE EXCEPTION 'isolated fault'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER t06_fail_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.t06_fail_audit()');
  try{const r=await change(c,user,[],'disabled');assert.equal(r.status,503);assert.equal((await r.json()).error,'management_save_failed');assert.equal(r.headers.get('set-cookie'),null);assert.equal(await version(user),v);assert.equal((await get(await login(user),'/api/protected')).status,200);}finally{await pool.query('DROP TRIGGER t06_fail_audit ON templux.audit_events;DROP FUNCTION templux.t06_fail_audit()');}
 });
 await t.test('actor is revalidated after concurrent authorization commit, before target mutation',async()=>{
  const c=await login(admin),v=await version(agent),writer=await pool.connect();await writer.query('BEGIN');await authorizationLock(writer);await writer.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[admin]);
  const pending=change(c,agent,['admin']);let blocked=false;for(let i=0;i<100&&!blocked;i++){blocked=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS blocked")).rows[0].blocked;await new Promise(r=>setTimeout(r,5));}await writer.query('COMMIT');writer.release();assert.equal(blocked,true);const r=await pending;assert.equal(r.status,401);assert.equal((await r.json()).error,'authorization_changed');assert.equal(await version(agent),v);
 });
 await t.test('project mutually exclusive predefined roles share Web/CLI enforcement and validate configuration',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'t06-roles-'));const path=join(directory,'roles.json');const definitions=JSON.parse(readFileSync('config/roles.json','utf8'));definitions.roles.auditor={label:'审计人员',permissions:['audit:read'],excludes:['user']};writeFileSync(path,JSON.stringify(definitions));process.env.TEMPLUX_ROLE_CONFIG_PATH=path;
  try{
   const roleApp=await createApplication(pool,null);await roleApp.listen({host:'127.0.0.1',port:0});const roleBase=`http://127.0.0.1:${roleApp.server.address().port}`;
   try{const cookie=await login(admin);const send=async roles=>fetch(roleBase+`/api/admin/accounts/${agent}/authorization`,{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({roles,state:'active',confirm:true,expectedVersion:await version(agent)})});
    const v=await version(agent);assert.equal((await send(['user','auditor'])).status,409);assert.equal((await cli(agent,'user,auditor')).code,1);assert.equal(await version(agent),v);
    assert.equal((await send(['admin','auditor'])).status,200);const r=await fetch(roleBase+'/api/admin/access',{headers:{Cookie:await login(agent)}});assert.equal(r.status,200);const permissions=(await r.json()).account.permissions;assert.ok(permissions.includes('audit:read'));assert.ok(permissions.includes('accounts:manage'));
    assert.equal((await send([])).status,200);
   }finally{await roleApp.close();}
   for(const excludes of [['unknown'],['auditor'],['user','user'],'user']){definitions.roles.auditor.excludes=excludes;writeFileSync(path,JSON.stringify(definitions));assert.throws(()=>readRoles());}
  }finally{delete process.env.TEMPLUX_ROLE_CONFIG_PATH;rmSync(directory,{recursive:true,force:true});}
 });
 await t.test('normal Feishu first login is Pending; Web approval invalidates it and fresh login gets business access',async()=>{
  const config={appId:'t06-isolated-app',appSecret:'isolated-protocol-only',tenantKey:'t06-tenant',redirectUri:'http://localhost:31000/api/auth/feishu/callback',publicOrigin:process.env.APP_PUBLIC_URL,secure:false,idleSeconds:600,maximumSeconds:43200};
  const transport=async url=>url.endsWith('/token')?Response.json({code:0,access_token:'isolated-remote-response',token_type:'Bearer',expires_in:7200}):Response.json({code:0,data:{name:'T06 Pending person',open_id:'t06-person',tenant_key:config.tenantKey}});
  const feishu=await createApplication(pool,config,transport);await feishu.listen({host:'127.0.0.1',port:0});const origin=`http://127.0.0.1:${feishu.server.address().port}`;
  const enter=async()=>{const start=await fetch(origin+'/api/auth/feishu/start',{redirect:'manual'});const state=new URL(start.headers.get('location')).searchParams.get('state');const response=await fetch(origin+`/api/auth/feishu/callback?state=${state}&code=isolated-code`,{redirect:'manual',headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}});assert.equal(response.status,302);return response.headers.getSetCookie().find(value=>value.startsWith('templux_session=')).split(';')[0];};
  try{const cookie=await enter();const profile=await (await fetch(origin+'/api/auth/session',{headers:{Cookie:cookie}})).json();assert.equal(profile.account.state,'pending');assert.deepEqual(profile.account.roles,[]);assert.equal((await fetch(origin+'/api/protected',{headers:{Cookie:cookie}})).status,403);
   const r=await fetch(origin+`/api/admin/accounts/${profile.account.id}/authorization`,{method:'POST',headers:{Cookie:await login(admin),Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({roles:['user'],state:'active',confirm:true,expectedVersion:profile.account.authVersion})});assert.equal(r.status,200);assert.equal((await fetch(origin+'/api/protected',{headers:{Cookie:cookie}})).status,401);assert.equal((await fetch(origin+'/api/protected',{headers:{Cookie:await enter()}})).status,200);
  }finally{await feishu.close();}
 });
 await t.test('web and CLI concurrently demote two admins; only one commits and self response requires re-login',async()=>{
  const c=await login(admin);const [web,command]=await Promise.all([change(c,admin,['user']),cli(backup,'user')]);assert.equal(Number(web.status===200)+Number(command.code===0),1);
  const count=(await pool.query("SELECT count(*) FROM templux.accounts a JOIN templux.account_roles r ON r.account_id=a.id WHERE a.state='active' AND r.role_key='admin'")).rows[0].count;assert.equal(count,'1');
  if(web.status===200){assert.equal((await web.json()).selfChanged,true);assert.equal((await get(c)).status,401);}else assert.equal(web.status,409);
  const survivor=web.status===200?backup:admin;assert.equal((await change(await login(survivor),survivor,[],'disabled')).status,409);
  assert.equal((await cli(admin,'admin')).code,0);assert.equal((await cli(backup,'admin')).code,0);
 });
 await t.test('concurrent Web disable and CLI disable preserve one effective admin',async()=>{
  const c=await login(admin);const [web,command]=await Promise.all([change(c,admin,[],'disabled'),cli(backup,'','disabled')]);assert.equal(Number(web.status===200)+Number(command.code===0),1);
  const result=(await pool.query("SELECT count(*) FROM templux.accounts a JOIN templux.account_roles r ON r.account_id=a.id WHERE a.state='active' AND r.role_key='admin'")).rows[0].count;assert.equal(result,'1');
  assert.equal((await cli(admin,'admin')).code,0);assert.equal((await cli(backup,'admin')).code,0);
 });
 await t.test('list pages have independent slices, clamp past the last page and reject negative pages',async()=>{
  const c=await login(admin);const first=await (await get(c,'/api/admin/accounts?pageSize=5&page=1')).json();const last=await (await get(c,'/api/admin/accounts?pageSize=5&page=2')).json();assert.equal(first.accounts.length,5);assert.equal(last.accounts.length,1);assert.equal(last.pages,2);assert.equal(new Set([...first.accounts,...last.accounts].map(account=>account.id)).size,6);
  const clamped=await (await get(c,'/api/admin/accounts?pageSize=5&page=999')).json();assert.equal(clamped.page,2);assert.deepEqual(clamped.accounts.map(a=>a.id),last.accounts.map(a=>a.id));assert.equal((await get(c,'/api/admin/accounts?page=-1')).status,400);
 });
 await t.test('CLI bootstrap from zero effective administrators remains available',async()=>{
  await pool.query("DELETE FROM templux.account_roles WHERE role_key='admin'");assert.equal((await cli(admin,'admin')).code,0);assert.equal((await get(await login(admin))).status,200);
 });

});
