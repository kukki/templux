import {mkdirSync,rmSync,readFileSync,readdirSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {parseConfig} from './config.mjs';import {readCatalog,downloadRelease} from './source.mjs';import {findPath,available} from './versions.mjs';import {UpdateError} from './catalog.mjs';import {cumulative} from './cumulative.mjs';import {stateRead,stateWrite,readAttempt,nextDelay} from './state.mjs';
import {safePath,overlaps,assertSeparated,projectFiles,list,entry,json} from '../upgrade/files.mjs';import {capture,inventory} from '../upgrade/delivery.mjs';import {sha,verifyProject} from '../release/verify.mjs';
function toolHash(){const root=dirname(dirname(fileURLToPath(import.meta.url))),files={};for(const dir of ['updates','upgrade','release'])for(const name of readdirSync(join(root,dir)).filter(n=>n.endsWith('.mjs')).sort())files[dir+'/'+name]=sha(readFileSync(join(root,dir,name)));return sha(JSON.stringify(files));}
function currentHash(current,m){const p=new Set([...projectFiles(current),...list(join(current,'.templux')).map(p=>'.templux/'+p),'vendor/manifest.json',...m.packages.map(p=>'vendor/'+p.file)]);return sha(JSON.stringify(Object.fromEntries([...p].sort().map(p=>[p,{sha256:sha(entry(current,p).bytes),mode:entry(current,p).mode}]))));}
export async function checkUpdates({current,config,state,output,automatic}){
 let locked=false,lock,cache;const attempt=randomUUID();let outcome,attemptedAt;
 try{
  const c=parseConfig(config);current=safePath(current);state=safePath(state);output=safePath(output);const inputs=[current,...(c.source.kind==='directory'?[safePath(c.source.root)]:[])];if(inputs.some(p=>overlaps(p,state)||overlaps(p,output))||overlaps(state,output))throw new UpdateError('unsafe_paths');assertSeparated(inputs,state);assertSeparated(inputs,output);mkdirSync(state,{recursive:true,mode:0o700});mkdirSync(output,{recursive:true,mode:0o700});
  lock=join(state,'check.lock');try{mkdirSync(lock,{mode:0o700});locked=true;}catch(e){if(e.code==='EEXIST')return{ok:false,status:'locked'};throw e;}
  const at=Date.now();stateWrite(lock,'owner.json',{id:attempt,at,pid:process.pid});const priorAttempt=readAttempt(state);
  if(automatic){
   const attemptKey=sha(JSON.stringify(priorAttempt)),d=nextDelay(priorAttempt?.at??0,at,c.intervalSeconds*1000);
   // Only our scheduler returns this same-attempt token after a full monotonic rollback wait.
   if(d.ms&&!(automatic.waited===true&&automatic.clockRollback===true&&automatic.attemptKey===attemptKey)){outcome={ok:true,status:'deferred',delayMs:d.ms,attemptKey,clockRollback:d.clockRollback};return outcome;}
  }
  stateWrite(state,'attempt.json',{at,id:attempt});attemptedAt=at;
  const verified=verifyProject(current),m=json(current,'vendor/manifest.json'),loaded=await readCatalog(c.source,c.timeoutMs),records=loaded.catalog.releases,record=records.find(r=>r.version===verified.version);
  if(!record||record.manifestSha256!==verified.manifestSha256)throw new UpdateError('source_identity_mismatch');
  const known=stateRead(state,'known-releases.json')??{};if(typeof known!=='object'||Array.isArray(known))throw new UpdateError('invalid_state');for(const r of records)if(known[r.version]&&known[r.version]!==r.manifestSha256)throw new UpdateError('release_identity_changed');for(const r of records)known[r.version]=r.manifestSha256;stateWrite(state,'known-releases.json',known);
  const base={available:available(records,verified.version,c.allowPrerelease),catalog:{sha256:loaded.sha256,trust:loaded.trust},current:{version:verified.version,manifestSha256:verified.manifestSha256}};
  if(!c.targetVersion||c.targetVersion===verified.version){outcome={ok:true,status:!base.available.length?'no_update':c.targetVersion?'target_current':'updates_available',...base};return outcome;}
  const path=findPath(records,verified.version,c.targetVersion,c.allowPrerelease);if(!path){outcome={ok:false,status:'unsupported_path',...base,requestedTarget:c.targetVersion};return outcome;}
  const key=sha(JSON.stringify({input:currentHash(current,m),catalog:loaded.sha256,config:c,tool:toolHash()})),previous=stateRead(state,'receipt.json');
  if(previous?.key===key){
   try{if(!/^[a-f0-9-]{36}$/.test(previous.proposal))throw Error();const prior=safePath(join(output,previous.proposal));if(sha(JSON.stringify(inventory(capture(prior))))!==previous.treeSha256||!json(prior,'report.json').directlyApplicable)throw Error();verifyProject(join(prior,'candidate'));outcome={ok:true,status:'duplicate',proposal:previous.proposal,...base};return outcome;}catch{throw new UpdateError('previous_artifact_invalid');}
  }
  mkdirSync(join(state,'cache'),{recursive:true,mode:0o700});cache=join(state,'cache',attempt);mkdirSync(cache,{mode:0o700});const releases=[];
  for(const v of path){const r=records.find(r=>r.version===v),directory=join(cache,v);await downloadRelease(c.source,r,directory,c.timeoutMs);releases.push({...r,directory});}
  const proposal=join(output,attempt),result=await cumulative({current,releases,output:proposal,behavior:c.behavior,trustProjectCode:c.trustProjectCode,timeout:c.checkTimeoutMs});
  outcome={ok:result.directlyApplicable,status:result.directlyApplicable?'proposal_ready':'proposal_incomplete',proposal:attempt,path:[verified.version,...path],...base};
  if(result.directlyApplicable)stateWrite(state,'receipt.json',{key,proposal:attempt,treeSha256:sha(JSON.stringify(inventory(capture(proposal))))});
  return outcome;
 }catch(e){outcome={ok:false,status:e instanceof UpdateError?e.code:'check_failed'};return outcome;}
 finally{
  if(outcome&&attemptedAt!==undefined)outcome.attemptedAt=attemptedAt;
  if(cache)rmSync(cache,{recursive:true,force:true});
  if(locked){try{if(outcome)stateWrite(state,'result.json',{...outcome,at:Date.now()});}finally{rmSync(lock,{recursive:true,force:true});}}
 }
}
