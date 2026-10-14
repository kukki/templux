import type pg from 'pg';import type {FastifyInstance} from 'fastify';import {transaction} from './auth-store.js';import {writeAudit} from './audit-store.js';import {auditSettings} from './audit-settings.js';import {migrations,schemaVersion} from './database.js';
export async function deleteAuditBatch(client:pg.PoolClient,cutoff:string,limit:number){return Number((await client.query<{count:string}>(`WITH victims AS (SELECT id FROM templux.audit_events WHERE occurred_at < $1::timestamptz ORDER BY occurred_at,id LIMIT $2 FOR UPDATE SKIP LOCKED),removed AS (DELETE FROM templux.audit_events WHERE id IN (SELECT id FROM victims) RETURNING id) SELECT count(*) FROM removed`,[cutoff,limit])).rows[0]!.count);}
export async function cleanupAudit(pool:pg.Pool,settings= auditSettings()){
 return transaction(pool,async client=>{
 await client.query("SET LOCAL statement_timeout='4s'");
 const acquired=(await client.query<{locked:boolean}>("SELECT pg_try_advisory_xact_lock(hashtext('templux:audit-retention')) AS locked")).rows[0]!.locked;if(!acquired)return {removed:0,skipped:true};
 const cutoff=(await client.query<{cutoff:string}>("SELECT (clock_timestamp()-$1*interval '1 day')::text AS cutoff",[settings.days])).rows[0]!.cutoff;const removed=await deleteAuditBatch(client,cutoff,settings.batchSize);
 if(removed)await writeAudit(client,'system','system:audit-retention','audit_retention_cleaned',null,{removed,retentionDays:settings.days});return {removed,skipped:false};
 });
}
export function registerAuditRetention(server:FastifyInstance,pool:pg.Pool){const settings=auditSettings();let stopped=false,timer:ReturnType<typeof setInterval>|undefined,active:Promise<void>|undefined;
 const tick=()=>{if(stopped||active)return;active=(async()=>{try{await schemaVersion(pool,await migrations());for(let batch=0;batch<settings.maximumBatches&&!stopped;batch++){const result=await cleanupAudit(pool,settings);if(result.skipped||result.removed<settings.batchSize)break;}}catch{server.log.error({event:'audit_cleanup_failed'},'审计清理未完成，当前批未提交。');}})().finally(()=>{active=undefined;});};
 server.addHook('onReady',async()=>{timer=setInterval(tick,settings.intervalSeconds*1000);timer.unref();tick();});server.addHook('onClose',async()=>{stopped=true;if(timer)clearInterval(timer);await active;});
}
