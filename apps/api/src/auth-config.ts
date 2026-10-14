import {passwordProxyHosts} from '../../../shared/client-ip.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OperationError } from './database.js';

export type SessionConfig = { heartbeatSeconds: number; publicOrigin: string; secure: boolean; idleSeconds: number; maximumSeconds: number; agentIdleSeconds: number; agentMaximumSeconds: number; agentEnabled: boolean };
export type AuthConfig = { appId: string; appSecret: string; tenantKey: string; redirectUri: string; publicOrigin: string; secure: boolean; idleSeconds: number; maximumSeconds: number };
export class AuthError extends Error {
  constructor(public readonly reason: string, public readonly status = 401, public readonly diagnosis?: { stage: string; httpStatus: number; providerCode?: number | string }) { super(reason); }
}
export function readSessionConfig(): SessionConfig {
  try {
    const origin = new URL(process.env.APP_PUBLIC_URL ?? 'http://localhost:31000');
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || !['http:', 'https:'].includes(origin.protocol)
      || (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) throw new Error();
    const environment = process.env.DEPLOYMENT_ENV ?? 'PROD';
    if (!['DEV', 'UAT', 'PROD'].includes(environment)) throw new Error();
    const flag = process.env.AGENT_LOGIN_ENABLED;
    if (flag !== undefined && flag !== '' && !['true', 'false'].includes(flag)) throw new Error();
    const seconds = (key: string, fallback: number) => {
      const number = Number(process.env[key] ?? fallback);
      if (!Number.isInteger(number) || number < 60 || number > 604800) throw new Error();
      return number;
    };
    const heartbeatSeconds = Number(process.env.HEARTBEAT_INTERVAL_SECONDS ?? 30);
    if (!Number.isInteger(heartbeatSeconds) || heartbeatSeconds < 1 || heartbeatSeconds > 300) throw new Error();
    return { heartbeatSeconds, publicOrigin: origin.origin, secure: origin.protocol === 'https:',
      idleSeconds: seconds('PERSON_IDLE_TIMEOUT_SECONDS', 600), maximumSeconds: seconds('PERSON_SESSION_MAX_SECONDS', 43200),
      agentIdleSeconds: seconds('AGENT_IDLE_TIMEOUT_SECONDS', 600), agentMaximumSeconds: seconds('AGENT_SESSION_MAX_SECONDS', 43200),
      agentEnabled: flag ? flag === 'true' : environment !== 'PROD' };
  } catch { throw new OperationError('公开地址、部署环境或会话配置无效。'); }
}
export type AuthRealm = Pick<AuthConfig, 'appId' | 'tenantKey'>;
export function readAuthRealm(): AuthRealm | null {
  const { FEISHU_APP_ID: appId, FEISHU_ALLOWED_TENANT_KEY: canonicalTenant, FEISHU_TENANT_KEY: existingTenant } = process.env;
  if (canonicalTenant && existingTenant && canonicalTenant !== existingTenant) throw new OperationError('FEISHU_ALLOWED_TENANT_KEY 与 FEISHU_TENANT_KEY 冲突。');
  const tenantKey = canonicalTenant || existingTenant;
  return appId?.trim() && tenantKey?.trim() ? { appId, tenantKey } : null;
}
export function readAuthConfig(): AuthConfig | null {
  const realm = readAuthRealm();
  const { FEISHU_APP_SECRET: appSecret, FEISHU_REDIRECT_URI: configuredRedirect } = process.env;
  const publicUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:31000';
  const redirectUri = configuredRedirect || `${publicUrl.replace(/\/$/, '')}/api/auth/feishu/callback`;
  if (!realm || !appSecret?.trim()) return null;
  try {
    const origin = new URL(publicUrl);
    const redirect = new URL(redirectUri!);
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || !['http:', 'https:'].includes(origin.protocol)
      || (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
      || redirect.origin !== origin.origin || redirect.pathname !== '/api/auth/feishu/callback' || redirect.search || redirect.hash || redirect.username || redirect.password) throw new Error();
    const idleSeconds = Number(process.env.PERSON_IDLE_TIMEOUT_SECONDS ?? 600);
    const maximumSeconds = Number(process.env.PERSON_SESSION_MAX_SECONDS ?? 43200);
    if (![idleSeconds, maximumSeconds].every(n => Number.isInteger(n) && n >= 60 && n <= 604800)) throw new Error();
    return { appId: realm.appId, appSecret, tenantKey: realm.tenantKey, redirectUri: redirect.href, publicOrigin: origin.origin,
      secure: origin.protocol === 'https:', idleSeconds, maximumSeconds };
  } catch { throw new OperationError('飞书回调、公开地址或会话配置无效。'); }
}
export type Roles = Record<string, { label: string; permissions: string[]; excludes?: string[] }>;
export function readRoles(): Roles {
  try {
    const value = JSON.parse(readFileSync(process.env.TEMPLUX_ROLE_CONFIG_PATH ?? resolve('config/roles.json'), 'utf8'));
    if (value.schemaVersion !== 1 || Object.keys(value).some(k => !['schemaVersion', 'roles'].includes(k)) || !value.roles || typeof value.roles !== 'object' || Array.isArray(value.roles)) throw new Error();
    for (const [key, role] of Object.entries(value.roles)) {
      const item = role as { label?: unknown; permissions?: unknown; excludes?: unknown };
      if (!/^[a-z][a-z0-9_-]{0,79}$/.test(key) || !item || Object.keys(item).some(k => !['label', 'permissions', 'excludes'].includes(k))
        || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 200 || !Array.isArray(item.permissions)
        || item.permissions.length > 100 || item.permissions.some(p => typeof p !== 'string' || !/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/.test(p))) throw new Error();
    }
    for (const [key, role] of Object.entries(value.roles) as [string, Roles[string]][]) {
      if (role.excludes !== undefined && (!Array.isArray(role.excludes) || new Set(role.excludes).size !== role.excludes.length
        || role.excludes.some(other => typeof other !== 'string' || other === key || !Object.hasOwn(value.roles, other)))) throw new Error();
    }
    if (!value.roles.admin?.permissions.includes('accounts:manage') || !value.roles.admin?.permissions.includes('application:read') || !value.roles.user) throw new Error();
    return value.roles;
  } catch { throw new OperationError('预定义角色配置无效，须保留 admin/user 及管理员必要权限。'); }
}

