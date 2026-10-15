import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export class OperationError extends Error {}

export function databasePool(): pg.Pool {
  const value = process.env.DATABASE_URL;
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    throw new OperationError('DATABASE_URL 必须是有效的 PostgreSQL 连接地址。');
  }
  return new pg.Pool({
    connectionString: value,
    max: 5,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    idleTimeoutMillis: 10000,
  });
}

type Migration = { version: string; sql: string; checksum: string };

export async function migrations(): Promise<Migration[]> {
  const directory = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));
  const names = (await readdir(directory)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name)).sort();
  if (!names.length) throw new OperationError('未找到数据库迁移，部署已中止。');
  const result = await Promise.all(names.map(async name => {
    const sql = await readFile(`${directory}/${name}`, 'utf8');
    return { version: name.slice(0, 4), sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
  if (new Set(result.map(item => item.version)).size !== result.length) {
    throw new OperationError('数据库迁移版本重复，部署已中止。');
  }
  return result;
}

type AppliedMigration = { version: string; checksum: string };

function validateHistory(applied: AppliedMigration[], expected: Migration[]): void {
  for (const [index, row] of applied.entries()) {
    const source = expected[index];
    if (!source || source.version !== row.version || source.checksum !== row.checksum) {
      throw new OperationError('数据库迁移历史与当前发布不匹配，部署已中止。');
    }
  }
}

export async function schemaVersion(pool: pg.Pool | pg.PoolClient, expected: Migration[]): Promise<string> {
  const result = await pool.query<AppliedMigration>(
    'SELECT version, checksum FROM public.templux_migrations ORDER BY version',
  );
  validateHistory(result.rows, expected);
  if (result.rows.length !== expected.length) throw new OperationError('数据库存在待执行迁移。');
  const structure = await pool.query<{ schema_exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS schema_exists', ['templux'],
  );
  if (structure.rows[0]?.schema_exists !== true) throw new OperationError('应用数据库结构缺失，部署已中止。');
  if (expected.some(item => item.version === '0002')) {
    const tables = ['accounts', 'identities', 'account_roles', 'auth_sessions', 'oauth_requests', 'audit_events'].map(name => `templux.${name}`);
    const check = await pool.query<{ complete: boolean }>('SELECT bool_and(to_regclass(name) IS NOT NULL) AS complete FROM unnest($1::text[]) AS name', [tables]);
    if (check.rows[0]?.complete !== true) throw new OperationError('认证数据库结构缺失，部署已中止。');
  }
  if (expected.some(item => item.version === '0004')) {
    const check = await pool.query("SELECT to_regclass('templux.password_credentials') IS NOT NULL AS complete");
    if (!check.rows[0]?.complete) throw new OperationError('密码数据库结构缺失，部署已中止。');
  }
  if (expected.some(item => item.version === '0005')) {
    const check=await pool.query("SELECT to_regclass('templux.password_failures') IS NOT NULL AS complete");
    if(!check.rows[0]?.complete)throw new OperationError('密码失败限制结构缺失，部署已中止。');
  }
  if(expected.some(item=>item.version==='0006')){const check=await pool.query("SELECT to_regclass('templux.login_method_requests') IS NOT NULL AS complete");if(!check.rows[0]?.complete)throw new OperationError('登录方式验证结构缺失，部署已中止。');}
  if(expected.some(item=>item.version==='0007')){const check=await pool.query("SELECT count(*)=2 AS complete FROM information_schema.columns WHERE table_schema='templux' AND table_name='oauth_requests' AND column_name IN ('purpose','login_request_id')");if(!check.rows[0]?.complete)throw new OperationError('OAuth用途结构缺失，部署已中止。');}
  if(expected.some(item=>item.version==='0008')){const check=await pool.query("SELECT count(*)=8 AS complete FROM information_schema.columns WHERE table_schema='templux' AND table_name='audit_events' AND column_name IN ('result','actor_assurance','actor_account_id','actor_kind','actor_responsible_person_id','target_kind','target_responsible_person_id','occurred_at')");if(!check.rows[0]?.complete)throw new OperationError('审计结构缺失，部署已中止。');}
  if(expected.some(item=>item.version==='0009')){const check=await pool.query("SELECT to_regclass('templux.maintenance_state') IS NOT NULL AND to_regprocedure('templux.guard_maintenance_write()') IS NOT NULL AS complete");if(!check.rows[0]?.complete)throw new OperationError('维护状态与写屏障结构缺失。');const guards=await pool.query("SELECT count(*)=8 AS complete FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='templux' AND c.relname=ANY($1) AND t.tgname='maintenance_write_guard' AND t.tgenabled='O' AND t.tgtype=62 AND t.tgfoid=to_regprocedure('templux.guard_maintenance_write()')",[['accounts','identities','account_roles','auth_sessions','oauth_requests','password_credentials','password_failures','login_method_requests']]);if(!guards.rows[0]?.complete)throw new OperationError('维护写屏障缺失或被禁用。');}
  if(expected.some(item=>item.version==='0010')){const check=await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='templux' AND table_name='maintenance_state' AND column_name='gate_version') AS complete");if(!check.rows[0]?.complete)throw new OperationError('维护入口版本结构缺失。');}
  return result.rows.at(-1)!.version;
}

export async function migrate(pool: pg.Pool, beforeChange?: () => Promise<unknown>): Promise<{ schemaVersion: string; applied: number }> {
  const expected = await migrations();
  const client = await pool.connect();
  let locked = false;
  let appliedCount = 0;
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('templux:migrations')) AS acquired",
    );
    locked = lock.rows[0]?.acquired === true;
    if (!locked) throw new OperationError('另一个迁移正在执行，请稍后重试。');
    const history = (await client.query("SELECT to_regclass('public.templux_migrations') IS NOT NULL AS present")).rows[0]?.present;
    const applied = history ? await client.query<AppliedMigration>('SELECT version, checksum FROM public.templux_migrations ORDER BY version') : {rows: [] as AppliedMigration[]};
    validateHistory(applied.rows, expected);
    if (applied.rows.length < expected.length) {
      // Schema dependency records cover named objects, including standalone types,
      // operators, collations and text-search objects; a relkind list does not.
      // Non-schema object catalogs are checked separately. 16384 is PostgreSQL's
      // FirstNormalObjectId: initdb objects (including default plpgsql) are below it.
      const existing = (await client.query(`SELECT
        EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_')
        OR EXISTS (
          SELECT 1 FROM pg_depend d JOIN pg_namespace n
            ON d.refclassid='pg_namespace'::regclass AND d.refobjid=n.oid
          WHERE n.nspname='public'
            AND NOT (d.classid='pg_class'::regclass AND d.objid=COALESCE(to_regclass('public.templux_migrations')::oid,0))
        )
        OR EXISTS (SELECT 1 FROM pg_extension WHERE oid>=16384)
        OR EXISTS (SELECT 1 FROM pg_language WHERE oid>=16384)
        OR EXISTS (SELECT 1 FROM pg_cast WHERE oid>=16384)
        OR EXISTS (SELECT 1 FROM pg_transform)
        OR EXISTS (SELECT 1 FROM pg_foreign_data_wrapper)
        OR EXISTS (SELECT 1 FROM pg_foreign_server)
        OR EXISTS (SELECT 1 FROM pg_user_mapping)
        OR EXISTS (SELECT 1 FROM pg_event_trigger)
        OR EXISTS (SELECT 1 FROM pg_publication)
        OR EXISTS (SELECT 1 FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database()))
        OR EXISTS (SELECT 1 FROM pg_largeobject_metadata)
        OR EXISTS (SELECT 1 FROM pg_default_acl)
        AS present`)).rows[0]?.present || applied.rows.length > 0;
      if (existing) {
        if (!beforeChange) throw new OperationError('已有结构存在待迁移项，必须先完成受控备份。');
        await beforeChange();
      }
      await client.query(`CREATE TABLE IF NOT EXISTS public.templux_migrations (
        version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    }
    for (const migration of expected.slice(applied.rows.length)) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO public.templux_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, migration.checksum]);
        await client.query('COMMIT');
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return { schemaVersion: await schemaVersion(client, expected), applied: appliedCount };
  } finally {
    try {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('templux:migrations'))");
    } finally {
      client.release();
    }
  }
}
