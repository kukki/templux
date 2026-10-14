import assert from 'node:assert/strict';
import test from 'node:test';

test('the deployed authentication entry reports availability without exposing credentials', async () => {
  const response = await fetch(`${process.env.TEST_API_URL ?? 'http://api:8080'}/api/auth/config`);
  assert.equal(response.status, 200);
  const text = await response.text();
  const config = JSON.parse(text);
  assert.equal(typeof config.enabled, 'boolean');
  assert.doesNotMatch(text, /client_secret|access_token|postgresql:\/\//);
});
