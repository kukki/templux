import {restoreCommand} from './restore-cli.js';
import {RestoreResultError} from './restore.js';
import {backupCommand} from './backup-cli.js';
import {BackupResultError,backupSettings} from './backup.js';
import {maintenanceCommand} from './maintenance-cli.js';
import {projectFeatures,FeatureConfigError} from '../../../shared/features.mjs';
import {recordOperation} from './operational-audit.js';
import {auditSettings} from './audit-settings.js';
import {runtimePolicy,runtimeRecord} from '../../../shared/runtime-log.mjs';
import {loginMethodCommand} from './login-method-cli.js';
import { passwordCommand } from './password-cli.js';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { isAbsolute } from 'node:path';
import { OperationError } from './database.js';
import { authorizationCommand } from './auth-cli.js';
import { initialize } from './initialize.js';
import { loadPresentation, PresentationError } from '../../../shared/presentation.mjs';

const commands = ['start', 'status', 'stop', 'logs', 'typecheck', 'test', 'init', 'config-check', 'users', 'authorize', 'create-person', 'create-agent', 'reset-agent', 'request-login-link', 'login-links', 'complete-login-link', 'reset-person', 'maintenance-status', 'maintenance-start', 'maintenance-cancel', 'maintenance-end', 'maintenance-halt', 'maintenance-resume', 'maintenance-rescue', 'backup', 'restore'] as const;
type Command = typeof commands[number];
let currentCommand:Command|undefined;

function isCommand(value: string | undefined): value is Command {
  return commands.some(command => command === value);
}

