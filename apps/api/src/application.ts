import {maintenanceReleased,maintenanceReleasePath} from './maintenance-release.js';
import {readMaintenance} from './maintenance.js';
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
  maintenanceReleasePath();runtimePolicy();const config = presentation(); const expected = await migrations();
  const server = Fastify({ logger: { level: 'info', stream: pinoDestination('api'),
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }, logController:new LogController({disableRequestLogging:true}) });
  server.get('/health/live', async () => ({ status: 'alive' }));
  server.get('/api/status', async (_request, reply) => {
    try { return { name: config.project.name, version: config.project.version, status: 'ready', database: 'connected', schemaVersion: await schemaVersion(pool, expected) }; }
    catch { server.log.error({ event: 'readiness_failed' }, '数据库连接或结构校验失败。'); return reply.code(503).send({ name: config.project.name, status: 'unavailable' }); }
  });
  server.get('/api/maintenance',async (_request,reply)=>{reply.header('Cache-Control','no-store');try{const state=await readMaintenance(pool);return {ok:true,state:{...state,accessReady:maintenanceReleased(state)}};}catch{return reply.code(503).send({ok:false,error:'maintenance_unknown'});}});
  server.addHook('onRequest',async(request,reply)=>{if(['/api/status','/api/maintenance','/health/live'].includes(request.url.split('?')[0]!))return;try{const state=await readMaintenance(pool);if(maintenanceReleased(state))return;}catch{}return reply.code(503).send({ok:false,error:'maintenance_unavailable'});});
  registerAuthRoutes(server, pool, authConfig, transport);
  registerAuditRetention(server,pool);
  return server;
}
