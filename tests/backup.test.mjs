import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,statSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
const connectionString=process.env.TEST_AUTH_DATABASE_URL??'postgresql://templux_test:isolated-test-only@auth-database:5432/templux_auth_test';
const run=(args,env={})=>spawnSync(process.execPath,['apps/api/dist/manage.js',...args],{encoding:'utf8',env:{...process.env,DATABASE_URL:connectionString,...env},timeout:20000});
test('backup CLI requires confirmation and rejects overwrite before a connection',()=>{for(const args of [['backup','--json'],['backup','--confirm','--overwrite','--json']]){const r=run(args);assert.equal(r.status,1);assert.match(JSON.parse(r.stdout).error,/confirm|参数/);}});
test('container dump publishes a private verifiable archive, restores real rows and never leaks the URL',async t=>{
 const {backupDatabase}=await import('../apps/api/dist/backup.js');const root=mkdtempSync(join(tmpdir(),'t22-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const pool=new pg.Pool({connectionString});t.after(()=>pool.end());
 await pool.query('CREATE TABLE IF NOT EXISTS public.t22_proof(value text)');await pool.query("INSERT INTO public.t22_proof VALUES('archive data')");
 const env={TEMPLUX_BACKUP_DIR:root,TEMPLUX_PROJECT_NAME:'t22-suite',TEMPLUX_BACKUP_RETAIN:'2'};
 const result=await backupDatabase(pool,{kind:'manual',connectionString,env});assert.equal(result.backupSucceeded,true);assert.equal(result.retentionSucceeded,true);assert.equal(result.restored,false);
 const human=run(['backup','--confirm'],env);assert.equal(human.status,0,human.stdout+human.stderr);assert.match(human.stdout,/备份结果/);
 const archive=join(result.directory,'archive.dump'),manifest=JSON.parse(readFileSync(join(result.directory,'manifest.json'),'utf8'));
 assert.equal(statSync(root).mode&0o777,0o700);for(const f of ['archive.dump','manifest.json'])assert.equal(statSync(join(result.directory,f)).mode&0o777,0o600);assert.equal(manifest.payload.kind,'manual');assert.equal(manifest.payload.bytes,statSync(archive).size);assert.ok(manifest.payload.sha256.length===64);assert.equal(JSON.stringify(result).includes(connectionString),false);
 const decode=spawnSync('/opt/pg-tools/bin/pg_restore',['--exit-on-error','--file=-',archive],{env:{PATH:process.env.PATH,LD_LIBRARY_PATH:'/opt/pg-tools/lib'},encoding:'utf8'});assert.equal(decode.status,0);assert.match(decode.stdout,/archive data/);
 await t.test('only valid automatic archives are retained and failed new work never prunes',async()=>{
  const first=await backupDatabase(pool,{kind:'automatic',connectionString,env});const corrupt=await backupDatabase(pool,{kind:'automatic',connectionString,env});writeFileSync(join(corrupt.directory,'archive.dump'),'corrupt');
  const latest=await backupDatabase(pool,{kind:'automatic',connectionString,env});const newest=await backupDatabase(pool,{kind:'automatic',connectionString,env});assert.ok(readdirSync(root).includes(result.id));assert.ok(readdirSync(root).includes(corrupt.id));assert.equal(readdirSync(root).includes(first.id),false);assert.ok(readdirSync(root).includes(latest.id));assert.ok(readdirSync(root).includes(newest.id));
  // Publication order survives a wall-clock rollback: a new successful file must not prune itself.
  t.mock.timers.enable({apis:['Date'],now:1});let rollback;try{rollback=await backupDatabase(pool,{kind:'automatic',connectionString,env});}finally{t.mock.timers.reset();}assert.ok(readdirSync(root).includes(rollback.id));
  const before=readdirSync(root).sort();await assert.rejects(backupDatabase(pool,{kind:'automatic',connectionString:connectionString.replace('5432','1'),env}));assert.deepEqual(readdirSync(root).sort(),before);
 });
 await t.test('foreign files and symlink root are refused without touching their targets',async()=>{const link=root+'-link';symlinkSync(root,link);try{await assert.rejects(backupDatabase(pool,{kind:'manual',connectionString,env:{...env,TEMPLUX_BACKUP_DIR:link}}));}finally{rmSync(link);}writeFileSync(join(root,'.lock'),'held',{mode:0o600});await assert.rejects(backupDatabase(pool,{kind:'manual',connectionString,env}),/另一个|锁/);rmSync(join(root,'.lock'));});
 await pool.query('DROP TABLE public.t22_proof');
});
test('backup retain rejects empty, zero and malformed configuration',async()=>{const {backupSettings}=await import('../apps/api/dist/backup.js');for(const value of ['', '0','-1','1.5','101','01'])assert.throws(()=>backupSettings({TEMPLUX_BACKUP_RETAIN:value}),/配置/);assert.equal(backupSettings({}).retain,5);});
test('migration never changes an existing structure before its backup gate succeeds',async t=>{
 const {migrate}=await import('../apps/api/dist/database.js');const pool=new pg.Pool({connectionString});t.after(()=>pool.end());
 // A separate scratch database is created through SQL in the isolated test server.
 const name='t22_migration_gate';await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await pool.query(`CREATE DATABASE ${name}`);const u=new URL(connectionString);u.pathname='/'+name;const scratch=new pg.Pool({connectionString:u.toString()});
 try{await scratch.query('CREATE TABLE public.before_upgrade(value text)');await assert.rejects(migrate(scratch),/备份/);assert.equal((await scratch.query("SELECT to_regclass('public.templux_migrations') AS name")).rows[0].name,null);
  await assert.rejects(migrate(scratch,async()=>{throw new Error('backup failed');}),/backup failed/);assert.equal((await scratch.query("SELECT to_regclass('public.templux_migrations') AS name")).rows[0].name,null);
  let calls=0;await migrate(scratch,async()=>{calls++;});assert.equal(calls,1);await migrate(scratch,async()=>{throw new Error('must skip no pending');});
 }finally{await scratch.end();await pool.query(`DROP DATABASE ${name} WITH (FORCE)`);}
});
test('migration invalid connection configuration still has one JSON failure and separate diagnostics',()=>{const r=spawnSync(process.execPath,['apps/api/dist/migrate.js','--json'],{env:{...process.env,DATABASE_URL:'invalid-private-connection'},encoding:'utf8',timeout:3000});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).ok,false);assert.match(JSON.parse(r.stderr).event,/migration_failed/);assert.equal((r.stdout+r.stderr).includes('invalid-private-connection'),false);});
