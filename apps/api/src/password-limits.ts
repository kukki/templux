import type pg from 'pg';
import {AuthError} from './auth-config.js';
import {digest} from './auth-store.js';
import {canonicalIp} from '../../../shared/client-ip.mjs';
export class PasswordLimited extends AuthError {
  constructor(public readonly retryAfterSeconds:number){super('login_limited',429);}
}
export const passwordFailureKey=(ip:string,username:string)=>digest(`${canonicalIp(ip)}\0${username}`);
export async function limitedSeconds(client:pg.Pool|pg.PoolClient,key:string):Promise<number|null>{
  const row=(await client.query<{seconds:number}>(`SELECT greatest(1,ceil(extract(epoch FROM blocked_until-clock_timestamp())))::int AS seconds
    FROM templux.password_failures WHERE key_hash=$1 AND blocked_until>clock_timestamp()`,[key])).rows[0];
  return row?.seconds??null;
}
export async function countPasswordFailure(client:pg.PoolClient,key:string):Promise<number|null>{
  const row=(await client.query<{failures:number}>(`WITH moment AS MATERIALIZED (SELECT clock_timestamp() AS instant)
    INSERT INTO templux.password_failures(key_hash,failures,first_failed_at,blocked_until,expires_at)
    SELECT $1,1,instant,NULL,instant+interval '15 minutes' FROM moment
    ON CONFLICT(key_hash) DO UPDATE SET
      failures=CASE WHEN password_failures.expires_at<=(SELECT instant FROM moment) THEN 1 ELSE least(password_failures.failures+1,5) END,
      first_failed_at=CASE WHEN password_failures.expires_at<=(SELECT instant FROM moment) THEN (SELECT instant FROM moment) ELSE password_failures.first_failed_at END,
      blocked_until=CASE WHEN password_failures.expires_at>(SELECT instant FROM moment) AND password_failures.failures>=4 THEN (SELECT instant FROM moment)+interval '15 minutes' ELSE NULL END,
      expires_at=CASE WHEN password_failures.expires_at<=(SELECT instant FROM moment) OR password_failures.failures>=4 THEN (SELECT instant FROM moment)+interval '15 minutes' ELSE password_failures.expires_at END
    RETURNING failures`,[key])).rows[0]!;
  return row.failures===5?await limitedSeconds(client,key):null;
}
export async function cleanupPasswordFailures(pool:pg.Pool):Promise<void>{
  await pool.query(`DELETE FROM templux.password_failures WHERE key_hash IN
    (SELECT key_hash FROM templux.password_failures WHERE expires_at<=clock_timestamp()
     ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)`);
}
