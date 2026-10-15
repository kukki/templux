import {readFileSync,writeFileSync} from 'node:fs';import {createInterface} from 'node:readline/promises';
import {checkUpdates} from './check.mjs';import {schedule} from './schedule.mjs';import {buildCatalog,UpdateError} from './catalog.mjs';import {safePath} from '../upgrade/files.mjs';import {sha} from '../release/verify.mjs';
const print=v=>console.log(JSON.stringify(v));
try{
 const args=process.argv.slice(2),values={},releases=[];let command;
 const keys={'--current':'current','--config':'configFile','--state':'state','--output':'output','--max-runs':'maxRuns','--root':'root','--release':'release'};
 for(let i=0;i<args.length;i++){const a=args[i];if(a==='--json')continue;if(!a.startsWith('--')){if(command)throw new UpdateError('invalid_arguments');command=a;continue;}const k=keys[a];if(!k||k!=='release'&&k in values||!args[i+1]||args[i+1].startsWith('--'))throw new UpdateError('invalid_arguments');if(k==='release')releases.push(args[++i]);else values[k]=args[++i];}
 if(values.maxRuns!==undefined&&(!/^[1-9]\d*$/.test(values.maxRuns)||Number(values.maxRuns)>10000))throw new UpdateError('invalid_arguments');
 if(command==='catalog'){
  if(!values.root||!values.output||!releases.length||Object.keys(values).some(k=>!['root','output'].includes(k)))throw new UpdateError('invalid_arguments');const c=buildCatalog(values.root,releases),bytes=JSON.stringify(c,null,2)+'\n';writeFileSync(safePath(values.output),bytes,{flag:'wx',mode:0o644});print({ok:true,status:'catalog_created',sha256:sha(bytes)});
 }else{
  if(values.root||releases.length||command&&!['check','schedule'].includes(command))throw new UpdateError('invalid_arguments');
  const options={current:values.current??'/input/current',state:values.state??'/state',output:values.output??'/output',config:JSON.parse(readFileSync(safePath(values.configFile??'/input/current/config/updates.json'),'utf8'))};
  if(!command){if(!process.stdin.isTTY||!process.stdout.isTTY)throw new UpdateError('command_required');const terminal=createInterface({input:process.stdin,output:process.stderr});try{const choice=await terminal.question('模板更新：1 检查并准备已选目标  2 启动项目调度  0 退出\n> ');command=choice==='1'?'check':choice==='2'?'schedule':choice==='0'?'quit':null;if(!command)throw new UpdateError('invalid_choice');}finally{terminal.close();}}
  if(command==='quit')print({ok:true,status:'cancelled'});
  else if(command==='check'){const result=await checkUpdates(options);print(result);if(!result.ok){console.error(JSON.stringify({event:'update_check_failed',code:result.status}));process.exitCode=['proposal_incomplete','unsupported_path'].includes(result.status)?2:result.status==='locked'?3:1;}}
  else{let failed=false;const stop=new AbortController();process.once('SIGTERM',()=>stop.abort());process.once('SIGINT',()=>stop.abort());await schedule(options,{maxRuns:values.maxRuns?Number(values.maxRuns):Infinity,signal:stop.signal,onResult:r=>{print(r);if(!r.ok){failed=true;console.error(JSON.stringify({event:'update_check_failed',code:r.status}));}}});if(failed)process.exitCode=1;}
 }
}catch(e){const code=e instanceof UpdateError?e.code:'invalid_arguments';console.error(JSON.stringify({event:'update_command_failed',code}));print({ok:false,status:code});process.exitCode=1;}