export type AuthenticationAvailability = { schemaVersion: 1; feishu: AuthRealm | null; agentEnabled: boolean };
export function authenticationAvailability(): AuthenticationAvailability {
  passwordProxyHosts(process.env.PASSWORD_PROXY_HOSTS??'');
  const config = readAuthConfig();
  return { schemaVersion: 1, feishu: config ? { appId: config.appId, tenantKey: config.tenantKey } : null,
    agentEnabled: readSessionConfig().agentEnabled };
}
export function availableAuthRealm(): AuthRealm | null {
  const projection = process.env.TEMPLUX_AUTH_AVAILABILITY_JSON;
  if (projection === undefined) {
    if (process.env.TEMPLUX_REQUIRE_AUTH_PROJECTION === '1') throw new OperationError('缺少部署认证可用性信息，请通过宿主 templux 入口执行授权。');
    return authenticationAvailability().feishu;
  }
  try {
    const value = JSON.parse(projection) as AuthenticationAvailability;
    const realm = readAuthRealm();
    if (!value || Object.keys(value).some(key => !['schemaVersion', 'feishu', 'agentEnabled'].includes(key))
      || value.schemaVersion !== 1 || typeof value.agentEnabled !== 'boolean' || value.agentEnabled !== readSessionConfig().agentEnabled
      || (value.feishu !== null && (!value.feishu || Object.keys(value.feishu).some(key => !['appId', 'tenantKey'].includes(key))
        || typeof value.feishu.appId !== 'string' || typeof value.feishu.tenantKey !== 'string'
        || !realm || value.feishu.appId !== realm.appId || value.feishu.tenantKey !== realm.tenantKey))) throw new Error();
    return value.feishu;
  } catch { throw new OperationError('部署认证可用性信息无效或与管理配置冲突，请重新通过宿主入口执行。'); }
}
