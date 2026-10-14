import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { databasePool, OperationError } from './database.js';
import { createPasswordAccount, resetAgentPassword } from './password-accounts.js';
export async function passwordCommand(command: 'create-person' | 'create-agent' | 'reset-agent', options: Map<string,string>, flags: Set<string>, interactive: boolean) {
  const required = command === 'reset-agent' ? ['--account','--credential-file'] : ['--username','--name',...(command === 'create-agent' ? ['--owner'] : []),'--credential-file'];
  const prompt = interactive ? createInterface({input:stdin,output:stderr}) : undefined;
  const pool = databasePool();
  try {
    if (prompt) for (const key of required) if (!options.has(key)) { const answer=(await prompt.question(`${key}：`)).trim(); if(answer) options.set(key,answer); }
    if (required.some(key=>!options.get(key))) throw new OperationError(`${command} 缺少必填参数：${required.join('、')}。`);
    if (!flags.has('--confirm')) {
      if (!prompt) throw new OperationError(`${command} 需要显式 --confirm。`);
      stderr.write(`操作：${command}\n目标：${options.get('--account') ?? options.get('--username')}\n责任人：${options.get('--owner') ?? '不适用'}\n凭据文件：${options.get('--credential-file')}\n${command==='reset-agent'?'旧会话将失效。':'新账号默认零角色，无业务权限。'}\n`);
      if((await prompt.question('输入 yes 确认：')).trim()!=='yes') throw new OperationError('已取消操作。');
    }
    const actor=`host-uid:${process.env.TEMPLUX_HOST_UID ?? process.getuid?.() ?? 'unknown'}`;
    if(command==='reset-agent') return await resetAgentPassword(pool,options.get('--account')!,options.get('--credential-file')!,actor);
    return await createPasswordAccount(pool,{kind:command==='create-agent'?'agent':'person',username:options.get('--username')!,name:options.get('--name')!,owner:options.get('--owner'),file:options.get('--credential-file')!},actor);
  } finally {prompt?.close();await pool.end();}
}
