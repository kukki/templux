import type pg from 'pg';
export type AuditSource='cli'|'feishu'|'password'|'system';
export type AuditResult='success'|'denied'|'failed';
const id=(value:unknown)=>typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n?value:null;
const roles=(value:unknown)=>Array.isArray(value)?value.filter(v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,79}$/.test(v)).slice(0,100):undefined;
// Deliberate allowlist: never serialize arbitrary input, provider payloads or delivery metadata.
export function auditDetails(input:unknown,depth=0):Record<string,unknown>{
 const output:Record<string,unknown>={};if(depth>3||!input||typeof input!=='object'||Array.isArray(input))return output;const value=input as Record<string,unknown>;
 for(const key of ['maintenanceVersion','gateVersion'])if(typeof value[key]==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(value[key] as string))output[key]=value[key];
 if(['online','offline'].includes(value.maintenancePhase as string))output.maintenancePhase=value.maintenancePhase;
 if(typeof value.noticeActive==='boolean')output.noticeActive=value.noticeActive;
 if(typeof value.plannedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.plannedAt))output.plannedAt=value.plannedAt;
 const state=value.accountState??value.state;if(['pending','active','disabled'].includes(state as string))output.accountState=state;
 for(const key of ['before','after'])if(value[key]&&typeof value[key]==='object'){const item=value[key] as Record<string,unknown>;output[key]=auditDetails(item,depth+1);}
 const selected=roles(value.roles);if(selected)output.roles=selected;
 if(['person','agent'].includes(value.kind as string))output.kind=value.kind;
 if(['password','feishu'].includes(value.method as string))output.method=value.method;
 for(const key of ['owner','requestId']){const identifier=id(value[key]);if(identifier)output[key]=identifier;}
 for(const key of ['removed','retentionDays'])if(Number.isSafeInteger(value[key])&&(value[key] as number)>=0)output[key]=value[key];
 if(['start','stop','init','test','typecheck','config-check','maintenance-halt','maintenance-resume','backup','maintenance-rescue'].includes(value.command as string))output.command=value.command;
 if(['invalid_credentials','login_limited','organization_denied','login_cancelled','invalid_state','provider_invalid','provider_unavailable','origin_denied','authentication_unconfigured','service_unavailable'].includes(value.reason as string))output.reason=value.reason;
 return output;
}
export function auditActor(source:AuditSource,value:string){
 if(source==='cli')return {actor:/^host-uid:(?:[0-9]{1,10}|unknown)$/.test(value)?value:'host-uid:unverified',assurance:'host_claim',accountId:null};
 if(source==='system')return {actor:'system:audit-retention',assurance:'service',accountId:null};
 const accountId=value.startsWith('account:')?id(value.slice(8)):null;
 return accountId?{actor:`account:${accountId}`,assurance:'application_session',accountId}:{actor:'anonymous',assurance:'unverified',accountId:null};
}
export async function writeAudit(client:pg.Pool|pg.PoolClient,source:AuditSource,actor:string,event:string,target:string|null,details:object,result:AuditResult='success'){
 if(!/^[a-z][a-z0-9_]{0,79}$/.test(event)||!['cli','feishu','password','system'].includes(source)||target!==null&&!id(target))throw new Error('Invalid server audit metadata');
 const identity=auditActor(source,actor);if(identity.accountId&&['account_registered','login_succeeded'].includes(event))identity.assurance='verified_identity';
 // Snapshot ownership in the INSERT statement itself; pool-based login audit does not race two separate reads.
 await client.query('INSERT INTO templux.audit_events(source,actor,event,account_id,details,result,actor_assurance,actor_account_id,actor_kind,actor_responsible_person_id,target_kind,target_responsible_person_id) SELECT $1,$2,$3,$4,$5::jsonb,$6,$7,a.id,a.kind,a.responsible_person_id,t.kind,t.responsible_person_id FROM (SELECT 1) base LEFT JOIN templux.accounts a ON a.id=$8::bigint LEFT JOIN templux.accounts t ON t.id=$4::bigint',[source,identity.actor,event,target,JSON.stringify(auditDetails(details)),result,identity.assurance,identity.accountId]);
}
export async function bestEffortAudit(pool:pg.Pool,source:AuditSource,actor:string,event:string,target:string|null,details:object,result:AuditResult,failed:()=>void){try{await writeAudit(pool,source,actor,event,target,details,result);}catch{failed();}}
