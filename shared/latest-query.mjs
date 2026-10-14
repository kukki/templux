export function createLatestQuery(publish){let generation=0,closed=false,controller;
 const invalidate=()=>{generation++;controller?.abort();};
 return {invalidate,close(){closed=true;invalidate();},run(load,term){if(closed)return;invalidate();const current=generation;controller=new AbortController();const signal=controller.signal;publish({status:'loading'});
 Promise.resolve().then(()=>load({term,signal})).then(result=>{if(closed||current!==generation)return;if(result?.status==='success'&&Array.isArray(result.rows)||result?.status==='error'||result?.status==='forbidden')publish(result);else publish({status:'error'});}).catch(()=>{if(!closed&&current===generation)publish({status:'error'});});}};
}
