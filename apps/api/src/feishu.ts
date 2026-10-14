import { AuthError, type AuthConfig } from './auth-config.js';
export type Identity = { appId: string; tenantKey: string; subject: string; name: string };
export const authorizeEndpoint = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
export const tokenEndpoint = 'https://accounts.feishu.cn/oauth/v3/token';
export const userInfoEndpoint = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
export type Transport = typeof fetch;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthError('provider_invalid', 502);
  return value as Record<string, unknown>;
}
function text(value: unknown, limit = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f]/u.test(value)) throw new AuthError('provider_invalid', 502);
  return value;
}
export async function exchangeIdentity(config: AuthConfig, code: string, transport: Transport = fetch): Promise<Identity> {
  try {
    const response = await transport(tokenEndpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.appId, client_secret: config.appSecret,
        code, redirect_uri: config.redirectUri }).toString() });
    const token = record(await response.json());
    if (!response.ok || (token.code !== undefined && token.code !== 0) || token.error !== undefined) {
      const safeErrors = ['invalid_client', 'invalid_grant', 'invalid_request', 'unsupported_grant_type', 'invalid_scope', 'server_error'];
      const providerCode = typeof token.code === 'number' ? token.code : typeof token.error === 'string' && safeErrors.includes(token.error) ? token.error : undefined;
      throw new AuthError('provider_rejected', 502, { stage: 'token', httpStatus: response.status, ...(providerCode !== undefined ? { providerCode } : {}) });
    }
    const accessToken = text(token.access_token, 8192);
    if (token.token_type !== 'Bearer' || typeof token.expires_in !== 'number' || token.expires_in <= 0) throw new AuthError('provider_invalid', 502);
    const infoResponse = await transport(userInfoEndpoint, { redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=utf-8' } });
    const info = record(await infoResponse.json());
    if (!infoResponse.ok || info.code !== 0) throw new AuthError('provider_rejected', 502,
      { stage: 'user_info', httpStatus: infoResponse.status, ...(typeof info.code === 'number' ? { providerCode: info.code } : {}) });
    const data = record(info.data);
    const tenantKey = text(data.tenant_key);
    if (tenantKey !== config.tenantKey) throw new AuthError('organization_denied', 403);
    return { appId: config.appId, tenantKey, subject: text(data.open_id), name: text(data.name) };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('provider_unavailable', 502);
  }
}
