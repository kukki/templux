import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { existsSync, writeFileSync, renameSync, unlinkSync, linkSync, statSync, chownSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { configPath, defaultPresentation, loadPresentation, themePreset, validatePresentation, PresentationError } from '../../../shared/presentation.mjs';

export async function initialize(options: Map<string, string>, flags: Set<string>, interactive: boolean): Promise<Record<string, unknown>> {
  const path = configPath();
  const exists = existsSync(path);
  const prompt = interactive ? createInterface({ input: stdin, output: stderr }) : undefined;
  try {
    if (prompt) {
      for (const [key, label] of [['--name', '项目名称（必填）'], ['--brand', '品牌文字（已有配置留空保留，新文件留空使用项目名称）'], ['--theme', '配色 light-blue / dark-black / dark-brown / dark-yellow（留空保留）']] as const) {
        if (!options.has(key)) {
          const answer = (await prompt.question(`${label}：`)).trim();
          if (answer) options.set(key, answer);
        }
      }
    }
    const name = options.get('--name');
    if (!name?.trim()) throw new PresentationError('init 缺少必填 --name。');
    // A supplied complete config replaces the input, but individual arguments override only their fields.
    const source = options.get('--config');
    const config = source ? loadPresentation(source) : exists ? loadPresentation(path) : defaultPresentation();
    config.project.name = name;
    if (options.has('--brand')) config.brand.wordmark = options.get('--brand')!;
    else if (!exists && !source) config.brand.wordmark = name;
    if (options.has('--theme')) config.theme = themePreset(options.get('--theme')!);
    if (options.has('--version')) config.project.version = options.get('--version')!;
    if (options.has('--copyright')) config.footer.copyright = options.get('--copyright')!;
    const candidate = validatePresentation(config);
    if (prompt && !flags.has('--confirm')) {
      stderr.write(`目标配置：${path}\n项目：${candidate.project.name}\n${exists ? '覆盖已有配置；未指定字段保留（提供 --config 时采用完整导入值）。' : '创建配置。'}\n`);
      if ((await prompt.question('输入 yes 确认写入：')).trim() !== 'yes') throw new PresentationError('已取消初始化。');
      flags.add('--confirm');
      if (exists) flags.add('--overwrite');
    }
    if (!flags.has('--confirm')) throw new PresentationError('init 需要显式 --confirm。');
    if (exists && !flags.has('--overwrite')) throw new PresentationError('已有配置，需显式 --overwrite 和 --confirm；未指定字段将保留。');
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const owner = exists ? statSync(path) : undefined;
      writeFileSync(temporary, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx', mode: owner ? owner.mode & 0o777 : 0o644 });
      if (owner) chmodSync(temporary, owner.mode & 0o777);
      if (process.getuid?.() === 0) chownSync(temporary,
        owner?.uid ?? Number(process.env.TEMPLUX_HOST_UID ?? 0),
        owner?.gid ?? Number(process.env.TEMPLUX_HOST_GID ?? 0));
      if (exists) renameSync(temporary, path);
      else { linkSync(temporary, path); unlinkSync(temporary); }
    } catch {
      throw new PresentationError('配置写入失败，原配置未被替换；请检查目录权限及是否已有文件。');
    } finally {
      try { unlinkSync(temporary); } catch { /* No temporary artifact after success. */ }
    }
    return { ok: true, command: 'init', name: candidate.project.name, config: path, restartRequired: true };
  } finally { prompt?.close(); }
}
