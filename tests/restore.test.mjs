import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=args=>spawnSync(process.execPath,['apps/api/dist/manage.js','restore',...args,'--json'],{encoding:'utf8',timeout:10000,env:{...process.env,DATABASE_URL:process.env.DATABASE_URL??'postgresql://unused:unused@unreachable.invalid/unused'}});
test('restore requires explicit mode and target and never defaults to the configured database',()=>{
 for(const args of [[],['--mode','original'],['--mode','independent'],['--target','current']]){
  const r=run(args);assert.equal(r.status,1);assert.match(JSON.parse(r.stdout).error,/mode|target|模式|目标/);
 }
});
test('restore command refuses URL targets and missing destructive confirmation before SQL',()=>{
 const base=['--mode','original','--target','current','--archive','/private/selected.dump','--sha256','a'.repeat(64)];
 let r=run(base);assert.equal(r.status,1);assert.match(JSON.parse(r.stdout).error,/confirm|overwrite/);
 r=run(['--mode','independent','--target','postgresql://secret-value','--json']);assert.equal(r.status,1);assert.equal((r.stdout+r.stderr).includes('secret-value'),false);
});
test('restore block prevents gate0 fallback and ordinary resume cannot publish through it',async()=>{
 const {mkdtempSync,rmSync,writeFileSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {maintenanceReleased,publishMaintenanceRelease}=await import('../apps/api/dist/maintenance-release.js');const d=mkdtempSync(join(tmpdir(),'t23-block-'));const prev=process.env.TEMPLUX_MAINTENANCE_RELEASE_FILE;process.env.TEMPLUX_MAINTENANCE_RELEASE_FILE=join(d,'release.json');
 try{const state={phase:'online',gateVersion:'0'};assert.equal(maintenanceReleased(state),true);writeFileSync(join(d,'release.json.restore-block'),'in-progress');assert.equal(maintenanceReleased(state),false);assert.throws(()=>publishMaintenanceRelease(state),/恢复|restore/);}finally{if(prev===undefined)delete process.env.TEMPLUX_MAINTENANCE_RELEASE_FILE;else process.env.TEMPLUX_MAINTENANCE_RELEASE_FILE=prev;rmSync(d,{recursive:true,force:true});}
});
test('archive history preflight rejects older/newer/mismatched and missing metadata',async()=>{
 const {validateRestoreHistory}=await import('../apps/api/dist/restore.js');const expected=[{version:'0010',checksum:'b'.repeat(64)}];
 const sql=(v,c)=>`COPY public.templux_migrations (version, checksum, applied_at) FROM stdin;\n${v}\t${c}\t2026-01-01\n\\.\n`;
 assert.doesNotThrow(()=>validateRestoreHistory(sql('0010','b'.repeat(64)),expected));
 for(const value of ['',sql('0009','b'.repeat(64)),sql('0011','b'.repeat(64)),sql('0010','a'.repeat(64))])assert.throws(()=>validateRestoreHistory(value,expected),/版本|历史/);
});
test('independent real restore retains accounts/roles and atomically revokes sessions before connection reopening',async t=>{
 if(!process.env.TEST_RESTORE_DATABASE_URL){t.skip('Explicit own isolated restore server required');return;}
 const {mkdtempSync,rmSync,readFileSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const pg=(await import('pg')).default;const {migrate}=await import('../apps/api/dist/database.js');const {backupDatabase}=await import('../apps/api/dist/backup.js');const {restoreDatabase}=await import('../apps/api/dist/restore.js');
 const connectionString=process.env.TEST_RESTORE_DATABASE_URL;const pool=new pg.Pool({connectionString});await migrate(pool);
 const name='t23_independent';await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await pool.query(`CREATE DATABASE ${name}`);
 const u=new URL(connectionString);u.pathname='/'+name;const target=u.toString();const before=new pg.Pool({connectionString:target});await before.query("CREATE TYPE public.t23_before_restore AS ENUM ('preserved')");await before.end();const root=mkdtempSync(join(tmpdir(),'t23-real-'));const old={...process.env};Object.assign(process.env,{DATABASE_URL:connectionString,TEMPLUX_BACKUP_DIR:root,TEMPLUX_PROJECT_NAME:'t23-real'});
 t.after(async()=>{process.env=old;rmSync(root,{recursive:true,force:true});await pool.query(`ALTER DATABASE ${name} ALLOW_CONNECTIONS true`);await pool.query(`DROP DATABASE ${name} WITH (FORCE)`);await pool.end();});
 const a=(await pool.query("INSERT INTO templux.accounts(display_name,state) VALUES('Restore synthetic person','active') RETURNING id")).rows[0].id;
 await pool.query("INSERT INTO templux.account_roles VALUES($1,'user')",[a]);await pool.query("INSERT INTO templux.auth_sessions(token_hash,account_id,auth_version,expires_at) VALUES($1,$2,1,now()+interval '1 hour')",[(await import('node:crypto')).randomBytes(32).toString('hex'),a]);
 const backup=await backupDatabase(pool,{kind:'manual',connectionString});
 const result=await restoreDatabase({mode:'independent',target:'env:T23_TARGET',connectionString:target,archive:join(backup.directory,'archive.dump'),sha256:backup.sha256},async()=>{throw Error('independent must not compose');});
 assert.equal(result.safetyBackup?.backupSucceeded,true,'type-only target must be backed up before overwrite');assert.equal(result.restored,true);assert.equal(result.accessReady,false);assert.equal(result.dataCommitted,true);
 const verify=new pg.Pool({connectionString:target});try{assert.equal((await verify.query('SELECT count(*) FROM templux.auth_sessions')).rows[0].count,'0');assert.ok((await verify.query('SELECT id FROM templux.accounts WHERE id=$1',[a])).rows[0]);assert.equal((await verify.query("SELECT count(*) FROM templux.audit_events WHERE event='database_restored'")).rows[0].count,'1');assert.equal((await verify.query('SELECT phase FROM templux.maintenance_state')).rows[0].phase,'offline');assert.equal((await verify.query('SELECT role_key FROM templux.account_roles WHERE account_id=$1',[a])).rows[0].role_key,'user');}finally{await verify.end();}
 assert.equal(JSON.stringify(result).includes(connectionString),false);assert.ok(readFileSync(join(backup.directory,'manifest.json')).length);
});
test('wrapper incomplete restore fails before Docker even when Docker is unavailable',()=>{
 for(const args of [['restore','--mode','original','--json'],['restore','--mode','--json']]){const r=spawnSync('/bin/sh',['./templux',...args],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'},timeout:3000});assert.equal(r.status,1);assert.match(JSON.parse(r.stdout).error,/before Docker/);assert.equal(r.stderr.includes('docker'),false);}
});
test('restore rejects non-custom bytes with a matching checksum before any database access',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHash}=await import('node:crypto');const {restoreDatabase}=await import('../apps/api/dist/restore.js');
 const root=mkdtempSync(join(tmpdir(),'t23-format-')),archive=join(root,'selected.dump'),value=Buffer.from('not-custom-dump');writeFileSync(archive,value,{mode:0o600});const previous=process.env.DATABASE_URL;process.env.DATABASE_URL='postgresql://unused:unused@unreachable.invalid/source';
 try{await assert.rejects(restoreDatabase({mode:'independent',target:'env:T23_TARGET',connectionString:'postgresql://unused:unused@unreachable.invalid/target',archive,sha256:createHash('sha256').update(value).digest('hex')},async()=>{throw Error('no Docker');}),e=>e.result.stage==='preflight'&&/PGDMP/.test(e.message));}finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;rmSync(root,{recursive:true,force:true});}
});
