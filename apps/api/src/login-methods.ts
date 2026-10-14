import type pg from 'pg';
import {ManagementError,managementOperator,type AuthorizationActor} from './authorization.js';
import {AuthError,readRoles,availableAuthRealm,type AuthConfig,type AuthRealm,type Roles} from './auth-config.js';
import {OperationError} from './database.js';
import {audit,authorizationLock,transaction,digest,opaqueToken,loadSession,loadSessionHash,readSession,requirePermission} from './auth-store.js';
import {normalizeUsername,generatePassword,hashPassword} from './password.js';
import type {Identity} from './feishu.js';
export type Credential={username:string;password:string};
export type Delivery=(credential:Credential)=>{cleanup:()=>void;file:string};
type Link={id:string;account_id:string;expected_version:string;method:'feishu'|'password';username:string|null;status:string;expired:boolean;app_id:string|null;tenant_key:string|null;subject:string|null;verified_name:string|null;proof_session_hash:string|null};
const invalid=()=>new ManagementError('invalid_management_input',400,'登录方式管理参数无效。');
export function managementId(id:string){if(!/^[1-9][0-9]{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)throw invalid();return id;}
async function target(client:pg.PoolClient,id:string,version?:string){const row=(await client.query<{id:string;kind:string;state:string;auth_version:string}>('SELECT id,kind,state,auth_version FROM templux.accounts WHERE id=$1 FOR UPDATE',[managementId(id)])).rows[0];
 if(!row)throw new ManagementError('account_not_found',404,'目标不存在。');if(row.kind!=='person')throw new ManagementError('person_required',409,'仅人员账号可关联登录方式；Agent仍独立。');
 if(version!==undefined&&row.auth_version!==version)throw new ManagementError('account_conflict',409,'目标已变更，请重新创建验证请求。');return row;}
async function request(client:pg.PoolClient,id:string){const row=(await client.query<Link>('SELECT *,expires_at<=clock_timestamp() AS expired FROM templux.login_method_requests WHERE id=$1 FOR UPDATE',[managementId(id)])).rows[0];
 if(!row||row.expired||!['pending','verified'].includes(row.status))throw new ManagementError('link_request_unavailable',409,'请求已过期、取消或完成。');return row;}
function realmRequired(realm:AuthRealm|null){if(!realm)throw new AuthError('authentication_unconfigured',503);return realm;}
async function currentFeishu(client:pg.PoolClient,id:string,realm:AuthRealm){return (await client.query<{subject:string}>('SELECT subject FROM templux.identities WHERE account_id=$1 AND provider=\'feishu\' AND app_id=$2 AND tenant_key=$3',[id,realm.appId,realm.tenantKey])).rows[0];}
async function fresh(client:pg.PoolClient,hash:string){if(!(await client.query<{fresh:boolean}>('SELECT created_at>clock_timestamp()-interval \'5 minutes\' AS fresh FROM templux.auth_sessions WHERE token_hash=$1',[hash])).rows[0]?.fresh)throw new ManagementError('fresh_login_required',409,'请先重新通过目标账号的正常登录，再进行验证。');}
async function safe<T>(work:()=>Promise<T>):Promise<T>{try{return await work();}catch(error){if(error instanceof AuthError||error instanceof OperationError)throw error;throw new ManagementError('login_method_save_failed',503,'登录方式或审计保存失败，变更未提交。');}}
export async function createLoginRequest(pool:pg.Pool,input:{accountId:string;expectedVersion:string;method:'feishu'|'password';username?:string},actor:AuthorizationActor,definitions:Roles=readRoles(),realm:AuthRealm|null=availableAuthRealm()){
 const current=realmRequired(realm);if(!['feishu','password'].includes(input.method)||!input.expectedVersion||input.method==='feishu'&&input.username!==undefined)throw invalid();const username=input.method==='password'?normalizeUsername(input.username):null;
 return safe(()=>transaction(pool,async client=>{await authorizationLock(client);const operator=await managementOperator(client,actor,definitions);const account=await target(client,input.accountId,input.expectedVersion);if(account.state==='disabled')throw new ManagementError('account_disabled',409,'停用账号不可关联。');
 const pwd=(await client.query<{username:string;enabled:boolean}>('SELECT username,enabled FROM templux.password_credentials WHERE account_id=$1',[account.id])).rows[0];
 if(input.method==='password'){if(!await currentFeishu(client,account.id,current))throw new ManagementError('feishu_identity_required',409,'启用密码须验证目标当前飞书身份。');if(pwd?.enabled)throw new ManagementError('password_already_enabled',409,'已启用密码，请使用管理员重置。');if(pwd&&pwd.username!==username)throw new ManagementError('identity_conflict',409,'须使用目标原有用户名。');
 if((await client.query('SELECT account_id FROM templux.password_credentials WHERE username=$1 AND account_id<>$2',[username,account.id])).rowCount)throw new ManagementError('identity_conflict',409,'用户名已被其它账号占用。');
 }else if(!pwd?.enabled)throw new ManagementError('password_identity_required',409,'关联飞书须先具有可验证的正常密码方式。');
 await client.query("UPDATE templux.login_method_requests SET status='cancelled' WHERE account_id=$1 AND method=$2 AND status IN ('pending','verified')",[account.id,input.method]);
 const row=(await client.query<{id:string}>("INSERT INTO templux.login_method_requests(account_id,expected_version,method,username,issuer) VALUES($1,$2,$3,$4,$5) RETURNING id",[account.id,account.auth_version,input.method,username,operator.actor])).rows[0]!;
 await audit(client,operator.source,operator.actor,'login_method_requested',account.id,{requestId:row.id,method:input.method});return {ok:true,requestId:row.id,accountId:account.id,method:input.method};}));
}
export async function listLoginRequests(pool:pg.Pool,actor:AuthorizationActor,accountId?:string,owner=false,definitions:Roles=readRoles()){
 return transaction(pool,async client=>{await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('templux:authorization'))");let id=accountId;
 if(owner){if(typeof actor==='string')throw invalid();id=(await loadSession(client,actor.token,actor.config,definitions,true)).id;}else await managementOperator(client,actor,definitions);
 if(id!==undefined)managementId(id);
 return (await client.query(`SELECT id,account_id AS "accountId",method,username,CASE WHEN expires_at<=clock_timestamp() AND status IN ('pending','verified') THEN 'expired' ELSE status END AS status,verified_name AS "verifiedName",expires_at AS "expiresAt" FROM templux.login_method_requests WHERE ($1::bigint IS NULL OR account_id=$1) ORDER BY id DESC LIMIT 25`,[id??null])).rows;
 });
}
export async function verifyPasswordEnable(pool:pg.Pool,id:string,token:string|undefined,config:AuthConfig|null,definitions:Roles){const realm=realmRequired(config);
 return safe(()=>transaction(pool,async client=>{await authorizationLock(client);const owner=await loadSession(client,token,config,definitions);const link=await request(client,id);await target(client,link.account_id,link.expected_version);
 if(link.method!=='password'||link.status!=='pending'||owner.id!==link.account_id||owner.loginMethod!=='feishu')throw new ManagementError('link_verification_denied',403,'须由目标人员通过正常飞书登录验证。');await fresh(client,digest(token!));const identity=await currentFeishu(client,owner.id,realm);if(!identity)throw new ManagementError('identity_conflict',409,'目标当前飞书身份已变化。');
 await client.query("UPDATE templux.login_method_requests SET status='verified',app_id=$2,tenant_key=$3,subject=$4,verified_name=$5,proof_session_hash=$6 WHERE id=$1",[link.id,realm.appId,realm.tenantKey,identity.subject,owner.name,digest(token!)]);
 await audit(client,'feishu',`account:${owner.id}`,'login_method_verified',owner.id,{requestId:link.id,method:'password'});return {ok:true};}));
}
export async function beginFeishuLink(pool:pg.Pool,id:string,token:string|undefined,config:AuthConfig|null,definitions:Roles){realmRequired(config);const state=opaqueToken(),browser=opaqueToken();
 await safe(()=>transaction(pool,async client=>{await authorizationLock(client);const owner=await loadSession(client,token,config,definitions);const link=await request(client,id);await target(client,link.account_id,link.expected_version);
 if(link.method!=='feishu'||link.status!=='pending'||owner.id!==link.account_id||owner.loginMethod!=='password')throw new ManagementError('link_verification_denied',403,'须由目标人员通过正常密码登录验证。');await fresh(client,digest(token!));
 await client.query('DELETE FROM templux.oauth_requests WHERE state_hash=(SELECT oauth_state_hash FROM templux.login_method_requests WHERE id=$1)',[link.id]);
 await client.query("INSERT INTO templux.oauth_requests(state_hash,browser_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '10 minutes')",[digest(state),digest(browser)]);
 await client.query('UPDATE templux.login_method_requests SET oauth_state_hash=$2,proof_session_hash=$3 WHERE id=$1',[link.id,digest(state),digest(token!)]);
 }));return {state,browser};
}
export async function verifyFeishuLink(pool:pg.Pool,state:string,identity:Identity,config:AuthConfig,definitions:Roles){
 return safe(()=>transaction(pool,async client=>{await authorizationLock(client);const link=(await client.query<Link>('SELECT *,expires_at<=clock_timestamp() AS expired FROM templux.login_method_requests WHERE oauth_state_hash=$1 FOR UPDATE',[digest(state)])).rows[0];
 if(!link)return false;if(link.expired||link.status!=='pending'||link.method!=='feishu')throw new ManagementError('link_request_unavailable',409,'请求已失效。');const account=await target(client,link.account_id,link.expected_version);
 const owner=await loadSessionHash(client,link.proof_session_hash??'',config,definitions);if(owner.id!==account.id||owner.loginMethod!=='password')throw new ManagementError('link_verification_denied',403,'目标密码验证已失效。');await fresh(client,link.proof_session_hash!);
 const collision=(await client.query<{account_id:string}>('SELECT account_id FROM templux.identities WHERE provider=\'feishu\' AND app_id=$1 AND tenant_key=$2 AND subject=$3',[identity.appId,identity.tenantKey,identity.subject])).rows[0];
 const existing=await currentFeishu(client,account.id,identity);
 if(collision&&collision.account_id!==account.id||existing&&existing.subject!==identity.subject)throw new ManagementError('identity_conflict',409,'飞书身份已被占用或目标已有其它飞书身份；不合并账号。');
 await client.query("UPDATE templux.login_method_requests SET status='verified',app_id=$2,tenant_key=$3,subject=$4,verified_name=$5 WHERE id=$1",[link.id,identity.appId,identity.tenantKey,identity.subject,identity.name]);
 await audit(client,'feishu',`account:${account.id}`,'login_method_verified',account.id,{requestId:link.id,method:'feishu'});return true;}));
}
async function preflightOperator(pool:pg.Pool,actor:AuthorizationActor,definitions:Roles){if(typeof actor!=='string')requirePermission(await readSession(pool,actor.token,actor.config,definitions),'accounts:manage');}
export async function completeLoginRequest(pool:pg.Pool,id:string,actor:AuthorizationActor,delivery?:Delivery,definitions:Roles=readRoles(),realm:AuthRealm|null=availableAuthRealm()){
 await preflightOperator(pool,actor,definitions);const current=realmRequired(realm);const password=generatePassword(),hash=await hashPassword(password);let output:ReturnType<Delivery>|undefined;
 try{return await safe(()=>transaction(pool,async client=>{await authorizationLock(client);const operator=await managementOperator(client,actor,definitions);const link=await request(client,id);const account=await target(client,link.account_id,link.expected_version);
 if(link.status!=='verified'||link.app_id!==current.appId||link.tenant_key!==current.tenantKey)throw new ManagementError('link_not_verified',409,'请求尚未验证或部署身份域已变更。');
 if(account.state==='disabled')throw new ManagementError('account_disabled',409,'目标已停用。');
 let credential:Credential|undefined;
 if(link.method==='password'){
 if(operator.account?.id===account.id)throw new ManagementError('self_password_change_cli',409,'本人密码变更请使用CLI受限文件交付。');
 const identity=await currentFeishu(client,account.id,current);if(identity?.subject!==link.subject)throw new ManagementError('identity_conflict',409,'目标飞书身份已变化。');
 const pwd=(await client.query<{username:string;enabled:boolean}>('SELECT username,enabled FROM templux.password_credentials WHERE account_id=$1',[account.id])).rows[0];if(pwd?.enabled)throw new ManagementError('password_already_enabled',409,'密码已启用，请重新查询。');
 if((await client.query('SELECT 1 FROM templux.password_credentials WHERE username=$1 AND account_id<>$2',[link.username,account.id])).rowCount)throw new ManagementError('identity_conflict',409,'用户名已被占用。');
 credential={username:link.username!,password};if(typeof actor==='string'&&!delivery)throw invalid();output=delivery?.(credential);
 await client.query('INSERT INTO templux.password_credentials(account_id,username,password_hash,enabled) VALUES($1,$2,$3,true) ON CONFLICT(account_id) DO UPDATE SET password_hash=$3,enabled=true',[account.id,link.username,hash]);
 }else{
 const collision=(await client.query<{account_id:string}>('SELECT account_id FROM templux.identities WHERE provider=\'feishu\' AND app_id=$1 AND tenant_key=$2 AND subject=$3',[link.app_id,link.tenant_key,link.subject])).rows[0];const existing=await currentFeishu(client,account.id,current);
 if(collision&&collision.account_id!==account.id||existing&&existing.subject!==link.subject)throw new ManagementError('identity_conflict',409,'飞书身份已被占用；不合并账号。');
 if(!collision)await client.query("INSERT INTO templux.identities(account_id,provider,app_id,tenant_key,subject) VALUES($1,'feishu',$2,$3,$4)",[account.id,link.app_id,link.tenant_key,link.subject]);
 }
 await client.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[account.id]);await client.query("UPDATE templux.login_method_requests SET status='completed' WHERE id=$1",[link.id]);await audit(client,operator.source,operator.actor,'login_method_linked',account.id,{requestId:link.id,method:link.method});
 return {ok:true,accountId:account.id,reloginRequired:true,selfChanged:operator.account?.id===account.id,...(output?{credentialFile:output.file}:credential?{credential}: {})};}));}catch(error){if(!(error instanceof OperationError&&error.message.includes('提交结果未确认')))output?.cleanup();throw error;}
}
export async function resetPersonPassword(pool:pg.Pool,id:string,version:string|undefined,actor:AuthorizationActor,delivery?:Delivery,definitions:Roles=readRoles()){
 await preflightOperator(pool,actor,definitions);const password=generatePassword(),hash=await hashPassword(password);let output:ReturnType<Delivery>|undefined;
 try{return await safe(()=>transaction(pool,async client=>{await authorizationLock(client);const operator=await managementOperator(client,actor,definitions);const account=await target(client,id,version);
 if(operator.account?.id===account.id)throw new ManagementError('self_password_change_cli',409,'本人密码重置请使用CLI受限文件。');
 const pwd=(await client.query<{username:string}>('SELECT username FROM templux.password_credentials WHERE account_id=$1',[account.id])).rows[0];if(!pwd)throw new ManagementError('password_identity_required',409,'目标尚无已验证密码方式，请先发起启用请求。');
 const credential={username:pwd.username,password};if(typeof actor==='string'&&!delivery)throw invalid();output=delivery?.(credential);
 await client.query('UPDATE templux.password_credentials SET password_hash=$2 WHERE account_id=$1',[account.id,hash]);await client.query('UPDATE templux.accounts SET auth_version=auth_version+1 WHERE id=$1',[account.id]);
 await audit(client,operator.source,operator.actor,'person_password_reset',account.id,{});return {ok:true,accountId:account.id,reloginRequired:true,selfChanged:operator.account?.id===account.id,...(output?{credentialFile:output.file}:{credential})};}));}catch(error){if(!(error instanceof OperationError&&error.message.includes('提交结果未确认')))output?.cleanup();throw error;}
}
