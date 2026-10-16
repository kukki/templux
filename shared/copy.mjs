/** Instance-bound clipboard feedback. Snapshots and diagnostics never contain the target. */
export function createCopyFeedback({value,label,emptyMode='disable',feedbackMs=1000,write,schedule=setTimeout,cancel=clearTimeout}){
 if((value!=null&&typeof value!=='string')||typeof label!=='string'||!label.trim()||label.length>200||!['hide','disable'].includes(emptyMode)||!Number.isInteger(feedbackMs)||feedbackMs<100||feedbackMs>60000||typeof write!=='function')throw new Error('Invalid copy control configuration');
 const empty=value==null||value.length===0,listeners=new Set();let status='idle',ended=false,generation=0,timer,snapshot;
 const publish=()=>{snapshot=Object.freeze({status,empty,hidden:empty&&emptyMode==='hide',ended});for(const listener of listeners)listener();};
 const invalidate=()=>{generation++;if(timer!==undefined)cancel(timer);timer=undefined;status='idle';};
 publish();
 return {
  getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  copy(){if(ended||empty||status==='pending')return;invalidate();const attempt=generation;status='pending';publish();
   const fail=error=>{if(ended||attempt!==generation)return;status=error?.name==='NotAllowedError'?'denied':error?.name==='NotSupportedError'?'unsupported':'failed';publish();};
   let result;try{result=write(value);}catch(error){fail(error);return;}
   void Promise.resolve(result).then(()=>{if(ended||attempt!==generation)return;status='copied';timer=schedule(()=>{if(ended||attempt!==generation)return;timer=undefined;status='idle';publish();},feedbackMs);publish();},fail);
  },
  invalidate(){invalidate();publish();},
  end(){invalidate();ended=true;publish();},
 };
}

/** Plain text presentation only; no clipboard value, identity, HTML or side effects. */
export function resolveCopyMessages(base,overrides){
 const keys=['action','pending','succeeded','retry','empty','denied','unsupported','failed'];
 const valid=(value,partial)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).some(k=>!keys.includes(k)||typeof value[k]!=='string'||!value[k].trim()||value[k].length>300)||!partial&&keys.some(k=>!Object.hasOwn(value,k)))throw new Error('Invalid copy messages');};
 valid(base,false);if(overrides!==undefined)valid(overrides,true);return Object.freeze({...base,...overrides});
}
