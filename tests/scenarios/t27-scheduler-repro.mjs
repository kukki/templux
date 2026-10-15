// Run inside updates-tools, mounted as /repro.mjs. Own HTTP/source/state only; always cleans up.
import assert from 'node:assert/strict';import {fixture} from '/opt/templux/tests/helpers/update-release.mjs';import {buildCatalog} from '/opt/templux/tools/updates/catalog.mjs';import {schedule} from '/opt/templux/tools/updates/schedule.mjs';import {checkUpdates} from '/opt/templux/tools/updates/check.mjs';import {stateWrite,lastAttempt} from '/opt/templux/tools/updates/state.mjs';import {mkdirSync,rmSync} from 'node:fs';import {createServer} from 'node:http';import {setTimeout as wait} from 'node:timers/promises';
const outcomes=[];
for(const mode of ['overflow','manual-during-wait']){
 const f=fixture(),requests=[],stop=new AbortController();const bytes=JSON.stringify(buildCatalog(f.source,['0.1.0']));const server=createServer((req,res)=>{requests.push(Date.now());res.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let timer;
 try{
  mkdirSync(f.state);const config={schemaVersion:1,source:{kind:'https',url:`http://127.0.0.1:${server.address().port}/catalog.json`,allowHttpLoopback:true},intervalSeconds:mode==='overflow'?2678400:2};stateWrite(f.state,'attempt.json',{at:Date.now(),id:'repro-initial'});const initialAt=lastAttempt(f.state),started=Date.now();let result,manualAt;
  const run=schedule({...f,config},{maxRuns:1,signal:stop.signal,onResult:r=>result=r});
  if(mode==='overflow')timer=setTimeout(()=>stop.abort(),150);else{await wait(1400);await checkUpdates({...f,config});manualAt=lastAttempt(f.state);}
  const completion=await run;const record={mode,runs:completion.runs,status:result?.status??'aborted_wait',elapsed:Date.now()-started,intervalMs:config.intervalSeconds*1000,initialAt,attemptAt:lastAttempt(f.state),schedulerStarted:result?.startedAt,manualAt,gapFromManual:manualAt?result.startedAt-manualAt:null,httpRequests:requests};outcomes.push(record);console.log(JSON.stringify(record));
 }finally{clearTimeout(timer);stop.abort();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(f.root,{recursive:true,force:true});}
}
assert.equal(outcomes[0].runs,0);assert.equal(outcomes[0].attemptAt,outcomes[0].initialAt);assert.equal(outcomes[0].httpRequests.length,0);assert.ok(outcomes[1].gapFromManual>=2000);assert.equal(outcomes[1].httpRequests.length,2);
