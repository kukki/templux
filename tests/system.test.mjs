import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(process.env.TEMPLUX_CONFIG_PATH ?? 'config/presentation.json', 'utf8'));

const api = process.env.TEST_API_URL ?? 'http://api:8080';
const web = process.env.TEST_WEB_URL ?? 'http://web:3000';

test('a running installation reports readiness from the real database', async () => {
  const response = await fetch(`${api}/api/status`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    name: config.project.name,
    version: config.project.version,
    status: 'ready',
    database: 'connected',
    schemaVersion: '0004',
  });
});

test('the installation page renders live service readiness without exposing configuration', async () => {
  const response = await fetch(web);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes(config.copy.ready));
  assert.match(html, /0004/);
  assert.doesNotMatch(html, /postgresql:\/\/|DATABASE_URL|templux-local-only/);
});
