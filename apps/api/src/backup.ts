import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {constants,openSync,closeSync,readFileSync,readSync,fstatSync,writeFileSync,mkdirSync,lstatSync,fchmodSync,fchownSync,fsyncSync,unlinkSync,rmSync,readdirSync,linkSync} from 'node:fs';
import {isAbsolute,join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import type pg from 'pg';
import {OperationError} from './database.js';

type Env=NodeJS.ProcessEnv;
type Kind='manual'|'automatic';
type Settings={directory:string;project:string;retain:number;uid:number;gid:number};
type Payload={schema:1;id:string;project:string;owner:string;source:string;kind:Kind;createdAt:string;bytes:number;sha256:string;format:'custom';toolMajor:18;sequence:number;restored:false};
type Owner={project:string;id:string;key:string;root:string};
export type BackupResult={backupSucceeded:true;retentionSucceeded:boolean;directory:string;id:string;source:string;kind:Kind;sha256:string;bytes:number;restored:false;removed:number;cleanupSucceeded:boolean;containerOwner:{uid:number;gid:number}};
export class BackupResultError extends OperationError {constructor(message:string,public result:BackupResult){super(message);}}
export function backupSettings(env:Env=process.env):Settings{
 if((env.TEMPLUX_HOST_UID===undefined)!==(env.TEMPLUX_HOST_GID===undefined))throw new OperationError('备份属主UID/GID必须成对配置。');
 const directory=env.TEMPLUX_BACKUP_DIR??'/opt/templux/backups',project=env.TEMPLUX_PROJECT_NAME??'templux',retain=env.TEMPLUX_BACKUP_RETAIN??'5';
 const number=(v:string|undefined,fallback:number)=>{if(v===undefined)return fallback;if(!/^(0|[1-9]\d*)$/.test(v)||(!Number.isSafeInteger(Number(v))||Number(v)>4294967294))throw new OperationError('备份属主配置无效。');return Number(v);};
 if(!isAbsolute(directory)||resolve(directory)==='/'||directory.includes('\0')||!directory||!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(project)||!/^([1-9]|[1-9]\d|100)$/.test(retain))throw new OperationError('备份目录/项目/保留数量配置无效。');
 return{directory:resolve(directory),project,retain:Number(retain),uid:number(env.TEMPLUX_HOST_UID,process.getuid?.()??0),gid:number(env.TEMPLUX_HOST_GID,process.getgid?.()??0)};
}
export function safePath(path:string){for(let p=resolve(path);;p=dirname(p)){try{if(lstatSync(p).isSymbolicLink())throw new OperationError('备份路径不允许符号链接。');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(p==='/')break;}}
export function privateFile(path:string,data:string|Buffer,s:Settings){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{fchmodSync(fd,0o600);fchownSync(fd,s.uid,s.gid);writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}
export function syncDirectory(path:string){const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
function readPrivate(path:string,s:Settings,limit=65536){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=fstatSync(fd);if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.uid!==s.uid||stat.gid!==s.gid||stat.size>limit)throw new OperationError('备份归属/清单权限无效。');return readFileSync(fd,'utf8');}finally{closeSync(fd);}}
function root(s:Settings){safePath(s.directory);try{mkdirSync(s.directory,{mode:0o700});const fd=openSync(s.directory,constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fchmodSync(fd,0o700);fchownSync(fd,s.uid,s.gid);}finally{closeSync(fd);}}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}let stat=lstatSync(s.directory);if(stat.isDirectory()&&stat.uid===(process.getuid?.()??0)&&readdirSync(s.directory).length===0){const fd=openSync(s.directory,constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fchmodSync(fd,0o700);fchownSync(fd,s.uid,s.gid);}finally{closeSync(fd);}stat=lstatSync(s.directory);}if(!stat.isDirectory()||(stat.mode&0o777)!==0o700||stat.uid!==s.uid||stat.gid!==s.gid)throw new OperationError('备份目录须为指定宿主属主的0700专用目录。');}
function ownership(s:Settings):Owner{const path=join(s.directory,'.owner.json'),st=lstatSync(s.directory),identity=`${st.dev}:${st.ino}`;try{const value=JSON.parse(readPrivate(path,s));if(value.project!==s.project||value.root!==identity||typeof value.id!=='string'||!/^[a-f0-9]{64}$/.test(value.key))throw new Error();return value;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new OperationError('备份归属记录不匹配或损坏，未覆盖。');const owner={project:s.project,root:identity,id:randomUUID(),key:randomBytes(32).toString('hex')};privateFile(path,JSON.stringify(owner),s);syncDirectory(s.directory);return owner;}}
function signature(payload:unknown,owner:Owner){return createHmac('sha256',Buffer.from(owner.key,'hex')).update(JSON.stringify(payload)).digest('hex');}
export function connection(value:string){try{const u=new URL(value);if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||u.hash)throw new Error();const fields:Env={PGHOST:u.hostname.replace(/^\[|\]$/g,''),PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1))||decodeURIComponent(u.username),PGUSER:decodeURIComponent(u.username)};if(!fields.PGUSER||!fields.PGDATABASE)throw new Error();const allowed:Record<string,string>={sslmode:'PGSSLMODE',sslrootcert:'PGSSLROOTCERT',sslcert:'PGSSLCERT',sslkey:'PGSSLKEY',sslcrl:'PGSSLCRL'};for(const [k,v]of u.searchParams){if(!allowed[k]||u.searchParams.getAll(k).length!==1)throw new Error();fields[allowed[k]!]=v;}const password=decodeURIComponent(u.password);if([...Object.values(fields),password].some(v=>v===undefined||/[\r\n\0]/.test(v)))throw new Error();const source=createHash('sha256').update(JSON.stringify([fields.PGHOST,fields.PGPORT,fields.PGDATABASE])).digest('hex');return{fields,password,source};}catch{throw new OperationError('备份连接配置无效或含未支持的连接选项；请核对显式TLS配置。');}}
export async function tool(name:'pg_dump'|'pg_restore',args:string[],env:Env){await new Promise<void>((yes,no)=>{let diagnostic=false;const child=spawn(`/opt/pg-tools/bin/${name}`,args,{env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',()=>{diagnostic=true;});const timeout=setTimeout(()=>child.kill('SIGKILL'),900000);child.once('error',()=>{clearTimeout(timeout);no(new OperationError(`备份工具${name}无法执行。`));});child.once('close',code=>{clearTimeout(timeout);code===0&&!diagnostic?yes():no(new OperationError(`备份工具${name}未通过（退出/超时/诊断），未发布成功产物；原始诊断含连接信息，未输出。`));});});}
export async function digest(path:string){const {createReadStream}=await import('node:fs');const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
async function retained(s:Settings,owner:Owner,source:string){const valid:Payload[]=[];for(const id of readdirSync(s.directory)){if(!/^backup-[0-9a-f-]{36}$/.test(id))continue;try{const directory=join(s.directory,id),st=lstatSync(directory);if(!st.isDirectory()||(st.mode&0o777)!==0o700||st.uid!==s.uid||st.gid!==s.gid)continue;const m=JSON.parse(readPrivate(join(directory,'manifest.json'),s)),p=m.payload as Payload;if(p.schema!==1||p.id!==id||p.project!==s.project||p.owner!==owner.id||p.source!==source||p.kind!=='automatic'||!Number.isSafeInteger(p.sequence)||p.sequence<1||m.signature!==signature(p,owner))continue;const file=join(directory,'archive.dump'),a=lstatSync(file);if(!a.isFile()||a.isSymbolicLink()||a.uid!==s.uid||a.gid!==s.gid||(a.mode&0o777)!==0o600||a.size!==p.bytes||await digest(file)!==p.sha256)continue;if(readdirSync(directory).some(n=>!['archive.dump','manifest.json'].includes(n)))continue;valid.push(p);}catch{/* Unknown or damaged files are never deletion candidates. */}}return valid.sort((a,b)=>b.sequence-a.sequence);}
export async function backupDatabase(pool:pg.Pool,options:{kind:Kind;connectionString:string;env?:Env}):Promise<BackupResult>{
 const s=backupSettings(options.env),c=connection(options.connectionString),client=await pool.connect();let locked=false,lockFile=false,created=false,published=false,directory='',credentials='';let result:BackupResult|undefined;
 try{
  locked=(await client.query("SELECT pg_try_advisory_lock(hashtext('templux:backups')) AS acquired")).rows[0]?.acquired===true;if(!locked)throw new OperationError('另一个数据库备份正在执行。');root(s);
  try{privateFile(join(s.directory,'.lock'),JSON.stringify({startedAt:new Date().toISOString()}),s);lockFile=true;}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new OperationError('备份目录锁已存在，先核实上次任务结果，不自动抢锁。');throw e;}
  const owner=ownership(s),id=`backup-${randomUUID()}`;directory=join(s.directory,id);mkdirSync(directory,{mode:0o700});created=true;const dfd=openSync(directory,constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fchmodSync(dfd,0o700);fchownSync(dfd,s.uid,s.gid);}finally{closeSync(dfd);}
  const {mkdtempSync}=await import('node:fs');credentials=mkdtempSync(join(tmpdir(),'templux-pg-'));const secretSettings={...s,uid:process.getuid?.()??0,gid:process.getgid?.()??0};const passfile=join(credentials,'pass');privateFile(passfile,`*:*:*:*:${c.password.replace(/\\/g,'\\\\').replace(/:/g,'\\:')}\n`,secretSettings);
  const env={PATH:process.env.PATH,LD_LIBRARY_PATH:'/opt/pg-tools/lib',...c.fields,PGPASSFILE:passfile,PGCONNECT_TIMEOUT:'10',PGAPPNAME:'templux-backup'},archive=join(directory,'archive.dump');privateFile(archive,Buffer.alloc(0),s);
  await tool('pg_dump',['--format=custom','--no-password','--quote-all-identifiers','--file',archive],env);
  const stat=lstatSync(archive),header=Buffer.alloc(5),headerFd=openSync(archive,constants.O_RDONLY|constants.O_NOFOLLOW);try{readSync(headerFd,header,0,5,0);}finally{closeSync(headerFd);}if(!stat.isFile()||stat.size<6||header.toString()!=='PGDMP')throw new OperationError('数据库备份为空或格式无效。');
  await tool('pg_restore',['--list',archive],env);await tool('pg_restore',['--exit-on-error','--file=/dev/null',archive],env);
  const fd=openSync(archive,constants.O_RDONLY|constants.O_NOFOLLOW);try{fchmodSync(fd,0o600);fchownSync(fd,s.uid,s.gid);fsyncSync(fd);}finally{closeSync(fd);}
  const payload:Payload={schema:1,id,project:s.project,owner:owner.id,source:c.source,kind:options.kind,createdAt:new Date().toISOString(),bytes:stat.size,sha256:await digest(archive),format:'custom',toolMajor:18,sequence:options.kind==='automatic'?((await retained(s,owner,c.source))[0]?.sequence??0)+1:0,restored:false};
  privateFile(join(directory,'.manifest.tmp'),JSON.stringify({payload,signature:signature(payload,owner)}),s);syncDirectory(directory);linkSync(join(directory,'.manifest.tmp'),join(directory,'manifest.json'));published=true;unlinkSync(join(directory,'.manifest.tmp'));syncDirectory(directory);syncDirectory(s.directory);
  result={backupSucceeded:true,retentionSucceeded:true,directory,id,source:c.source,kind:options.kind,sha256:payload.sha256,bytes:payload.bytes,restored:false,removed:0,cleanupSucceeded:true,containerOwner:{uid:s.uid,gid:s.gid}};
  if(options.kind==='automatic'){try{for(const p of(await retained(s,owner,c.source)).slice(s.retain)){const path=join(s.directory,p.id);unlinkSync(join(path,'manifest.json'));unlinkSync(join(path,'archive.dump'));const{rmdirSync}=await import('node:fs');rmdirSync(path);result.removed++;}syncDirectory(s.directory);}catch{result.retentionSucceeded=false;throw new BackupResultError('数据库备份成功，但自动保留清理未完成；迁移已中止，勿把新产物当作失败备份。',result);}}
  return result;
 }catch(e){if(e instanceof BackupResultError)throw e;if(published)throw new OperationError('备份成功标记可能已发布，完成结果未确认；请检查受限目录，不自动重试。');if(e instanceof OperationError)throw e;throw new OperationError('数据库备份未完成，未发布成功清单；请检查工具、权限和磁盘空间。');}
 finally{let cleanupFailed=false;
  try{if(credentials)rmSync(credentials,{recursive:true,force:true});}catch{cleanupFailed=true;}
  try{if(created&&!published)rmSync(directory,{recursive:true,force:true});}catch{cleanupFailed=true;}
  try{if(lockFile)unlinkSync(join(s.directory,'.lock'));}catch{cleanupFailed=true;}
  try{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('templux:backups'))");}catch{cleanupFailed=true;}finally{client.release(cleanupFailed);}
  if(cleanupFailed){if(result)throw new BackupResultError('数据库备份成功，但临时文件/任务锁清理未完成，请人工核验。',{...result,cleanupSucceeded:false});throw new OperationError('备份未确认且临时清理未完成，请核实私有目录和任务锁。');}
 }
}

/** A private durable operator claim, never a verified backup or a retention candidate. */
export async function recordExternalBackupReference(reference:string,env:Env=process.env){
 if(!reference.trim()||reference.length>1000||/[\r\n\0]/.test(reference))throw new OperationError('外部备份参考必须为1–1000字符单行非空记录。');
 const s=backupSettings(env);root(s);let lock=false;
 try{privateFile(join(s.directory,'.lock'),'external-reference',s);lock=true;const owner=ownership(s),id=`external-${randomUUID()}`,payload={schema:1,id,project:s.project,owner:owner.id,kind:'external-reference',source:connection(env.DATABASE_URL??'').source,verified:false,reference,createdAt:new Date().toISOString()};privateFile(join(s.directory,`${id}.json`),JSON.stringify({payload,signature:signature(payload,owner)}),s);syncDirectory(s.directory);return{id,verified:false};}catch{throw new OperationError('外部备份参考记录未完成；未允许迁移，请核实目录权限及任务锁。');}finally{if(lock)unlinkSync(join(s.directory,'.lock'));}
}
