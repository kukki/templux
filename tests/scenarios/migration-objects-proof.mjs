// Tool-only driver: actual standard migration image, isolated SQL, custom dump and scratch restore.
import assert from 'node:assert/strict';import pg from 'pg';import {spawnSync} from 'node:child_process';
import {migrationObjectCases} from '../fixtures/migration-object-cases.mjs';
const project=process.env.TEMPLUX_FIX_PROJECT;assert.ok(['t22-fix','t22-am-fix'].includes(project));
const hostRoot=process.env.TEMPLUX_FIX_HOST_ROOT;assert.ok(hostRoot?.endsWith(`/test-results/${project}`));
const connectionString='postgresql://templux_test:isolated-test-only@database:5432/templux_auth_test',admin=new pg.Pool({connectionString});
const url=name=>{const u=new URL(connectionString);u.pathname='/'+name;return u.toString();};
const image=process.env.TEMPLUX_FIX_MIGRATION_IMAGE??'t22-fix-standard-migration';
assert.match(image,/^t22-(am-standard-migration|fix-standard-migration|root-migration)$/);
const migrate=(name,{good=false,prefix=false}={})=>{
 const r=spawnSync('docker',['run','--rm','--network',project,'-e',`DATABASE_URL=${url(name)}`,'-e',`TEMPLUX_PROJECT_NAME=${project}`,'-e',`TEMPLUX_BACKUP_DIR=${good?'/opt/templux/backups':'/proc/backup-impossible'}`,
 ...(good?['-v',`${hostRoot}/private:/opt/templux/backups`]:[]),...(prefix?['-v',`${hostRoot}/migrations8:/opt/templux/database/migrations:ro`]:[]),image,'--json'],{encoding:'utf8',timeout:30000});assert.equal(r.error,undefined);return{status:r.status,body:JSON.parse(r.stdout),events:r.stderr.split('\n').filter(Boolean).map(line=>JSON.parse(line))};
};
const fresh=async name=>{await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.query(`CREATE DATABASE ${name}`);return new pg.Pool({connectionString:url(name)});};
const absent=async p=>assert.equal((await p.query("SELECT to_regclass('public.templux_migrations') name")).rows[0].name,null);
try{
 for(const [kind,sql]of migrationObjectCases){const name=`t22_standard_${kind}`,p=await fresh(name);try{await p.query(sql);const r=migrate(name);assert.equal(r.status,1,`${kind}: ${JSON.stringify(r.body)}`);assert.equal(r.body.ok,false);await absent(p);console.log(JSON.stringify({stage:'blocked-before-metadata',kind,status:r.status,historyAbsent:true}));}finally{await p.end();}}
 const am=await fresh('t22_standard_ams');try{
  await am.query('CREATE ACCESS METHOD fix_heap TYPE TABLE HANDLER pg_catalog.heap_tableam_handler;CREATE ACCESS METHOD fix_btree TYPE INDEX HANDLER pg_catalog.bthandler');
  const query="SELECT amname,amtype,amhandler::regproc::text handler FROM pg_am WHERE amname IN ('fix_heap','fix_btree') ORDER BY amname";
  const before=(await am.query(query)).rows;assert.deepEqual(before,[{amname:'fix_btree',amtype:'i',handler:'bthandler'},{amname:'fix_heap',amtype:'t',handler:'heap_tableam_handler'}]);
  const bad=migrate('t22_standard_ams');assert.equal(bad.status,1);await absent(am);
  const r=migrate('t22_standard_ams',{good:true});assert.equal(r.status,0);assert.equal(r.body.applied,10);const backup=r.events.find(e=>e.event==='migration_backup_complete');assert.ok(backup?.backupSucceeded);assert.equal(backup.kind,'automatic');
  const scratch=await fresh('t22_standard_am_restore');try{
   const restore=spawnSync('/opt/pg-tools/bin/pg_restore',['--no-password','--exit-on-error','--no-owner','--no-privileges','--dbname','t22_standard_am_restore',`${backup.directory}/archive.dump`],{env:{PATH:process.env.PATH,LD_LIBRARY_PATH:'/opt/pg-tools/lib',PGHOST:'database',PGPORT:'5432',PGUSER:'templux_test',PGPASSWORD:'isolated-test-only'},encoding:'utf8'});assert.equal(restore.status,0,'AM scratch restore failed; raw diagnostics withheld');await absent(scratch);assert.deepEqual((await scratch.query(query)).rows,before);
   console.log(JSON.stringify({stage:'standard-dump-scratch-access-methods',migration:r.body,backupSucceeded:true,methods:before,historyAbsentInBackup:true,bytes:backup.bytes}));
  }finally{await scratch.end();}
 }finally{await am.end();}
 const p=await fresh('t22_standard_types');try{await p.query("CREATE TYPE public.fix_status AS ENUM ('draft','active');CREATE DOMAIN public.fix_positive AS integer CHECK(VALUE>0);CREATE TYPE public.fix_pair AS (name text,amount integer)");
  const before=(await p.query("SELECT typname,typtype FROM pg_type WHERE typnamespace='public'::regnamespace ORDER BY typname")).rows;
  const r=migrate('t22_standard_types',{good:true});assert.equal(r.status,0);assert.equal(r.body.applied,10);const backup=r.events.find(e=>e.event==='migration_backup_complete');assert.ok(backup?.backupSucceeded);assert.equal(backup.kind,'automatic');
  const scratch=await fresh('t22_standard_restore');try{const restore=spawnSync('/opt/pg-tools/bin/pg_restore',['--no-password','--exit-on-error','--no-owner','--no-privileges','--dbname','t22_standard_restore',`${backup.directory}/archive.dump`],{env:{PATH:process.env.PATH,LD_LIBRARY_PATH:'/opt/pg-tools/lib',PGHOST:'database',PGPORT:'5432',PGUSER:'templux_test',PGPASSWORD:'isolated-test-only'},encoding:'utf8'});assert.equal(restore.status,0,'scratch restore failed; raw diagnostics withheld');await absent(scratch);
   const after=(await scratch.query("SELECT typname,typtype FROM pg_type WHERE typnamespace='public'::regnamespace ORDER BY typname")).rows;assert.deepEqual(after,before);
   assert.deepEqual((await scratch.query("SELECT enumlabel FROM pg_enum WHERE enumtypid='public.fix_status'::regtype ORDER BY enumsortorder")).rows.map(r=>r.enumlabel),['draft','active']);
   assert.equal((await scratch.query("SELECT '2'::public.fix_positive::integer value")).rows[0].value,2);await assert.rejects(scratch.query("SELECT '-1'::public.fix_positive"),/check constraint/);
   assert.deepEqual((await scratch.query("SELECT (ROW('proof',7)::public.fix_pair).* ")).rows,[{name:'proof',amount:7}]);
   console.log(JSON.stringify({stage:'standard-dump-scratch-types',migration:r.body,backupSucceeded:true,typesPreserved:true,enumLabels:true,domainConstraint:true,compositeValues:true,historyAbsentInBackup:true,bytes:backup.bytes}));
  }finally{await scratch.end();}
  const none=migrate('t22_standard_types');assert.equal(none.status,0);assert.equal(none.body.applied,0);console.log(JSON.stringify({stage:'no-pending-skip',body:none.body}));
 }finally{await p.end();}
 const empty=await fresh('t22_standard_empty');try{const builtin=(await empty.query("SELECT amname FROM pg_am WHERE oid<16384 AND amname IN ('heap','btree') ORDER BY amname")).rows.map(r=>r.amname);assert.deepEqual(builtin,['btree','heap']);const r=migrate('t22_standard_empty');assert.equal(r.status,0);assert.equal(r.body.applied,10);console.log(JSON.stringify({stage:'real-empty-defaults-skip',builtInMethods:builtin,body:r.body}));}finally{await empty.end();}
 const upgrade=await fresh('t22_standard_upgrade');try{const first=migrate('t22_standard_upgrade',{prefix:true});assert.equal(first.status,0);assert.equal(first.body.schemaVersion,'0008');const r=migrate('t22_standard_upgrade');assert.equal(r.status,1);assert.equal((await upgrade.query('SELECT max(version) version,count(*)::int count FROM public.templux_migrations')).rows[0].version,'0008');const good=migrate('t22_standard_upgrade',{good:true});assert.equal(good.status,0);assert.equal(good.body.applied,2);console.log(JSON.stringify({stage:'existing-0008-guard',blocked:true,versionAfterFailure:'0008',success:good.body}));}finally{await upgrade.end();}
}finally{await admin.end();}
