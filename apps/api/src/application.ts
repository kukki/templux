import {registerAuditRetention} from './audit-retention.js';
import Fastify,{LogController} from 'fastify';
import {pinoDestination,runtimePolicy} from '../../../shared/runtime-log.mjs';
import type pg from 'pg';
import { presentation } from '../../../shared/presentation.mjs';
import { migrations, schemaVersion } from './database.js';
import { registerAuthRoutes } from './auth-routes.js';
import { readAuthConfig, type AuthConfig } from './auth-config.js';
import type { Transport } from './feishu.js';
export async function createApplication(pool: pg.Pool, authConfig: AuthConfig | null = readAuthConfig(), transport: Transport = fetch) {
  runtimePolicy();const config = presentation(); const expected = await migrations();
  const server = Fastify({ logger: { level: 'info', stream: pinoDestination('api'),
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }, logController:new LogController({disableRequestLogging:true}) });
  server.get('/health/live', async () => ({ status: 'alive' }));
  server.get('/api/status', async (_request, reply) => {
    try { return { name: config.project.name, version: config.project.version, status: 'ready', database: 'connected', schemaVersion: await schemaVersion(pool, expected) }; }
    catch { server.log.error({ event: 'readiness_failed' }, '数据库连接或结构校验失败。'); return reply.code(503).send({ name: config.project.name, status: 'unavailable' }); }
  });
  registerAuthRoutes(server, pool, authConfig, transport);
  registerAuditRetention(server,pool);
  return server;
}
