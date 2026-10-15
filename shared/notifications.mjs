/** In-memory notification state. Call tick with a monotonic clock; timers belong to the view. */
export function createNotifications({durationMs=15000,visible:limit=3,queueCapacity=50,now=()=>performance.now()}={}){
 const integer=(n,max)=>Number.isSafeInteger(n)&&n>=1&&n<=max;
 if(!integer(durationMs,3600000)||!integer(limit,10)||!integer(queueCapacity,500)||typeof now!=='function')throw new Error('Invalid notification configuration');
 const listeners=new Set();let visible=[],waiting=[],suspended=[],omitted=0,ended=false,sequence=0,last=now(),snapshot;
 if(!Number.isFinite(last))throw new Error('A finite monotonic clock is required');
 const item=value=>Object.freeze({...value,pauses:Object.freeze([...value.pauses])});
 const publish=()=>{snapshot=Object.freeze({visible:Object.freeze(visible.map(item)),waiting:Object.freeze(waiting.map(item)),suspended:Object.freeze(suspended.map(item)),omitted,ended});for(const listener of listeners)listener();};
 const advance=()=>{const time=now();if(!Number.isFinite(time)||time<last)throw new Error('A finite monotonic clock is required');const elapsed=time-last;last=time;for(const value of visible)if(!value.pauses.size)value.remainingMs=Math.max(0,value.remainingMs-elapsed);visible=visible.filter(value=>value.remainingMs>0);};
 const fill=()=>{while(visible.length<limit&&(suspended.length||waiting.length))visible.push(suspended.shift()??waiting.shift());};
 const update=(action,{refillBefore=true}={})=>{advance();if(refillBefore)fill();const result=action();fill();publish();return result;};
 publish();
 return {
  getSnapshot:()=>snapshot,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  push(input){
   if(ended)return null;
   const {title,message,level='info',key,durationMs:duration=durationMs}=input;
   if(typeof title!=='string'||!title.trim()||title.length>200||typeof message!=='string'||!message.trim()||message.length>4000||!['info','success','warning','error'].includes(level)||(key!==undefined&&(typeof key!=='string'||!key.trim()||key.length>200))||!integer(duration,3600000))throw new Error('Invalid notification');
   return update(()=>{const existing=key===undefined?undefined:[...visible,...suspended,...waiting].find(value=>value.key===key&&value.level===level);if(existing){existing.count=Math.min(Number.MAX_SAFE_INTEGER,existing.count+1);return existing.id;}
    const value={id:`notice-${++sequence}`,title,message,level,key,durationMs:duration,remainingMs:duration,count:1,pauses:new Set()};
    if(visible.length<limit)visible.push(value);else{if(waiting.length===queueCapacity){waiting.shift();omitted=Math.min(Number.MAX_SAFE_INTEGER,omitted+1);}waiting.push(value);}return value.id;});
  },
  tick(){return update(()=>{});},
  pause(id,reason,paused){if(!['hover','focus'].includes(reason)||typeof paused!=='boolean')throw new Error('Invalid pause reason');return update(()=>{const value=visible.find(value=>value.id===id);if(!value)return false;if(paused)value.pauses.add(reason);else value.pauses.delete(reason);return true;});},
  close(id){return update(()=>{const all=[visible,suspended,waiting],list=all.find(values=>values.some(value=>value.id===id));if(!list)return false;list.splice(list.findIndex(value=>value.id===id),1);return true;});},
  // Resize before promotion: only survivors of a published visible snapshot may be suspended.
  setLimit(value){if(!integer(value,10))throw new Error('Invalid visible notification limit');return update(()=>{limit=value;if(visible.length>limit){const removed=visible.splice(limit);for(const value of removed)value.pauses.clear();suspended.unshift(...removed);}},{refillBefore:false});},
  clear(){visible=[];waiting=[];suspended=[];omitted=0;last=now();publish();},
  end(){ended=true;this.clear();},
 };
}
