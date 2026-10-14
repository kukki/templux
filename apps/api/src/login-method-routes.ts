import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';import type pg from 'pg';
import type {AuthConfig,Roles} from './auth-config.js';import {AuthError} from './auth-config.js';
import {ManagementError} from './authorization.js';
import {createLoginRequest,listLoginRequests,verifyPasswordEnable,beginFeishuLink,completeLoginRequest,resetPersonPassword,managementId} from './login-methods.js';
import {authorizeEndpoint} from './feishu.js';
export function registerLoginMethodRoutes(server:FastifyInstance,pool:pg.Pool,config:AuthConfig|null,roles:Roles,origin:string,sessionToken:(request:FastifyRequest)=>string|undefined){
 const actor=(request:FastifyRequest)=>({token:sessionToken(request),config});
 function body(request:FastifyRequest,keys:string[]){if(request.headers.origin!==origin)throw new AuthError('origin_denied',403);const value=request.body;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new ManagementError('invalid_management_input',400,'参数无效。');return value as Record<string,unknown>;}
 const version=(value:unknown)=>{if(typeof value!=='string')throw new ManagementError('invalid_management_input',400,'须核对目标版本。');return managementId(value);};
 server.get('/api/admin/login-links',async request=>{const query=request.query as Record<string,unknown>;if(Object.keys(query).some(key=>key!=='account')||typeof query.account!=='string')throw new ManagementError('invalid_management_input',400,'须指定目标账号。');return {ok:true,requests:await listLoginRequests(pool,actor(request),query.account,false,roles)};});
 server.get('/api/account/login-links',async request=>({ok:true,requests:await listLoginRequests(pool,actor(request),undefined,true,roles)}));
 server.post('/api/admin/login-links',{bodyLimit:4096},async request=>{const input=body(request,['accountId','expectedVersion','method','username','confirm']);if(input.confirm!==true||typeof input.accountId!=='string'||!['password','feishu'].includes(input.method as string)||input.username!==undefined&&typeof input.username!=='string')throw new ManagementError('invalid_management_input',400,'须明确确认目标和方式。');
 return createLoginRequest(pool,{accountId:input.accountId,expectedVersion:version(input.expectedVersion),method:input.method as 'password'|'feishu',username:input.username as string|undefined},actor(request),roles,config);});
 server.post('/api/account/login-links/:id/verify',{bodyLimit:1024},async request=>{const input=body(request,['confirm']);if(input.confirm!==true)throw new ManagementError('invalid_management_input',400,'须确认验证。');return verifyPasswordEnable(pool,(request.params as {id:string}).id,sessionToken(request),config,roles);});
 server.post('/api/account/login-links/:id/feishu',{bodyLimit:1024},async(request,reply)=>{const input=body(request,['confirm']);if(input.confirm!==true)throw new ManagementError('invalid_management_input',400,'须确认验证。');const flow=await beginFeishuLink(pool,(request.params as {id:string}).id,sessionToken(request),config,roles);
 const url=new URL(authorizeEndpoint);url.search=new URLSearchParams({client_id:config!.appId,response_type:'code',redirect_uri:config!.redirectUri,state:flow.state}).toString();
 reply.header('Set-Cookie',`templux_oauth=${flow.browser}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${config!.secure?'; Secure':''}`);return {ok:true,url:url.href};});
 function sensitive(reply:FastifyReply){reply.header('Cache-Control','no-store');reply.header('Pragma','no-cache');reply.header('Expires','0');reply.header('X-Content-Type-Options','nosniff');}
 server.post('/api/admin/login-links/:id/complete',{bodyLimit:1024},async(request,reply)=>{const input=body(request,['confirm']);if(input.confirm!==true)throw new ManagementError('invalid_management_input',400,'须明确确认。');const result=await completeLoginRequest(pool,(request.params as {id:string}).id,actor(request),undefined,roles,config);sensitive(reply);return result;});
 server.post('/api/admin/accounts/:id/password-reset',{bodyLimit:1024},async(request,reply)=>{const input=body(request,['expectedVersion','confirm']);if(input.confirm!==true)throw new ManagementError('invalid_management_input',400,'须明确确认。');const result=await resetPersonPassword(pool,(request.params as {id:string}).id,version(input.expectedVersion),actor(request),undefined,roles);sensitive(reply);return result;});
}
