import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignArgs, adsetArgs, readCases, validateConfig, assertToolSuccess, createdId, parseApiJson } from '../live/plan.mjs';

const config = { account_id: 'act_12345', page_id: '23456', targeting: { geo_locations: { countries: ['BR'] } }, daily_budget: 600, landing_url: 'https://example.com', image_hash: 'fake' };

test('plano real de leitura não contém mutações mesmo com fixtures adicionais', () => {
  const cases = readCases({ ...config, campaign_id: '34567', adset_id: '45678', ad_id: '56789', creative_id: '67890', pixel_id: '78901', video_id: '89012' });
  for (const [tool] of cases) assert.match(tool, /^(discover_|list_|get_|search_)/);
});

test('consultas do plano real seguem os schemas executáveis, incluindo busca geográfica', async () => {
  const { apiSchemas } = await import('../../dist/schemas/api-schemas.js');
  const cases = readCases({ ...config, campaign_id: '34567', adset_id: '45678', ad_id: '56789', creative_id: '67890', pixel_id: '78901', video_id: '89012', geolocation_query: 'Barueri' });
  for (const [name, args] of cases) {
    const parsed = apiSchemas[name].safeParse(args);
    assert.equal(parsed.success, true, `${name}: ${parsed.error?.message ?? ''}`);
  }
  assert.equal(cases.find(([name]) => name === 'search_geolocation')[1].q, 'Barueri');
});

test('plano real força PAUSED e conta aprovada independentemente dos campos extras', () => {
  const dirty = { ...config, status: 'ACTIVE', campaign_id: 'EXISTING', name: 'existing' };
  assert.equal(campaignArgs(dirty, 'audit').status, 'PAUSED');
  const args = adsetArgs(dirty, 'NEW_CAMPAIGN', 'audit');
  assert.equal(args.status, 'PAUSED');
  assert.equal(args.campaign_id, 'NEW_CAMPAIGN');
  assert.equal(args.account_id, config.account_id);
});

test('configuração rejeita conta, orçamento e targeting ausentes antes de autenticar', () => {
  assert.throws(() => validateConfig({ ...config, account_id: 'me' }));
  assert.throws(() => validateConfig({ ...config, targeting: {} }));
  assert.throws(() => validateConfig({ ...config, daily_budget: 1000000 }, true));
  assert.throws(() => validateConfig({ ...config, landing_url: 'http://example.com' }, true));
  assert.equal(validateConfig(config, true), config);
});

test('harness detecta erro de validação que o servidor reportou como sucesso', () => {
  assert.throws(() => assertToolSuccess({ content: [{ text: '# Erro de Validação\ninvalid' }] }));
  assert.throws(() => assertToolSuccess({ isError: true, content: [{ text: 'error' }] }));
  assert.throws(() => createdId({ content: [{ text: 'Success without ID' }] }));
  assert.equal(createdId({ content: [{ text: '**ID:** 12345' }] }), '12345');
});

test('readback exige JSON da Graph API, sem inferir sucesso pelo texto', () => {
  assert.throws(() => parseApiJson({ content: [{ text: 'success' }] }));
  assert.deepEqual(parseApiJson({ content: [{ text: '```json\n{"success":true}\n```' }] }), { success: true });
});
