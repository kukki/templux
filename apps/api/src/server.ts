import Fastify from 'fastify';
import { databasePool, migrations, schemaVersion } from './database.js';

const pool = databasePool();
const expected = await migrations();
const server = Fastify({
  logger: { level: 'info', stream: process.stderr, redact: ['req.headers.authorization', 'req.headers.cookie'] },
  disableRequestLogging: true,
});
pool.on('error', () => server.log.error({ event: 'database_pool_error' }, '数据库连接失效。'));

server.get('/health/live', async () => ({ status: 'alive' }));
server.get('/api/status', async (_request, reply) => {
  reply.header('Cache-Control', 'no-store');
  try {
    const version = await schemaVersion(pool, expected);
    return { name: 'Templux', version: '0.1.0', status: 'ready', database: 'connected', schemaVersion: version };
  } catch {
    server.log.error({ event: 'readiness_failed' }, '数据库连接或结构校验失败。');
    return reply.code(503).send({ name: 'Templux', status: 'unavailable' });
  }
});
server.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => { void server.close().catch(() => { process.exitCode = 1; }); });
}
await server.listen({ host: '0.0.0.0', port: 8080 });
