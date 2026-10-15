/** Plain text presentation only; no clipboard value, identity, HTML or side effects. */
export function resolveCopyMessages(base,overrides){
 const keys=['action','pending','succeeded','retry','empty','denied','unsupported','failed'];
 const valid=(value,partial)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).some(k=>!keys.includes(k)||typeof value[k]!=='string'||!value[k].trim()||value[k].length>300)||!partial&&keys.some(k=>!Object.hasOwn(value,k)))throw new Error('Invalid copy messages');};
 valid(base,false);if(overrides!==undefined)valid(overrides,true);return Object.freeze({...base,...overrides});
}
