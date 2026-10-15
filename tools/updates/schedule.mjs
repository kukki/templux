import {setTimeout as wait} from 'node:timers/promises';import {parseConfig} from './config.mjs';import {lastAttempt} from './state.mjs';import {checkUpdates} from './check.mjs';
export function nextDelay(last,now,interval){if(!last)return{ms:0,clockRollback:false};return{ms:Math.min(interval,Math.max(0,last+interval-now)),clockRollback:last>now};}
export async function schedule(options,{maxRuns=Infinity,signal,onResult=()=>{}}={}){
 const c=parseConfig(options.config),interval=c.intervalSeconds*1000;let runs=0;
 while(runs<maxRuns&&!signal?.aborted){const d=nextDelay(lastAttempt(options.state),Date.now(),interval);if(d.ms)try{await wait(d.ms,undefined,{signal});}catch{break;}if(signal?.aborted)break;const startedAt=Date.now(),result=await checkUpdates({...options,config:c});await onResult({...result,startedAt,clockRollback:d.clockRollback,nextAttemptNoEarlierThan:startedAt+interval});runs++;
  // Contention does not update our attempt record. Still avoid a tight retry loop.
  if(result.status==='locked'&&runs<maxRuns)try{await wait(interval,undefined,{signal});}catch{break;}
 }
 return{runs};
}
