import { passwordCommand } from './password-cli.js';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { isAbsolute } from 'node:path';
import { OperationError } from './database.js';
import { authorizationCommand } from './auth-cli.js';
import { initialize } from './initialize.js';
import { loadPresentation, PresentationError } from '../../../shared/presentation.mjs';

const commands = ['start', 'status', 'stop', 'logs', 'typecheck', 'test', 'init', 'config-check', 'users', 'authorize', 'create-person', 'create-agent', 'reset-agent'] as const;
type Command = typeof commands[number];

function isCommand(value: string | undefined): value is Command {
  return commands.some(command => command === value);
}

async function compose(args: string[]): Promise<void> {
  const directory = process.env.TEMPLUX_PROJECT_DIR;
  if (!directory || !isAbsolute(directory)) throw new OperationError('缺少容器管理项目目录。');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', ['compose', '--project-directory', directory,
      '-f', `${directory}/compose.yaml`, ...args], { stdio: ['ignore', 2, 2] });
    child.on('error', () => reject(new OperationError('无法调用 Docker Compose。')));
    child.on('exit', (code, signal) => code === 0 ? resolve()
      : reject(new OperationError(`容器操作未完成${signal ? `（${signal}）` : `（退出码 ${code}）`}。`)));
  });
}

async function status(): Promise<Record<string, unknown>> {
  try {
    const response = await fetch('http://api:8080/api/status', { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('status' in payload) || payload.status !== 'ready') throw new Error();
    return { ok: true, command: 'status', service: payload };
  } catch {
    throw new OperationError('服务尚未就绪，请运行 start 或查看 logs。');
  }
}

async function main(): Promise<Record<string, unknown>> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const nonInteractive = args.includes('--non-interactive');
  const interactive = args.includes('--interactive');
  if (interactive && (nonInteractive || json || !stdin.isTTY || !stderr.isTTY)) {
    throw new OperationError('--interactive 需要交互终端，不能与 --json 或 --non-interactive 同用。');
  }
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const positional: string[] = [];
  const flagNames = ['--json', '--non-interactive', '--interactive', '--confirm', '--overwrite'];
  const valueNames = ['--name', '--brand', '--theme', '--version', '--copyright', '--config', '--account', '--roles', '--state', '--username', '--owner', '--credential-file'];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (flagNames.includes(arg)) {
      if (flags.has(arg)) throw new OperationError('重复参数。');
      flags.add(arg);
    } else if (valueNames.includes(arg)) {
      const value = args[++i];
      if (options.has(arg) || value === undefined || value.startsWith('--')) throw new OperationError('参数重复或缺少值。');
      options.set(arg, value);
    } else if (arg.startsWith('-')) throw new OperationError('未知参数。');
    else positional.push(arg);
  }
  if (positional.length > 1) throw new OperationError('只允许一个管理命令。');
  let command = positional[0];
  if (!command) {
    if (nonInteractive || !stdin.isTTY || !stderr.isTTY || json) {
      throw new OperationError('缺少管理命令：start、status、stop、logs、typecheck、test、init、config-check、users、authorize、create-person、create-agent 或 reset-agent。');
    }
    const prompt = createInterface({ input: stdin, output: stderr });
    try {
      stderr.write('\nTemplux 管理菜单\n1. 启动\n2. 查看状态\n3. 停止（保留数据库）\n4. 查看日志\n5. 类型检查\n6. 运行测试\n7. 初始化项目\n8. 校验呈现配置\n9. 查看账号\n10. 授权账号\n11. 创建人员密码账号\n12. 创建Agent密码账号\n13. 重置Agent密码\n');
      const selection = await prompt.question('请选择 1–13：');
      command = commands[Number(selection.trim()) - 1];
    } finally { prompt.close(); }
  }
  if (!isCommand(command)) throw new OperationError('无效管理命令。');
  if (['create-person','create-agent','reset-agent'].includes(command)) {
    const allowed = command === 'reset-agent' ? ['--account','--credential-file'] : ['--username','--name','--credential-file',...(command==='create-agent'?['--owner']:[])];
    if ([...options.keys()].some(key=>!allowed.includes(key)) || flags.has('--overwrite')) throw new OperationError('密码账号管理参数无效。');
    return passwordCommand(command as 'create-person' | 'create-agent' | 'reset-agent',options,flags,(interactive || positional.length===0)&&!nonInteractive&&!json&&!!stdin.isTTY&&!!stderr.isTTY);
  }
  if (command === 'users' || command === 'authorize') {
    if ([...options.keys()].some(key => !['--account', '--roles', '--state'].includes(key)) || flags.has('--overwrite') || (command === 'users' && options.size)) throw new OperationError('账号管理参数无效。');
    return authorizationCommand(command, options, flags, (interactive || positional.length === 0) && !nonInteractive && !json && !!stdin.isTTY && !!stderr.isTTY);
  }
  if (command !== 'init' && (options.size > 0 || flags.has('--overwrite'))) throw new OperationError('品牌参数与 --overwrite 只适用于 init。');
  if (command === 'init' && [...options.keys()].some(key => ['--account', '--roles', '--state', '--username', '--owner', '--credential-file'].includes(key))) throw new OperationError('init 参数无效。');
  if (command === 'init') return initialize(options, flags,
    (interactive || positional.length === 0) && !nonInteractive && !json && !!stdin.isTTY && !!stderr.isTTY);
  if (command === 'config-check') { loadPresentation(); return { ok: true, command }; }
  if (command === 'stop' && !args.includes('--confirm')) {
    if (nonInteractive || json || !stdin.isTTY || !stderr.isTTY) throw new OperationError('stop 需要显式 --confirm。');
    const prompt = createInterface({ input: stdin, output: stderr });
    try {
      if ((await prompt.question('停止当前 Templux 前后端及数据库（保留数据）？输入 yes 确认：')).trim() !== 'yes') {
        throw new OperationError('已取消停止操作。');
      }
    } finally { prompt.close(); }
  }
  if (command === 'status') return status();
  if (command === 'start') {
    loadPresentation();
    await compose(['build', 'api', 'web']);
    await compose(['up', '-d', '--wait', '--wait-timeout', '60', 'database']);
    await compose(['run', '--rm', '--no-deps', 'migrate']);
    await compose(['up', '-d', '--wait', '--wait-timeout', '90', 'api', 'web']);
    return { ok: true, command, url: `http://localhost:${process.env.TEMPLUX_HTTP_PORT ?? '31000'}` };
  }
  if (command === 'stop') await compose(['stop', 'web', 'api', 'database']);
  if (command === 'logs') await compose(['logs', '--no-color', '--tail', '100', 'api', 'web', 'database']);
  if (command === 'test' || command === 'typecheck') {
    await compose(['build', 'checks']);
    if (command === 'test') await compose(['up', '-d', '--wait', 'auth-database', 'ssr-body-api', 'ssr-body-web']);
    await compose(['run', '--rm', '--no-deps', 'checks', 'npm', 'run', command]);
  }
  return { ok: true, command };
}

try {
  const result = await main();
  console.log(process.argv.includes('--json') ? JSON.stringify(result)
    : `完成：${result.command}${result.url ? `\n访问 ${result.url}` : ''}`);
} catch (error) {
  const message = error instanceof OperationError || error instanceof PresentationError ? error.message : '操作失败，请检查容器及配置。';
  console.error(JSON.stringify({ event: 'management_failed', message }));
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
}
