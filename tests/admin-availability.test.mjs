import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
import {migrate} from '../apps/api/dist/database.js';import {hashPassword} from '../apps/api/dist/password.js';import {createApplication} from '../apps/api/dist/application.js';import {digest} from '../apps/api/dist/auth-store.js';
import {readAuthConfig,authenticationAvailability} from '../apps/api/dist/auth-config.js';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;assert.ok(connectionString?.endsWith('/templux_auth_test'));
test('last effective administrator matches verified deployment authentication availability',async t=>{
 const pool=new pg.Pool({connectionString});t.after(()=>pool.end());await migrate(pool);
 await pool.query('TRUNCATE templux.password_credentials,templux.audit_events,templux.oauth_requests,templux.auth_sessions,templux.account_roles,templux.identities,templux.accounts RESTART IDENTITY');
 const original={...process.env};const keys=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_TENANT_KEY','FEISHU_ALLOWED_TENANT_KEY','FEISHU_REDIRECT_URI','TEMPLUX_AUTH_AVAILABILITY_JSON','TEMPLUX_REQUIRE_AUTH_PROJECTION'];
 const clean=()=>{for(const key of keys) delete process.env[key];process.env.APP_PUBLIC_URL='http://localhost:31000';process.env.DEPLOYMENT_ENV='PROD';delete process.env.AGENT_LOGIN_ENABLED;};clean();
 t.after(()=>{for(const key of Object.keys(process.env))if(!Object.hasOwn(original,key))delete process.env[key];Object.assign(process.env,original);});
 const password=randomBytes(32).toString('base64url');const passwordHash=await hashPassword(password);
 const person=(await pool.query("INSERT INTO templux.accounts(display_name,state) VALUES('Password administrator','active') RETURNING id")).rows[0].id;
 const backup=(await pool.query("INSERT INTO templux.accounts(display_name,state) VALUES('Feishu administrator','active') RETURNING id")).rows[0].id;
 await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash) VALUES($1,$2,$3)',[person,'availability-admin',passwordHash]);
 await pool.query("INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,'admin'),($2,'admin')",[person,backup]);
 const restore=async()=>{await pool.query('DELETE FROM templux.account_roles WHERE account_id=$1',[person]);await pool.query("INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,'admin')",[person]);};
 const identify=()=>pool.query("INSERT INTO templux.identities(account_id,provider,app_id,tenant_key,subject) VALUES($1,'feishu','fixture-app','fixture-tenant','availability-subject') ON CONFLICT DO NOTHING",[backup]);
 const cli=(projection,required=false)=>{const env={...process.env,DATABASE_URL:connectionString};if(required){delete env.FEISHU_APP_SECRET;env.TEMPLUX_REQUIRE_AUTH_PROJECTION='1';}if(projection!==undefined)env.TEMPLUX_AUTH_AVAILABILITY_JSON=projection;
 return spawnSync(process.execPath,['apps/api/dist/manage.js','authorize','--account',person,'--roles','user','--confirm','--non-interactive','--json'],{env,encoding:'utf8',timeout:5000});};
 const assertRejected=async()=>{const before=await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[person]);const audits=await pool.query('SELECT count(*) FROM templux.audit_events');const result=cli();assert.equal(result.status,1,result.stderr);assert.match(result.stdout,/最后一个有效管理员/);
 assert.deepEqual((await pool.query('SELECT state,auth_version FROM templux.accounts WHERE id=$1',[person])).rows,before.rows);assert.deepEqual((await pool.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1',[person])).rows,[{role_key:'admin'}]);assert.equal((await pool.query('SELECT count(*) FROM templux.audit_events')).rows[0].count,audits.rows[0].count);};
 const configured=()=>Object.assign(process.env,{FEISHU_APP_ID:'fixture-app',FEISHU_TENANT_KEY:'fixture-tenant',FEISHU_APP_SECRET:'fixture-secret-not-real'});
 await t.test('no identity and disabled password do not count as usable backups',async()=>{
 await assertRejected();await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash,enabled) VALUES($1,$2,$3,false)',[backup,'disabled-backup',passwordHash]);await assertRejected();});
 await t.test('missing Feishu realm rejects last password administrator demotion and preserves API access',async()=>{
 await identify();const app=await createApplication(pool,null);t.after(()=>app.close());
 const login=()=>app.inject({method:'POST',url:'/api/auth/password',headers:{origin:'http://localhost:31000'},payload:{username:'availability-admin',password}});
 const session=await login();assert.equal(session.statusCode,200);const cookie=session.headers['set-cookie'].split(';')[0];assert.equal((await app.inject({url:'/api/admin/access',headers:{cookie}})).statusCode,200);
 assert.equal((await app.inject({url:'/api/auth/feishu/start'})).statusCode,503);
 const token=randomBytes(32).toString('base64url');await pool.query("INSERT INTO templux.auth_sessions(token_hash,account_id,auth_version,method,expires_at) VALUES($1,$2,1,'feishu',now()+interval '1 hour')",[digest(token),backup]);
 assert.equal((await app.inject({url:'/api/admin/access',headers:{cookie:`templux_session=${token}`}})).statusCode,401);
 await assertRejected();assert.equal((await app.inject({url:'/api/admin/access',headers:{cookie}})).statusCode,200);
 });
 await t.test('matching realm without secret or whitespace-only secret remains unavailable',async()=>{
 configured();delete process.env.FEISHU_APP_SECRET;assert.equal(readAuthConfig(),null);await assertRejected();process.env.FEISHU_APP_SECRET='   ';assert.equal(readAuthConfig(),null);await assertRejected();clean();});
 await t.test('fully configured but mismatching realm still rejects backup',async()=>{configured();process.env.FEISHU_APP_ID='different-app';await assertRejected();clean();});
 await t.test('complete matching Feishu configuration permits backup via public projection without giving management secret',async()=>{
 configured();const config=readAuthConfig();const projection=JSON.stringify(authenticationAvailability());assert.ok(!projection.includes(process.env.FEISHU_APP_SECRET));
 const probe=spawnSync(process.execPath,['apps/api/dist/auth-config-probe.js'],{env:process.env,encoding:'utf8'});assert.equal(probe.status,0);assert.equal(probe.stdout.trim(),projection);
 const transport=async(url)=>url.includes('/oauth/v3/token')?Response.json({code:0,access_token:'fixture-runtime-token',token_type:'Bearer',expires_in:7200}):Response.json({code:0,data:{name:'Feishu administrator',open_id:'availability-subject',tenant_key:'fixture-tenant'}});
 const app=await createApplication(pool,config,transport);t.after(()=>app.close());const start=await app.inject({url:'/api/auth/feishu/start'});assert.equal(start.statusCode,302);const state=new URL(start.headers.location).searchParams.get('state');const cookie=start.headers['set-cookie'].split(';')[0];
 const callback=await app.inject({url:`/api/auth/feishu/callback?state=${state}&code=fixture-code`,headers:{cookie}});assert.equal(callback.statusCode,302);const session=[callback.headers['set-cookie']].flat().find(value=>value.startsWith('templux_session=')).split(';')[0];assert.equal((await app.inject({url:'/api/admin/access',headers:{cookie:session}})).statusCode,200);
 const result=cli(projection,true);assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes(config.appSecret)&&!result.stderr.includes(config.appSecret));assert.equal((await app.inject({url:'/api/admin/access',headers:{cookie:session}})).statusCode,200);await restore();clean();});
 await t.test('invalid or absent public projection cannot silently disable validation',async()=>{
 configured();assert.equal(cli(undefined,true).status,1);for(const value of ['', '{}','true',JSON.stringify({schemaVersion:1,feishu:{appId:'wrong',tenantKey:'fixture-tenant'},agentEnabled:false}),JSON.stringify({schemaVersion:1,feishu:null,agentEnabled:true})]) assert.equal(cli(value,true).status,1);
 process.env.FEISHU_ALLOWED_TENANT_KEY='conflict';assert.equal(cli(JSON.stringify({schemaVersion:1,feishu:null,agentEnabled:false}),true).status,1);clean();});
 await t.test('probe shares invalid callback/session/alias and empty configuration behavior with API',async()=>{
 for(const changes of [{APP_PUBLIC_URL:'https://example.test/path'},{FEISHU_REDIRECT_URI:'http://attacker.invalid/callback'},{PERSON_IDLE_TIMEOUT_SECONDS:'bad'},{FEISHU_ALLOWED_TENANT_KEY:'conflict'}]){
 configured();Object.assign(process.env,changes);assert.throws(()=>readAuthConfig());const result=spawnSync(process.execPath,['apps/api/dist/auth-config-probe.js'],{env:process.env,encoding:'utf8'});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.ok(!result.stderr.includes('fixture-secret-not-real'));delete process.env.PERSON_IDLE_TIMEOUT_SECONDS;clean();}
 for(const key of ['FEISHU_APP_ID','FEISHU_TENANT_KEY']){configured();process.env[key]=' ';assert.equal(authenticationAvailability().feishu,null);clean();}
 });
});
