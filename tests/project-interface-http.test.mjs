import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {createProjectApplication,changeProjectAccess} from '../apps/api/dist/project-interface.js';import {migrate} from '../apps/api/dist/database.js';
test('public project routes use real passwords, transaction rollback, scope and post-lock live authorization',async t=>{
 const url=process.env.TEST_AUTH_DATABASE_URL;assert.ok(url?.endsWith('/templux_auth_test'));const admin=new pg.Pool({connectionString:url});t.after(()=>admin.end());const name='t25_project_http';await admin.query(`CREATE DATABASE ${name}`);const u=new URL(url);u.pathname='/'+name;const pool=new pg.Pool({connectionString:u.toString()});
 const dir=mkdtempSync(join(tmpdir(),'t25-http-'));let app;
 try{
  await migrate(pool);await pool.query('CREATE TABLE public.business_probe(value text)');
  Object.assign(process.env,{DATABASE_URL:u.toString(),APP_PUBLIC_URL:'http://localhost:31525',TEMPLUX_CREDENTIAL_DIR:dir,PASSWORD_PROXY_HOSTS:'',DEPLOYMENT_ENV:'DEV',TEMPLUX_MAINTENANCE_RELEASE_FILE:join(dir,'release.json')});
  const cli=(args)=>{const r=spawnSync(process.execPath,['apps/api/dist/manage.js',...args,'--confirm','--json'],{env:process.env,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stdout);return JSON.parse(r.stdout);};
  const person=cli(['create-person','--username','t25.http','--name','Synthetic HTTP person','--credential-file','person.json']);cli(['authorize','--account',person.accountId,'--roles','user']);const credential=JSON.parse(readFileSync(join(dir,'person.json'),'utf8'));
  app=await createProjectApplication(pool,{routes:[
   {method:'GET',path:'/api/business/data',permission:'application:read',scope:async({query})=>(query??{}).deny!=='1',handle:({account})=>({ok:true,id:account.id})},
   {method:'POST',path:'/api/business/fail',permission:'application:read',handle:async({client})=>{await client.query("INSERT INTO public.business_probe VALUES('must rollback')");throw new Error('private handler diagnostic');}},
   {method:'POST',path:'/api/business/save',permission:'application:read',handle:async({client})=>{await client.query("INSERT INTO public.business_probe VALUES('committed')");return {ok:true};}}
  ]});
  const address=await app.listen({host:'0.0.0.0',port:0});
  const call=(path,options={})=>fetch(address+path,options);
  assert.equal((await call('/api/business/data')).status,401);
  const login=await call('/api/auth/password',{method:'POST',headers:{Origin:'http://localhost:31525','Content-Type':'application/json'},body:JSON.stringify({username:credential.username,password:credential.password})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().find(v=>v.startsWith('templux_session=')).split(';')[0],headers={Cookie:cookie,Origin:'http://localhost:31525'};
  assert.equal((await call('/api/business/data',{headers})).status,200);assert.equal((await call('/api/business/data?deny=1',{headers})).status,403);
  assert.equal((await call('/api/business/save',{method:'POST',headers:{Cookie:cookie,Origin:'http://evil.invalid'}})).status,403);
  const failed=await call('/api/business/fail',{method:'POST',headers});assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private handler diagnostic'),false);assert.equal((await pool.query('SELECT count(*) FROM public.business_probe')).rows[0].count,'0');
  assert.equal((await call('/api/business/save',{method:'POST',headers})).status,200);assert.equal((await pool.query('SELECT count(*) FROM public.business_probe')).rows[0].count,'1');
  await assert.rejects(changeProjectAccess(pool,person.accountId,{source:'cli',actor:'isolated-host'},async client=>{await client.query("INSERT INTO public.business_probe VALUES('rollback scope')");throw new Error('scope failed');}));assert.equal((await pool.query('SELECT count(*) FROM public.business_probe')).rows[0].count,'1');
  const version=(await pool.query('SELECT auth_version FROM templux.accounts WHERE id=$1',[person.accountId])).rows[0].auth_version;
  await pool.query("CREATE FUNCTION public.t25_fail_scope_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='scope_access_invalidated' THEN RAISE EXCEPTION 'isolated scope audit failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER t25_fail_scope_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION public.t25_fail_scope_audit()");
  await assert.rejects(changeProjectAccess(pool,person.accountId,{source:'cli',actor:'isolated-host'},async client=>{await client.query("INSERT INTO public.business_probe VALUES('scope must rollback')");}));
  assert.equal((await pool.query('SELECT auth_version FROM templux.accounts WHERE id=$1',[person.accountId])).rows[0].auth_version,version);assert.equal((await pool.query('SELECT count(*) FROM public.business_probe')).rows[0].count,'1');
  await pool.query('DROP TRIGGER t25_fail_scope_audit ON templux.audit_events;DROP FUNCTION public.t25_fail_scope_audit()');
  const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query("SELECT pg_advisory_xact_lock(hashtext('templux:authorization'))");const waiting=call('/api/business/data',{headers});
  for(let i=0;i<100;i++){if((await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS waiting")).rows[0].waiting)break;await new Promise(r=>setTimeout(r,10));}
  assert.equal((await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS waiting")).rows[0].waiting,true);
  await blocker.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[person.accountId]);await blocker.query('COMMIT');blocker.release();assert.equal((await waiting).status,401);
  assert.equal((await call('/api/fixture-authorize')).status,404);
 }finally{await app?.close();await pool.end();rmSync(dir,{recursive:true,force:true});for(let i=0;i<100;i++){if(!(await admin.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=$1) busy',[name])).rows[0].busy)break;await new Promise(r=>setTimeout(r,10));}await admin.query(`DROP DATABASE ${name}`);}
});
