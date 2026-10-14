import { databasePool } from './database.js';
import { createApplication } from './application.js';
const pool = databasePool();
try {
  const server = await createApplication(pool);
  pool.on('error', () => server.log.error({ event: 'database_pool_error' }, '数据库连接失效。'));
  server.addHook('onClose', async () => { await pool.end(); });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void server.close().catch(() => { process.exitCode = 1; }); });
  await server.listen({ host: '0.0.0.0', port: 8080 });
} catch {
  console.error(JSON.stringify({ event: 'application_start_failed', message: '应用配置或启动失败。' }));
  await pool.end(); process.exitCode = 1;
}
