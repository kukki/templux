import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { databasePool, OperationError } from './database.js';
import { listAccounts, setAuthorization } from './authorization.js';
import { readRoles } from './auth-config.js';
export async function authorizationCommand(command: 'users' | 'authorize', options: Map<string, string>, flags: Set<string>, interactive: boolean) {
  const pool = databasePool(); const prompt = interactive ? createInterface({ input: stdin, output: stderr }) : undefined;
  try {
    if (command === 'users') return { ok: true, command, accounts: await listAccounts(pool) };
    if (prompt) {
      stderr.write(`预定义角色：${Object.keys(readRoles()).join(', ')}；none 表示清空角色。\n`);
      for (const [key, label] of [['--account', '目标账号ID'], ['--roles', '角色（逗号分隔）'], ['--state', '状态 active/disabled（留空active）']] as const) {
        if (!options.has(key)) { const answer = (await prompt.question(`${label}：`)).trim(); if (answer) options.set(key, answer); }
      }
    }
    const accountId = options.get('--account'); const selected = options.get('--roles');
    if (!accountId || !selected) throw new OperationError('authorize 必须指定 --account 和 --roles（或 none）。');
    const state = options.get('--state') ?? 'active';
    if (!['active', 'disabled'].includes(state)) throw new OperationError('状态仅支持 active/disabled。');
    const roles = selected === 'none' ? [] : selected.split(',').map(r => r.trim());
    if (!flags.has('--confirm')) {
      if (!prompt) throw new OperationError('authorize 需要显式 --confirm。');
      stderr.write(`目标账号：${accountId}\n角色：${roles.join(', ') || 'none'}\n状态：${state}\n旧会话将失效。\n`);
      if ((await prompt.question('输入 yes 确认授权变更：')).trim() !== 'yes') throw new OperationError('已取消授权。');
    }
    return await setAuthorization(pool, { accountId, roles, state: state as 'active' | 'disabled' }, `host-uid:${process.env.TEMPLUX_HOST_UID ?? process.getuid?.() ?? 'unknown'}`);
  } finally { prompt?.close(); await pool.end(); }
}
