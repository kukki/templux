import { databasePool, migrate, OperationError, schemaVersion, migrations } from './database.js';

const pool = databasePool();
try {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--json', '--check'].includes(arg))) throw new OperationError('迁移参数无效。');
  const result = args.includes('--check')
    ? { schemaVersion: await schemaVersion(pool, await migrations()), applied: 0 }
    : await migrate(pool);
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  console.error(JSON.stringify({ event: 'migration_failed', message: error instanceof OperationError
    ? error.message : '数据库连接或迁移失败，部署已中止。' }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
