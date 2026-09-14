// Pure planning functions: no credentials, network or writes.
export function validateConfig(config, write = false) {
  if (!/^act_\d+$/.test(config.account_id ?? '')) throw new Error('account_id deve ser act_ seguido do ID real.');
  if (!config.targeting?.geo_locations) throw new Error('targeting.geo_locations deve ser explícito.');
  if (write) {
    if (!/^\d+$/.test(config.page_id ?? '')) throw new Error('page_id obrigatório para escrita.');
    const url = new URL(config.landing_url);
    if (url.protocol !== 'https:') throw new Error('landing_url deve usar HTTPS.');
    if (!config.image_hash) throw new Error('Use image_hash de uma imagem já existente na conta.');
    if (!Number.isInteger(config.daily_budget) || config.daily_budget < 600 || config.daily_budget > 10000) {
      throw new Error('daily_budget deve estar entre 600 e 10000, em unidades mínimas da moeda da conta.');
    }
    if (config.messaging) {
      if (!['WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT'].includes(config.messaging.destination)) throw new Error('Destino de messaging inválido.');
      if (config.messaging.destination === 'WHATSAPP' && !config.messaging.whatsapp_phone_number) throw new Error('WhatsApp exige número para esta wrapper.');
    }
    if (config.partnership) {
      const p = config.partnership;
      if (!['boost_existing_post', 'boost_existing_fb_post'].includes(p.mode)) throw new Error('A fixture live suporta boost Instagram ou Facebook.');
      if (p.mode === 'boost_existing_post' && !p.source_instagram_media_id && !p.instagram_boost_post_access_token) throw new Error('Partnership Instagram exige media ID ou ad code.');
      if (p.mode === 'boost_existing_fb_post' && !p.facebook_boost_post_access_token) throw new Error('Partnership Facebook exige ad code.');
    }
    if (config.special_ad_category && !['HOUSING', 'EMPLOYMENT', 'CREDIT', 'FINANCIAL_PRODUCTS_SERVICES'].includes(config.special_ad_category)) throw new Error('Categoria especial não suportada pela fixture.');
  }
  return config;
}

export function readCases(c) {
  const account_id = c.account_id;
  const cases = [
    ['discover_ad_accounts', { fields: ['id', 'name', 'account_status', 'currency', 'timezone_name'] }],
    ['list_campaigns', { account_id, fields: ['id', 'name', 'status', 'objective'] }],
    ['list_adsets', { account_id, fields: ['id', 'name', 'status', 'campaign_id'] }],
    ['list_ads', { account_id, fields: ['id', 'name', 'status', 'adset_id'] }],
    ['list_creatives', { account_id, fields: ['id', 'name'] }],
    ['list_custom_audiences', { account_id }],
    ['list_pixels', { account_id }],
    ['list_ad_labels', { account_id }],
    ['list_value_rule_sets', { account_id }],
    ['get_account_insights', { account_id, date_preset: 'last_7d', fields: ['impressions', 'clicks', 'spend'] }],
    ['get_reach_estimate', { account_id, targeting_spec: c.targeting }],
    ['search_geolocation', { q: c.geolocation_query ?? 'São Paulo', country_code: c.country_code ?? 'BR', location_types: ['city'] }],
  ];
  if (c.page_id) cases.push(['list_facebook_pages', { fields: ['id', 'name'] }], ['get_instagram_account', { page_id: c.page_id }]);
  for (const kind of ['campaign', 'adset', 'ad', 'creative']) {
    if (c[`${kind}_id`]) {
      cases.push([`get_${kind}`, { [`${kind}_id`]: c[`${kind}_id`] }]);
      if (kind !== 'creative') cases.push([`get_${kind}_insights`, { [`${kind}_id`]: c[`${kind}_id`], date_preset: 'last_7d' }]);
    }
  }
  if (c.pixel_id) cases.push(['get_dataset_quality', { pixel_id: c.pixel_id }]);
  if (c.video_id) cases.push(['get_video_status', { video_id: c.video_id }]);
  return cases;
}

export function campaignArgs(config, name, objective = 'OUTCOME_TRAFFIC', categories = []) {
  return { account_id: config.account_id, name, objective, special_ad_categories: categories, status: 'PAUSED', is_adset_budget_sharing_enabled: false };
}

export function adsetArgs(config, campaign_id, name) {
  return {
    account_id: config.account_id, campaign_id, name, status: 'PAUSED',
    daily_budget: config.daily_budget, optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP', advantage_audience: 0,
    targeting: { ...config.targeting, targeting_automation: { advantage_audience: 0 } },
  };
}

export function parseApiJson(result) {
  const text = (result.content ?? []).map(part => part.text ?? '').join('\n');
  const json = text.match(/```json\s*([\s\S]*?)```/);
  if (!json) throw new Error('execute_api não devolveu JSON verificável.');
  return JSON.parse(json[1]);
}

export function createdId(result) {
  const text = (result.content ?? []).map(part => part.text ?? '').join('\n');
  const match = text.match(/\*\*ID:\*\*\s*(\d+)/);
  if (!match) throw new Error('Criação sem ID verificável. Revise o ledger antes de repetir.');
  return match[1];
}

export function assertToolSuccess(result) {
  const text = (result.content ?? []).map(part => part.text ?? '').join('\n');
  // Current branch sometimes returns validation failures without isError.
  if (result.isError || /(?:^|\n)#\s*(?:Erro|Error)|Permission denied|não está configurada/i.test(text)) {
    const error = new Error('A tool recusou a operação.');
    error.toolText = text;
    throw error;
  }
  if (!text.trim()) throw new Error('Resposta vazia da tool.');
  return result;
}
