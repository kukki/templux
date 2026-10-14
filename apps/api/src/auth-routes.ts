import {queryAudit} from './audit-query.js';
import {bestEffortAudit} from './audit-store.js';
import {registerLoginMethodRoutes} from './login-method-routes.js';
import {verifyFeishuLink} from './login-methods.js';
import { passwordSource } from './password-source.js';
import { PasswordLimited, cleanupPasswordFailures } from './password-limits.js';
import { registerAccountManagement } from './account-management.js';
import { ManagementError } from './authorization.js';
import { revokeSessions } from './session-lifecycle.js';
import { passwordLogin } from './password-accounts.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { AuthError, readAuthConfig, readSessionConfig, readRoles, type AuthConfig } from './auth-config.js';
import { authorizeEndpoint, exchangeIdentity, type Transport } from './feishu.js';
import { beginOAuth, consumeOAuth, readSession, registerSession, requirePermission } from './auth-store.js';
export function requestCookie(request: FastifyRequest, name: string): string | undefined {
  const values = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;
  return values[0]!.slice(name.length + 1);
}
function cookie(name: string, value: string, seconds: number, secure: boolean): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
}
export function registerAuthRoutes(server: FastifyInstance, pool: pg.Pool, config: AuthConfig | null = readAuthConfig(), transport: Transport = fetch) {
  const sourceIp=passwordSource();
  const roles = readRoles(); const sessionSettings = { ...readSessionConfig(), ...(config ? {publicOrigin:config.publicOrigin,secure:config.secure} : {}) };
  function configured(): AuthConfig { if (!config) throw new AuthError('authentication_unconfigured', 503); return config; }
  const cleanup=setInterval(()=>{void cleanupPasswordFailures(pool).catch(()=>server.log.error({event:'password_failure_cleanup_failed'},'密码失败记录清理未完成。'));},60000);cleanup.unref();
  server.addHook('onClose',async()=>clearInterval(cleanup));
  server.setErrorHandler(async (error, _request, reply) => {
    if(error instanceof PasswordLimited)reply.header('Retry-After',String(error.retryAfterSeconds));
    if (error instanceof ManagementError) {
      if (error.status >= 500) server.log.error({event:error.reason,result:'failed'},'管理变更未提交。');else server.log.warn({event:'management_request_rejected',result:'denied'},'管理请求被拒绝。');
      return void reply.code(error.status).send({ok:false,error:error.reason});
    }
    const reason = error instanceof AuthError ? error.reason : 'service_unavailable';
    const requestPath=_request.url.split('?')[0]??'';if(['/api/auth/password','/api/auth/feishu/start'].includes(requestPath))await bestEffortAudit(pool,requestPath==='/api/auth/password'?'password':'feishu','anonymous','authentication_rejected',null,{reason},error instanceof AuthError&&error.status<500?'denied':'failed',()=>server.log.error({event:'authentication_audit_failed'},'认证拒绝审计未保存。'));
    if (!(error instanceof AuthError)) server.log.error({ event: 'authentication_request_failed' }, '认证或服务操作失败。');
    void reply.code(error instanceof AuthError ? error.status : 503).send({ ok: false, error: reason });
  });
  server.addHook('onSend', async (_request, reply, payload) => { reply.header('Cache-Control', 'no-store'); reply.header('Referrer-Policy', 'no-referrer'); return payload; });
  registerAccountManagement(server,pool,config,roles,request=>requestCookie(request,'templux_session'));
  registerLoginMethodRoutes(server,pool,config,roles,sessionSettings.publicOrigin,request=>requestCookie(request,'templux_session'));
  server.get('/api/admin/audit',request=>queryAudit(pool,requestCookie(request,'templux_session'),config,roles,request.query as Record<string,unknown>));
  server.get('/api/admin/audit-access',async request=>{const account=await readSession(pool,requestCookie(request,'templux_session'),config,roles,true);requirePermission(account,'accounts:manage');requirePermission(account,'audit:read');return {ok:true,account,heartbeatSeconds:sessionSettings.heartbeatSeconds};});
  server.get('/api/auth/config', async () => ({ enabled: config !== null }));
  server.post('/api/auth/password', { bodyLimit: 4096 }, async (request, reply) => {
    if (request.headers.origin !== sessionSettings.publicOrigin) throw new AuthError('origin_denied', 403);
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['username','password'].includes(k))) throw new AuthError('invalid_credentials');
    const input = body as {username?: unknown; password?: unknown};
    const result = await passwordLogin(pool, input.username, input.password, await sourceIp(request), () => server.log.error({event:'login_audit_failed'}, '登录成功审计未保存。'));
    reply.header('Set-Cookie', cookie('templux_session', result.token, result.maximumSeconds, sessionSettings.secure));
    return {ok:true};
  });
  server.get('/api/admin/access', async request => {
    const account = await readSession(pool, requestCookie(request, 'templux_session'), config, roles, true);
    requirePermission(account, 'accounts:manage');
    return {ok:true,account,heartbeatSeconds:sessionSettings.heartbeatSeconds};
  });
  server.get('/api/auth/feishu/start', async (_request, reply) => {
    const settings = configured(); const flow = await beginOAuth(pool);
    const url = new URL(authorizeEndpoint);
    url.search = new URLSearchParams({ client_id: settings.appId, response_type: 'code', redirect_uri: settings.redirectUri,
      state: flow.state }).toString();
    reply.header('Set-Cookie', cookie('templux_oauth', flow.browser, 600, settings.secure));
    return reply.redirect(url.href);
  });
  server.get('/api/auth/feishu/callback', async (request, reply) => {
    const settings = configured();
    try {
      const query = request.query as Record<string, unknown>;
      const state = typeof query.state === 'string' ? query.state : '';
      const browser = requestCookie(request, 'templux_oauth') ?? '';
      const context=await consumeOAuth(pool, state, browser);
      reply.header('Set-Cookie', cookie('templux_oauth', '', 0, settings.secure));
      if (query.error !== undefined) throw new AuthError('login_cancelled', 400);
      if (typeof query.code !== 'string' || !query.code || query.code.length > 4096) throw new AuthError('provider_invalid', 400);
      const identity = await exchangeIdentity(settings, query.code, transport);
      if(context.purpose==='login_link'){await verifyFeishuLink(pool,state,identity,settings,roles,context.requestId);return reply.redirect('/account?link=verified');}
      const result = await registerSession(pool, identity, settings, () => server.log.error({ event: 'login_audit_failed' }, '登录成功审计未保存。'));
      reply.header('Set-Cookie', cookie('templux_session', result.token, settings.maximumSeconds, settings.secure));
      return reply.redirect('/account');
    } catch (error) {
      const reason = error instanceof AuthError || error instanceof ManagementError ? error.reason : 'service_unavailable';
      await bestEffortAudit(pool,'feishu','anonymous','authentication_rejected',null,{reason},error instanceof AuthError&&error.status<500?'denied':'failed',()=>server.log.error({event:'authentication_audit_failed'},'认证拒绝审计未保存。'));
      if (error instanceof AuthError && error.diagnosis) server.log.warn({ event: 'feishu_protocol_rejected', ...error.diagnosis }, '飞书协议请求被拒绝。');
      if (!(error instanceof AuthError)) server.log.error({ event: 'login_registration_failed' }, '登录或初始账号保存失败。');
      reply.header('Set-Cookie', cookie('templux_oauth', '', 0, settings.secure));
      return reply.redirect(`/login?reason=${encodeURIComponent(reason)}`);
    }
  });
  server.get('/api/auth/session', async request => ({ ok: true, account: await readSession(pool, requestCookie(request, 'templux_session'), config, roles), heartbeatSeconds:sessionSettings.heartbeatSeconds }));
  server.get('/api/protected', async request => {
    const account = await readSession(pool, requestCookie(request, 'templux_session'), config, roles, true);
    requirePermission(account, 'application:read');
    return { ok: true, account, heartbeatSeconds:sessionSettings.heartbeatSeconds };
  });
  server.get('/api/auth/heartbeat', async request => ({ ok:true,
    account:await readSession(pool, requestCookie(request, 'templux_session'), config, roles), heartbeatSeconds:sessionSettings.heartbeatSeconds }));
  server.post('/api/auth/activity', async request => {
    if (request.headers.origin !== sessionSettings.publicOrigin) throw new AuthError('origin_denied',403);
    return {ok:true,account:await readSession(pool,requestCookie(request,'templux_session'),config,roles,true)};
  });
  for (const [path, all] of [['/api/auth/logout', false], ['/api/auth/logout-all', true]] as const) {
    server.post(path, async (request, reply) => {
      if (request.headers.origin !== sessionSettings.publicOrigin) throw new AuthError('origin_denied',403);
      await revokeSessions(pool,requestCookie(request,'templux_session'),config,roles,all);
      reply.header('Set-Cookie',cookie('templux_session','',0,sessionSettings.secure));
      return {ok:true};
    });
  }
}
