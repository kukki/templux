import {parseEnv} from 'node:util';
import {trustedProxyPolicy} from './client-ip.mjs';
// This is the deployed contract. The example must declare every key with the same policy.
const required=['TEMPLUX_PROJECT_NAME','DEPLOYMENT_ENV','APP_PUBLIC_URL'];
const database=['DATABASE_URL'];const localDatabase=['TEMPLUX_DB_PASSWORD'];
const domain=['APP_HOST','NETWORK_NAME','ENTRY_TRUSTED_PROXY_CIDRS'];
const feishu=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_REDIRECT_URI'];
const optional=['DOMAIN_NAME','TEMPLUX_HTTP_PORT','TEMPLUX_API_PORT','TEMPLUX_ACCESS_MODE','FEISHU_TENANT_KEY','FEISHU_ALLOWED_TENANT_KEY','PERSON_IDLE_TIMEOUT_SECONDS','PERSON_SESSION_MAX_SECONDS','AGENT_LOGIN_ENABLED','AGENT_IDLE_TIMEOUT_SECONDS','AGENT_SESSION_MAX_SECONDS','TEMPLUX_CREDENTIAL_DIR','HEARTBEAT_INTERVAL_SECONDS','PASSWORD_PROXY_HOSTS','WEB_TRUSTED_PROXY_CIDRS','AUDIT_RETENTION_DAYS','AUDIT_CLEANUP_BATCH_SIZE','AUDIT_CLEANUP_MAX_BATCHES','AUDIT_CLEANUP_INTERVAL_SECONDS','RUNTIME_LOG_MAX_BYTES','RUNTIME_LOG_MAX_FILES','COMPONENT_EXAMPLES_ENABLED','TEMPLUX_BACKUP_DIR','TEMPLUX_BACKUP_RETAIN'];
const secret=new Set(['DATABASE_URL','TEMPLUX_DB_PASSWORD','FEISHU_APP_SECRET']);
export const environmentContract=Object.freeze(Object.fromEntries(Object.entries({required,database,localDatabase,domain,feishu,optional}).flatMap(([policy,keys])=>keys.map(key=>[key,Object.freeze({policy,visibility:secret.has(key)?'secret':'public'})]))));
const nonblank=v=>typeof v==='string'&&v.trim()!=='';
export function parseEnvironmentFile(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>65536||text.includes('\0'))throw new Error('dotenv syntax');
 const values={};const lines=text.replace(/\r\n/g,'\n').split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line||line.startsWith('#'))continue;
  const match=/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);if(!match)throw new Error('dotenv syntax');
  const [,key,value]=match;if(Object.hasOwn(values,key))throw new Error('dotenv duplicate');
  let chunk=line;const quote=value[0];
  if(quote==='"'||quote==="'"){
   let body=value.slice(1),end=-1;
   for(;;){for(let j=0;j<body.length;j++){if(body[j]===quote&&(quote==="'"||body[j-1]!=='\\')){end=j;break;}}
    if(end>=0)break;if(++i>=lines.length)throw new Error('dotenv syntax');body+='\n'+lines[i];chunk+='\n'+lines[i];}
   if(!/^\s*(?:#.*)?$/.test(body.slice(end+1)))throw new Error('dotenv syntax');
  }
  const parsed=parseEnv(chunk);if(!Object.hasOwn(parsed,key))throw new Error('dotenv syntax');values[key]=parsed[key];
 }
 return values;
}
export function checkEnvironment({exampleText,fileText,env=process.env,scope='all'}){
 const errors=[],warnings=[],rows=[];const fail=(key,code)=>errors.push({key,code});let file={};
 if(!['all','api','web','entry','management','migration','probe'].includes(scope))fail('TEMPLUX_ENV_SCOPE','scope');
 try{
  const example=parseEnvironmentFile(exampleText),marks={};
  for(const m of exampleText.matchAll(/^# @env ([A-Z][A-Z0-9_]*) (\w+) (secret|public)\s*$/gm)){
   if(marks[m[1]])throw new Error();marks[m[1]]={policy:m[2],visibility:m[3]};
  }
  if(JSON.stringify(Object.keys(example).sort())!==JSON.stringify(Object.keys(environmentContract).sort()))throw new Error();
  for(const [key,rule]of Object.entries(environmentContract))if(JSON.stringify(marks[key])!==JSON.stringify(rule))throw new Error();
 }catch{fail('.env.example','example_drift');}
 if(fileText!==undefined)try{file=parseEnvironmentFile(fileText);}catch{fail('.env','syntax_or_duplicate');}
 for(const key of Object.keys(file))if(!Object.hasOwn(environmentContract,key))warnings.push({key,code:'unknown_file_key'});
 const access=env.TEMPLUX_ACCESS_MODE??'local';const isDomain=access==='traefik';
 const authScope=['all','api','probe'].includes(scope);const serving=['all','api','web','entry','probe'].includes(scope);
 const hasFeishu=authScope&&(nonblank(env.FEISHU_APP_ID)||nonblank(env.FEISHU_APP_SECRET));
 let ownDatabase=false;
 if(nonblank(env.DATABASE_URL)){try{const url=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error();ownDatabase=url.hostname==='database';}catch{fail('DATABASE_URL','database_url');}}
 for(const [key,rule]of Object.entries(environmentContract)){
  const value=env[key],state=value===undefined?'missing':value===''?'empty':nonblank(value)?'set':'blank';
  let needed=rule.policy==='required'&&(key!=='APP_PUBLIC_URL'||serving);
  if(rule.policy==='database')needed=!['web','probe'].includes(scope);
  if(rule.policy==='localDatabase')needed=scope==='all'&&ownDatabase;
  if(rule.policy==='domain')needed=isDomain&&serving;
  if(rule.policy==='feishu')needed=hasFeishu;
  rows.push({key,policy:rule.policy,required:needed,visibility:rule.visibility,state,source:value===undefined?'missing':Object.hasOwn(file,key)&&file[key]===value?'container (.env match)':'container (effective override or Compose projection)'});
  if(needed&&state!=='set')fail(key,'required_nonblank');
 }
 if(nonblank(env.TEMPLUX_PROJECT_NAME)&&!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(env.TEMPLUX_PROJECT_NAME))fail('TEMPLUX_PROJECT_NAME','project_identifier');
 if(nonblank(env.DEPLOYMENT_ENV)&&!['DEV','UAT','PROD'].includes(env.DEPLOYMENT_ENV))fail('DEPLOYMENT_ENV','deployment');
 if(!['local','traefik'].includes(access))fail('TEMPLUX_ACCESS_MODE','access_mode');
 let origin;try{if(nonblank(env.APP_PUBLIC_URL)){const u=new URL(env.APP_PUBLIC_URL);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/'||(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error();origin=u.origin;}}catch{fail('APP_PUBLIC_URL','public_origin');}
 if(isDomain&&serving){
  if(env.TEMPLUX_TRAEFIK!=='1')fail('TEMPLUX_ACCESS_MODE','traefik_overlay_required');
  if(typeof env.APP_HOST!=='string'||env.APP_HOST.length>253||!env.APP_HOST.includes('.')||!env.APP_HOST.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))fail('APP_HOST','hostname');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(env.NETWORK_NAME??''))fail('NETWORK_NAME','network_identifier');
  if(nonblank(env.DOMAIN_NAME)&&env.APP_HOST!==env.DOMAIN_NAME&&!env.APP_HOST?.endsWith('.'+env.DOMAIN_NAME))fail('DOMAIN_NAME','host_outside_root');
  if(origin!==`https://${env.APP_HOST}`)fail('APP_PUBLIC_URL','domain_origin');
  try{trustedProxyPolicy(env.ENTRY_TRUSTED_PROXY_CIDRS);}catch{fail('ENTRY_TRUSTED_PROXY_CIDRS','proxy_policy');}
 }
 if(hasFeishu){
  if(!nonblank(env.FEISHU_TENANT_KEY)&&!nonblank(env.FEISHU_ALLOWED_TENANT_KEY))fail('FEISHU_TENANT_KEY','tenant_required');
  if(nonblank(env.FEISHU_TENANT_KEY)&&nonblank(env.FEISHU_ALLOWED_TENANT_KEY)&&env.FEISHU_TENANT_KEY!==env.FEISHU_ALLOWED_TENANT_KEY)fail('FEISHU_ALLOWED_TENANT_KEY','tenant_conflict');
  if(env.FEISHU_REDIRECT_URI!==`${origin}/api/auth/feishu/callback`)fail('FEISHU_REDIRECT_URI','callback_origin');
 }
 return {ok:errors.length===0,scope,rows,errors,warnings};
}
