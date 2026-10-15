import timers from 'node:timers/promises';import {parseConfig} from './config.mjs';import {checkUpdates} from './check.mjs';
export {nextDelay} from './state.mjs';
// Node truncates delays above this value to 1ms. Monotonic time avoids wall-clock jumps mid-wait.
export async function waitFor(ms,signal){const deadline=performance.now()+ms;signal?.throwIfAborted();for(let remaining=deadline-performance.now();remaining>0;remaining=deadline-performance.now())await timers.setTimeout(Math.ceil(Math.min(2147483647,remaining)),undefined,{signal});}
export async function schedule(options,{maxRuns=Infinity,signal,onResult=()=>{}}={}){
 const c=parseConfig(options.config),interval=c.intervalSeconds*1000;let runs=0,automatic={},clockRollback=false;
 while(runs<maxRuns&&!signal?.aborted){
  const invokedAt=Date.now(),result=await checkUpdates({...options,config:c,automatic});
  if(result.status==='deferred'){
   clockRollback ||= result.clockRollback;
   try{await waitFor(result.delayMs,signal);}catch(e){if(e.name==='AbortError'&&signal?.aborted)break;throw e;}
   automatic={...result,waited:true};continue;
  }
  const startedAt=result.attemptedAt??invokedAt;await onResult({...result,startedAt,clockRollback,nextAttemptNoEarlierThan:startedAt+interval});runs++;automatic={};clockRollback=false;
  // Lock contention and failures before publishing attempt must not form a tight retry loop.
  if(result.attemptedAt===undefined&&runs<maxRuns)try{await waitFor(interval,signal);}catch(e){if(e.name==='AbortError'&&signal?.aborted)break;throw e;}
 }
 return{runs};
}
