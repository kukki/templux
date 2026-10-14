import type pg from 'pg';
import { OperationError } from './database.js';
import type { AuthConfig, Roles } from './auth-config.js';
import { audit, authorizationLock, digest, loadSession, transaction } from './auth-store.js';

// Acquire authorizationLock before changing project-owned scope, then call this
// with that same transaction client. Scope storage remains owned by the project.
export async function invalidateAccountAccess(client: pg.PoolClient, accountId: string,
  context: { source: 'cli' | 'password' | 'feishu'; actor: string }): Promise<void> {
  if (!/^[1-9][0-9]{0,18}$/.test(accountId)) throw new OperationError('账号ID无效。');
  await authorizationLock(client);
  const changed = await client.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1 RETURNING id', [accountId]);
  if (!changed.rows[0]) throw new OperationError('未找到目标账号。');
  await audit(client, context.source, context.actor, 'scope_access_invalidated', accountId, {});
}
export async function revokeSessions(pool: pg.Pool, token: string | undefined, config: AuthConfig | null, roles: Roles, all: boolean): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    if (all) await transaction(pool, client => loadSession(client, token, config, roles));
    return;
  }
  await transaction(pool, async client => {
    await authorizationLock(client);
    if (all) {
      const account = await loadSession(client, token, config, roles);
      await client.query("UPDATE templux.auth_sessions SET revoked_reason='logout_all' WHERE account_id=$1 AND revoked_reason IS NULL", [account.id]);
      await audit(client, account.loginMethod, `account:${account.id}`, 'all_sessions_logged_out', account.id, {});
    } else {
      const session = (await client.query<{account_id:string;method:'feishu'|'password'}>(
        "UPDATE templux.auth_sessions SET revoked_reason='logout' WHERE token_hash=$1 AND revoked_reason IS NULL RETURNING account_id,method", [digest(token)])).rows[0];
      if (session) await audit(client, session.method, `account:${session.account_id}`, 'session_logged_out', session.account_id, {});
    }
  });
}
