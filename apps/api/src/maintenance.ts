import type pg from 'pg';
import {OperationError} from './database.js';
import {writeAudit} from './audit-store.js';
import {validateMaintenanceStart,type MaintenanceState} from '../../../shared/maintenance.mjs';
export type MaintenanceAction='start'|'cancel'|'end'|'halt'|'resume';
export type MaintenanceInput={expectedVersion:string;at?:string;message?:string};
export async function readMaintenance(db:pg.Pool|pg.PoolClient):Promise<MaintenanceState>{
 const row=(await db.query("SELECT version::text,gate_version::text AS \"gateVersion\",phase,active,planned_at AS \"plannedAt\",message,clock_timestamp() AS \"serverNow\" FROM templux.maintenance_state WHERE singleton")).rows[0];
 if(!row||!['online','offline'].includes(row.phase)||typeof row.active!=='boolean')throw new OperationError('维护状态无法确认，访问保持不可用。');
 return {...row,plannedAt:row.plannedAt?.toISOString()??null,serverNow:row.serverNow.toISOString()};
}
export async function maintenanceOperation(pool:pg.Pool,action:MaintenanceAction,input:MaintenanceInput,actor:string,external:()=>Promise<void>=async()=>{},afterCommit:(state:MaintenanceState)=>Promise<void>=async()=>{}){
 if(!/^(0|[1-9][0-9]{0,18})$/.test(input.expectedVersion)||BigInt(input.expectedVersion)>9223372036854775807n)throw new OperationError('必须指定maintenance-status返回的 --expected-version。');
 let notice:{at:string;message:string}|undefined;
 if(action==='start')try{notice=validateMaintenanceStart({at:input.at,message:input.message});}catch(error){throw new OperationError((error as Error).message);}
 const client=await pool.connect();let locked=false,discard=false,inTransaction=false;
 try{
  locked=(await client.query("SELECT pg_try_advisory_lock(hashtext('templux:maintenance-operation')) AS locked")).rows[0].locked;
  if(!locked)throw new OperationError('另一维护操作正在执行，请核对状态后重试。');
  let before=await readMaintenance(client);
  if(before.version!==input.expectedVersion)throw new OperationError('维护版本已改变，请重新查询并确认。');
  if(action==='resume')await external();
  await client.query('BEGIN');inTransaction=true;
  // Exclusive barrier is acquired BEFORE the singleton row to avoid writers' lock inversion.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('templux:business-writes'))");
  before=await readMaintenance(client);
  if(before.version!==input.expectedVersion)throw new OperationError('维护版本已改变，请重新查询并确认。');
  if(['start','cancel','end'].includes(action)&&before.phase!=='online')throw new OperationError('业务访问仍关闭，请先显式恢复后管理提醒。');
  const phase=action==='halt'?'offline':action==='resume'?'online':before.phase,active=action==='start'?true:['cancel','end'].includes(action)?false:before.active,at=notice?.at??(active?before.plannedAt:null),message=notice?.message??(active?before.message:'');
  const changed=phase!==before.phase||active!==before.active||at!==before.plannedAt||message!==before.message;
  if(changed){await client.query('UPDATE templux.maintenance_state SET gate_version=gate_version+CASE WHEN phase<>$1 THEN 1 ELSE 0 END,version=version+1,phase=$1,active=$2,planned_at=$3,message=$4,updated_at=clock_timestamp() WHERE singleton',[phase,active,at,message]);
   const state=await readMaintenance(client);const events={start:'maintenance_notice_started',cancel:'maintenance_notice_cancelled',end:'maintenance_notice_ended',halt:'maintenance_gate_closed',resume:'maintenance_gate_opened'};
   await writeAudit(client,'cli',actor,events[action],null,{maintenanceVersion:state.version,gateVersion:state.gateVersion,maintenancePhase:phase,noticeActive:active,plannedAt:at});
  }
  const state=await readMaintenance(client);
  if(!changed&&action==='resume')await writeAudit(client,'cli',actor,'maintenance_release_authorized',null,{maintenanceVersion:state.version,gateVersion:state.gateVersion,maintenancePhase:state.phase,noticeActive:state.active});
  try{await client.query('COMMIT');inTransaction=false;}catch{discard=true;inTransaction=false;throw new OperationError('维护提交结果未确认。请查询状态和审计，不要自动重试或执行后续停服。');}
  await afterCommit(state);
  if(action==='halt')await external();
  // Do not claim success if the lock connection was lost during a container action.
  const verified=await readMaintenance(client);if(verified.version!==state.version||verified.phase!==state.phase)throw new OperationError('维护状态已变化，操作结果未确认，请核对后处理。');
  return {ok:true,state,changed};
 }catch(error){if(inTransaction)try{await client.query('ROLLBACK');}catch{discard=true;}if(error instanceof OperationError)throw error;throw new OperationError('维护操作未完成，请核对持久状态、审计及容器；不要自动重试。');}
 finally{if(locked&&!discard)try{await client.query("SELECT pg_advisory_unlock(hashtext('templux:maintenance-operation'))");}catch{discard=true;}client.release(discard);}
}
