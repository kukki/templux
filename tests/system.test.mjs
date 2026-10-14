import assert from 'node:assert/strict';
import test from 'node:test';

const api = process.env.TEST_API_URL ?? 'http://api:8080';
const web = process.env.TEST_WEB_URL ?? 'http://web:3000';

test('a running installation reports readiness from the real database', async () => {
  const response = await fetch(`${api}/api/status`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    name: 'Templux',
    version: '0.1.0',
    status: 'ready',
    database: 'connected',
    schemaVersion: '0001',
  });
});

test('the installation page renders live service readiness without exposing configuration', async () => {
  const response = await fetch(web);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /运行正常/);
  assert.match(html, /0001/);
  assert.doesNotMatch(html, /postgresql:\/\/|DATABASE_URL|templux-local-only/);
});
