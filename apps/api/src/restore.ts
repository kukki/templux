import {isAbsolute,join} from 'node:path';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readSync,writeSync,readFileSync,mkdtempSync,rmSync,fsyncSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {OperationError,migrations,schemaVersion,hasUserObjects} from './database.js';
import {backupSettings,backupDatabase,connection,tool,digest,safePath,privateFile,syncDirectory} from './backup.js';
import {readMaintenance,maintenanceOperation} from './maintenance.js';
import {restoreBlockPath,assertNoRestoreBlock} from './maintenance-release.js';
import {auditActor,auditDetails} from './audit-store.js';
import {restoreProcess} from './restore-process.js';
export type RestoreInput={mode:'original'|'independent';target:string;connectionString:string;archive:string;sha256:string};
export class RestoreResultError extends OperationError {constructor(message:string,public result:Record<string,unknown>){super(message);}}
export function restoreInput(options:Map<string,string>,env:NodeJS.ProcessEnv):RestoreInput{
 const mode=options.get('--mode'),target=options.get('--target'),archive=options.get('--archive'),sha256=options.get('--sha256');
 if(mode!=='original'&&mode!=='independent'||!target)throw new OperationError('restore 必须明确 --mode original|independent 和 --target；无默认模式或目标。');
 if(target!=='current'&&!/^env:[A-Z][A-Z0-9_]{0,99}$/.test(target))throw new OperationError('恢复目标须为 current 或 env:变量名，不接受含凭据的URL参数。');
 const connectionString=target==='current'?env.DATABASE_URL:env[target.slice(4)];
 if(!connectionString)throw new OperationError('恢复目标配置缺失。');
 if(!archive||!isAbsolute(archive)||archive.includes('\0')||!sha256||!/^[a-f0-9]{64}$/.test(sha256))throw new OperationError('restore 必须提供归档绝对路径 --archive 和已核对 --sha256。');
 return{mode,target,connectionString,archive:join(archive),sha256};
}
/** Only full custom COPY archives with this release's exact immutable history. */
export function validateRestoreHistory(sql:string,expected:{version:string;checksum:string}[]){
 const sections=[...sql.matchAll(/COPY (?:(?:public)|(?:"public"))\.(?:(?:templux_migrations)|(?:"templux_migrations")) \(([^\n]+)\) FROM stdin;\r?\n([\s\S]*?)\r?\n\\\.\r?\n/g)];
 if(sections.length!==1)throw new OperationError('归档缺少唯一完整迁移历史，版本未核验。');
 const columns=sections[0]![1]!.replaceAll('"','').split(',').map(v=>v.trim());
 const vi=columns.indexOf('version'),ci=columns.indexOf('checksum');
 const rows=sections[0]![2]!.split(/\r?\n/).map(line=>line.split('\t'));
 if(vi<0||ci<0||rows.length!==expected.length||rows.some((r,i)=>r[vi]!==expected[i]!.version||r[ci]!==expected[i]!.checksum))throw new OperationError('归档迁移版本/历史与当前发布不匹配；未停服或修改目标。');
}
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const identifier=(value:string)=>'"'+value.replaceAll('"','""')+'"';
async function identity(client:pg.PoolClient){
 const row=(await client.query("SELECT s.system_identifier::text AS cluster,d.oid::text AS oid,d.datname AS name,d.datallowconn AS allowed,(r.rolsuper OR pg_has_role(current_user,d.datdba,'USAGE')) AS owner FROM pg_control_system() s,pg_database d,pg_roles r WHERE d.datname=current_database() AND r.rolname=current_user")).rows[0];
 if(!row?.cluster||!row.oid)throw new OperationError('无法验证数据库真实身份；拒绝恢复。');return row as {cluster:string;oid:string;name:string;allowed:boolean;owner:boolean};
}
function finalizeSQL(expected:{version:string;checksum:string}[],runId:string,mode:string,sha256:string){
 const history=literal(JSON.stringify(expected.map(({version,checksum})=>({version,checksum}))));
 const identity=auditActor('cli',`host-uid:${process.env.TEMPLUX_HOST_UID??process.getuid?.()??'unknown'}`);
 const details=literal(JSON.stringify(auditDetails({restoreRunId:runId,restoreSha256:sha256,restoreMode:mode})));
 return `DO $restore_check$ BEGIN
 IF (SELECT COALESCE(jsonb_agg(jsonb_build_object('version',version,'checksum',checksum) ORDER BY version),'[]'::jsonb) FROM public.templux_migrations) <> ${history}::jsonb THEN RAISE EXCEPTION 'restore history mismatch'; END IF;
 IF NOT (SELECT count(*)=8 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='templux' AND c.relname IN ('accounts','identities','account_roles','auth_sessions','oauth_requests','password_credentials','password_failures','login_method_requests') AND t.tgname='maintenance_write_guard' AND t.tgenabled='O' AND t.tgtype=62 AND t.tgfoid=to_regprocedure('templux.guard_maintenance_write()')) THEN RAISE EXCEPTION 'restore guards missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM templux.maintenance_state WHERE singleton AND gate_version>=0) THEN RAISE EXCEPTION 'restore state missing'; END IF;
 END $restore_check$;
 -- This transient online value is invisible outside the fenced transaction. Guards remain enabled.
 UPDATE templux.maintenance_state SET phase='online' WHERE singleton;
 DELETE FROM templux.auth_sessions;
 DELETE FROM templux.oauth_requests;
 DELETE FROM templux.login_method_requests;
 UPDATE templux.maintenance_state SET phase='offline',version=version+1,gate_version=gate_version+1,updated_at=clock_timestamp() WHERE singleton;
 INSERT INTO templux.audit_events(source,actor,event,account_id,details,result,actor_assurance) VALUES('cli',${literal(identity.actor)},'database_restored',NULL,${details}::jsonb,'success','host_claim');`;
}
export async function restoreDatabase(input:RestoreInput,compose:(args:string[])=>Promise<void>):Promise<Record<string,unknown>>{
 const runId=randomUUID(),settings=backupSettings(),currentConnection=process.env.DATABASE_URL;
 const result:Record<string,unknown>={runId,mode:input.mode,target:input.target,stage:'preflight',connectionsClosed:false,dataCommitted:false,accessReady:false,restored:false};
 let temporary='',fenced=false,block=false,commitAttempted=false,crossedFence=false;let rescue:pg.PoolClient|undefined,targetName='',rescueConnection='';let child:ReturnType<typeof restoreProcess>|undefined;
 const pools:pg.Pool[]=[],clients:pg.PoolClient[]=[];
 const connect=async(value:string)=>{connection(value);const pool=new pg.Pool({connectionString:value,max:1,connectionTimeoutMillis:5000,query_timeout:15000});pools.push(pool);const client=await pool.connect();client.on('error',()=>{});clients.push(client);return client;};
 try{
  if(!currentConnection)throw new OperationError('当前数据库配置缺失。');
  const c=connection(input.connectionString),expected=await migrations();safePath(input.archive);
  const fd=openSync(input.archive,constants.O_RDONLY|constants.O_NOFOLLOW);
  temporary=mkdtempSync(join(tmpdir(),'templux-restore-'));const own={...settings,uid:process.getuid?.()??0,gid:process.getgid?.()??0};
  const archive=join(temporary,'archive.dump');privateFile(archive,Buffer.alloc(0),own);
  try{
   const st=fstatSync(fd);if(!st.isFile()||st.size<6||(st.mode&0o777)!==0o600||st.uid!==settings.uid||st.gid!==settings.gid)throw new OperationError('恢复归档须为指定属主的0600普通文件，禁止链接。');
   const header=Buffer.alloc(5);readSync(fd,header,0,5,0);if(header.toString()!=='PGDMP')throw new OperationError('仅支持完整custom PGDMP归档；未修改目标。');
   const out=openSync(archive,constants.O_WRONLY|constants.O_NOFOLLOW);try{const buffer=Buffer.alloc(1024*1024);let n;while((n=readSync(fd,buffer,0,buffer.length,null))>0){let offset=0;while(offset<n)offset+=writeSync(out,buffer,offset,n-offset);}fsyncSync(out);}finally{closeSync(out);}
  }finally{closeSync(fd);}
  if(await digest(archive)!==input.sha256)throw new OperationError('恢复归档SHA256不匹配，未修改目标。');
  privateFile(join(temporary,'pass'),`*:*:*:*:${c.password.replaceAll('\\','\\\\').replaceAll(':','\\:')}\n`,own);
  const env={PATH:process.env.PATH,LD_LIBRARY_PATH:'/opt/pg-tools/lib',...c.fields,PGPASSFILE:join(temporary,'pass'),PGCONNECT_TIMEOUT:'10',PGAPPNAME:'templux-restore'};
  await tool('pg_restore',['--list',archive],env);
  const sql=join(temporary,'restore.sql');privateFile(sql,Buffer.alloc(0),own);
  await tool('pg_restore',['--exit-on-error','--clean','--if-exists','--no-owner','--no-acl','--file',sql,archive],env);
  const decoded=openSync(sql,constants.O_RDONLY|constants.O_NOFOLLOW);try{if(fstatSync(decoded).size>512*1024*1024)throw new OperationError('解码归档超过首版512MiB SQL上限，未修改目标。');validateRestoreHistory(readFileSync(decoded,'utf8'),expected);}finally{closeSync(decoded);}
  const current=await connect(currentConnection),target=await connect(input.connectionString);
  const currentId=await identity(current),targetId=await identity(target);
  current.release(true);clients.splice(clients.indexOf(current),1);
  const same=currentId.cluster===targetId.cluster&&currentId.oid===targetId.oid;
  if(input.mode==='independent'&&same||input.mode==='original'&&!same)throw new OperationError('恢复模式与实际数据库身份不符；独立别名不得指向当前库。');
  if(!targetId.owner||!targetId.allowed)throw new OperationError('目标须允许连接且操作者拥有数据库ALTER权限；未修改目标。');
  const adminUrl=process.env.TEMPLUX_RESTORE_ADMIN_URL??(()=>{const u=new URL(input.connectionString);u.pathname='/postgres';return u.toString();})();
  const admin=await connect(adminUrl),adminId=await identity(admin);rescue=admin;targetName=targetId.name;rescueConnection=adminUrl;
  if(adminId.cluster!==targetId.cluster||adminId.oid===targetId.oid)throw new OperationError('须有同集群不同管理库的救援连接；未修改目标。');
  const preflight=await target.query(`SELECT
   current_setting('server_version_num')::integer BETWEEN 180000 AND 189999 AS supported_version,
   has_function_privilege(current_user,'pg_catalog.pg_terminate_backend(integer,bigint)','EXECUTE') AS terminate,
   NOT EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) AS prepared_clear,
   NOT EXISTS(SELECT 1 FROM (
    SELECT c.relowner AS owner,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    UNION ALL SELECT t.typowner,n.nspname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    UNION ALL SELECT p.proowner,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    UNION ALL SELECT n.nspowner,n.nspname FROM pg_namespace n
   ) owned WHERE nspname !~ '^pg_' AND nspname<>'information_schema' AND NOT pg_has_role(current_user,owner,'USAGE')) AS objects_owned,
   NOT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_roles r ON r.rolname=a.usename WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND NOT (pg_has_role(current_user,r.oid,'USAGE') OR (pg_has_role(current_user,'pg_signal_backend','USAGE') AND NOT r.rolsuper))) AS can_terminate`);
  if(Object.values(preflight.rows[0]).some(v=>v!==true))throw new OperationError('恢复权限/已有对象属主/在途预备事务检查未通过；未停服或修改目标。');
  const adminRole=(await admin.query("SELECT r.rolsuper OR pg_has_role(current_user,d.datdba,'USAGE') AS allowed FROM pg_database d,pg_roles r WHERE d.oid=$1 AND r.rolname=current_user",[targetId.oid])).rows[0]?.allowed;
  if(!adminRole)throw new OperationError('管理库连接无目标ALTER救援权限。');
  result.targetIdentity=digestIdentity(targetId);result.archiveSha256=input.sha256;
  // A pre-destruction backup preserves the current target, not a substitute for the selected archive.
  const existing=await hasUserObjects(target);
  if(existing){result.stage='target-backup';const pool=new pg.Pool({connectionString:input.connectionString});try{result.safetyBackup=await backupDatabase(pool,{kind:'manual',connectionString:input.connectionString});}finally{await pool.end();}}
  for(const key of ['templux:migrations','templux:backups'])if(!(await target.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',[key])).rows[0]?.acquired)throw new OperationError('另一迁移/备份任务正在执行；未停服或执行恢复。');
  if(input.mode==='original'){
   try{const response=await fetch('http://entry:8080/health/live',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error();}catch{throw new OperationError('维护入口未确认存活，未停服或执行恢复。');}
   assertNoRestoreBlock();await schemaVersion(target,expected);result.stage='halt';
   const state=await readMaintenance(target);const haltPool=new pg.Pool({connectionString:input.connectionString});try{await maintenanceOperation(haltPool,'halt',{expectedVersion:state.version},`host-uid:${settings.uid}`,async()=>compose(['stop','--timeout','30','web','api']));}finally{await haltPool.end();}
  }
  // Lock order agrees with migration/backup. Ordinary maintenance cannot resume during restoration.
  for(const key of ['templux:maintenance-operation']){
   if(!(await target.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',[key])).rows[0]?.acquired)throw new OperationError('另一迁移/备份/维护任务正在执行；未执行恢复。');
  }
  if(input.mode==='original'){
   if((await readMaintenance(target)).phase!=='offline')throw new OperationError('停写状态已变化，拒绝恢复。');
   result.stage='entry-block';result.entryBlocked='unknown';privateFile(restoreBlockPath(),JSON.stringify({runId,sha256:input.sha256}),{...own,uid:process.getuid?.()??0,gid:process.getgid?.()??0});block=true;result.entryBlocked=true;syncDirectory(join(restoreBlockPath(),'..'));
  }
  result.stage='connection-fence';child=restoreProcess(env);const restorePid=await child.connect();
  // The already-connected restoring transaction and management session survive ALLOW_CONNECTIONS=false.
  crossedFence=true;result.connectionsClosed='unknown';await admin.query(`ALTER DATABASE ${identifier(targetId.name)} ALLOW_CONNECTIONS false`);fenced=true;result.connectionsClosed=true;
  await target.query('SELECT pg_terminate_backend(pid,10000) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND pid<>$1',[restorePid]);
  if((await target.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND pid<>$1) AS present',[restorePid])).rows[0]?.present)throw new OperationError('目标仍有其它连接，恢复已中止并保持禁连接。');
  if(!(await target.query('SELECT NOT EXISTS(SELECT 1 FROM pg_prepared_xacts WHERE database=current_database()) AS clear')).rows[0]?.clear)throw new OperationError('存在预备事务，恢复已中止并保持禁连接。');
  result.stage='restore-transaction';await child.execute(sql,finalizeSQL(expected,runId,input.mode,input.sha256));
  result.stage='commit-unconfirmed';commitAttempted=true;await child.commit();result.dataCommitted=true;
  result.stage='verify-commit';await schemaVersion(target,expected);
  const verified=(await target.query("SELECT (SELECT count(*) FROM templux.auth_sessions)=0 AS sessions_clear,(SELECT count(*) FROM templux.oauth_requests)=0 AS oauth_clear,(SELECT count(*) FROM templux.login_method_requests)=0 AS links_clear,EXISTS(SELECT 1 FROM templux.maintenance_state WHERE singleton AND phase='offline') AS offline,EXISTS(SELECT 1 FROM templux.audit_events WHERE event='database_restored' AND details->>'restoreRunId'=$1) AS audited",[runId])).rows[0];
  if(Object.values(verified).some(v=>v!==true))throw new OperationError('恢复提交后验证未通过，保持禁连接。');
  result.stage='allow-connections';await admin.query(`ALTER DATABASE ${identifier(targetId.name)} ALLOW_CONNECTIONS true`);
  if(!(await admin.query('SELECT datallowconn FROM pg_database WHERE oid=$1',[targetId.oid])).rows[0]?.datallowconn)throw new OperationError('重新允许连接未确认。');
  fenced=false;result.connectionsClosed=false;
  if(block){result.entryBlocked='unknown';const value=JSON.parse(readFileSync(restoreBlockPath(),'utf8'));if(value.runId!==runId)throw new OperationError('恢复入口阻断归属改变，未释放。');unlinkSync(restoreBlockPath());syncDirectory(join(restoreBlockPath(),'..'));block=false;result.entryBlocked=false;}
  result.stage='completed-offline';result.restored=true;result.schemaVersion=expected.at(-1)!.version;result.state=await readMaintenance(target);result.sessionsRevoked=true;return result;
 }catch(error){
  if(commitAttempted&&result.dataCommitted!==true)result.dataCommitted='unknown';
  if(crossedFence&&rescue){try{await rescue.query(`ALTER DATABASE ${identifier(targetName)} ALLOW_CONNECTIONS false`);fenced=true;result.connectionsClosed=true;}catch{
    // Re-fencing is idempotent safety cleanup, never a restore/commit retry.
    const control=new pg.Pool({connectionString:rescueConnection,max:1,connectionTimeoutMillis:5000,query_timeout:10000});
    try{await control.query(`ALTER DATABASE ${identifier(targetName)} ALLOW_CONNECTIONS false`);fenced=true;result.connectionsClosed=true;}catch{result.connectionsClosed='unknown';}finally{await control.end();}
   }}
  if(result.connectionsClosed!=='unknown')result.connectionsClosed=fenced;if(result.entryBlocked!=='unknown')result.entryBlocked=block;
  const message=error instanceof OperationError?error.message:'恢复未完成，原始数据库/工具诊断已隐藏。';
  throw new RestoreResultError(`${message} 请按runId及stage核验；不自动重试/开放。`,result);
 }finally{
  await child?.abort();let cleanupFailed=false;for(const client of clients)try{client.release(true);}catch{cleanupFailed=true;}for(const pool of pools)try{await pool.end();}catch{cleanupFailed=true;}if(temporary)try{rmSync(temporary,{recursive:true,force:true});}catch{cleanupFailed=true;}
  if(cleanupFailed)throw new RestoreResultError('恢复清理未完成；按runId核验私有临时目录和连接，勿自动重试。',{...result,cleanupSucceeded:false});
 }
}
function digestIdentity(identity:{cluster:string;oid:string}){return `${identity.cluster}:${identity.oid}`;}
