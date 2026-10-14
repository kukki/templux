import type pg from 'pg';
import { OperationError } from './database.js';
import { readRoles, availableAuthRealm, readSessionConfig, AuthError, type AuthConfig, type AuthRealm, type Roles } from './auth-config.js';
import { audit, authorizationLock, transaction, loadSession, requirePermission } from './auth-store.js';
export class ManagementError extends OperationError {
  constructor(public readonly reason: string, public readonly status: number, message: string) { super(message); }
}
export type AuthorizationChange = { accountId: string; roles: string[]; state: 'active' | 'disabled'; expectedVersion?: string };
// Browser actor data is validated only after obtaining the mutation lock, never trusted as a claimed account ID.
export type AuthorizationActor = string | { token: string | undefined; config: AuthConfig | null };
export async function managementOperator(client:pg.PoolClient,actor:AuthorizationActor,definitions:Roles){
  const account=typeof actor==='string'?null:await loadSession(client,actor.token,actor.config,definitions,true);
  if(account)requirePermission(account,'accounts:manage');
  return {account,source:account?.loginMethod??'cli' as const,actor:account?`account:${account.id}`:actor as string};
}
export function validateRoleSelection(roles: string[], definitions: Roles): void {
  if (roles.length > 100 || roles.some(key => !Object.hasOwn(definitions, key)) || new Set(roles).size !== roles.length)
    throw new ManagementError('invalid_management_input', 400, '预定义角色无效或重复。');
  if (roles.some(key => definitions[key]!.excludes?.some(other => roles.includes(other))))
    throw new ManagementError('role_conflict', 409, '所选预定义角色存在项目声明的互斥，请调整角色。');
}
export async function setAuthorization(pool: pg.Pool, change: AuthorizationChange, actor: AuthorizationActor, definitions: Roles = readRoles(), realm: AuthRealm | null = availableAuthRealm()) {
  if (!/^[1-9][0-9]{0,18}$/.test(change.accountId) || BigInt(change.accountId) > 9223372036854775807n || !['active', 'disabled'].includes(change.state)
    || change.roles.some(key => !Object.hasOwn(definitions, key)) || new Set(change.roles).size !== change.roles.length) {
    throw new ManagementError('invalid_management_input',400,'账号ID、状态或预定义角色无效。');
  }
  validateRoleSelection(change.roles, definitions);
  try {
    return await transaction(pool, async client => {
      await authorizationLock(client);
      const operator=(await managementOperator(client,actor,definitions)).account;
      const account = (await client.query<{ id: string; state: string; auth_version: string }>('SELECT id,state,auth_version FROM templux.accounts WHERE id=$1 FOR UPDATE', [change.accountId])).rows[0];
      if (!account) throw new ManagementError('account_not_found',404,'未找到目标账号。');
      if (change.expectedVersion !== undefined && change.expectedVersion !== account.auth_version)
        throw new ManagementError('account_conflict',409,'目标账号已经变更，请刷新后重新确认。');
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
      if (beforeAdmins > 0 && await effectiveAdmins() === 0) throw new ManagementError('last_admin',409,'不能停用或降权最后一个有效管理员，请先建立另一位管理员。');
      await audit(client, operator?.loginMethod ?? 'cli', operator ? `account:${operator.id}` : actor as string, 'authorization_changed', account.id,
        { before: { state: account.state, roles: before }, after: { state: change.state, roles: change.roles } });
      return { ok: true, command: 'authorize', accountId: account.id, roles: change.roles, state: change.state, reloginRequired: true, selfChanged: operator?.id === account.id };
    });
  } catch (error) {
    if (error instanceof OperationError || error instanceof AuthError) throw error;
    throw new ManagementError('management_save_failed',503,'授权或审计保存失败，变更未提交。');
  }
}
export async function listAccounts(pool: pg.Pool) {
  return (await pool.query(`SELECT a.id,a.display_name AS name,a.state,a.kind,a.responsible_person_id AS "responsiblePersonId",
    coalesce(array_agg(r.role_key ORDER BY r.role_key) FILTER(WHERE r.role_key IS NOT NULL),'{}') AS roles
    FROM templux.accounts a LEFT JOIN templux.account_roles r ON r.account_id=a.id GROUP BY a.id ORDER BY a.id LIMIT 100`)).rows;
}
