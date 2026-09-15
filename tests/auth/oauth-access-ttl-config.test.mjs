import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const variable = 'MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS';
const moduleUrl = new URL('../../dist/auth/oauth-utils.js', import.meta.url).href;
function start(value) {
  const env = { ...process.env };
  delete env[variable];
  if (value !== undefined) env[variable] = value;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_IDLE_TTL } from ${JSON.stringify(moduleUrl)};
    process.stdout.write(JSON.stringify({ access: ACCESS_TOKEN_TTL, refresh: REFRESH_TOKEN_IDLE_TTL }));
  `], { env, encoding: 'utf8', timeout: 10_000 });
}

test('OAuth startup uses one hour by default and accepts bounded accelerated access lifetimes', () => {
  for (const [value, seconds] of [[undefined, 3600], ['60', 60], ['120', 120], ['300', 300], ['3600', 3600]]) {
    const result = start(value);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { access: seconds * 1000, refresh: 90 * 24 * 60 * 60 * 1000 });
  }
});

test('OAuth startup rejects invalid lifetimes instead of silently changing expiry or echoing input', () => {
  for (const value of ['', '0', '59', '3601', '-120', '120.5', '1e2', '0x78', ' 120', '120 ', 'Infinity', 'synthetic-sensitive-invalid-value']) {
    const result = start(value);
    assert.equal(result.status, 1, `Invalid configuration must fail: ${JSON.stringify(value)}`);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes(`${variable} must be an integer between 60 and 3600.`));
    assert.ok(!result.stderr.includes('synthetic-sensitive-invalid-value'));
  }
});
