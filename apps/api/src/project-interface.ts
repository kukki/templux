import type {FastifyInstance} from 'fastify';
import type pg from 'pg';
import {createApplication} from './application.js';
import {AuthError,readAuthConfig,readRoles,readSessionConfig} from './auth-config.js';
import {loadSession,requirePermission,transaction,authorizationLock,type Account} from './auth-store.js';
import {requestCookie} from './auth-routes.js';
import {OperationError,databasePool} from './database.js';
import {readMaintenance} from './maintenance.js';
import {maintenanceReleased} from './maintenance-release.js';
import {invalidateAccountAccess} from './session-lifecycle.js';

export type BusinessContext={account:Readonly<Account>;client:pg.PoolClient;body:unknown;query:unknown};
export type BusinessRoute={method:'GET'|'POST';path:string;permission:string;scope?:(context:BusinessContext)=>Promise<boolean>;handle:(context:BusinessContext)=>Promise<unknown>|unknown};
/** Supported extension surface. No Fastify hooks, auth transports or core route replacement. */
export async function createProjectApplication(pool:pg.Pool,options:{routes:readonly BusinessRoute[]}):Promise<Pick<FastifyInstance,'listen'|'close'>>{
 const routes=options?.routes;
 if(!Array.isArray(routes)||new Set(routes.map(r=>`${r?.method} ${r?.path}`)).size!==routes.length||routes.some(r=>!r||!['GET','POST'].includes(r.method)||!/^\/api\/business\/[a-z][a-z0-9/_-]*$/.test(r.path)||!/^([a-z][a-z0-9_-]*):([a-z][a-z0-9_-]*)$/.test(r.permission)||typeof r.handle!=='function'||(r.scope!==undefined&&typeof r.scope!=='function')||Object.keys(r).some(k=>!['method','path','permission','scope','handle'].includes(k))))throw new OperationError('业务路由必须显式声明唯一业务路径、权限及处理器。');
 const config=readAuthConfig(),roles=readRoles(),session=readSessionConfig();
 const known=new Set(Object.values(roles).flatMap(role=>role.permissions));
 if(routes.some(route=>!known.has(route.permission)))throw new OperationError('业务路由权限未在项目预定义角色中注册。');
 const server=await createApplication(pool,config);
 for(const route of routes)server.route({method:route.method,url:route.path,handler:async request=>{
  if(route.method==='POST'&&request.headers.origin!==session.publicOrigin)throw new AuthError('invalid_request',403);
  return transaction(pool,async client=>{
   await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('templux:authorization'))");
   const account=await loadSession(client,requestCookie(request,'templux_session'),config,roles,true);
   requirePermission(account,'application:read');requirePermission(account,route.permission);
   if(route.method==='POST'){
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('templux:business-writes'))");
    if(!maintenanceReleased(await readMaintenance(client)))throw new AuthError('maintenance_unavailable',503);
   }
   const context={account,client,body:request.body,query:request.query};
   if(route.scope&&!await route.scope(context))throw new AuthError('permission_denied',403);
   return route.handle(context);
  });
 }});
 return {listen:server.listen.bind(server),close:server.close.bind(server)};
}
/** Project service must authorize the caller before invoking its own scope mutation. */
export async function changeProjectAccess(pool:pg.Pool,accountId:string,context:{source:'cli'|'password'|'feishu';actor:string},change:(client:pg.PoolClient)=>Promise<void>){
 return transaction(pool,async client=>{await authorizationLock(client);await change(client);await invalidateAccountAccess(client,accountId,context);});
}
export {databasePool};
