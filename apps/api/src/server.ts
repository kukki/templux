import {installRuntimeConsole,runtimeRecord} from '../../../shared/runtime-log.mjs';
import { databasePool } from './database.js';
import { createApplication } from './application.js';
let pool:ReturnType<typeof databasePool>|undefined;
try {
  const activePool=databasePool();pool=activePool;
  installRuntimeConsole('api');
  const server = await createApplication(activePool);
  activePool.on('error', () => server.log.error({ event: 'database_pool_error' }, '数据库连接失效。'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void (async()=>{try{await server.close();await activePool.end();}catch{process.exitCode=1;}})(); });
  await server.listen({ host: '0.0.0.0', port: 8080 });
} catch {
  runtimeRecord('api','error','application_start_failed');
  await pool?.end(); process.exitCode = 1;
}
