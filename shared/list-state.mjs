export function validatePagination(settings){
 if(!settings||!Array.isArray(settings.pageSizes)||!settings.pageSizes.length||settings.pageSizes.length>20||settings.pageSizes.some(n=>!Number.isInteger(n)||n<1||n>1000)||new Set(settings.pageSizes).size!==settings.pageSizes.length||!settings.pageSizes.includes(settings.pageSize)||!settings.controls||['total','size','edges','pages','jump'].some(k=>typeof settings.controls[k]!=='boolean'))throw new Error('无效分页设置。');
}
export function validateSortFields(fields){if(!Array.isArray(fields)||fields.some(f=>!f||typeof f.key!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(f.key)||typeof f.label!=='string'||!f.label.trim()||typeof f.compare!=='function')||new Set(fields.map(f=>f.key)).size!==fields.length)throw new Error('排序必须提供唯一字段、名称及比较器。');}
export function parseListState(params,settings,fields,total=null){
 validatePagination(settings);validateSortFields(fields);
 const integer=(value,fallback)=>typeof value==='string'&&/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):fallback;
 const requestedSize=integer(params.get('pageSize'),settings.pageSize),pageSize=settings.pageSizes.includes(requestedSize)?requestedSize:settings.pageSize;
 const rawSort=params.get('sort'),sort=fields.some(f=>rawSort===f.key+':asc'||rawSort===f.key+':desc')?rawSort:'base';
 let page=integer(params.get('page'),1);if(total!==null){if(!Number.isSafeInteger(total)||total<0)throw new Error('无效列表总数。');page=Math.min(page,Math.max(1,Math.ceil(total/pageSize)));}
 return {page,pageSize,sort};
}
export function writeListState(href,state){const url=new URL(href);for(const key of ['page','pageSize','sort'])url.searchParams.set(key,String(state[key]));return url.href;}
export function cycleSort(current,key){return current===key+':asc'?key+':desc':current===key+':desc'?'base':key+':asc';}
export function orderRows(rows,sort,fields,baseCompare){
 validateSortFields(fields);if(typeof baseCompare!=='function')throw new Error('排序必须提供稳定基础次序。');
 const selected=fields.find(f=>sort===f.key+':asc'||sort===f.key+':desc');if(sort!=='base'&&!selected)throw new Error('无效排序状态。');
 const checked=(compare,a,b)=>{const value=compare(a,b);if(typeof value!=='number'||!Number.isFinite(value))throw new Error('比较器必须返回有限数字。');return value;};
 return [...rows].sort((a,b)=>{const value=selected?checked(selected.compare,a,b)*(sort.endsWith(':desc')?-1:1):0;return value||checked(baseCompare,a,b);});
}
export function pageNumbers(total,current){const numbers=new Set([1,total]);for(let n=Math.max(1,current-2);n<=Math.min(total,current+2);n++)numbers.add(n);const out=[];for(const n of [...numbers].sort((a,b)=>a-b)){if(out.length&&n-out.at(-1)>1)out.push(null);out.push(n);}return out;}
