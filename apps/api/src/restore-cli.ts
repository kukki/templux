import {createInterface} from 'node:readline/promises';
import {stdin,stderr} from 'node:process';
import {OperationError} from './database.js';
import {restoreDatabase,restoreInput} from './restore.js';
export async function restoreCommand(options:Map<string,string>,flags:Set<string>,interactive:boolean,compose:(args:string[])=>Promise<void>){
 if([...options.keys()].some(k=>!['--mode','--target','--archive','--sha256'].includes(k)))throw new OperationError('restore 参数无效。');
 const p=interactive?createInterface({input:stdin,output:stderr}):undefined;
 try{
  if(p)for(const [key,label]of [['--mode','模式 original / independent'],['--target','明确目标 current / env:变量名'],['--archive','可信custom归档容器绝对路径'],['--sha256','独立核对的SHA256']])if(!options.has(key!))options.set(key!,await p.question(`${label}：`));
  const input=restoreInput(options,process.env);
  stderr.write(`恢复模式 ${input.mode}；目标 ${input.target}。归档来源必须可信；将替换归档中对象，保留归档外对象，不等同整库擦除。原库将halt；任何恢复不自动resume/部署/切换连接。\n`);
  if(!flags.has('--confirm')||!flags.has('--overwrite')){
   if(!p)throw new OperationError('restore 必须显式 --confirm --overwrite；目标已有对象会被覆盖。');
   if((await p.question('确认已核对可信归档、目标及备份/配置/必要密钥，允许破坏性覆盖？输入 yes：')).trim()!=='yes')throw new OperationError('已取消恢复。');
  }
  return {ok:true,command:'restore',...await restoreDatabase(input,compose)};
 }finally{p?.close();}
}
