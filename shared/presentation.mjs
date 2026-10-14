import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import defaults from './default-presentation.json' with { type: 'json' };

export class PresentationError extends Error {}
export const themeNames = ['light-blue', 'dark-black', 'dark-brown', 'dark-yellow'];
const palettes = {
  'light-blue': defaults.theme,
  'dark-black': { colorScheme: 'dark', background: '#101418', surface: '#1b2229', text: '#edf2f7', muted: '#afbdcb', border: '#394652', accent: '#8bbaff', accentText: '#101418', success: '#80d3a6', danger: '#ffad95' },
  'dark-brown': { colorScheme: 'dark', background: '#211913', surface: '#30251d', text: '#f7eee3', muted: '#cbb8a2', border: '#5b4738', accent: '#e5b482', accentText: '#211913', success: '#a9d6a0', danger: '#ffb39b' },
  'dark-yellow': { colorScheme: 'dark', background: '#201d10', surface: '#302c18', text: '#f7f2d8', muted: '#c8c098', border: '#585033', accent: '#f2d56b', accentText: '#201d10', success: '#aed69a', danger: '#ffb39b' },
};
export function defaultPresentation() { return structuredClone(defaults); }
export function themePreset(name) {
  if (!themeNames.includes(name)) throw new PresentationError('无效主题；支持 light-blue、dark-black、dark-brown、dark-yellow。');
  return structuredClone(palettes[name]);
}

export function validatePresentation(value) {
  function shape(actual, expected, path) {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || actual.length === 0 || actual.length > 20 || actual.some(v => !Number.isInteger(v) || v < 1 || v > 1000)) {
        throw new PresentationError(`配置字段 ${path} 必须是有效的正整数数组。`);
      }
    } else if (expected && typeof expected === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new PresentationError(`配置字段 ${path} 必须是对象。`);
      if (Object.keys(actual).some(key => !Object.hasOwn(expected, key))) throw new PresentationError('呈现配置含未知字段；环境变量与密钥必须放在 .env。');
      for (const [key, child] of Object.entries(expected)) shape(actual[key], child, `${path}.${key}`);
    } else if (typeof actual !== typeof expected || (typeof actual === 'string' && (actual.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(actual)))) {
      throw new PresentationError(`配置字段 ${path} 类型或长度无效。`);
    }
  }
  shape(value, defaults, 'presentation');
  if (value.schemaVersion !== 1) throw new PresentationError('不支持的呈现配置版本。');
  for (const [key, color] of Object.entries(value.theme)) {
    if (key !== 'colorScheme' && !/^#[\da-f]{6}$/i.test(color)) throw new PresentationError(`配置字段 theme.${key} 必须是六位十六进制颜色。`);
  }
  if (!['light', 'dark'].includes(value.theme.colorScheme)) throw new PresentationError('无效 colorScheme。');
  if (!['vertical', 'horizontal'].includes(value.navigation.orientation)) throw new PresentationError('无效导航方向。');
  if (!value.project.name.trim() || !value.project.version.trim() || !value.brand.wordmark.trim()) throw new PresentationError('项目名称、版本和品牌文字不能为空。');
  if (value.brand.logo && (!/^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value.brand.logo) || value.brand.logo.split('/').includes('..'))) {
    throw new PresentationError('Logo 必须是本项目 public 目录中的绝对 URL 路径。');
  }
  try { Intl.getCanonicalLocales(value.language); } catch { throw new PresentationError('无效语言标记。'); }
  if (!value.language.trim()) throw new PresentationError('语言标记不能为空。');
  try { new Intl.DateTimeFormat(value.language, { timeZone: value.time.timeZone }); } catch { throw new PresentationError('无效显示时区。'); }
  const { pageSize, pageSizes } = value.elements.pagination;
  if (!Number.isInteger(pageSize) || !pageSizes.includes(pageSize) || new Set(pageSizes).size !== pageSizes.length) throw new PresentationError('分页默认值须属于不重复的数量集合。');
  for (const n of Object.values(value.elements.notifications)) {
    if (!Number.isInteger(n) || n <= 0 || n > 3600000) throw new PresentationError('通知默认值须为有上限的正整数。');
  }
  return structuredClone(value);
}
export function configPath() { return process.env.TEMPLUX_CONFIG_PATH ?? resolve('config/presentation.json'); }
export function loadPresentation(path = configPath()) {
  let value;
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new PresentationError('无法读取呈现配置，请检查文件存在、权限及 JSON 格式。'); }
  return validatePresentation(value);
}
let runtimePresentation;
export function presentation() { return runtimePresentation ??= loadPresentation(); }
export function formatManagementTime(instant, config) {
  return new Intl.DateTimeFormat(config.language, {
    timeZone: config.time.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', ...(config.time.showSeconds ? { second: '2-digit' } : {}), hourCycle: 'h23',
  }).format(new Date(instant));
}
