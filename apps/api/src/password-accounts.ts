import { constants, openSync, closeSync, fchmodSync, fchownSync, fstatSync, fsyncSync, writeFileSync, unlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { AuthError, readSessionConfig } from './auth-config.js';
import { OperationError } from './database.js';
import { audit, authorizationLock, digest, opaqueToken, transaction } from './auth-store.js';
import { generatePassword, hashPassword, normalizeUsername, verifyPassword } from './password.js';
export type PasswordCreation = { kind: 'person' | 'agent'; username: string; name: string; owner?: string; file: string };
function credentialFile(file: string, payload: object) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(file)) throw new OperationError('--credential-file 须为受限凭据目录内的 JSON 文件名。');
  const directory = process.env.TEMPLUX_CREDENTIAL_DIR ?? '/opt/templux/credentials';
  const path = join(directory, file); let fd: number | undefined; let inode: number | undefined;
  const cleanup = () => { try { if (inode !== undefined && lstatSync(path).ino === inode) unlinkSync(path); } catch { /* Preserve original failure. */ } };
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    inode = fstatSync(fd).ino;
    const uid = Number(process.env.TEMPLUX_HOST_UID ?? process.getuid?.());
    const gid = Number(process.env.TEMPLUX_HOST_GID ?? process.getgid?.());
    if (![uid, gid].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error();
    if (fstatSync(fd).uid !== uid || fstatSync(fd).gid !== gid) fchownSync(fd, uid, gid);
    fchmodSync(fd, 0o600);
    writeFileSync(fd, JSON.stringify(payload) + '\n'); fsyncSync(fd);
    if ((fstatSync(fd).mode & 0o777) !== 0o600) throw new Error();
    closeSync(fd); fd = undefined;
    return { cleanup };
  } catch { if (fd !== undefined) closeSync(fd); cleanup(); throw new OperationError('凭据文件无法安全创建；须指定新文件、可写目录及有效宿主属主，已有文件不会覆盖。'); }
}
export async function createPasswordAccount(pool: pg.Pool, input: PasswordCreation, actor: string) {
  let username: string;
  try { username = normalizeUsername(input.username); } catch { throw new OperationError('用户名须为3–80位英文字母、数字、点、下划线或连字符。'); }
  if (!['person','agent'].includes(input.kind) || !input.name.trim() || input.name.length > 200 || /[\x00-\x1f\x7f]/.test(input.name)
    || (input.kind === 'agent' && !/^[1-9][0-9]{0,18}$/.test(input.owner ?? '')) || (input.kind === 'person' && input.owner)) throw new OperationError('账号类型、显示名称或责任人ID无效。');
  const password = generatePassword(); const hash = await hashPassword(password);
  const output = credentialFile(input.file, { username, password });
  try {
    return await transaction(pool, async client => {
      await authorizationLock(client);
      if (input.kind === 'agent') {
        const owner = (await client.query("SELECT id FROM templux.accounts WHERE id=$1 AND kind='person' AND state='active' FOR UPDATE", [input.owner])).rows[0];
        if (!owner) throw new OperationError('责任人须为已启用的人员账号。');
      }
      const account = (await client.query("INSERT INTO templux.accounts(display_name,state,kind,responsible_person_id) VALUES($1,'active',$2,$3) RETURNING id", [input.name,input.kind,input.owner ?? null])).rows[0];
      await client.query('INSERT INTO templux.password_credentials(account_id,username,password_hash) VALUES($1,$2,$3)', [account.id,username,hash]);
      await audit(client,'cli',actor,'password_account_created',account.id,{kind:input.kind,username,owner:input.owner ?? null,roles:[]});
      return {ok:true,command:`create-${input.kind}`,accountId:account.id,username,kind:input.kind,roles:[],credentialFile:input.file};
    });
  } catch (error) {
    if (!(error instanceof OperationError && error.message.includes('提交结果未确认'))) output.cleanup();
    if (error instanceof OperationError) throw error;
    throw new OperationError('账号或审计保存失败，变更未提交，用户名可能已存在。');
  }
}
export async function resetAgentPassword(pool: pg.Pool, accountId: string, file: string, actor: string) {
  if (!/^[1-9][0-9]{0,18}$/.test(accountId)) throw new OperationError('Agent账号ID无效。');
  const password = generatePassword(); const hash = await hashPassword(password);
  let output: ReturnType<typeof credentialFile> | undefined;
  try {
    return await transaction(pool, async client => {
      await authorizationLock(client);
      const account = (await client.query("SELECT p.username FROM templux.accounts a JOIN templux.password_credentials p ON p.account_id=a.id WHERE a.id=$1 AND a.kind='agent' FOR UPDATE OF a,p",[accountId])).rows[0];
      if (!account) throw new OperationError('未找到Agent密码账号。');
      output = credentialFile(file,{username:account.username,password});
      await client.query('UPDATE templux.password_credentials SET password_hash=$2 WHERE account_id=$1',[accountId,hash]);
      await client.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[accountId]);
      await audit(client,'cli',actor,'agent_password_reset',accountId,{});
      return {ok:true,command:'reset-agent',accountId,credentialFile:file,reloginRequired:true};
    });
  } catch(error) {
    if (!(error instanceof OperationError && error.message.includes('提交结果未确认'))) output?.cleanup();
    if(error instanceof OperationError) throw error;
    throw new OperationError('密码或审计保存失败，变更未提交。');
  }
}
export async function passwordLogin(pool: pg.Pool, usernameValue: unknown, password: unknown, logFailure: () => void) {
  const username = normalizeUsername(usernameValue); const config = readSessionConfig();
  const candidate = (await pool.query<{account_id:string;password_hash:string}>(
    'SELECT account_id,password_hash FROM templux.password_credentials WHERE username=$1 AND enabled',[username])).rows[0];
  if (!await verifyPassword(password,candidate?.password_hash) || !candidate) throw new AuthError('invalid_credentials');
  const token = opaqueToken();
  const kind = await transaction(pool,async client => {
    await authorizationLock(client);
    const account = (await client.query<{kind:string;state:string;auth_version:string;password_hash:string;enabled:boolean;owner_valid:boolean}>(
      `SELECT a.kind,a.state,a.auth_version,p.password_hash,p.enabled,
       EXISTS(SELECT 1 FROM templux.accounts o WHERE o.id=a.responsible_person_id AND o.kind='person' AND o.state='active') AS owner_valid
       FROM templux.accounts a JOIN templux.password_credentials p ON p.account_id=a.id WHERE a.id=$1 FOR UPDATE OF a,p`,[candidate.account_id])).rows[0];
    if (!account || !account.enabled || account.password_hash !== candidate.password_hash || account.state === 'disabled') throw new AuthError('invalid_credentials');
    if (account.kind === 'agent' && (!config.agentEnabled || !account.owner_valid)) throw new AuthError('agent_login_denied',403);
    await client.query("INSERT INTO templux.auth_sessions(token_hash,account_id,auth_version,method,expires_at) VALUES($1,$2,$3,'password',now()+$4*interval '1 second')",[digest(token),candidate.account_id,account.auth_version,account.kind==='agent'?config.agentMaximumSeconds:config.maximumSeconds]);
    return account.kind;
  });
  try { await audit(pool,'password','verified_password','login_succeeded',candidate.account_id,{}); } catch { logFailure(); }
  return {token,maximumSeconds:kind==='agent'?config.agentMaximumSeconds:config.maximumSeconds};
}
