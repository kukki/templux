import assert from 'node:assert/strict';import test from 'node:test';import pg from 'pg';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {migrate} from '../apps/api/dist/database.js';import {createApplication} from '../apps/api/dist/application.js';import {hashPassword} from '../apps/api/dist/password.js';import {digest,transaction,authorizationLock} from '../apps/api/dist/auth-store.js';import {invalidateAccountAccess} from '../apps/api/dist/session-lifecycle.js';import {readSessionConfig} from '../apps/api/dist/auth-config.js';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;assert.ok(connectionString?.endsWith('/templux_auth_test'));
test('persistent session lifecycle uses real HTTP, SQL and CLI boundaries',async t=>{
 const pool=new pg.Pool({connectionString});t.after(()=>pool.end());await migrate(pool);
 await pool.query('TRUNCATE templux.password_failures,templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
 const previous={...process.env};process.env.DEPLOYMENT_ENV='DEV';process.env.APP_PUBLIC_URL='http://localhost:31000';delete process.env.AGENT_LOGIN_ENABLED;
 t.after(()=>{for(const key of Object.keys(process.env))if(!Object.hasOwn(previous,key))delete process.env[key];Object.assign(process.env,previous);});
 const credentials={username:'session-person',password:randomBytes(32).toString('base64url')};const hash=await hashPassword(credentials.password);
 const person=(await pool.query("INSERT INTO templux.accounts(display_name,state) VALUES('Session person','active') RETURNING id")).rows[0].id;
 const backup=(await pool.query("INSERT INTO templux.accounts(display_name,state) VALUES('Backup admin','active') RETURNING id")).rows[0].id;
 const agent=(await pool.query("INSERT INTO templux.accounts(display_name,state,kind,responsible_person_id) VALUES('Session Agent','active','agent',$1) RETURNING id",[person])).rows[0].id;
 for(const [id,name] of [[person,credentials.username],[backup,'session-backup'],[agent,'session-agent']])await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash) VALUES($1,$2,$3)',[id,name,hash]);
 await pool.query("INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,'user'),($2,'admin'),($3,'user')",[person,backup,agent]);
 const app=await createApplication(pool,null);await app.listen({host:'0.0.0.0',port:0});t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
 const login=async(username=credentials.username)=>{const response=await fetch(base+'/api/auth/password',{method:'POST',headers:{Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json'},body:JSON.stringify({...credentials,username})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 const get=(path,cookie)=>fetch(base+path,{headers:{Cookie:cookie}});
 const post=(path,cookie,origin=process.env.APP_PUBLIC_URL)=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:origin}});
 const tokenHash=cookie=>digest(cookie.split('=')[1]);
 const active=cookie=>pool.query('SELECT last_active_at,revoked_reason,expires_at FROM templux.auth_sessions WHERE token_hash=$1',[tokenHash(cookie)]);
 const grant=(roles,state='active')=>{const result=spawnSync(process.execPath,['apps/api/dist/manage.js','authorize','--account',person,'--roles',roles,'--state',state,'--confirm','--json','--non-interactive'],{env:{...process.env,DATABASE_URL:connectionString},encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
 await t.test('heartbeat endpoint and default/independent security configuration',async()=>{
 assert.equal((await app.inject({url:'/api/auth/heartbeat'})).statusCode,401);const config=readSessionConfig();assert.equal(config.heartbeatSeconds,30);assert.equal(config.idleSeconds,600);assert.equal(config.maximumSeconds,43200);assert.equal(config.agentIdleSeconds,600);assert.equal(config.agentMaximumSeconds,43200);
 process.env.HEARTBEAT_INTERVAL_SECONDS='0';assert.throws(()=>readSessionConfig());delete process.env.HEARTBEAT_INTERVAL_SECONDS;
 });
 await t.test('heartbeat never refreshes real SQL activity; explicit interaction and protected requests do',async()=>{
 const cookie=await login();await pool.query("UPDATE templux.auth_sessions SET last_active_at=now()-interval '20 seconds' WHERE token_hash=$1",[tokenHash(cookie)]);const before=(await active(cookie)).rows[0].last_active_at;
 for(let i=0;i<3;i++)assert.equal((await get('/api/auth/heartbeat',cookie)).status,200);assert.equal((await active(cookie)).rows[0].last_active_at.getTime(),before.getTime());
 assert.equal((await post('/api/auth/activity',cookie,'http://attacker.invalid')).status,403);assert.equal((await active(cookie)).rows[0].last_active_at.getTime(),before.getTime());
 assert.equal((await post('/api/auth/activity',cookie)).status,200);assert.ok((await active(cookie)).rows[0].last_active_at>before);
 await pool.query("UPDATE templux.auth_sessions SET last_active_at=now()-interval '20 seconds' WHERE token_hash=$1",[tokenHash(cookie)]);assert.equal((await get('/api/protected',cookie)).status,200);assert.ok((await active(cookie)).rows[0].last_active_at>before);
 });
 await t.test('valid business403 is not authentication failure; idle and maximum never revive via activity',async()=>{
 const cookie=await login();assert.equal((await get('/api/admin/access',cookie)).status,403);assert.equal((await get('/api/auth/heartbeat',cookie)).status,200);
 await pool.query("UPDATE templux.auth_sessions SET last_active_at=now()-interval '601 seconds' WHERE token_hash=$1",[tokenHash(cookie)]);const heartbeat=await get('/api/auth/heartbeat',cookie);assert.equal(heartbeat.status,401);assert.equal((await heartbeat.json()).error,'session_idle');assert.equal((await post('/api/auth/activity',cookie)).status,401);
 const expired=await login();await pool.query("UPDATE templux.auth_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(expired)]);assert.equal((await (await get('/api/protected',expired)).json()).error,'session_expired');
 });
 await t.test('current logout leaves another device valid, and revoked session stays revoked after restart',async()=>{
 const first=await login(),second=await login();assert.notEqual(first,second);assert.equal((await post('/api/auth/logout',first)).status,200);assert.equal((await get('/api/protected',first)).status,401);assert.equal((await get('/api/protected',second)).status,200);
 const restarted=await createApplication(pool,null);t.after(()=>restarted.close());assert.equal((await restarted.inject({url:'/api/protected',headers:{cookie:second}})).statusCode,200);assert.equal((await restarted.inject({url:'/api/protected',headers:{cookie:first}})).statusCode,401);
 });
 await t.test('all logout includes current and every device, excludes another account and allows later deliberate login',async()=>{
 const first=await login(),second=await login(),other=await login('session-agent');assert.equal((await post('/api/auth/logout-all',first,'http://attacker.invalid')).status,403);assert.equal((await get('/api/protected',first)).status,200);
 const result=await post('/api/auth/logout-all',first);assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 for(const cookie of [first,second]){const response=await get('/api/auth/heartbeat',cookie);assert.equal(response.status,401);assert.equal((await response.json()).error,'all_sessions_revoked');}
 assert.equal((await get('/api/protected',other)).status,200);assert.equal((await get('/api/protected',await login())).status,200);
 });
 await t.test('logout audit failure preserves persisted sessions and returns no cleared Cookie',async()=>{
 const first=await login(),second=await login();
 await pool.query("CREATE FUNCTION templux.fail_logout_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event IN ('session_logged_out','all_sessions_logged_out') THEN RAISE EXCEPTION 'isolated logout audit failure'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER fail_logout_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.fail_logout_audit()');
 try{for(const path of ['/api/auth/logout','/api/auth/logout-all']){const result=await post(path,first);assert.equal(result.status,503);assert.equal(result.headers.get('set-cookie'),null);assert.equal((await get('/api/auth/heartbeat',first)).status,200);assert.equal((await get('/api/auth/heartbeat',second)).status,200);}}finally{await pool.query('DROP TRIGGER fail_logout_audit ON templux.audit_events;DROP FUNCTION templux.fail_logout_audit()');}
 });
 await t.test('person/Agent independent idle and maximum values apply to persisted sessions',async()=>{
 process.env.PERSON_IDLE_TIMEOUT_SECONDS='120';process.env.PERSON_SESSION_MAX_SECONDS='240';process.env.AGENT_IDLE_TIMEOUT_SECONDS='60';process.env.AGENT_SESSION_MAX_SECONDS='180';
 const personCookie=await login(),agentCookie=await login('session-agent');await pool.query("UPDATE templux.auth_sessions SET last_active_at=now()-interval '61 seconds' WHERE token_hash=ANY($1::text[])",[[tokenHash(personCookie),tokenHash(agentCookie)]]);assert.equal((await get('/api/auth/heartbeat',personCookie)).status,200);assert.equal((await get('/api/auth/heartbeat',agentCookie)).status,401);
 const periods=(await pool.query('SELECT account_id,extract(epoch FROM expires_at-created_at)::int AS duration FROM templux.auth_sessions WHERE token_hash=ANY($1::text[])',[[tokenHash(personCookie),tokenHash(agentCookie)]])).rows;assert.equal(periods.find(x=>x.account_id===person).duration,240);assert.equal(periods.find(x=>x.account_id===agent).duration,180);
 for(const key of ['PERSON_IDLE_TIMEOUT_SECONDS','PERSON_SESSION_MAX_SECONDS','AGENT_IDLE_TIMEOUT_SECONDS','AGENT_SESSION_MAX_SECONDS'])delete process.env[key];
 });
 await t.test('CLI role/state changes invalidate all previous sessions while new authorized requests use latest state',async()=>{
 const cookie=await login();grant('user');const response=await get('/api/protected',cookie);assert.equal(response.status,401);assert.equal((await response.json()).error,'authorization_changed');assert.equal((await get('/api/protected',await login())).status,200);
 const current=await login();grant('user','disabled');assert.equal((await (await get('/api/auth/heartbeat',current)).json()).error,'account_disabled');grant('user');
 });
 await t.test('scope seam commits project mutation/version/audit together and rolls all back on audit failure',async()=>{
 await pool.query('CREATE TABLE templux.session_test_scope(account_id bigint PRIMARY KEY,revision integer)');
 await pool.query('INSERT INTO templux.session_test_scope VALUES($1,1)',[person]);const cookie=await login();
 const invalidate=()=>transaction(pool,async client=>{await authorizationLock(client);await client.query('UPDATE templux.session_test_scope SET revision=revision+1 WHERE account_id=$1',[person]);await invalidateAccountAccess(client,person,{source:'cli',actor:'isolated-project-scope'});});
 await invalidate();assert.equal((await get('/api/protected',cookie)).status,401);const current=await login();const before=(await pool.query('SELECT auth_version FROM templux.accounts WHERE id=$1',[person])).rows[0].auth_version;
 await pool.query("CREATE FUNCTION templux.fail_scope_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='scope_access_invalidated' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER fail_scope_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.fail_scope_audit()');
 try{await assert.rejects(invalidate());assert.equal((await pool.query('SELECT auth_version FROM templux.accounts WHERE id=$1',[person])).rows[0].auth_version,before);assert.equal((await pool.query('SELECT revision FROM templux.session_test_scope WHERE account_id=$1',[person])).rows[0].revision,2);assert.equal((await get('/api/protected',current)).status,200);}finally{await pool.query('DROP TRIGGER fail_scope_audit ON templux.audit_events;DROP FUNCTION templux.fail_scope_audit()');}await pool.query('DROP TABLE templux.session_test_scope');
 });
 await t.test('a protected HTTP request waits for concurrent authorization commit and then rejects old version',async()=>{
 const cookie=await login();const writer=await pool.connect();await writer.query('BEGIN');await authorizationLock(writer);await writer.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[person]);
 const responsePromise=get('/api/protected',cookie);let completed=false;void responsePromise.then(()=>completed=true);
 // Observe actual SQL lock wait, not a timing-only assertion.
 let blocked=false;for(let i=0;i<100&&!blocked;i++){blocked=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS blocked")).rows[0].blocked;await new Promise(r=>setTimeout(r,5));}
 const completedBeforeCommit=completed;await writer.query('COMMIT');writer.release();assert.equal(blocked,true);assert.equal(completedBeforeCommit,false);const response=await responsePromise;assert.equal(response.status,401);assert.equal((await response.json()).error,'authorization_changed');assert.equal((await get('/api/protected',await login())).status,200);
 });
});
