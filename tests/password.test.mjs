import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,statSync,existsSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../apps/api/dist/database.js';
import {createApplication} from '../apps/api/dist/application.js';
import {readSessionConfig} from '../apps/api/dist/auth-config.js';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;
assert.ok(connectionString,'Explicit isolated test database required.');
test('controlled password identities, normal HTTP sessions and audited CLI use real PostgreSQL',async t=>{
  const pool=new pg.Pool({connectionString});t.after(()=>pool.end());await migrate(pool);
  await pool.query('TRUNCATE templux.password_failures,templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
  const directory=mkdtempSync(join(tmpdir(),'templux-password-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const previous={...process.env};process.env.DEPLOYMENT_ENV='DEV';delete process.env.AGENT_LOGIN_ENABLED;process.env.APP_PUBLIC_URL='http://localhost:31000';
  t.after(()=>{for(const key of Object.keys(process.env)) if(!Object.hasOwn(previous,key)) delete process.env[key];Object.assign(process.env,previous);});
  const app=await createApplication(pool,null);await app.listen({host:'0.0.0.0',port:0});t.after(()=>app.close());
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const cli=(args,extra={})=>spawnSync(process.execPath,['--input-type=module','-e',`process.umask(0o077);process.argv=${JSON.stringify([process.execPath,'apps/api/dist/manage.js',...args,'--non-interactive','--json'])};await import('./apps/api/dist/manage.js');`],{
    env:{...process.env,DATABASE_URL:connectionString,TEMPLUX_CREDENTIAL_DIR:directory,...extra},encoding:'utf8',timeout:15000});
  const secret=file=>JSON.parse(readFileSync(join(directory,file),'utf8'));
  const login=async credentials=>{
    const response=await fetch(base+'/api/auth/password',{method:'POST',headers:{Origin:'http://localhost:31000','Content-Type':'application/json'},body:JSON.stringify(credentials)});
    return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0],body:await response.json()};
  };
  const get=(path,session)=>fetch(base+path,{headers:{Cookie:session.cookie??''}});
  const grant=(id,roles,state='active')=>{const r=cli(['authorize','--account',id,'--roles',roles,'--state',state,'--confirm']);assert.equal(r.status,0,r.stderr);};
  let owner,agent,ordinary,administrator;
  await t.test('server-rendered password form uses POST and cannot put credentials in URL before hydration',async()=>{
    const html=await (await fetch(process.env.TEST_WEB_URL+'/login')).text();assert.match(html,/method="post"/);assert.match(html,/action="\/api\/auth\/password"/);
  });
  await t.test('normal endpoint rejects unknown password without Feishu credentials or database side effects',async()=>{
    assert.equal((await login({username:'missing',password:'invalid-test-value'})).status,401);
    assert.equal((await pool.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count,'0');
    assert.equal((await fetch(base+'/api/auth/password',{method:'POST',headers:{Origin:'http://attacker.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
  });
  await t.test('CLI requires complete arguments/confirmation and creates zero-role person with private random credentials',async()=>{
    const args=['create-person','--username','owner-person','--name','验收责任人','--credential-file','owner.json'];
    assert.notEqual(cli(args).status,0);assert.equal(existsSync(join(directory,'owner.json')),false);
    assert.notEqual(cli(['create-agent','--confirm']).status,0);
    const r=cli([...args,'--confirm'],{TEMPLUX_HOST_UID:'1001',TEMPLUX_HOST_GID:'1001'});assert.equal(r.status,0,r.stderr);owner=JSON.parse(r.stdout).accountId;
    const data=secret('owner.json');assert.equal(data.password.length,43);assert.ok(!r.stdout.includes(data.password)&&!r.stderr.includes(data.password));
    const st=statSync(join(directory,'owner.json'));assert.equal(st.mode&0o777,0o600);assert.equal(st.uid,1001);assert.equal(st.gid,1001);
    const row=(await pool.query('SELECT a.kind,a.state,p.password_hash FROM templux.accounts a JOIN templux.password_credentials p ON p.account_id=a.id WHERE a.id=$1',[owner])).rows[0];
    assert.equal(row.kind,'person');assert.equal(row.state,'active');assert.ok(row.password_hash.startsWith('scrypt-v1$')&&!row.password_hash.includes(data.password));
    assert.equal((await pool.query('SELECT count(*) FROM templux.account_roles WHERE account_id=$1',[owner])).rows[0].count,'0');
  });
  await t.test('existing and symlink files are not overwritten; invalid owner/duplicate username roll back and clean new output',async()=>{
    const before=readFileSync(join(directory,'owner.json'));const count=await pool.query('SELECT count(*) FROM templux.accounts');
    assert.notEqual(cli(['create-person','--username','another','--name','重复文件','--credential-file','owner.json','--confirm']).status,0);
    assert.ok(readFileSync(join(directory,'owner.json')).equals(before));
    symlinkSync(join(directory,'owner.json'),join(directory,'link.json'));
    assert.notEqual(cli(['create-person','--username','another','--name','符号链接','--credential-file','link.json','--confirm']).status,0);
    assert.equal(statSync(join(directory,'link.json')).mode&0o777,0o600);
    for(const args of [ ['create-person','--username','OWNER-PERSON','--name','重复账号','--credential-file','duplicate.json'],['create-agent','--username','bad-owner','--name','无效责任人','--owner','999999','--credential-file','bad-owner.json'] ]) {
      assert.notEqual(cli([...args,'--confirm']).status,0);assert.equal(existsSync(join(directory,args.at(-1))),false);
    }
    assert.equal((await pool.query('SELECT count(*) FROM templux.accounts')).rows[0].count,count.rows[0].count);
  });
  await t.test('Agent creation requires active person owner and starts with no business permission',async()=>{
    const r=cli(['create-agent','--username','qa-agent','--name','验收Agent','--owner',owner,'--credential-file','agent.json','--confirm']);assert.equal(r.status,0,r.stderr);agent=JSON.parse(r.stdout).accountId;
    const credentials=secret('agent.json');assert.ok(!r.stdout.includes(credentials.password)&&!r.stderr.includes(credentials.password));
    const session=await login(credentials);assert.equal(session.status,200);assert.equal((await get('/api/protected',session)).status,403);
    const profile=await (await get('/api/auth/session',session)).json();assert.equal(profile.account.kind,'agent');assert.equal(profile.account.responsiblePersonId,owner);assert.deepEqual(profile.account.roles,[]);
    assert.notEqual(cli(['create-agent','--username','agent-owner','--name','Agent不能负责','--owner',agent,'--credential-file','agent-owner.json','--confirm']).status,0);
  });
  await t.test('real user and explicit admin grants remain distinct and old sessions are rejected',async()=>{
    ordinary=await login(secret('owner.json'));assert.equal(ordinary.status,200);assert.equal((await get('/api/protected',ordinary)).status,403);assert.equal((await get('/api/admin/access',ordinary)).status,403);
    grant(owner,'user');assert.equal((await get('/api/auth/session',ordinary)).status,401);ordinary=await login(secret('owner.json'));assert.equal((await get('/api/protected',ordinary)).status,200);assert.equal((await get('/api/admin/access',ordinary)).status,403);
    grant(agent,'admin,user');administrator=await login(secret('agent.json'));assert.equal((await get('/api/admin/access',administrator)).status,200);
    assert.notEqual(cli(['authorize','--account',agent,'--roles','user','--confirm']).status,0);
    assert.notEqual(cli(['authorize','--account',owner,'--roles','user','--state','disabled','--confirm']).status,0,'Disabling owner cannot strand last effective Agent admin');
    grant(owner,'admin,user');
  });
  await t.test('PROD defaults deny Agent login and existing sessions; explicit enable never grants roles',async()=>{
    process.env.DEPLOYMENT_ENV='PROD';assert.equal((await login(secret('agent.json'))).status,401);assert.equal((await get('/api/protected',administrator)).status,401);
    process.env.AGENT_LOGIN_ENABLED='true';assert.equal((await login(secret('agent.json'))).status,200);
    process.env.AGENT_LOGIN_ENABLED='false';assert.equal((await login(secret('agent.json'))).status,401);
    process.env.DEPLOYMENT_ENV='UAT';delete process.env.AGENT_LOGIN_ENABLED;assert.equal((await login(secret('agent.json'))).status,200);
    process.env.DEPLOYMENT_ENV='DEV';
  });
  await t.test('disabled owner and disabled account reject login and issued sessions',async()=>{
    const backup=cli(['create-person','--username','backup-admin','--name','备用管理员','--credential-file','backup.json','--confirm']);assert.equal(backup.status,0,backup.stderr);grant(JSON.parse(backup.stdout).accountId,'admin');
    grant(owner,'user','disabled');assert.equal((await login(secret('agent.json'))).status,401);assert.equal((await get('/api/protected',administrator)).status,401);
    grant(owner,'admin,user');grant(agent,'user','disabled');assert.equal((await login(secret('agent.json'))).status,401);grant(agent,'user');
  });
  await t.test('Agent independent maximum and idle configuration is honored and restart preserves valid session',async()=>{
    process.env.AGENT_SESSION_MAX_SECONDS='120';process.env.AGENT_IDLE_TIMEOUT_SECONDS='60';
    const session=await login(secret('agent.json'));assert.equal(session.status,200);
    const row=(await pool.query("SELECT extract(epoch FROM expires_at-created_at)::int AS duration FROM templux.auth_sessions WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1",[agent])).rows[0];assert.equal(row.duration,120);
    const restarted=await createApplication(pool,null);t.after(()=>restarted.close());assert.equal((await restarted.inject({url:'/api/protected',headers:{cookie:session.cookie}})).statusCode,200);
    await pool.query("UPDATE templux.auth_sessions SET last_active_at=now()-interval '61 seconds' WHERE account_id=$1",[agent]);assert.equal((await get('/api/protected',session)).status,401);
    delete process.env.AGENT_SESSION_MAX_SECONDS;delete process.env.AGENT_IDLE_TIMEOUT_SECONDS;
  });
  await t.test('Agent password reset uses a new private file and invalidates all old sessions',async()=>{
    const old=await login(secret('agent.json'));const r=cli(['reset-agent','--account',agent,'--credential-file','agent-reset.json','--confirm']);assert.equal(r.status,0,r.stderr);
    assert.equal((await login(secret('agent.json'))).status,401);assert.equal((await get('/api/auth/session',old)).status,401);assert.equal((await login(secret('agent-reset.json'))).status,200);
    assert.notEqual(cli(['reset-agent','--account',owner,'--credential-file','person-reset.json','--confirm']).status,0);assert.equal(existsSync(join(directory,'person-reset.json')),false);
  });
  await t.test('management audit failure rolls back account/credential and removes new secret file',async()=>{
    await pool.query("CREATE FUNCTION templux.fail_password_management() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='password_account_created' OR NEW.event='agent_password_reset' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER fail_password_management BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.fail_password_management()');
    try {
      assert.notEqual(cli(['create-person','--username','audit-failed','--name','审计故障','--credential-file','audit-failed.json','--confirm']).status,0);assert.equal(existsSync(join(directory,'audit-failed.json')),false);
      assert.equal((await pool.query("SELECT count(*) FROM templux.password_credentials WHERE username='audit-failed'")).rows[0].count,'0');
      const r=cli(['reset-agent','--account',agent,'--credential-file','audit-reset.json','--confirm']);assert.notEqual(r.status,0);assert.equal(existsSync(join(directory,'audit-reset.json')),false);assert.equal((await login(secret('agent-reset.json'))).status,200);
    } finally {await pool.query('DROP TRIGGER fail_password_management ON templux.audit_events;DROP FUNCTION templux.fail_password_management()');}
  });
  await t.test('uncertain commit retains private output for reconciliation without claiming success',async()=>{
    await pool.query("CREATE FUNCTION templux.fail_password_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='password_account_created' THEN RAISE EXCEPTION 'test deferred audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE CONSTRAINT TRIGGER fail_password_commit AFTER INSERT ON templux.audit_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION templux.fail_password_commit()');
    try {
      const result=cli(['create-person','--username','commit-failed','--name','提交未确认','--credential-file','commit-failed.json','--confirm']);assert.notEqual(result.status,0);assert.match(result.stdout,/提交结果未确认/);
      assert.equal(existsSync(join(directory,'commit-failed.json')),true);assert.equal(statSync(join(directory,'commit-failed.json')).mode&0o777,0o600);
      assert.ok(!result.stdout.includes(secret('commit-failed.json').password)&&!result.stderr.includes(secret('commit-failed.json').password));
      assert.equal((await pool.query("SELECT count(*) FROM templux.password_credentials WHERE username='commit-failed'")).rows[0].count,'0');
    } finally {await pool.query('DROP TRIGGER fail_password_commit ON templux.audit_events;DROP FUNCTION templux.fail_password_commit()');}
  });
  await t.test('successful-login audit-only fault allows session; unavailable database never authenticates',async()=>{
    await pool.query("CREATE FUNCTION templux.fail_password_login() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='login_succeeded' AND NEW.source='password' THEN RAISE EXCEPTION 'test login audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER fail_password_login BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.fail_password_login()');
    try {const session=await login(secret('owner.json'));assert.equal(session.status,200);assert.equal((await get('/api/protected',session)).status,200);} finally {await pool.query('DROP TRIGGER fail_password_login ON templux.audit_events;DROP FUNCTION templux.fail_password_login()');}
    const deadPool=new pg.Pool({connectionString:'postgresql://invalid:invalid@127.0.0.1:1/isolated',connectionTimeoutMillis:200});const dead=await createApplication(deadPool,null);t.after(async()=>{await dead.close();await deadPool.end();});
    const response=await dead.inject({method:'POST',url:'/api/auth/password',headers:{origin:'http://localhost:31000'},payload:secret('owner.json')});assert.equal(response.statusCode,503);assert.equal(response.headers['set-cookie'],undefined);
    const auditText=JSON.stringify((await pool.query('SELECT source,event,details FROM templux.audit_events')).rows);for(const file of ['owner.json','agent.json','agent-reset.json']) assert.ok(!auditText.includes(secret(file).password));
  });
  await t.test('invalid security settings fail closed and frontend endpoint has no registration route',async()=>{
    process.env.DEPLOYMENT_ENV='TYPO';assert.throws(()=>readSessionConfig());process.env.DEPLOYMENT_ENV='PROD';process.env.AGENT_LOGIN_ENABLED='yes';assert.throws(()=>readSessionConfig());delete process.env.AGENT_LOGIN_ENABLED;
    assert.equal((await fetch(base+'/api/auth/register',{method:'POST'})).status,404);
  });
});
