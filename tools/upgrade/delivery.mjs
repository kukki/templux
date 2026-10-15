import {readdirSync,lstatSync,rmSync,mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {entry,writeEntry,digestPath} from './files.mjs';import {sameEntry} from './merge.mjs';import {sha} from '../release/verify.mjs';
// This inventories the delivery, not the input copy filter: no hidden new files escape it.
function paths(root,prefix=''){
 const result=[];for(const item of readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=prefix?prefix+'/'+item.name:item.name;if(!digestPath(p))throw Error('invalid delivery path');if(item.isDirectory())result.push(...paths(join(root,item.name),p));else result.push(p);if(result.length>5000)throw Error('delivery too large');}return result;
}
export const capture=root=>new Map(paths(root).map(p=>[p,entry(root,p)]));
export const inventory=snapshot=>Object.fromEntries([...snapshot].sort(([a],[b])=>a.localeCompare(b)).map(([p,e])=>[p,{sha256:sha(e.bytes),mode:e.mode}]));
const nextBase='/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n';
const nextGenerated=nextBase+'import "./.next/types/routes.d.ts";\nimport "./.next/types/root-params.d.ts";\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n';
export function acceptGenerated(expected,root,step){
 if(step==='lock'){const e=entry(root,'package-lock.json');if(e)expected.set('package-lock.json',e);}
 if(step==='web-build'){
  const p='apps/web/next-env.d.ts',before=expected.get(p),after=entry(root,p);
  if(before&&after&&[nextBase,nextGenerated].includes(before.bytes.toString())&&after.bytes.toString()===nextGenerated&&after.mode===before.mode)expected.set(p,after);
 }
}
export function enforceSnapshot(root,expected,manual){
 for(const p of new Set([...paths(root),...expected.keys()])){
  let actual,invalid=false;try{actual=entry(root,p);}catch{actual=null;invalid=true;}
  const wanted=expected.get(p)??null;
  if(invalid||!sameEntry(actual,wanted)){manual.push({kind:'delivery-mutated-by-check',path:p});rmSync(join(root,p),{force:true,recursive:true});if(wanted)writeEntry(root,p,wanted);}
 }
}
const git=(args,cwd)=>spawnSync('git',args,{cwd,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
export function patchAndVerify(current,candidate,currentPaths,vendor,out){
 const temp=mkdtempSync(join(tmpdir(),'templux-delivery-'));
 try{
  const final=capture(candidate),all=new Set([...currentPaths,...final.keys()]);
  // git's no-prefix uses our a/ and b/ directory names directly. Never edit diff bytes.
  for(const side of ['a','b'])mkdirSync(join(temp,side));
  for(const p of all)for(const [side,root]of [['a',current],['b',candidate]]){const e=entry(root,p);if(e&&!/^vendor\/.*\.tgz$/.test(p)&&!e.bytes.includes(0))writeEntry(join(temp,side),p,e);}
  const diff=git(['diff','--no-index','--no-prefix','--no-ext-diff','--no-renames','--','a','b'],temp);
  if(diff.error||![0,1].includes(diff.status))throw Error('diff failed');
  const patch=join(out,'changes.patch');writeFileSync(patch,diff.stdout,{mode:0o600});
  const applied=join(temp,'applied');mkdirSync(applied);
  for(const p of currentPaths){const e=entry(current,p);if(e)writeEntry(applied,p,e);}
  if(diff.stdout){for(const args of [['apply','--check',patch],['apply',patch]]){const r=git(args,applied);if(r.error||r.status!==0)return{status:'failed',reason:'patch-not-applicable'};}}
  for(const p of vendor){writeEntry(applied,'vendor/'+p.file,entry(candidate,'vendor/'+p.file));if(p.replaces&&p.replaces!==p.file)rmSync(join(applied,'vendor',p.replaces));}
  const actual=inventory(capture(applied)),wanted=inventory(final);
  return JSON.stringify(actual)===JSON.stringify(wanted)?{status:'passed',files:final.size,patchSha256:sha(readFileSync(patch))}:{status:'failed',reason:'applied-inventory-differs'};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
