import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, callTool, fakeFetch, textOf, assertSuccess } from '../helpers/offline.mjs';

test('discovery uses the account ID when custom fields omit name', async (t) => {
  const calls = fakeFetch(t, () => ({
    data: [{ id: ACCOUNT, account_status: 1, currency: 'BRL' }],
  }));

  const result = await callTool('discover_ad_accounts', {
    fields: ['id', 'account_status', 'currency'],
  });

  assertSuccess(result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].path, /\/me\/adaccounts$/);
  assert.equal(calls[0].url.searchParams.get('fields'), 'id,account_status,currency');
  assert.match(textOf(result), new RegExp(`### ${ACCOUNT}\\n`));
  assert.match(textOf(result), /\*\*Status:\*\* ACTIVE/);
  assert.match(textOf(result), /\*\*Moeda:\*\* BRL/);
});

for (const omittedStatus of [undefined, null]) {
  test(`discovery does not invent a status when it is ${omittedStatus}`, async (t) => {
    const calls = fakeFetch(t, () => ({
      data: [{ id: ACCOUNT, ...(omittedStatus === null ? { account_status: null } : {}) }],
    }));

    const result = await callTool('discover_ad_accounts', { fields: ['id'] });

    assertSuccess(result);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.searchParams.get('fields'), 'id');
    assert.match(textOf(result), new RegExp(`### ${ACCOUNT}\\n- \\*\\*ID:\\*\\* ${ACCOUNT}`));
    assert.doesNotMatch(textOf(result), /\*\*(Status|Moeda|Timezone):\*\*|UNKNOWN|ACTIVE/);
  });
}

test('discovery preserves custom fields and the existing ID requirement for account scope', async (t) => {
  const calls = fakeFetch(t, () => ({
    data: [
      { id: ACCOUNT, currency: 'BRL' },
      { id: 'act_999999', currency: 'USD' },
    ],
  }));

  const result = await callTool('discover_ad_accounts', { fields: ['currency'] }, {
    allowedAccountIds: [ACCOUNT],
  });

  assertSuccess(result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('fields'), 'id,currency');
  assert.match(textOf(result), /Encontradas 1 conta\(s\)/);
  assert.match(textOf(result), new RegExp(`### ${ACCOUNT}\\n`));
  assert.doesNotMatch(textOf(result), /act_999999|USD|\*\*Status:\*\*/);
});

test('discovery preserves its default fields and named account details', async (t) => {
  const calls = fakeFetch(t, () => ({
    data: [{
      id: ACCOUNT, name: 'Offline account', account_status: 2,
      currency: 'BRL', timezone_name: 'America/Sao_Paulo',
    }],
  }));

  const result = await callTool('discover_ad_accounts', {});

  assertSuccess(result);
  assert.equal(calls[0].url.searchParams.get('fields'), 'id,name,account_status,currency,timezone_name');
  assert.match(textOf(result), /### Offline account\n/);
  assert.match(textOf(result), new RegExp(`\\*\\*ID:\\*\\* ${ACCOUNT}`));
  assert.match(textOf(result), /\*\*Status:\*\* DISABLED/);
  assert.match(textOf(result), /\*\*Moeda:\*\* BRL/);
  assert.match(textOf(result), /\*\*Timezone:\*\* America\/Sao_Paulo/);
});

test('discovery keeps an explicitly returned unknown status visible', async (t) => {
  fakeFetch(t, () => ({ data: [{ id: ACCOUNT, account_status: 999 }] }));

  const result = await callTool('discover_ad_accounts', { fields: ['id', 'account_status'] });

  assertSuccess(result);
  assert.match(textOf(result), /\*\*Status:\*\* UNKNOWN \(999\)/);
});
