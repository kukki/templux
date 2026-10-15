import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,symlinkSync,chmodSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../apps/api/dist/database.js';
import {restoreDatabase} from '../apps/api/dist/restore.js';
import {backupDatabase} from '../apps/api/dist/backup.js';
import {restoreFaultProxy} from './fixtures/restore-pg-proxy.mjs';
const source=process.env.TEST_RESTORE_DATABASE_URL;
test('restore real SQL preflight, owner rescue and uncertain outcomes remain closed',async t=>{
 if(!source){t.skip('Explicit own isolated restore server required');return;}
 assert.equal(new URL(source).hostname,'restore-db');assert.match(new URL(source).pathname,/^\/restore_/);
 const pool=new pg.Pool({connectionString:source});await migrate(pool);
 const root=mkdtempSync(join(tmpdir(),'t23-failure-')),old={...process.env};Object.assign(process.env,{DATABASE_URL:source,TEMPLUX_BACKUP_DIR:root,TEMPLUX_PROJECT_NAME:'t23-failures'});
 const names=[];t.after(async()=>{for(const name of names){await pool.query(`ALTER DATABASE ${name} ALLOW_CONNECTIONS true`);await pool.query(`DROP DATABASE ${name} WITH (FORCE)`);}await pool.query('DROP ROLE IF EXISTS t23_owner');await pool.end();process.env=old;rmSync(root,{recursive:true,force:true});});
 const baseline=await backupDatabase(pool,{kind:'manual',connectionString:source});
 const input=(target,backup=baseline)=>({mode:'independent',target:'env:T23_TARGET',connectionString:target,archive:join(backup.directory,'archive.dump'),sha256:backup.sha256});
 const make=async(name,owner)=>{names.push(name);await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await pool.query(`CREATE DATABASE ${name}${owner?' OWNER '+owner:''}`);const u=new URL(source);u.pathname='/'+name;return u;};
 const noop=async()=>{throw Error('independent must not call Docker');};
 await t.test('same target URI aliases cannot bypass original maintenance',async()=>{
  const u=new URL(source);u.searchParams.set('sslmode','disable');await assert.rejects(restoreDatabase(input(u.toString()),noop),e=>e.result.stage==='preflight'&&e.result.connectionsClosed===false);
  assert.equal((await pool.query('SELECT phase FROM templux.maintenance_state')).rows[0].phase,'online');
 });
 await t.test('hash, symlink and public mode fail without changing target connections',async()=>{
  const u=await make('t23_input');const i=input(u.toString());await assert.rejects(restoreDatabase({...i,sha256:'a'.repeat(64)},noop),/SHA256/);
  symlinkSync(i.archive,join(root,'symlink.dump'));await assert.rejects(restoreDatabase({...i,archive:join(root,'symlink.dump')},noop),/链接/);
  chmodSync(i.archive,0o644);try{await assert.rejects(restoreDatabase(i,noop),/0600/);}finally{chmodSync(i.archive,0o600);}
  assert.equal((await pool.query("SELECT datallowconn FROM pg_database WHERE datname='t23_input'")).rows[0].datallowconn,true);
 });
 await t.test('corrupt full bytes and incompatible real migration history fail before closing connections',async()=>{
  const u=await make('t23_corrupt');const bytes=readFileSync(join(baseline.directory,'archive.dump'));const corrupt=join(root,'truncated.dump');writeFileSync(corrupt,bytes.subarray(0,bytes.length-1000),{mode:0o600});const sha=(await import('node:crypto')).createHash('sha256').update(readFileSync(corrupt)).digest('hex');
  await assert.rejects(restoreDatabase({...input(u.toString()),archive:corrupt,sha256:sha},noop),e=>e.result.stage==='preflight'&&e.result.connectionsClosed===false);
  const row=(await pool.query("DELETE FROM public.templux_migrations WHERE version='0010' RETURNING *")).rows[0];let oldArchive;try{oldArchive=await backupDatabase(pool,{kind:'manual',connectionString:source});}finally{await pool.query('INSERT INTO public.templux_migrations(version,checksum,applied_at) VALUES($1,$2,$3)',[row.version,row.checksum,row.applied_at]);}
  await assert.rejects(restoreDatabase(input(u.toString(),oldArchive),noop),e=>e.result.stage==='preflight'&&e.result.connectionsClosed===false);
  assert.equal((await pool.query("SELECT datallowconn FROM pg_database WHERE datname='t23_corrupt'")).rows[0].datallowconn,true);
 });
 await t.test('missing identity privilege fails before halt/fence; no-CREATEDB owner restores and rescues a failure',async()=>{
  await pool.query('DROP ROLE IF EXISTS t23_owner');await pool.query("CREATE ROLE t23_owner LOGIN PASSWORD 'synthetic-owner-only' NOCREATEDB NOSUPERUSER");
  const u=await make('t23_owner_target','t23_owner');const setup=new pg.Pool({connectionString:u.toString()});await setup.query('REVOKE EXECUTE ON FUNCTION pg_catalog.pg_control_system() FROM PUBLIC');u.username='t23_owner';u.password='synthetic-owner-only';
  await assert.rejects(restoreDatabase(input(u.toString()),noop),e=>e.result.stage==='preflight'&&e.result.connectionsClosed===false);
  await setup.query('GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO t23_owner');await setup.end();await pool.query('GRANT pg_signal_backend TO t23_owner');
  const result=await restoreDatabase(input(u.toString()),noop);assert.equal(result.restored,true);
  const target=new pg.Pool({connectionString:u.toString()});try{assert.equal((await target.query("SELECT rolcreatedb,rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolcreatedb,false);}finally{await target.end();}
  await pool.query("CREATE FUNCTION templux.t23_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='database_restored' THEN RAISE EXCEPTION 'test audit fault'; END IF; RETURN NEW; END $$;CREATE TRIGGER t23_fail_audit BEFORE INSERT ON templux.audit_events FOR EACH ROW EXECUTE FUNCTION templux.t23_fail_audit()");
  let bad;try{bad=await backupDatabase(pool,{kind:'manual',connectionString:source});}finally{await pool.query('DROP TRIGGER t23_fail_audit ON templux.audit_events;DROP FUNCTION templux.t23_fail_audit()');}
  await assert.rejects(restoreDatabase(input(u.toString(),bad),noop),e=>e.result.connectionsClosed===true&&e.result.dataCommitted===false&&e.result.stage==='restore-transaction');
  await assert.rejects(new pg.Client({connectionString:u.toString()}).connect(),e=>e.code==='55000');
  // Rescue uses the SAME non-CREATEDB role and an existing management database.
  const adminUrl=new URL(u);adminUrl.pathname='/postgres';const admin=new pg.Client({connectionString:adminUrl.toString()});await admin.connect();try{assert.equal((await admin.query("SELECT datallowconn FROM pg_database WHERE datname='t23_owner_target'")).rows[0].datallowconn,false);await admin.query('ALTER DATABASE t23_owner_target ALLOW_CONNECTIONS true');}finally{await admin.end();}
  const verify=new pg.Pool({connectionString:u.toString()});try{assert.equal((await verify.query("SELECT count(*) FROM templux.audit_events WHERE event='database_restored'")).rows[0].count,'1');assert.equal((await verify.query('SELECT phase FROM templux.maintenance_state')).rows[0].phase,'offline');}finally{await verify.end();}
 });
 await t.test('missing guard is rejected INSIDE transaction and leaves no partially restored history',async()=>{
  await pool.query('ALTER TABLE templux.auth_sessions DISABLE TRIGGER maintenance_write_guard');let bad;try{bad=await backupDatabase(pool,{kind:'manual',connectionString:source});}finally{await pool.query('ALTER TABLE templux.auth_sessions ENABLE TRIGGER maintenance_write_guard');}
  const u=await make('t23_guard');await assert.rejects(restoreDatabase(input(u.toString(),bad),noop),e=>e.result.stage==='restore-transaction'&&e.result.connectionsClosed===true);
  await pool.query('ALTER DATABASE t23_guard ALLOW_CONNECTIONS true');const verify=new pg.Pool({connectionString:u.toString()});try{assert.equal((await verify.query("SELECT to_regclass('public.templux_migrations') AS name")).rows[0].name,null);}finally{await verify.end();}
 });
 for(const mode of ['fence','commit','reopen'])await t.test(`actual ${mode} acknowledgement loss does not claim success or resume`,async()=>{
  const u=await make('t23_'+mode);const proxy=await restoreFaultProxy('restore-db',5432,mode);const direct=u.toString();u.hostname='127.0.0.1';u.port=String(proxy.port);u.searchParams.set('sslmode','disable');
  const admin=new URL(u);admin.pathname='/postgres';process.env.TEMPLUX_RESTORE_ADMIN_URL=admin.toString();
  try{await assert.rejects(restoreDatabase(input(u.toString()),noop),e=>{assert.equal(e.result.restored,false);assert.equal(e.result.accessReady,false);assert.equal(e.result.dataCommitted,mode==='commit'?'unknown':mode==='fence'?false:true);assert.equal(e.result.connectionsClosed,true);return true;});assert.equal(proxy.fired(),true);}finally{delete process.env.TEMPLUX_RESTORE_ADMIN_URL;await proxy.close();}
  // Host verifies with an independent administrative connection; no automatic restore retry.
  const state=(await pool.query('SELECT datallowconn FROM pg_database WHERE datname=$1',[u.pathname.slice(1)])).rows[0];assert.equal(state.datallowconn,false);
  await pool.query(`ALTER DATABASE ${u.pathname.slice(1)} ALLOW_CONNECTIONS true`);const verify=new pg.Pool({connectionString:direct});try{if(mode==='fence')assert.equal((await verify.query("SELECT to_regclass('public.templux_migrations') AS name")).rows[0].name,null);else{assert.equal((await verify.query('SELECT phase FROM templux.maintenance_state')).rows[0].phase,'offline');assert.equal((await verify.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count,'0');}}finally{await verify.end();}
 });
 // Input remains only in restricted archives and never in the result/log stream.
 writeFileSync(join(root,'test-complete'),'private',{mode:0o600});
});
