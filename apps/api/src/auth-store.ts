import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { OperationError } from './database.js';
import { AuthError, type AuthConfig, type Roles } from './auth-config.js';
import type { Identity } from './feishu.js';
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type Account = { id: string; name: string; state: 'pending' | 'active' | 'disabled'; authVersion: string; roles: string[]; permissions: string[] };
export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    try {
      const result = await work(client);
      try { await client.query('COMMIT'); }
      catch {
        discard = true;
        throw new OperationError('提交结果未确认，请核对账号与审计，不要自动重试。');
      }
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    }
  } finally { client.release(discard); }
}
export async function authorizationLock(client: pg.PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('templux:authorization'))");
}
export async function audit(client: pg.Pool | pg.PoolClient, source: 'cli' | 'feishu', actor: string, event: string, accountId: string, details: object): Promise<void> {
  await client.query('INSERT INTO templux.audit_events(source,actor,event,account_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
    [source, actor, event, accountId, JSON.stringify(details)]);
}
export async function beginOAuth(pool: pg.Pool) {
  const state = opaqueToken(); const browser = opaqueToken();
  await pool.query('DELETE FROM templux.oauth_requests WHERE expires_at <= now()');
  await pool.query("INSERT INTO templux.oauth_requests(state_hash,browser_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
    [digest(state), digest(browser)]);
  return { state, browser };
}
export async function consumeOAuth(pool: pg.Pool, state: string, browser: string): Promise<void> {
  if (![state, browser].every(value => /^[A-Za-z0-9_-]{43}$/.test(value))) throw new AuthError('invalid_state', 400);
  const result = await pool.query<{ state_hash: string }>(
    'DELETE FROM templux.oauth_requests WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING state_hash', [digest(state), digest(browser)]);
  if (!result.rows[0]) throw new AuthError('invalid_state', 400);

}
export async function registerSession(pool: pg.Pool, identity: Identity, config: AuthConfig, logFailure: () => void) {
  const token = opaqueToken();
  const accountId = await transaction(pool, async client => {
    await authorizationLock(client);
    const known = await client.query<{ id: string; state: string; auth_version: string }>(
      `SELECT a.id,a.state,a.auth_version FROM templux.accounts a JOIN templux.identities i ON i.account_id=a.id
       WHERE i.provider='feishu' AND i.app_id=$1 AND i.tenant_key=$2 AND i.subject=$3 FOR UPDATE OF a`,
      [identity.appId, identity.tenantKey, identity.subject]);
    let account = known.rows[0];
    if (!account) {
      account = (await client.query<{ id: string; state: string; auth_version: string }>(
        'INSERT INTO templux.accounts(display_name) VALUES($1) RETURNING id,state,auth_version', [identity.name])).rows[0]!;
      await client.query("INSERT INTO templux.identities(account_id,provider,app_id,tenant_key,subject) VALUES($1,'feishu',$2,$3,$4)",
        [account.id, identity.appId, identity.tenantKey, identity.subject]);
      await audit(client, 'feishu', 'verified_feishu_identity', 'account_registered', account.id, { state: 'pending' });
    }
    if (account.state === 'disabled') throw new AuthError('account_disabled', 403);
    await client.query('INSERT INTO templux.auth_sessions(token_hash,account_id,auth_version,expires_at) VALUES($1,$2,$3,now()+$4*interval \'1 second\')',
      [digest(token), account.id, account.auth_version, config.maximumSeconds]);
    return account.id;
  });
  try { await audit(pool, 'feishu', 'verified_feishu_identity', 'login_succeeded', accountId, {}); } catch { logFailure(); }
  return { token, accountId };
}
export async function readSession(pool: pg.Pool, token: string | undefined, config: AuthConfig, definitions: Roles, touch = false): Promise<Account> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError('login_required');
  const row = (await pool.query<{ id: string; display_name: string; state: Account['state']; auth_version: string; session_version: string; revoked_reason: string | null; expired: boolean; idle: boolean; organization_valid: boolean }>(
    `SELECT a.id,a.display_name,a.state,a.auth_version,s.auth_version AS session_version,s.revoked_reason,
      s.expires_at<=now() AS expired,s.last_active_at+$2*interval '1 second'<=now() AS idle,
      EXISTS(SELECT 1 FROM templux.identities i WHERE i.account_id=a.id AND i.provider='feishu' AND i.app_id=$3 AND i.tenant_key=$4) AS organization_valid
     FROM templux.auth_sessions s JOIN templux.accounts a ON a.id=s.account_id WHERE s.token_hash=$1`, [digest(token), config.idleSeconds, config.appId, config.tenantKey])).rows[0];
  if (!row) throw new AuthError('login_required');
  if (!row.organization_valid) throw new AuthError('organization_denied');
  if (row.revoked_reason) throw new AuthError('session_revoked');
  if (row.state === 'disabled') throw new AuthError('account_disabled');
  if (row.auth_version !== row.session_version) throw new AuthError('authorization_changed');
  if (row.expired) throw new AuthError('session_expired');
  if (row.idle) throw new AuthError('session_idle');
  const grants = await pool.query<{ role_key: string }>('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key', [row.id]);
  const roles = grants.rows.map(r => r.role_key).filter(r => Object.hasOwn(definitions, r));
  const permissions = [...new Set(roles.flatMap(r => definitions[r]!.permissions))].sort();
  if (touch) await pool.query('UPDATE templux.auth_sessions SET last_active_at=now() WHERE token_hash=$1', [digest(token)]);
  return { id: row.id, name: row.display_name, state: row.state, authVersion: row.auth_version, roles, permissions };
}
export function requirePermission(account: Account, permission: string): void {
  if (account.state === 'pending') throw new AuthError('pending_authorization', 403);
  if (account.state !== 'active' || !account.roles.length || !account.permissions.includes(permission)) throw new AuthError('permission_denied', 403);
}
