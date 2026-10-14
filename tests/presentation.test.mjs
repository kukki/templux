import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, chmodSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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

async function tty(path, args, answers = []) {
  return new Promise(resolve => {
    const child = spawn('script', ['-q', '-e', '-c', `node apps/api/dist/manage.js ${args}`, '/dev/null'], {
      env: { ...process.env, TEMPLUX_CONFIG_PATH: path }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    let answerIndex = 0;
    child.stdout.on('data', chunk => {
      output += chunk;
      const step = answers[answerIndex];
      if (step && output.includes(step[0])) { answerIndex++; child.stdin.write(`${step[1]}\n`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 3000);
    child.on('error', error => { clearTimeout(timeout); resolve({ error, output }); });
    child.on('close', status => { clearTimeout(timeout); resolve({ status, timedOut, output }); });
    // With no supplied answers, keep stdin open to detect unwanted prompts.
  });
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
  const result = spawnSync('sh', ['-c', 'umask 077; exec node apps/api/dist/manage.js init --name ExistingMask --overwrite --confirm --non-interactive --json'], {
    encoding: 'utf8', timeout: 3000, env: { ...process.env, TEMPLUX_CONFIG_PATH: path },
  });
  assert.equal(result.status, 0, result.stderr);
  const after = statSync(path);
  assert.equal(after.mode & 0o777, 0o660);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
});

test('a complete init in a real TTY finishes without optional input and protects existing files', async t => {
  const { path } = installation(t);
  const first = await tty(path, 'init --name TtyComplete --confirm');
  assert.equal(first.timedOut, false, first.output);
  assert.equal(first.status, 0, first.output);
  assert.equal(JSON.parse(readFileSync(path)).brand.wordmark, 'TtyComplete');
  const before = readFileSync(path, 'utf8');
  const denied = await tty(path, 'init --name TtyReplacement --confirm');
  assert.equal(denied.timedOut, false, denied.output);
  assert.equal(denied.status, 1, denied.output);
  assert.equal(readFileSync(path, 'utf8'), before);
  const updated = await tty(path, 'init --name TtyReplacement --overwrite --confirm');
  assert.equal(updated.timedOut, false, updated.output);
  assert.equal(updated.status, 0, updated.output);
  const config = JSON.parse(readFileSync(path));
  assert.equal(config.project.name, 'TtyReplacement');
  assert.equal(config.brand.wordmark, 'TtyComplete');
});

test('menu and explicit interactive init still collect optional fields and confirmation', async t => {
  for (const args of ['', 'init --interactive']) {
    const { path } = installation(t);
    const answers = [
      ...(args ? [] : [['请选择', '7']]),
      ['项目名称', 'InteractiveProject'], ['品牌文字', 'InteractiveBrand'],
      ['配色', 'dark-yellow'], ['输入 yes', 'yes'],
    ];
    const result = await tty(path, args, answers);
    assert.equal(result.timedOut, false, result.output);
    assert.equal(result.status, 0, result.output);
    const config = JSON.parse(readFileSync(path));
    assert.equal(config.project.name, 'InteractiveProject');
    assert.equal(config.brand.wordmark, 'InteractiveBrand');
    assert.equal(config.theme.colorScheme, 'dark');
  }
});

test('new configuration under umask 077 is readable by a different service UID', t => {
  const { path } = installation(t);
  chmodSync(dirname(path), 0o755);
  const env = { ...process.env, TEMPLUX_CONFIG_PATH: path, TEMPLUX_HOST_UID: '1001', TEMPLUX_HOST_GID: '1001' };
  const result = spawnSync('sh', ['-c', 'umask 077; exec node apps/api/dist/manage.js init --name RestrictedMask --confirm --non-interactive --json'], {
    encoding: 'utf8', timeout: 3000, env,
  });
  assert.equal(result.status, 0, result.stderr);
  const read = spawnSync('setpriv', ['--reuid=1000', '--regid=1000', '--clear-groups', process.execPath,
    '--input-type=module', '-e', 'import {loadPresentation} from "./shared/presentation.mjs"; console.log(loadPresentation().project.name);'], {
    encoding: 'utf8', timeout: 3000, env,
  });
  assert.equal(read.status, 0, read.stderr);
  assert.equal(read.stdout.trim(), 'RestrictedMask');
  const file = statSync(path);
  assert.equal(file.mode & 0o777, 0o644);
  assert.equal(file.uid, 1001);
  assert.equal(file.gid, 1001);
  assert.deepEqual(readdirSync(dirname(path)), ['presentation.json']);
});

test('a metadata failure before publication leaves no new config or temporary artifact', t => {
  const { path } = installation(t);
  const result = spawnSync(process.execPath, ['apps/api/dist/manage.js', 'init', '--name', 'FailedOwner', '--confirm', '--non-interactive', '--json'], {
    encoding: 'utf8', timeout: 3000,
    env: { ...process.env, TEMPLUX_CONFIG_PATH: path, TEMPLUX_HOST_UID: 'invalid-uid', TEMPLUX_HOST_GID: '1001' },
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).ok, false);
  assert.deepEqual(readdirSync(dirname(path)), []);
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
