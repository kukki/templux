import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../apps/api/dist/database.js';
import { createApplication } from '../apps/api/dist/application.js';
import { setAuthorization } from '../apps/api/dist/authorization.js';
import { readAuthConfig } from '../apps/api/dist/auth-config.js';
import { exchangeIdentity } from '../apps/api/dist/feishu.js';

const connectionString = process.env.TEST_AUTH_DATABASE_URL;
assert.ok(connectionString, 'Run the container auth-database test entry; production database is never a fallback.');
const config = { appId:'fixture-app', appSecret:'fixture-secret-marker', tenantKey:'allowed-tenant',
  redirectUri:'http://localhost:31000/api/auth/feishu/callback', publicOrigin:'http://localhost:31000', secure:false, idleSeconds:600, maximumSeconds:43200 };
const hash = value => createHash('sha256').update(value).digest('hex');

test('Feishu OAuth, authorization and audit use real isolated PostgreSQL', async t => {
  const pool = new pg.Pool({connectionString});
  t.after(() => pool.end());
  await migrate(pool);
  await pool.query('TRUNCATE templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
  const authKeys=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_TENANT_KEY','FEISHU_ALLOWED_TENANT_KEY','APP_PUBLIC_URL'];
  const original=Object.fromEntries(authKeys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{FEISHU_APP_ID:config.appId,FEISHU_APP_SECRET:config.appSecret,FEISHU_TENANT_KEY:config.tenantKey,APP_PUBLIC_URL:config.publicOrigin});
  delete process.env.FEISHU_ALLOWED_TENANT_KEY;
  t.after(()=>{for(const key of authKeys) {if(original[key]===undefined) delete process.env[key];else process.env[key]=original[key];}});
  const directory = mkdtempSync(join(tmpdir(),'templux-auth-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  const rolePath = join(directory,'roles.json');
  const roleFile = JSON.parse(readFileSync('config/roles.json'));
  roleFile.roles.auditor = {label:'审计人员',permissions:['audit:read']};
  writeFileSync(rolePath,JSON.stringify(roleFile));
  const definitions = roleFile.roles;
  const previousRolePath = process.env.TEMPLUX_ROLE_CONFIG_PATH;
  process.env.TEMPLUX_ROLE_CONFIG_PATH = rolePath;
  let subject = 'person-a'; let tenant = config.tenantKey; let malformed = false; let exchanges = 0;
  const fakeProtocol = async (url, init) => {
    if (url === 'https://accounts.feishu.cn/oauth/v3/token') {
      exchanges++;
      assert.equal(init.headers['Content-Type'],'application/x-www-form-urlencoded');
      const body = Object.fromEntries(new URLSearchParams(init.body));
      assert.equal(body.client_id,config.appId); assert.equal(body.client_secret,config.appSecret);
      assert.equal(body.grant_type,'authorization_code'); assert.equal(body.redirect_uri,config.redirectUri);
      assert.equal(body.code_verifier,undefined);
      return Response.json({code:0,access_token:'fixture-runtime-token-marker',token_type:'Bearer',expires_in:7200});
    }
    assert.equal(url,'https://open.feishu.cn/open-apis/authen/v1/user_info');
    assert.equal(init.headers.Authorization,'Bearer fixture-runtime-token-marker');
    return Response.json({code:0,data:{name:'测试人员',open_id:subject,...(malformed?{}:{tenant_key:tenant})}});
  };
  const app = await createApplication(pool,config,fakeProtocol);
  if (previousRolePath === undefined) delete process.env.TEMPLUX_ROLE_CONFIG_PATH; else process.env.TEMPLUX_ROLE_CONFIG_PATH = previousRolePath;
  await app.listen({host:'127.0.0.1',port:0});
  t.after(() => app.close());
  const address = app.server.address(); const base = `http://127.0.0.1:${address.port}`;
  const get = (path, cookie) => fetch(base+path,{redirect:'manual',headers:cookie?{Cookie:cookie}:{}});
  async function start() {
    const response = await get('/api/auth/feishu/start'); assert.equal(response.status,302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.origin,'https://accounts.feishu.cn'); assert.equal(url.searchParams.get('response_type'),'code');
    assert.equal(url.searchParams.has('code_challenge'),false);
    assert.equal(url.searchParams.has('code_challenge_method'),false);
    const state=url.searchParams.get('state');
    const cookie=response.headers.getSetCookie().find(v=>v.startsWith('templux_oauth=')).split(';')[0];
    assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
    return {state,cookie};
  }
  async function login() {
    const flow=await start(); const callback=`/api/auth/feishu/callback?state=${flow.state}&code=fixture-code-marker`;
    const response=await get(callback,flow.cookie);
    const session=response.headers.getSetCookie().find(v=>v.startsWith('templux_session='));
    return {response,cookie:session?.split(';')[0],flow,callback};
  }
  let first; let accountId;
  await t.test('missing credentials disable auth routes and tenant aliases reject conflicting configuration',async()=>{
    const unavailable=await createApplication(pool,null,fakeProtocol); t.after(()=>unavailable.close());
    assert.deepEqual((await unavailable.inject({url:'/api/auth/config'})).json(),{enabled:false});
    assert.equal((await unavailable.inject({url:'/api/auth/feishu/start'})).statusCode,503);
    assert.equal((await unavailable.inject({url:'/api/protected'})).statusCode,401);
    const keys=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_TENANT_KEY','FEISHU_ALLOWED_TENANT_KEY','FEISHU_REDIRECT_URI','APP_PUBLIC_URL'];
    const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
    try {
      Object.assign(process.env,{FEISHU_APP_ID:'fixture-id',FEISHU_APP_SECRET:'fixture-secret',FEISHU_TENANT_KEY:'alias-tenant',APP_PUBLIC_URL:'http://localhost:31000'});
      delete process.env.FEISHU_ALLOWED_TENANT_KEY; delete process.env.FEISHU_REDIRECT_URI;
      assert.equal(readAuthConfig().tenantKey,'alias-tenant');
      assert.equal(readAuthConfig().redirectUri,'http://localhost:31000/api/auth/feishu/callback');
      process.env.FEISHU_ALLOWED_TENANT_KEY='conflicting-tenant';
      assert.throws(()=>readAuthConfig(),/冲突/);
      delete process.env.FEISHU_APP_SECRET;
      delete process.env.FEISHU_ALLOWED_TENANT_KEY;
      assert.equal(readAuthConfig(),null);
    } finally { for(const key of keys) if(prior[key]===undefined) delete process.env[key]; else process.env[key]=prior[key]; }
  });
  await t.test('provider failures expose only allowlisted diagnostic metadata',async()=>{
    await assert.rejects(exchangeIdentity(config,'test-code',async()=>Response.json({code:20002,error_description:'fixture-secret-marker'},{status:400})),error=>{
      assert.equal(error.reason,'provider_rejected');
      assert.deepEqual(error.diagnosis,{stage:'token',httpStatus:400,providerCode:20002});
      assert.doesNotMatch(JSON.stringify(error),/fixture-secret-marker/); return true;
    });
  });
  await t.test('state requires browser binding, is single use and rejects tampering before exchange',async()=>{
    const flow=await start(); const before=exchanges;
    assert.match((await get(`/api/auth/feishu/callback?state=${flow.state}&code=x`)).headers.get('location'),/invalid_state/);
    assert.equal(exchanges,before);
    const valid=await get(`/api/auth/feishu/callback?state=${flow.state}&code=x`,flow.cookie);
    assert.equal(valid.headers.get('location'),'/account');
    assert.match((await get(`/api/auth/feishu/callback?state=${flow.state}&code=x`,flow.cookie)).headers.get('location'),/invalid_state/);
  });
  await t.test('first verified login is Pending and cannot access protected data',async()=>{
    first=await login(); assert.equal(first.response.headers.get('location'),'/account');
    const profile=await (await get('/api/auth/session',first.cookie)).json();
    assert.equal(profile.account.state,'pending'); assert.deepEqual(profile.account.roles,[]); accountId=profile.account.id;
    const denied=await get('/api/protected',first.cookie); assert.equal(denied.status,403);
    assert.equal((await denied.json()).error,'pending_authorization');
    assert.equal((await pool.query('SELECT count(*) FROM templux.identities')).rows[0].count,'1');
    assert.equal((await pool.query('SELECT count(*) FROM templux.accounts')).rows[0].count,'1');
  });
  await t.test('wrong/missing organization never registers an account or session',async()=>{
    const count=(await pool.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count;
    subject='other-person'; tenant='other-tenant';
    const wrong=await login(); assert.equal(wrong.cookie,undefined); assert.match(wrong.response.headers.get('location'),/organization_denied/);
    tenant=config.tenantKey; malformed=true;
    const missing=await login(); assert.equal(missing.cookie,undefined); assert.match(missing.response.headers.get('location'),/provider_invalid/);
    malformed=false; subject='person-a';
    assert.equal((await pool.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count,count);
    assert.equal((await pool.query('SELECT count(*) FROM templux.accounts')).rows[0].count,'1');
  });
  await t.test('host CLI requires confirmation and grants first administrator with reliable audit',async()=>{
    const args=['apps/api/dist/manage.js','authorize','--account',accountId,'--roles','admin,user','--non-interactive','--json'];
    const env={...process.env,DATABASE_URL:connectionString,TEMPLUX_ROLE_CONFIG_PATH:rolePath};
    const missing=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:3000}); assert.equal(missing.status,1);
    const grant=spawnSync(process.execPath,[...args,'--confirm'],{env,encoding:'utf8',timeout:3000});
    assert.equal(grant.status,0,grant.stderr); assert.equal(JSON.parse(grant.stdout).accountId,accountId);
    const audit=(await pool.query("SELECT source,details FROM templux.audit_events WHERE event='authorization_changed' AND account_id=$1",[accountId])).rows[0];
    assert.equal(audit.source,'cli'); assert.deepEqual(audit.details.after.roles,['admin','user']);
    assert.equal((await get('/api/protected',first.cookie)).status,401);
  });
  let active;
  await t.test('reauthentication grants protected access, permissions union and persistent hashed sessions',async()=>{
    active=await login(); const response=await get('/api/protected',active.cookie); assert.equal(response.status,200);
    const result=await response.json(); assert.ok(result.account.permissions.includes('application:read')); assert.ok(result.account.permissions.includes('accounts:manage'));
    const token=active.cookie.split('=')[1]; const session=(await pool.query('SELECT token_hash FROM templux.auth_sessions WHERE token_hash=$1',[hash(token)])).rows[0];
    assert.equal(session.token_hash,hash(token)); assert.notEqual(session.token_hash,token);
    const restarted=await createApplication(pool,config,fakeProtocol); t.after(()=>restarted.close());
    const persisted=await restarted.inject({url:'/api/protected',headers:{cookie:active.cookie}}); assert.equal(persisted.statusCode,200);
  });
  await t.test('last effective admin cannot be demoted or disabled',async()=>{
    for(const change of [{roles:['user'],state:'active'},{roles:['admin'],state:'disabled'}]) {
      await assert.rejects(setAuthorization(pool,{accountId,...change},'test',definitions),/最后一个有效管理员/);
    }
  });
  await t.test('sessions from a previous deployment organization or app cannot access the changed realm',async()=>{
    for(const changed of [{tenantKey:'different-tenant'},{appId:'different-app'}]) {
      const other=await createApplication(pool,{...config,...changed},fakeProtocol); t.after(()=>other.close());
      const response=await other.inject({url:'/api/protected',headers:{cookie:active.cookie}});
      assert.equal(response.statusCode,401);
    }
  });
  let secondId;
  await t.test('extended predefined roles union, zero roles denial and disabled login',async()=>{
    subject='person-b'; const pending=await login(); secondId=(await (await get('/api/auth/session',pending.cookie)).json()).account.id;
    await setAuthorization(pool,{accountId:secondId,roles:['user','auditor'],state:'active'},'test',definitions);
    const result=await login(); const profile=await (await get('/api/protected',result.cookie)).json();
    assert.deepEqual(profile.account.permissions,['application:read','audit:read']);
    await setAuthorization(pool,{accountId:secondId,roles:[],state:'active'},'test',definitions);
    const zero=await login(); assert.equal((await get('/api/protected',zero.cookie)).status,403);
    await setAuthorization(pool,{accountId:secondId,roles:['user'],state:'disabled'},'test',definitions);
    const disabled=await login(); assert.equal(disabled.cookie,undefined); assert.match(disabled.response.headers.get('location'),/account_disabled/);
    subject='person-a';
  });
  await t.test('audit insertion failure rolls back roles, state and authorization version',async()=>{
    const before=(await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[accountId])).rows[0];
    const priorRoles=(await pool.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key',[accountId])).rows;
    await pool.query("CREATE FUNCTION templux.fail_auth_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='authorization_changed' THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER test_fail_auth_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.fail_auth_audit()');
    try {
      await assert.rejects(setAuthorization(pool,{accountId,roles:['admin','auditor'],state:'active'},'test',definitions),/未提交/);
      assert.deepEqual((await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[accountId])).rows[0],before);
      assert.deepEqual((await pool.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key',[accountId])).rows,priorRoles);
      assert.equal((await get('/api/protected',active.cookie)).status,200);
    } finally { await pool.query('DROP TRIGGER test_fail_auth_audit ON templux.audit_events'); await pool.query('DROP FUNCTION templux.fail_auth_audit()'); }
  });
  await t.test('administrators from an old realm do not permit removing the last current administrator',async()=>{
    await setAuthorization(pool,{accountId:secondId,roles:['admin'],state:'active'},'test',definitions);
    await pool.query('UPDATE templux.identities SET app_id=$2 WHERE account_id=$1',[secondId,'old-app']);
    try {
      await assert.rejects(setAuthorization(pool,{accountId,roles:['user'],state:'active'},'test',definitions,config),/最后一个有效管理员/);
    } finally { await pool.query('UPDATE templux.identities SET app_id=$2 WHERE account_id=$1',[secondId,config.appId]); }
  });
  await t.test('concurrent administrator changes retain one effective administrator',async()=>{
    await setAuthorization(pool,{accountId:secondId,roles:['admin'],state:'active'},'test',definitions);
    const results=await Promise.allSettled([accountId,secondId].map(id=>setAuthorization(pool,{accountId:id,roles:['user'],state:'active'},'test',definitions)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await pool.query("SELECT count(*) FROM templux.accounts a JOIN templux.account_roles r ON r.account_id=a.id WHERE a.state='active' AND r.role_key='admin'")).rows[0].count,'1');
  });
  await t.test('commit-phase failure reports an unconfirmed result and keeps authorization atomic',async()=>{
    const before=(await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[accountId])).rows[0];
    const priorRoles=(await pool.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key',[accountId])).rows;
    await pool.query("CREATE FUNCTION templux.fail_deferred_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='authorization_changed' THEN RAISE EXCEPTION 'isolated deferred audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE CONSTRAINT TRIGGER test_deferred_audit AFTER INSERT ON templux.audit_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION templux.fail_deferred_audit()');
    try {
      await assert.rejects(setAuthorization(pool,{accountId,roles:['admin','user'],state:'active'},'test',definitions),/提交结果未确认/);
      assert.deepEqual((await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[accountId])).rows[0],before);
      assert.deepEqual((await pool.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key',[accountId])).rows,priorRoles);
    } finally { await pool.query('DROP TRIGGER test_deferred_audit ON templux.audit_events'); await pool.query('DROP FUNCTION templux.fail_deferred_audit()'); }
  });
  await t.test('cookie logout checks origin, and no provider/session secrets are persisted in audit',async()=>{
    const denied=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:active.cookie,Origin:'http://attacker.invalid'}}); assert.equal(denied.status,403);
    const all=JSON.stringify((await pool.query('SELECT details,actor FROM templux.audit_events')).rows);
    assert.doesNotMatch(all,/fixture-secret-marker|fixture-runtime-token-marker|fixture-code-marker/);
    assert.equal((await get('/api/auth/session')).status,401);
    const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:active.cookie,Origin:config.publicOrigin}}); assert.equal(logout.status,200);
    assert.equal((await get('/api/auth/session',active.cookie)).status,401);
  });
});
