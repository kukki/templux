import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import defaults from '../../../../config/auth-copy.json';
export type AuthCopy = typeof defaults;
let loaded: AuthCopy;
export function authCopy(): AuthCopy {
  if (loaded) return loaded;
  const directory = process.env.TEMPLUX_CONFIG_PATH ? dirname(process.env.TEMPLUX_CONFIG_PATH) : resolve('config');
  const value = JSON.parse(readFileSync(resolve(directory, 'auth-copy.json'), 'utf8'));
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !Object.hasOwn(defaults, key))
    || Object.keys(defaults).some(key => typeof value[key] !== 'string' || value[key].length > 2000)) throw new Error('认证文案配置无效。');
  return loaded = value;
}
