import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
export const sameEntry=(a,b)=>a===null?b===null:b!==null&&a.mode===b.mode&&a.bytes.equals(b.bytes);
export function mergeEntry(base,current,target){
 if(sameEntry(current,target)||sameEntry(base,target))return{status:'unchanged',entry:current};
 if([base,current,target].some(e=>e&&(e.bytes.includes(0)||!Buffer.from(e.bytes.toString('utf8')).equals(e.bytes))))return{status:'conflict',reason:'binary requires manual replacement'};
 if(sameEntry(base,current))return{status:'merged',entry:target};
 if(!base||!current||!target)return{status:'conflict',reason:'add/delete conflict'};
 const mode=current.mode===target.mode?current.mode:base.mode===current.mode?target.mode:base.mode===target.mode?current.mode:null;
 if(mode===null||[base,current,target].some(e=>e.bytes.includes(0)||!Buffer.from(e.bytes.toString('utf8')).equals(e.bytes)))return{status:'conflict',reason:'binary/mode conflict'};
 const dir=mkdtempSync(join(tmpdir(),'templux-merge-'));
 try{
  for(const [name,entry]of Object.entries({base,current,target}))writeFileSync(join(dir,name),entry.bytes,{mode:0o600});
  const r=spawnSync('git',['merge-file','-p','-L','current','-L','baseline','-L','target',join(dir,'current'),join(dir,'base'),join(dir,'target')],{timeout:10000,maxBuffer:4*1024*1024});
  if(r.error||r.status!==0)return{status:'conflict',reason:r.status>0&&r.status<128?'text conflict':'merge unavailable'};
  return{status:'merged',entry:{bytes:r.stdout,mode}};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
