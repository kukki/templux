import assert from 'node:assert/strict';
import test from 'node:test';

test('database failure reports unavailable without pretending the installation is ready', async () => {
  const response = await fetch(process.env.TEST_API_URL + '/api/status');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { name: 'Templux', status: 'unavailable' });
  const html = await (await fetch(process.env.TEST_WEB_URL)).text();
  assert.match(html, /暂时不可用/);
  assert.doesNotMatch(html, /运行正常|postgresql:\/\/|templux-local-only/);
});
