import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {once} from 'node:events';
import {OperationError} from './database.js';

// stdout is protocol only; never relay SQL data or libpq diagnostics to logs.
export function restoreProcess(env:NodeJS.ProcessEnv){
 const child=spawn('/opt/pg-tools/bin/psql',['-X','--quiet','--no-password','--no-psqlrc','--single-transaction','--set','ON_ERROR_STOP=1','--file','-'],{env,stdio:['pipe','pipe','pipe']});
 let buffer='',ended=false,diagnostic=false;const messages=new Map<string,string>();const waiters=new Map<string,{resolve:(v:string)=>void;reject:(e:Error)=>void}>();
 const failure=()=>new OperationError('恢复SQL工具未确认完成（退出/诊断/超时），原始输出已隐藏；不要自动重试。');
 child.stdout.on('data',chunk=>{buffer+=String(chunk);let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);const m=/^TEMPLUX_RESTORE_(PID|VALIDATED)(?: ([0-9]+))?$/.exec(line);if(m){const value=m[2]??'';messages.set(m[1]!,value);waiters.get(m[1]!)?.resolve(value);waiters.delete(m[1]!);}}if(buffer.length>8192)buffer=buffer.slice(-1024);});
 child.stderr.on('data',()=>{diagnostic=true;});child.stdin.on('error',()=>{});
 let resolveDone:()=>void,rejectDone:(e:Error)=>void;
 const done=new Promise<void>((yes,no)=>{resolveDone=yes;rejectDone=no;});void done.catch(()=>{});
 const timeout=setTimeout(()=>child.kill('SIGKILL'),900000);
 const finish=(ok:boolean)=>{if(ended)return;ended=true;clearTimeout(timeout);for(const w of waiters.values())w.reject(failure());waiters.clear();if(ok&&!diagnostic)resolveDone();else rejectDone(failure());};
 child.once('error',()=>finish(false));child.once('close',(code)=>finish(code===0));
 const wait=(name:string)=>{if(messages.has(name))return Promise.resolve(messages.get(name)!);if(ended)return Promise.reject(failure());return new Promise<string>((resolve,reject)=>waiters.set(name,{resolve,reject}));};
 const write=async(value:string|Buffer)=>{if(ended||child.stdin.destroyed)throw failure();if(!child.stdin.write(value))await Promise.race([once(child.stdin,'drain'),done.then(()=>{throw failure();})]);};
 return {async connect(){await write('SELECT pg_backend_pid() AS restore_pid \\gset\n\\echo TEMPLUX_RESTORE_PID :restore_pid\n');const pid=await wait('PID');if(!/^[1-9]\d*$/.test(pid))throw failure();return Number(pid);},
  async execute(file:string,finalize:string){for await(const chunk of createReadStream(file))await write(chunk);await write('\n'+finalize+'\n\\echo TEMPLUX_RESTORE_VALIDATED\n');await wait('VALIDATED');},
  async commit(){child.stdin.end();await done;},async abort(){if(!ended)child.kill('SIGKILL');try{await done;}catch{/* Caller retains the durable fence. */}}};
}
