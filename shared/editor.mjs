/** String-field edit state. Normalization/validation are pure project policies. */
export function createEditor({initial,normalize,validate,failureMessage,timeoutMs,timeoutMessage,lockWhileSaving=false}) {
 if(timeoutMs!==undefined&&(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000||!timeoutMessage?.trim()))throw new Error('A deadline of 1–300000ms and an unconfirmed-result message are required');
 const fields=Object.keys(initial),copy=v=>Object.freeze({...v}),same=(a,b)=>fields.every(key=>a[key]===b[key]);
 let baseline=copy(normalize(copy(initial))),generation=0,revision=0,controller=null,uncertainRevision=0;
 let state=Object.freeze({values:copy(initial),errors:copy({}),formError:'',dirty:!same(normalize(initial),baseline),saving:false,blocked:false,uncertain:null,status:'idle'});
 const listeners=new Set();
 const publish=patch=>{const next={...state,...patch};state=Object.freeze({...next,blocked:lockWhileSaving&&next.saving,dirty:!same(normalize(next.values),baseline)});for(const listener of listeners)listener();};
 const recheckExposed=values=>{const validation=validate(normalize(values)),errors={};for(const key of fields)if(state.errors[key]&&validation[key])errors[key]=validation[key];return errors;};
 const cancel=()=>{generation++;controller?.abort();controller=null;publish({saving:false,uncertain:null,status:'idle',formError:state.uncertain?'':state.formError});};
 const acknowledge=(values,savedRevision)=>{baseline=copy(normalize(copy(values)));const current=revision===savedRevision?baseline:state.values;publish({values:current,saving:false,uncertain:null,status:same(normalize(current),baseline)?'saved':'idle',errors:copy(recheckExposed(current)),formError:''});};
 return {
  getSnapshot:()=>state,
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  change(key,value){if(state.blocked)return false;if(!fields.includes(key))throw new Error('Unknown edit field');revision++;const values=copy({...state.values,[key]:value}),errors={...state.errors};if(errors[key]){const message=validate(normalize(values))[key];if(message)errors[key]=message;else delete errors[key];}publish({values,errors:copy(errors),status:state.uncertain?'unconfirmed':'idle',formError:state.uncertain?state.formError:''});return true;},
  blur(key){if(!fields.includes(key))throw new Error('Unknown edit field');const errors={...state.errors},message=validate(normalize(state.values))[key];if(message)errors[key]=message;else delete errors[key];publish({errors:copy(errors)});},
  cancel,
  reset(values=baseline){if(state.blocked)return false;cancel();revision++;baseline=copy(normalize(copy(values)));publish({values:copy(values),errors:copy({}),formError:'',uncertain:null,status:'idle'});return true;},
  reconcile(attemptId,result){if(state.uncertain?.attemptId!==attemptId||state.saving)return false;if(result.kind==='saved')acknowledge(result.values,uncertainRevision);else if(result.kind==='not-applied')publish({uncertain:null,formError:'',status:'idle'});else return false;return true;},
  async submit(save){
   if(state.saving||state.uncertain)return;
   const submitted=copy(normalize(state.values)),errors=copy(validate(submitted));
   if(Object.values(errors).some(Boolean)){publish({errors,status:'error',formError:''});return;}
   const id=++generation,submittedRevision=revision,request=new AbortController(),attemptId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');controller=request;
   publish({saving:true,status:'saving',errors:copy({}),formError:''});
   let timer,cancelWait;const aborted=new Promise(resolve=>{cancelWait=()=>resolve({kind:'cancelled'});request.signal.addEventListener('abort',cancelWait,{once:true});});
   const deadline=timeoutMs===undefined?new Promise(()=>{}):new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'unconfirmed'}),timeoutMs);});
   let result;try{result=await Promise.race([save(submitted,request.signal,{attemptId}),deadline,aborted]);}catch{result={kind:'error',message:failureMessage};}finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancelWait);}
   if(id!==generation)return;
   controller=null;
   if(result.kind==='unconfirmed'){
    generation++;request.abort();uncertainRevision=submittedRevision;publish({saving:false,uncertain:Object.freeze({attemptId,values:submitted}),status:'unconfirmed',formError:result.message||timeoutMessage||failureMessage});return {kind:'unconfirmed',attemptId};
   }
   if(result.kind==='saved')acknowledge(result.values,submittedRevision);
   else if(result.kind==='fields'){
    const current=normalize(state.values),applicable=recheckExposed(state.values);for(const key of fields)if(!applicable[key]&&current[key]===submitted[key]&&result.errors[key])applicable[key]=result.errors[key];
    publish({saving:false,status:'error',errors:copy(applicable),formError:Object.keys(applicable).length?'':failureMessage});
   }else if(result.kind==='ended'){cancel();}
   else publish({saving:false,status:'error',formError:result.message||failureMessage});
   return result;
  }
 };
}
