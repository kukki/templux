import type pg from 'pg';
import { OperationError } from './database.js';
import { readRoles, availableAuthRealm, readSessionConfig, type AuthRealm, type Roles } from './auth-config.js';
import { audit, authorizationLock, transaction } from './auth-store.js';
export type AuthorizationChange = { accountId: string; roles: string[]; state: 'active' | 'disabled' };
export async function setAuthorization(pool: pg.Pool, change: AuthorizationChange, actor: string, definitions: Roles = readRoles(), realm: AuthRealm | null = availableAuthRealm()) {
  if (!/^[1-9][0-9]{0,18}$/.test(change.accountId) || !['active', 'disabled'].includes(change.state)
    || change.roles.some(key => !Object.hasOwn(definitions, key)) || new Set(change.roles).size !== change.roles.length) {
    throw new OperationError('账号ID、状态或预定义角色无效。');
  }
  try {
    return await transaction(pool, async client => {
      await authorizationLock(client);
      const account = (await client.query<{ id: string; state: string }>('SELECT id,state FROM templux.accounts WHERE id=$1 FOR UPDATE', [change.accountId])).rows[0];
      if (!account) throw new OperationError('未找到目标账号。');
      const before = (await client.query<{ role_key: string }>('SELECT role_key FROM templux.account_roles WHERE account_id=$1 ORDER BY role_key', [account.id])).rows.map(r => r.role_key);
      const settings = readSessionConfig();
      const effectiveAdmins = async () => Number((await client.query<{count:string}>(
        `SELECT count(*) FROM templux.accounts a JOIN templux.account_roles r ON r.account_id=a.id
         WHERE a.state='active' AND r.role_key='admin'
         AND (a.kind='person' OR ($3 AND EXISTS(SELECT 1 FROM templux.accounts o WHERE o.id=a.responsible_person_id AND o.kind='person' AND o.state='active')))
         AND (EXISTS(SELECT 1 FROM templux.password_credentials p WHERE p.account_id=a.id AND p.enabled)
          OR EXISTS(SELECT 1 FROM templux.identities i WHERE i.account_id=a.id AND i.provider='feishu' AND i.app_id=$1 AND i.tenant_key=$2))`,
        [realm?.appId ?? null, realm?.tenantKey ?? null, settings.agentEnabled])).rows[0]?.count ?? 0);
      const beforeAdmins = await effectiveAdmins();
      await client.query('DELETE FROM templux.account_roles WHERE account_id=$1', [account.id]);
      for (const key of change.roles) await client.query('INSERT INTO templux.account_roles(account_id,role_key) VALUES($1,$2)', [account.id, key]);
      await client.query('UPDATE templux.accounts SET state=$2,auth_version=auth_version+1 WHERE id=$1', [account.id, change.state]);
      if (beforeAdmins > 0 && await effectiveAdmins() === 0) throw new OperationError('不能停用或降权最后一个有效管理员，请先建立另一位管理员。');
      await audit(client, 'cli', actor, 'authorization_changed', account.id,
        { before: { state: account.state, roles: before }, after: { state: change.state, roles: change.roles } });
      return { ok: true, command: 'authorize', accountId: account.id, roles: change.roles, state: change.state, reloginRequired: true };
    });
  } catch (error) {
    if (error instanceof OperationError) throw error;
    throw new OperationError('授权或审计保存失败，变更未提交。');
  }
}
export async function listAccounts(pool: pg.Pool) {
  return (await pool.query(`SELECT a.id,a.display_name AS name,a.state,a.kind,a.responsible_person_id AS "responsiblePersonId",
    coalesce(array_agg(r.role_key ORDER BY r.role_key) FILTER(WHERE r.role_key IS NOT NULL),'{}') AS roles
    FROM templux.accounts a LEFT JOIN templux.account_roles r ON r.account_id=a.id GROUP BY a.id ORDER BY a.id LIMIT 100`)).rows;
}
