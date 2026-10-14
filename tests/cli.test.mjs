import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function command(args) {
  return spawnSync(process.execPath, ['apps/api/dist/manage.js', ...args], {
    encoding: 'utf8', timeout: 3000,
  });
}

test('non-interactive missing commands fail promptly with machine-readable output', () => {
  const result = command(['--json', '--non-interactive']);
  assert.equal(result.status, 1);
  assert.equal(result.error, undefined);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false, error: '缺少管理命令：start、status、stop、logs、typecheck、test、init、config-check、users、authorize、create-person、create-agent 或 reset-agent。',
  });
  assert.equal(JSON.parse(result.stderr).event, 'management_failed');
});

test('unknown options fail rather than being ignored by automation', () => {
  const result = command(['status', '--json', '--unexpected']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).ok, false);
});

test('non-interactive stop requires an explicit confirmation before touching containers', () => {
  const result = command(['stop', '--non-interactive', '--json']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error, 'stop 需要显式 --confirm。');
});

test('status returns only one JSON result and reports the running application', () => {
  const result = command(['status', '--json']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.service.status, 'ready');
  assert.equal(result.stderr, '');
});
