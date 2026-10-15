import {databasePool} from './database.js';import {bestEffortAudit,type AuditResult} from './audit-store.js';import {runtimeRecord} from '../../../shared/runtime-log.mjs';
const operations=new Set(['start','stop','init','test','typecheck','config-check','maintenance-rescue','maintenance-halt','maintenance-resume']);
export async function recordOperation(command:string,result:AuditResult){if(!operations.has(command))return;runtimeRecord('management',result==='success'?'info':'error','maintenance_command',{command,result});
 if(!process.env.DATABASE_URL){runtimeRecord('management','error','maintenance_audit_unavailable',{command});return;}
 let pool;try{pool=databasePool();const actor=`host-uid:${process.env.TEMPLUX_HOST_UID??process.getuid?.()??'unknown'}`;await bestEffortAudit(pool,'cli',actor,'maintenance_command',null,{command},result,()=>runtimeRecord('management','error','maintenance_audit_unavailable',{command}));}catch{runtimeRecord('management','error','maintenance_audit_unavailable',{command});}finally{await pool?.end();}
}
