import {assertNoRestoreBlock,maintenanceReleased,publishMaintenanceRelease,maintenanceReleasePath} from './maintenance-release.js';
import {createInterface} from 'node:readline/promises';
import {stdin,stderr} from 'node:process';
import {databasePool,OperationError} from './database.js';
import {readMaintenance,maintenanceOperation,type MaintenanceAction} from './maintenance.js';
export async function maintenanceCommand(command:string,options:Map<string,string>,flags:Set<string>,interactive:boolean,compose:(args:string[])=>Promise<void>){
 const action=command.slice('maintenance-'.length),allowed=action==='start'?['--expected-version','--at','--message']:action==='rescue'||action==='status'?[]:['--expected-version'];
 if([...options.keys()].some(key=>!allowed.includes(key))||flags.has('--overwrite'))throw new OperationError('维护命令参数无效。');
 const prompt=interactive?createInterface({input:stdin,output:stderr}):undefined;
 try{
  if(prompt&&action!=='status'&&action!=='rescue')for(const [key,label] of [['--expected-version','maintenance-status的版本'],...(action==='start'?[['--at','计划时刻（ISO含时区）'],['--message','公开维护说明（不得含敏感内容）']]:[])])if(!options.has(key!))options.set(key!,await prompt.question(`${label}：`));
  if(action!=='status'&&!flags.has('--confirm')){if(!prompt)throw new OperationError('维护操作需要显式 --confirm。');stderr.write(`维护动作：${action}；版本：${options.get('--expected-version')??'救援不核验'}。halt停止业务而保留入口/DB；rescue不能证明停写屏障或审计。\n`);if((await prompt.question('输入 yes 确认：')).trim()!=='yes')throw new OperationError('已取消维护操作。');}
  if(action==='rescue'){await compose(['stop','--timeout','30','web','api']);stderr.write('救援只停止业务容器，未确认数据库写屏障或持久审计；请核对DB、维护状态及在途操作后恢复。\n');return {ok:true,command,containersStopped:true,barrierVerified:false,auditSaved:false,state:'unknown'};}
  if(action==='resume')assertNoRestoreBlock();maintenanceReleasePath();const pool=databasePool();try{
   if(action==='status'){const state=await readMaintenance(pool);return {ok:true,command,state,accessReady:maintenanceReleased(state)};}
   const expectedVersion=options.get('--expected-version');if(expectedVersion===undefined)throw new OperationError('必须指定 --expected-version；先运行 maintenance-status。');
   if(action==='halt'||action==='resume')try{const response=await fetch('http://entry:8080/health/live',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error();}catch{throw new OperationError('维护入口未确认存活，请先启动entry并核对；本命令尚未停止或恢复业务。');}
   const external=async()=>{if(action==='halt')await compose(['stop','--timeout','30','web','api']);if(action==='resume')await compose(['up','-d','--no-build','--wait','--wait-timeout','90','api','web']);};
   const result=await maintenanceOperation(pool,action as MaintenanceAction,{expectedVersion,at:options.get('--at'),message:options.get('--message')},`host-uid:${process.env.TEMPLUX_HOST_UID??process.getuid?.()??'unknown'}`,external,async state=>{if(action==='resume')publishMaintenanceRelease(state);});
   if(action==='resume'&&!maintenanceReleased(result.state))throw new OperationError('数据库维护状态已提交，但入口释放未确认，请核对后处理。');
   return {...result,command,accessReady:maintenanceReleased(result.state),...(action==='halt'?{containersStopped:true}:{}),...(action==='resume'?{servicesHealthy:true}:{})};
  }finally{await pool.end();}
 }finally{prompt?.close();}
}
