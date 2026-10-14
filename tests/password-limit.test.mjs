import assert from 'node:assert/strict';import test from 'node:test';import pg from 'pg';import {randomBytes} from 'node:crypto';import {request as httpRequest} from 'node:http';import {readFileSync,writeFileSync} from 'node:fs';
import {createApplication} from '../apps/api/dist/application.js';import {migrate} from '../apps/api/dist/database.js';import {hashPassword} from '../apps/api/dist/password.js';
import {passwordFailureKey,cleanupPasswordFailures} from '../apps/api/dist/password-limits.js';import {passwordSource} from '../apps/api/dist/password-source.js';import {authenticationAvailability} from '../apps/api/dist/auth-config.js';
import {canonicalIp,trustedProxyPolicy,webClientIp} from '../shared/client-ip.mjs';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;assert.ok(connectionString?.endsWith('/templux_auth_test'));
test('T07 persistent password limits use real SQL and multiple HTTP instances',async t=>{
 const pool=new pg.Pool({connectionString}),secondPool=new pg.Pool({connectionString});t.after(()=>Promise.all([pool.end(),secondPool.end()]));await migrate(pool);
 await pool.query('TRUNCATE templux.login_method_requests,templux.password_failures,templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
 const previous={...process.env};process.env.APP_PUBLIC_URL='http://localhost:31000';process.env.DEPLOYMENT_ENV='DEV';delete process.env.PASSWORD_PROXY_HOSTS;delete process.env.AGENT_LOGIN_ENABLED;
 t.after(()=>{for(const key of Object.keys(process.env))if(!Object.hasOwn(previous,key))delete process.env[key];Object.assign(process.env,previous);});
 const password=randomBytes(32).toString('base64url'),hash=await hashPassword(password);
 async function account(username,state='active',kind='person',owner=null,enabled=true){const id=(await pool.query('INSERT INTO templux.accounts(display_name,state,kind,responsible_person_id) VALUES($1,$2,$3,$4) RETURNING id',[username,state,kind,owner])).rows[0].id;await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash,enabled) VALUES($1,$2,$3,$4)',[id,username,hash,enabled]);return id;}
 const person=await account('limited-person');await pool.query("INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,'user')",[person]);await account('limited-disabled','disabled');await account('limited-credential-off','active','person',null,false);await account('limited-agent','active','agent',person);await account('limited-pending','pending');
 const servers=[];async function server(db){const app=await createApplication(db,null);servers.push(app);await app.listen({host:'0.0.0.0',port:0});return {app,port:app.server.address().port};}
 t.after(()=>Promise.all(servers.map(app=>app.close())));let first=await server(pool);const second=await server(secondPool);
 const login=(username,pwd='incorrect',options={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:(options.server??first).port,path:'/api/auth/password',method:'POST',localAddress:options.ip??'127.0.0.1',headers:{Origin:process.env.APP_PUBLIC_URL,'Content-Type':'application/json',...options.headers}},response=>{let body='';response.on('data',part=>body+=part);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:JSON.parse(body)}));});req.on('error',reject);req.end(JSON.stringify({username,password:pwd}));});
 const key=(name,ip='127.0.0.1')=>passwordFailureKey(ip,name.trim().toLowerCase());
 const record=async(name,ip='127.0.0.1')=>(await pool.query('SELECT *,blocked_until-first_failed_at AS duration FROM templux.password_failures WHERE key_hash=$1',[key(name,ip)])).rows[0];
 await t.test('first four failures return the same401; fifth starts exactly900seconds; blocked requests freeze count/deadline',async()=>{
  for(let i=1;i<=5;i++){const r=await login('  Missing-Identity  ');assert.equal(r.status,i<5?401:429);assert.deepEqual(r.body,{ok:false,error:i<5?'invalid_credentials':'login_limited'});assert.equal(r.headers['set-cookie'],undefined);}
  const before=await record('missing-identity');assert.equal(before.failures,5);
  const duration=(await pool.query("SELECT extract(epoch FROM blocked_until-expires_at) AS difference,extract(epoch FROM blocked_until-first_failed_at) AS window FROM templux.password_failures WHERE key_hash=$1",[key('missing-identity')])).rows[0];assert.equal(Number(duration.difference),0);assert.ok(Number(duration.window)>=900);
  for(const pwd of ['incorrect',password]){const r=await login('missing-identity',pwd,{server:second});assert.equal(r.status,429);assert.ok(Number(r.headers['retry-after'])>0&&Number(r.headers['retry-after'])<=900);}
  const after=await record('missing-identity');assert.equal(after.failures,before.failures);assert.equal(+after.blocked_until,+before.blocked_until);assert.equal(+after.first_failed_at,+before.first_failed_at);
 });
 await t.test('many concurrent failures across independently pooled instances trigger once, never exceed five',async()=>{
  const results=await Promise.all(Array.from({length:12},(_,i)=>login('parallel-unknown','incorrect',{server:i%2?first:second})));
  assert.equal(results.filter(r=>r.status===401).length,4);assert.equal(results.filter(r=>r.status===429).length,8);assert.equal((await record('parallel-unknown')).failures,5);assert.equal((await pool.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count,'0');
 });
 await t.test('IP and normalized username form independent keys; default ignores forged headers',async()=>{
  assert.equal((await login('missing-identity','incorrect',{ip:'127.0.0.2'})).status,401);assert.equal((await record('missing-identity','127.0.0.2')).failures,1);assert.equal((await login('another-identity')).status,401);
  for(const spoof of ['198.51.100.4','198.51.100.5'])assert.equal((await login('missing-identity','incorrect',{headers:{'X-Forwarded-For':spoof,'X-Real-IP':spoof,'X-Templux-Client-IP':spoof}})).status,429);
  assert.equal(await record('missing-identity','198.51.100.4'),undefined);
 });
 await t.test('successful verified login clears only its combination and stores a usable SQL session',async()=>{
  assert.equal((await login(' LIMITED-PERSON ')).status,401);assert.equal((await login('limited-person','incorrect',{ip:'127.0.0.2'})).status,401);
  const success=await login('Limited-Person',password);assert.equal(success.status,200);assert.equal(await record('limited-person'),undefined);assert.equal((await record('limited-person','127.0.0.2')).failures,1);
  const cookie=success.headers['set-cookie'][0].split(';')[0];assert.equal((await fetch(`http://127.0.0.1:${first.port}/api/protected`,{headers:{Cookie:cookie}})).status,200);
 });
 await t.test('window resets at/after first failure expiry; fifth deadline begins at fifth attempt rather than window start',async()=>{
  await login('window-person');await pool.query("UPDATE templux.password_failures SET first_failed_at=clock_timestamp()-interval '15 minutes',expires_at=clock_timestamp() WHERE key_hash=$1",[key('window-person')]);
  assert.equal((await login('window-person')).status,401);const reset=await record('window-person');assert.equal(reset.failures,1);assert.ok((Date.now()-+reset.first_failed_at)<2000);
  await pool.query("UPDATE templux.password_failures SET failures=4,first_failed_at=clock_timestamp()-interval '14 minutes',expires_at=clock_timestamp()+interval '1 minute' WHERE key_hash=$1",[key('window-person')]);
  assert.equal((await login('window-person')).status,429);const row=(await pool.query("SELECT extract(epoch FROM blocked_until-first_failed_at) AS duration,extract(epoch FROM blocked_until-clock_timestamp()) AS remaining FROM templux.password_failures WHERE key_hash=$1",[key('window-person')])).rows[0];assert.ok(Number(row.duration)>1700);assert.ok(Number(row.remaining)>895&&Number(row.remaining)<=900);
 });
 await t.test('restart preserves restrictions, correct password cannot clear active block, expiry restores login',async()=>{
  for(let i=0;i<5;i++)await login('limited-person');const blocked=await record('limited-person');assert.equal((await login('limited-person',password)).status,429);assert.equal(+((await record('limited-person')).blocked_until),+blocked.blocked_until);
  await first.app.close();first=await server(pool);assert.equal((await login('limited-person',password)).status,429);
  await pool.query("WITH moment AS (SELECT clock_timestamp() AS instant) UPDATE templux.password_failures SET blocked_until=instant,expires_at=instant FROM moment WHERE key_hash=$1",[key('limited-person')]);assert.equal((await login('limited-person',password)).status,200);assert.equal(await record('limited-person'),undefined);
 });
 await t.test('unknown, disabled, disabled credential and disallowed Agent failures have identical feedback; Pending is verified but unauthorized',async()=>{
  process.env.AGENT_LOGIN_ENABLED='false';for(const name of ['uniform-unknown','limited-disabled','limited-credential-off','limited-agent']){const r=await login(name,password);assert.equal(r.status,401);assert.deepEqual(r.body,{ok:false,error:'invalid_credentials'});assert.equal(r.headers['set-cookie'],undefined);assert.equal((await record(name)).failures,1);}delete process.env.AGENT_LOGIN_ENABLED;
  const pending=await login('limited-pending',password);assert.equal(pending.status,200);const response=await fetch(`http://127.0.0.1:${first.port}/api/protected`,{headers:{Cookie:pending.headers['set-cookie'][0].split(';')[0]}});assert.equal(response.status,403);
 });
 await t.test('a correct password already being verified cannot bypass a concurrently committed restriction',async()=>{
  const id=await account('limited-race');const writer=await pool.connect();await writer.query('BEGIN');await writer.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`templux:password-failure:${key('limited-race')}`]);
  await writer.query("WITH moment AS (SELECT clock_timestamp() AS instant) INSERT INTO templux.password_failures SELECT $1,5,instant-interval '14 minutes',instant+interval '15 minutes',instant+interval '15 minutes' FROM moment",[key('limited-race')]);
  const request=login('limited-race',password);let waiting=false;for(let i=0;i<200&&!waiting;i++){waiting=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS waiting")).rows[0].waiting;await new Promise(resolve=>setTimeout(resolve,5));}await writer.query('COMMIT');writer.release();assert.equal(waiting,true);const r=await request;assert.equal(r.status,429);assert.equal(r.headers['set-cookie'],undefined);assert.equal((await pool.query('SELECT count(*) FROM templux.auth_sessions WHERE account_id=$1',[id])).rows[0].count,'0');
 });
 await t.test('only a specifically trusted proxy peer can supply a single valid stamped IP',async()=>{
  process.env.PASSWORD_PROXY_HOSTS='127.0.0.1';const proxy=await server(secondPool);delete process.env.PASSWORD_PROXY_HOSTS;
  const stamp={'X-Templux-Client-IP':'198.51.100.81','X-Forwarded-For':'198.51.100.99'};assert.equal((await login('trusted-peer-unknown','incorrect',{server:proxy,headers:stamp})).status,401);assert.equal((await record('trusted-peer-unknown','198.51.100.81')).failures,1);
  assert.equal((await login('trusted-peer-unknown','incorrect',{server:proxy,ip:'127.0.0.2',headers:stamp})).status,401);assert.equal((await record('trusted-peer-unknown','127.0.0.2')).failures,1);
  assert.equal((await login('trusted-peer-unknown','incorrect',{server:proxy,headers:{'X-Templux-Client-IP':'198.51.100.81,198.51.100.82'}})).status,400);
  assert.equal((await login('trusted-peer-unknown','incorrect',{server:proxy})).status,503);
 });
 await t.test('trusted DNS address changes take effect and unresolvable proxies fail closed',async()=>{
  const path='/etc/hosts',original=readFileSync(path,'utf8');writeFileSync(path,original+'\n127.0.0.1 t07-proxy.invalid\n');process.env.PASSWORD_PROXY_HOSTS='t07-proxy.invalid';const proxy=await server(secondPool);delete process.env.PASSWORD_PROXY_HOSTS;
  try{assert.equal((await login('dns-identity','incorrect',{server:proxy,headers:{'X-Templux-Client-IP':'198.51.100.91'}})).status,401);assert.equal((await record('dns-identity','198.51.100.91')).failures,1);
   writeFileSync(path,original+'\n127.0.0.2 t07-proxy.invalid\n');assert.equal((await login('dns-identity','incorrect',{server:proxy,headers:{'X-Templux-Client-IP':'198.51.100.91'}})).status,401);assert.equal((await record('dns-identity')).failures,1);assert.equal((await record('dns-identity','198.51.100.91')).failures,1);
   process.env.PASSWORD_PROXY_HOSTS='t07-unresolvable.invalid';const unresolved=await server(secondPool);delete process.env.PASSWORD_PROXY_HOSTS;const r=await login('unresolved-identity','incorrect',{server:unresolved,headers:{'X-Templux-Client-IP':'198.51.100.92'}});assert.equal(r.status,503);assert.equal(r.headers['set-cookie'],undefined);assert.equal(await record('unresolved-identity','198.51.100.92'),undefined);
  }finally{writeFileSync(path,original);delete process.env.PASSWORD_PROXY_HOSTS;}
 });
 await t.test('cleanup removes expired keys in bounded batches and never clears active restriction',async()=>{
  await login('cleanup-unknown');await pool.query("UPDATE templux.password_failures SET first_failed_at=clock_timestamp()-interval '16 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE key_hash=$1",[key('cleanup-unknown')]);await cleanupPasswordFailures(pool);assert.equal(await record('cleanup-unknown'),undefined);assert.equal((await record('missing-identity')).failures,5);
 });
 await t.test('counter SQL failure denies both correct and wrong credentials, and successful login audit failure still clears',async()=>{
  await pool.query("CREATE FUNCTION templux.t07_counter_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated counter failure'; END $$");await pool.query('CREATE TRIGGER t07_counter_fault BEFORE INSERT ON templux.password_failures FOR EACH ROW EXECUTE FUNCTION templux.t07_counter_fault()');
  try{const r=await login('database-fault');assert.equal(r.status,503);assert.equal(r.headers['set-cookie'],undefined);}finally{await pool.query('DROP TRIGGER t07_counter_fault ON templux.password_failures;DROP FUNCTION templux.t07_counter_fault()');}
  await pool.query('ALTER TABLE templux.password_failures RENAME TO t07_unavailable_counter');
  try{assert.equal((await fetch(`http://127.0.0.1:${first.port}/api/status`)).status,503);for(const pwd of ['incorrect',password]){const r=await login('limited-person',pwd);assert.equal(r.status,503);assert.equal(r.headers['set-cookie'],undefined);}}finally{await pool.query('ALTER TABLE templux.t07_unavailable_counter RENAME TO password_failures');}
  await login('limited-person');await pool.query("CREATE FUNCTION templux.t07_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='login_succeeded' THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER t07_audit_fault BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.t07_audit_fault()');
  try{assert.equal((await login('limited-person',password)).status,200);assert.equal(await record('limited-person'),undefined);}finally{await pool.query('DROP TRIGGER t07_audit_fault ON templux.audit_events;DROP FUNCTION templux.t07_audit_fault()');}
 });
});
test('IP canonicalization and explicitly trusted proxy chains reject spoofing and bad configuration',()=>{
 assert.equal(canonicalIp('::ffff:127.0.0.1'),'127.0.0.1');assert.equal(canonicalIp('2001:0db8:0:0::1'),'2001:db8::1');
 const trusted=trustedProxyPolicy('10.0.0.0/8,2001:db8:1::/64');assert.equal(webClientIp('192.0.2.1','198.51.100.20',trusted),'192.0.2.1');assert.equal(webClientIp('10.0.0.2','198.51.100.20, 192.0.2.9, 10.0.0.1',trusted),'192.0.2.9');
 assert.equal(webClientIp('10.0.0.2','198.51.100.20, 10.0.0.1',trusted),'198.51.100.20');assert.throws(()=>webClientIp('10.0.0.2','invalid',trusted));
 for(const value of ['true','1','0.0.0.0/0','::/0','10.0.0.1/33','*','127.0.0.1,','127.0.0.1,127.0.0.1'])assert.throws(()=>trustedProxyPolicy(value));
 const old=process.env.PASSWORD_PROXY_HOSTS;try{for(const value of ['*','true','1','web/24','http://web','web,']){process.env.PASSWORD_PROXY_HOSTS=value;assert.throws(()=>passwordSource());assert.throws(()=>authenticationAvailability());}}finally{if(old===undefined)delete process.env.PASSWORD_PROXY_HOSTS;else process.env.PASSWORD_PROXY_HOSTS=old;}
});