async function compose(args: string[]): Promise<void> {
  const directory = process.env.TEMPLUX_PROJECT_DIR;
  if (!directory || !isAbsolute(directory)) throw new OperationError('缺少容器管理项目目录。');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', ['compose', '--project-directory', directory,
      '-f', `${directory}/compose.yaml`, ...args], {
      stdio: ['ignore', 2, 2],
      // Compose runs against the host daemon: its bind source is a host path,
      // whereas the management tool itself writes through the container path.
      env: { ...process.env, ...(process.env.TEMPLUX_BACKUP_BIND_DIR !== undefined
        ? { TEMPLUX_BACKUP_DIR: process.env.TEMPLUX_BACKUP_BIND_DIR } : {}) },
    });
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
  const valueNames = ['--name', '--brand', '--theme', '--version', '--copyright', '--config', '--account', '--roles', '--state', '--username', '--owner', '--credential-file', '--method', '--request', '--expected-version', '--at', '--message', '--external-backup-reference', '--mode', '--target', '--archive', '--sha256'];
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
      throw new OperationError(`缺少管理命令：${commands.join('、')}。`);
    }
    const prompt = createInterface({ input: stdin, output: stderr });
    try {
      stderr.write('\nTemplux 管理菜单\n1. 启动\n2. 查看状态\n3. 停止（保留数据库）\n4. 查看日志\n5. 类型检查\n6. 运行测试\n7. 初始化项目\n8. 校验呈现配置\n9. 查看账号\n10. 授权账号\n11. 创建人员密码账号\n12. 创建Agent密码账号\n13. 重置Agent密码\n14. 发起人员登录方式验证\n15. 查询验证请求\n16. 完成已验证关联\n17. 重置人员密码\n18. 维护状态\n19. 开始维护提醒\n20. 取消维护提醒\n21. 结束维护提醒\n22. 停止业务（保留维护入口/DB）\n23. 恢复业务（不部署）\n24. 紧急停止业务（屏障/审计未核验）\n25. 备份数据库（手动保留）\n26. 恢复数据库（显式模式/目标，保持业务关闭）\n');
      const selection = await prompt.question('请选择 1–26：');
      command = commands[Number(selection.trim()) - 1];
    } finally { prompt.close(); }
  }
  if (!isCommand(command)) throw new OperationError('无效管理命令。');
  currentCommand=command;
  if(command==='restore')return restoreCommand(options,flags,(interactive||positional.length===0)&&!nonInteractive&&!json&&!!stdin.isTTY&&!!stderr.isTTY,compose);
  if(command==='backup')return backupCommand(options,flags,(interactive||positional.length===0)&&!nonInteractive&&!json&&!!stdin.isTTY&&!!stderr.isTTY);
  if(command.startsWith('maintenance-'))return maintenanceCommand(command,options,flags,(interactive||positional.length===0)&&!nonInteractive&&!json&&!!stdin.isTTY&&!!stderr.isTTY,compose);
  if(command==='start'||command==='config-check'){auditSettings();projectFeatures();}
  if(['request-login-link','login-links','complete-login-link','reset-person'].includes(command)){
    const allowed=command==='request-login-link'?['--account','--method','--username']:command==='complete-login-link'?['--request','--credential-file']:command==='reset-person'?['--account','--credential-file']:['--account'];
    if([...options.keys()].some(key=>!allowed.includes(key))||flags.has('--overwrite'))throw new OperationError('登录方式管理参数无效。');
    return {command,...await loginMethodCommand(command as 'request-login-link'|'login-links'|'complete-login-link'|'reset-person',options,flags,interactive||(!positional.length&&stdin.isTTY&&stderr.isTTY))};
  }
  if (['create-person','create-agent','reset-agent'].includes(command)) {
    const allowed = command === 'reset-agent' ? ['--account','--credential-file'] : ['--username','--name','--credential-file',...(command==='create-agent'?['--owner']:[])];
    if ([...options.keys()].some(key=>!allowed.includes(key)) || flags.has('--overwrite')) throw new OperationError('密码账号管理参数无效。');
    return passwordCommand(command as 'create-person' | 'create-agent' | 'reset-agent',options,flags,(interactive || positional.length===0)&&!nonInteractive&&!json&&!!stdin.isTTY&&!!stderr.isTTY);
  }
  if (command === 'users' || command === 'authorize') {
    if ([...options.keys()].some(key => !['--account', '--roles', '--state'].includes(key)) || flags.has('--overwrite') || (command === 'users' && options.size)) throw new OperationError('账号管理参数无效。');
    return authorizationCommand(command, options, flags, (interactive || positional.length === 0) && !nonInteractive && !json && !!stdin.isTTY && !!stderr.isTTY);
  }
  if (command !== 'init' && command!=='start' && (options.size > 0 || flags.has('--overwrite'))) throw new OperationError('品牌参数与 --overwrite 只适用于 init。');
  if (command === 'init' && [...options.keys()].some(key => !['--name','--brand','--theme','--version','--copyright','--config'].includes(key))) throw new OperationError('init 参数无效。');
  if (command === 'init') return initialize(options, flags,
    (interactive || positional.length === 0) && !nonInteractive && !json && !!stdin.isTTY && !!stderr.isTTY);
  if (command === 'config-check') { loadPresentation(); return { ok: true, command }; }
  if (command === 'stop' && !args.includes('--confirm')) {
    if (nonInteractive || json || !stdin.isTTY || !stderr.isTTY) throw new OperationError('stop 需要显式 --confirm。');
    const prompt = createInterface({ input: stdin, output: stderr });
    try {
      if ((await prompt.question('停止当前 Templux 入口、前后端及数据库（保留数据）？输入 yes 确认：')).trim() !== 'yes') {
        throw new OperationError('已取消停止操作。');
      }
    } finally { prompt.close(); }
  }
  if (command === 'status') return status();
  if (command === 'start') {
    if([...options.keys()].some(k=>k!=='--external-backup-reference')||flags.has('--overwrite'))throw new OperationError('start 参数无效。');
    if(options.has('--external-backup-reference')&&!flags.has('--confirm'))throw new OperationError('外部备份参考需要 --confirm。');
    backupSettings();loadPresentation();
    await compose(['run', '--build', '--rm', '--no-deps', 'environment', 'check', '--json']);
    await compose(['build', 'api', 'web', 'entry', 'migrate']);
    await compose(['up', '-d', '--wait', '--wait-timeout', '60', 'database']);
    await compose(['run', '--rm', '--no-deps', '-e', `TEMPLUX_HOST_UID=${process.env.TEMPLUX_HOST_UID??process.getuid?.()??0}`, '-e', `TEMPLUX_HOST_GID=${process.env.TEMPLUX_HOST_GID??process.getgid?.()??0}`, 'migrate', ...(options.has('--external-backup-reference')?['--external-backup-reference',options.get('--external-backup-reference')!,'--confirm']:[])]);
    await compose(['up', '-d', '--wait', '--wait-timeout', '90', 'api', 'web', 'entry']);
    return { ok: true, command, url: process.env.APP_PUBLIC_URL };
  }
  if (command === 'stop') await compose(['stop', 'entry', 'web', 'api', 'database']);
  if (command === 'logs') await compose(['logs', '--no-color', '--tail', '100', 'entry', 'api', 'web', 'database']);
  if (command === 'test' || command === 'typecheck') {
    await compose(['build', 'checks']);
    if (command === 'test') await compose(['up', '-d', '--wait', 'auth-database', 'ssr-body-api', 'ssr-body-web']);
    await compose(['run', '--rm', '--no-deps', 'checks', 'npm', 'run', command]);
  }
  return { ok: true, command };
}

try {
  try{runtimePolicy();}catch{throw new OperationError('运行日志容量配置无效。');}const result = await main();
  if(typeof result.command==='string')await recordOperation(result.command,'success');
  console.log(process.argv.includes('--json') ? JSON.stringify(result)
    : typeof result.command==='string'&&(result.command.startsWith('maintenance-')||result.command==='backup'||result.command==='restore') ? `${result.command==='backup'?'备份':result.command==='restore'?'恢复':'维护'}结果：\n${JSON.stringify(result,null,2)}`
    : `完成：${result.command}${result.url ? `\n访问 ${result.url}` : ''}`);
} catch (error) {
  if(currentCommand)await recordOperation(currentCommand,'failed');
  const message = error instanceof OperationError || error instanceof PresentationError || error instanceof FeatureConfigError ? error.message : '操作失败，请检查容器及配置。';
  if(!process.argv.includes('--json'))stderr.write(`${message}\n`);
  runtimeRecord('management','error','management_failed');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: message, ...(error instanceof BackupResultError || error instanceof RestoreResultError ? error.result : {}) }));
  process.exitCode = 1;
}
