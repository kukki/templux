export function version(value){
 if(typeof value!=='string'||value.length>80)throw Error('invalid_version');
 const m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
 if(!m||m.slice(1,4).some(n=>!Number.isSafeInteger(Number(n)))||m[4]?.split('.').some(n=>/^\d+$/.test(n)&&n.length>1&&n[0]==='0'))throw Error('invalid_version');
 return{numbers:m.slice(1,4).map(Number),pre:m[4]?.split('.')??null};
}
export function compare(a,b){const x=version(a),y=version(b);for(let i=0;i<3;i++)if(x.numbers[i]!==y.numbers[i])return Math.sign(x.numbers[i]-y.numbers[i]);if(!x.pre||!y.pre)return x.pre===y.pre?0:x.pre?-1:1;for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){const p=x.pre[i],q=y.pre[i];if(p===q)continue;if(p===undefined)return-1;if(q===undefined)return 1;const pn=/^\d+$/.test(p),qn=/^\d+$/.test(q);if(pn&&qn)return BigInt(p)<BigInt(q)?-1:1;if(pn!==qn)return pn?-1:1;return p<q?-1:1;}return 0;}
export function findPath(records,source,target,allowPrerelease=false){
 const a=version(source),b=version(target);if(a.numbers[0]!==b.numbers[0]||compare(source,target)>=0||b.pre&&!allowPrerelease)return null;
 const queue=[[source,[]]],seen=new Set([source]);while(queue.length){const [from,path]=queue.shift();if(path.length>=8)continue;for(const r of records){const v=version(r.version);if(v.numbers[0]!==a.numbers[0]||v.pre&&!allowPrerelease||compare(from,r.version)>=0||compare(r.version,target)>0||!r.from.includes(from)||seen.has(r.version))continue;const next=[...path,r.version];if(r.version===target)return next;seen.add(r.version);queue.push([r.version,next]);}}return null;
}
export const available=(records,source,pre)=>records.filter(r=>findPath(records,source,r.version,pre)).sort((a,b)=>compare(a.version,b.version)).map(r=>({version:r.version,manifestSha256:r.manifestSha256,path:findPath(records,source,r.version,pre),support:'catalog-declared'}));
