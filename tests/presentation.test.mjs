import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function installation(t) {
  const directory = mkdtempSync(join(tmpdir(), 'templux-presentation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'presentation.json');
  const run = (...args) => spawnSync(process.execPath, ['apps/api/dist/manage.js', ...args, '--non-interactive', '--json'], {
    encoding: 'utf8', timeout: 3000, env: { ...process.env, TEMPLUX_CONFIG_PATH: path },
  });
  return { path, run };
}

test('initialization creates a project without any running web service', t => {
  const { path, run } = installation(t);
  const result = run('init', '--name', '独立新项目', '--theme', 'dark-brown', '--confirm');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(config.project.name, '独立新项目');
  assert.equal(config.brand.wordmark, '独立新项目');
  assert.equal(config.theme.colorScheme, 'dark');
  assert.equal(config.time.timeZone, 'Asia/Hong_Kong');
});

test('missing name or confirmation does not create a config', t => {
  const { run } = installation(t);
  for (const args of [['init', '--confirm'], ['init', '--name', '新项目']]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
});

test('overwriting requires explicit permission and preserves unspecified project customizations', t => {
  const { path, run } = installation(t);
  assert.equal(run('init', '--name', '甲', '--confirm').status, 0);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.copy.heading = '保留项目文案';
  config.footer.copyright = '项目版权';
  config.brand.wordmark = '自定义品牌';
  writeFileSync(path, JSON.stringify(config));
  const before = readFileSync(path, 'utf8');
  assert.equal(run('init', '--name', '乙', '--confirm').status, 1);
  assert.equal(readFileSync(path, 'utf8'), before);
  assert.equal(run('init', '--name', '乙', '--overwrite', '--confirm').status, 0);
  const after = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(after.project.name, '乙');
  assert.equal(after.copy.heading, '保留项目文案');
  assert.equal(after.footer.copyright, '项目版权');
  assert.equal(after.brand.wordmark, '自定义品牌');
});

test('invalid imported configuration fails without modifying the existing file or leaking values', t => {
  const { path, run } = installation(t);
  assert.equal(run('init', '--name', '甲', '--confirm').status, 0);
  const before = readFileSync(path, 'utf8');
  const source = `${path}.source`;
  const config = JSON.parse(before);
  config.DATABASE_URL = 'private-secret-marker';
  writeFileSync(source, JSON.stringify(config));
  const result = run('init', '--name', '乙', '--config', source, '--overwrite', '--confirm');
  assert.equal(result.status, 1);
  assert.equal(readFileSync(path, 'utf8'), before);
  assert.doesNotMatch(result.stdout + result.stderr, /private-secret-marker/);
});

test('configuration checks reject invalid colors, zones, layout and element defaults', t => {
  const { path, run } = installation(t);
  assert.equal(run('init', '--name', '甲', '--confirm').status, 0);
  const base = JSON.parse(readFileSync(path, 'utf8'));
  for (const change of [
    c => { c.theme.accent = 'red;display:none'; },
    c => { c.time.timeZone = 'Invalid/TimeZone'; },
    c => { c.time.showSeconds = 'false'; },
    c => { c.language = 'invalid_locale'; },
    c => { c.navigation.orientation = 'diagonal'; },
    c => { c.elements.pagination.pageSize = 11; },
    c => { c.elements.pagination.pageSizes = [10, 10]; },
    c => { c.elements.notifications.durationMs = -1; },
    c => { c.brand.logo = '//external.example/logo.svg'; },
    c => { c.schemaVersion = 2; },
  ]) {
    const config = structuredClone(base);
    change(config);
    writeFileSync(path, JSON.stringify(config));
    const result = run('config-check');
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
});

test('malformed and missing configuration have explicit machine-readable failures', t => {
  const { path, run } = installation(t);
  assert.equal(run('config-check').status, 1);
  writeFileSync(path, '{invalid');
  assert.equal(run('config-check').status, 1);
});

test('overwriting preserves the existing configuration owner and file permissions', t => {
  const { path, run } = installation(t);
  assert.equal(run('init', '--name', '甲', '--confirm').status, 0);
  chmodSync(path, 0o660);
  const before = statSync(path);
  assert.equal(run('init', '--name', '乙', '--overwrite', '--confirm').status, 0);
  const after = statSync(path);
  assert.equal(after.mode & 0o777, 0o660);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
});

test('management time applies the project zone and precision without mutating the stored instant', async () => {
  const { defaultPresentation, formatManagementTime } = await import('../shared/presentation.mjs');
  const config = defaultPresentation();
  config.language = 'en-GB';
  const instant = '2024-01-01T00:00:01.234Z';
  assert.equal(formatManagementTime(instant, config), '01/01/2024, 08:00:01');
  config.time.timeZone = 'UTC';
  config.time.showSeconds = false;
  assert.equal(formatManagementTime(instant, config), '01/01/2024, 00:00');
});
