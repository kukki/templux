import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {migrate} from '../apps/api/dist/database.js';
const connectionString=process.env.TEST_AUTH_DATABASE_URL;assert.ok(connectionString?.endsWith('/templux_auth_test'));
import {migrationObjectCases as objects} from './fixtures/migration-object-cases.mjs';
// Pool.end closes sockets; wait for server-side disconnection before DROP.
// FORCE can otherwise SIGTERM a just-closing client and fail the finished test.
async function dropFinishedFixture(admin,name){
 assert.match(name,/^t22_(objects_[a-z_]+|empty_control)$/);
 for(let i=0;i<100;i++){
  const active=(await admin.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=$1) AS active',[name])).rows[0].active;
  if(!active){await admin.query(`DROP DATABASE ${name}`);return;}
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw new Error('Fixture connection did not finish closing; refused FORCE cleanup');
}


test('all supported user objects require backup before any migration metadata write',async t=>{
 const admin=new pg.Pool({connectionString});t.after(()=>admin.end());
 for(const [kind,sql]of objects)await t.test(kind,async()=>{const name=`t22_objects_${kind}`;await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.query(`CREATE DATABASE ${name}`);const u=new URL(connectionString);u.pathname='/'+name;const p=new pg.Pool({connectionString:u.toString()});try{await p.query(sql);await assert.rejects(migrate(p,async()=>{throw new Error('backup unavailable');}),/backup unavailable/);assert.equal((await p.query("SELECT to_regclass('public.templux_migrations') name")).rows[0].name,null);}finally{await p.end();await dropFinishedFixture(admin,name);}});
});
test('fresh PostgreSQL defaults and an empty migration-history table remain empty',async t=>{const admin=new pg.Pool({connectionString});t.after(()=>admin.end());for(const history of [false,true])await t.test(history?'empty-history':'defaults',async()=>{const name='t22_empty_control';await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.query(`CREATE DATABASE ${name}`);const u=new URL(connectionString);u.pathname='/'+name;const p=new pg.Pool({connectionString:u.toString()});try{if(history)await p.query('CREATE TABLE public.templux_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const result=await migrate(p,async()=>{throw new Error('empty must skip backup');});assert.equal(result.applied,10);assert.equal((await migrate(p,async()=>{throw new Error('no-pending must skip backup');})).applied,0);}finally{await p.end();await dropFinishedFixture(admin,name);}});});
test('object detection remains under the migration lock and failures release it',async t=>{const admin=new pg.Pool({connectionString});t.after(()=>admin.end());const name='t22_objects_lock';await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.query(`CREATE DATABASE ${name}`);const u=new URL(connectionString);u.pathname='/'+name;const p=new pg.Pool({connectionString:u.toString()});let release;try{await p.query("CREATE TYPE public.fix_status AS ENUM ('draft')");let entered;const observed=new Promise(r=>entered=r),waiting=new Promise(r=>release=r);const first=migrate(p,async()=>{entered();await waiting;throw new Error('backup failed under lock');});await observed;await assert.rejects(migrate(p,async()=>{}),/另一个迁移/);release();await assert.rejects(first,/backup failed under lock/);await assert.rejects(migrate(p,async()=>{throw new Error('lock was released');}),/lock was released/);assert.equal((await p.query("SELECT to_regclass('public.templux_migrations') name")).rows[0].name,null);}finally{release?.();await p.end();await dropFinishedFixture(admin,name);}});
