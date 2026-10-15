import {spawn} from 'node:child_process';
// No raw child stdout/stderr is persisted: project checks can print private values.
export async function checked(command,args,{cwd,timeout=180000}){
 const started=performance.now();return new Promise(resolve=>{
  let settled=false,timer;const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve({...result,durationMs:Math.round(performance.now()-started)});};
  const child=spawn(command,args,{cwd,env:{PATH:process.env.PATH,HOME:'/tmp',NEXT_TELEMETRY_DISABLED:'1',npm_config_cache:'/tmp/templux-npm-cache'},stdio:'ignore',detached:true});
  child.on('error',()=>finish({status:'unavailable'}));child.on('exit',(code,signal)=>finish({status:code===0?'passed':'failed',exitCode:code,signal}));
  timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}finish({status:'timeout'});},timeout);
 });
}
export async function runChecks(candidate,behavior,timeout,afterStep=()=>{}){
 const steps=[['lock','npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund']],['install','npm',['ci','--ignore-scripts','--no-audit','--no-fund']],['combination','node',['.templux/verify.mjs','.', '--installed']],['semantic','npm',['run','typecheck']],['api-build','npm',['run','build','--workspace','apps/api']],['web-build','npm',['run','build','--workspace','apps/web']],['behavior','node',[behavior]]];
 const results=[];for(const [name,command,args]of steps){const result=await checked(command,args,{cwd:candidate,timeout});results.push({name,...result});if(result.status!=='passed')break;afterStep(name);}return results;
}
