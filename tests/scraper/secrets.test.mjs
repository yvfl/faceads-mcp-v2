import test from 'node:test';
import assert from 'node:assert/strict';
import {redactCredentialExamples} from '../../scripts/lib/docs-http.js';

test('documentation examples cannot republish tokens or private-key blocks', () => {
  const token = 'EAA' + 'x'.repeat(80);
  const key = ['-----BEGIN ' + 'PRIVATE KEY-----','example-body','-----END ' + 'PRIVATE KEY-----'].join('\\n');
  const source = JSON.stringify({accessToken: token, private_key: key, apiVersion:'v26.0'});
  const output = redactCredentialExamples(source);
  assert.ok(!output.includes(token)); assert.ok(!output.includes('example-body'));
  assert.equal(JSON.parse(output).accessToken, '<YOUR_META_ACCESS_TOKEN>');
  assert.equal(JSON.parse(output).private_key, '<YOUR_PRIVATE_KEY>');
  assert.equal(JSON.parse(output).apiVersion, 'v26.0');
});
