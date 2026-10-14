import { presentation } from '../../../shared/presentation.mjs';
import type pg from 'pg';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { type AuthConfig, type Roles, AuthError, readSessionConfig } from './auth-config.js';
import { loadSession, requirePermission, transaction } from './auth-store.js';
import { ManagementError, setAuthorization } from './authorization.js';

export function registerAccountManagement(server: FastifyInstance, pool: pg.Pool, config: AuthConfig | null, roles: Roles, sessionToken: (request: FastifyRequest) => string | undefined) {
  const pagination = presentation().elements.pagination;
  const origin = config?.publicOrigin ?? readSessionConfig().publicOrigin;
  server.get('/api/admin/accounts', async request => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some(key => !['q','state','kind','page','pageSize'].includes(key))
      || Object.values(query).some(value => typeof value !== 'string')
      || (query.q !== undefined && (query.q as string).length > 200)
      || (query.state !== undefined && !['pending','active','disabled'].includes(query.state as string))
      || (query.kind !== undefined && !['person','agent'].includes(query.kind as string))) throw new ManagementError('invalid_management_input',400,'查询条件无效。');
    const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? pagination.pageSize);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !pagination.pageSizes.includes(pageSize)) throw new ManagementError('invalid_management_input',400,'分页条件无效。');
    return transaction(pool, async client => {
      await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('templux:authorization'))");
      const operator = await loadSession(client,sessionToken(request),config,roles,true);
      requirePermission(operator,'accounts:manage');
      const search = String(query.q ?? '').replace(/[\\%_]/g, char => `\\${char}`);
      const values = [`%${search}%`,query.state ?? null,query.kind ?? null];
      const where = `WHERE (a.display_name ILIKE $1 OR a.id::text ILIKE $1) AND ($2::text IS NULL OR a.state=$2) AND ($3::text IS NULL OR a.kind=$3)`;
      const total = Number((await client.query<{count:string}>(`SELECT count(*) FROM templux.accounts a ${where}`,values)).rows[0]!.count);
      const pages = Math.max(1,Math.ceil(total/pageSize)), currentPage = Math.min(page,pages);
      const accounts = (await client.query(`SELECT a.id,a.display_name AS name,a.state,a.kind,a.auth_version AS "authVersion",
        a.responsible_person_id AS "responsiblePersonId",o.display_name AS "responsiblePersonName",
        coalesce((SELECT array_agg(role_key ORDER BY role_key) FROM templux.account_roles r WHERE r.account_id=a.id),'{}') AS roles
        FROM templux.accounts a LEFT JOIN templux.accounts o ON o.id=a.responsible_person_id ${where}
        ORDER BY a.id LIMIT $4 OFFSET $5`,[...values,pageSize,(currentPage-1)*pageSize])).rows;
      return {ok:true,accounts,roles,total,page:currentPage,pageSize,pages};
    });
  });
  server.post('/api/admin/accounts/:id/authorization',{bodyLimit:16384},async request => {
    if (request.headers.origin !== origin) throw new AuthError('origin_denied',403);
    const input = request.body as Record<string,unknown> | null;
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key=>!['roles','state','expectedVersion','confirm'].includes(key))
      || input.confirm !== true || !Array.isArray(input.roles) || input.roles.some(role=>typeof role !== 'string') || input.roles.length > 100
      || !['active','disabled'].includes(input.state as string) || typeof input.expectedVersion !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input.expectedVersion))
      throw new ManagementError('invalid_management_input',400,'请核对状态、角色和目标版本，并明确确认。');
    const {id} = request.params as {id:string};
    return setAuthorization(pool,{accountId:id,roles:input.roles as string[],state:input.state as 'active'|'disabled',expectedVersion:input.expectedVersion},
      {token:sessionToken(request),config},roles,config ? {appId:config.appId,tenantKey:config.tenantKey} : null);
  });
}
