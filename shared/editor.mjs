/** String-field edit state. Normalization/validation are pure project policies. */
export function createEditor({initial,normalize,validate,failureMessage}) {
 const fields=Object.keys(initial),copy=v=>Object.freeze({...v}),same=(a,b)=>fields.every(key=>a[key]===b[key]);
 let baseline=copy(normalize(copy(initial))),generation=0,revision=0,controller=null;
 let state=Object.freeze({values:copy(initial),errors:copy({}),formError:'',dirty:!same(normalize(initial),baseline),saving:false,status:'idle'});
 const listeners=new Set();
 const publish=patch=>{const next={...state,...patch};state=Object.freeze({...next,dirty:!same(normalize(next.values),baseline)});for(const listener of listeners)listener();};
 const cancel=()=>{generation++;controller?.abort();controller=null;publish({saving:false,status:'idle'});};
 return {
  getSnapshot:()=>state,
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  change(key,value){if(!fields.includes(key))throw new Error('Unknown edit field');revision++;const values=copy({...state.values,[key]:value}),errors={...state.errors};if(errors[key]){const message=validate(normalize(values))[key];if(message)errors[key]=message;else delete errors[key];}publish({values,errors:copy(errors),status:'idle',formError:''});},
  blur(key){if(!fields.includes(key))throw new Error('Unknown edit field');const errors={...state.errors},message=validate(normalize(state.values))[key];if(message)errors[key]=message;else delete errors[key];publish({errors:copy(errors)});},
  cancel,
  reset(values=baseline){cancel();revision++;baseline=copy(normalize(copy(values)));publish({values:copy(values),errors:copy({}),formError:'',status:'idle'});},
  async submit(save){
   if(state.saving)return;
   const submitted=copy(normalize(state.values)),errors=copy(validate(submitted));
   if(Object.values(errors).some(Boolean)){publish({errors,status:'error',formError:''});return;}
   const id=++generation,submittedRevision=revision,request=new AbortController();controller=request;
   publish({saving:true,status:'saving',errors:copy({}),formError:''});
   let result;try{result=await save(submitted,request.signal);}catch{result={kind:'error',message:failureMessage};}
   if(id!==generation)return;
   controller=null;
   if(result.kind==='saved'){
    baseline=copy(normalize(copy(result.values)));
    const values=revision===submittedRevision?baseline:state.values;
    publish({values,saving:false,status:same(normalize(values),baseline)?'saved':'idle',errors:copy({}),formError:''});
   }else if(result.kind==='fields'){
    const current=normalize(state.values),applicable={};for(const key of fields)if(current[key]===submitted[key]&&result.errors[key])applicable[key]=result.errors[key];
    publish({saving:false,status:'error',errors:copy(applicable),formError:Object.keys(applicable).length?'':failureMessage});
   }else if(result.kind==='ended'){cancel();}
   else publish({saving:false,status:'error',formError:result.message||failureMessage});
  }
 };
}
