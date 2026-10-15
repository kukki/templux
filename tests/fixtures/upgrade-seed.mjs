// Isolated historical SQL fixture only; never an application or login endpoint.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import {migrations} from '../../apps/api/dist/database.js';
import {hashPassword} from '../../apps/api/dist/password.js';
assert.equal(process.env.TEMPLUX_PROJECT_NAME,'t24-proof');
assert.ok(['/t24_app','/t24_external'].includes(new URL(process.env.DATABASE_URL).pathname));
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 assert.equal((await pool.query("SELECT to_regnamespace('templux') n")).rows[0].n,null,'seed only an empty self-owned database');
 await pool.query('CREATE TABLE public.templux_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
 for(const m of (await migrations()).slice(0,8)){await pool.query('BEGIN');try{await pool.query(m.sql);await pool.query('INSERT INTO public.templux_migrations(version,checksum) VALUES($1,$2)',[m.version,m.checksum]);await pool.query('COMMIT');}catch(e){await pool.query('ROLLBACK');throw e;}}
 const values=[];let owner;
 for(const kind of ['person','agent']){
  const password=randomBytes(32).toString('base64url'),token=randomBytes(32).toString('base64url'),username='t24.'+kind;
  const id=(await pool.query("INSERT INTO templux.accounts(display_name,state,kind,responsible_person_id) VALUES($1,'active',$2,$3) RETURNING id",['Synthetic upgrade '+kind,kind,owner??null])).rows[0].id;
  owner??=id;
  await pool.query("INSERT INTO templux.account_roles VALUES($1,'user')",[id]);
  await pool.query('INSERT INTO templux.password_credentials(account_id,username,password_hash) VALUES($1,$2,$3)',[id,username,await hashPassword(password)]);
  await pool.query("INSERT INTO templux.auth_sessions(token_hash,account_id,auth_version,expires_at,method) VALUES($1,$2,1,now()+interval '12 hours','password')",[createHash('sha256').update(token).digest('hex'),id]);
  values.push({username,password,cookie:'templux_session='+token,accountId:id,kind});
 }
 await pool.query("INSERT INTO templux.audit_events(source,actor,event,actor_assurance) VALUES('cli','isolated-fixture','t24_historical_seed','host_claim')");
 writeFileSync('/opt/templux/credentials/upgrade.json',JSON.stringify(values),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({seeded:'0008',accounts:2,sessions:2,audit:1}));
}finally{await pool.end();}
