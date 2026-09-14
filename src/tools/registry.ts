import { z } from 'zod';
import type { MetaClient } from '../meta-client.js';
import { apiSchemas } from '../schemas/api-schemas.js';
import { toolDescriptions } from './definitions.js';
import { handleListAds, handleListCampaignAds, handleGetAd, handleCreateAd, handleUpdateAd, handlePauseAd, handleActivateAd } from './ads.js';
import { handleListAdsets, handleGetAdset, handleCreateAdset, handleUpdateAdset, handlePauseAdset, handleActivateAdset } from './adsets.js';
import { handleListPixels, handleUploadImage, handleGetDatasetQuality, handleSearchGeolocation } from './assets.js';
import { handleListCustomAudiences, handleCreateCustomAudience, handleGetReachEstimate } from './audiences.js';
import { handleListCampaigns, handleGetCampaign, handleCreateCampaign, handleUpdateCampaign, handlePauseCampaign, handleActivateCampaign } from './campaigns.js';
import { handleListCreatives, handleGetCreative, handleCreateCreative } from './creatives.js';
import { handleExecuteApi } from './custom-api.js';
import { handleDiscoverAdAccounts, handleListFacebookPages, handleGetInstagramAccount } from './discovery.js';
import { handleGetAccountInsights, handleGetCampaignInsights, handleGetAdsetInsights, handleGetAdInsights, handleGetAttributionComparison, handleGetPerformanceSummary, handleListCampaignAdsWithInsights } from './insights.js';
import { handleUploadVideo, handleGetVideoStatus, handleCreateValueRuleSet, handleListValueRuleSets, handleGetValueRuleSet, handleUpdateValueRuleSet, handleDeleteValueRuleSet, handleCreateAdLabel, handleListAdLabels, handlePreviewCreative, handleCreateBudgetSchedule, handleGetBudgetSchedules, handleUpdateBudgetSchedule, handleDeleteBudgetSchedule } from './management.js';
import { handleCreateThreadsAdSet, handleCreateClickToMessageAdSet, handleCreatePartnershipAdCreative } from './specialized.js';
import { handleGetSkill, handleGetPlaybook, handleGetAndromeda } from './context.js';
import { diagnoseConnectionSchema, handleDiagnoseConnection } from './connection-diagnostics.js';
import { collectionTools, usesAutomaticPagination } from '../pagination.js';
import { handleGetOperationStatus } from '../operations/handlers.js';

export type ToolResult = { content: Array<{type: 'text'; text: string}>; isError?: boolean; structuredContent?: Record<string, unknown> };
export type ToolPermission = 'read' | 'write' | 'method';
type Entry = { schema: z.ZodType; permission: ToolPermission; requiresApi?: boolean; execute: (client: MetaClient, args: any) => Promise<ToolResult> };

export const toolRegistry: Record<string, Entry> = {
  diagnose_connection: { schema: diagnoseConnectionSchema, permission: 'read', execute: handleDiagnoseConnection },
  get_operation_status: { schema: z.object({ request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/), inspect: z.boolean().optional().describe('Consulta o estado atual de um ID conhecido. A observação não confirma uma criação com ID perdido nem libera repetição incerta.') }), permission: 'read', execute: handleGetOperationStatus },
  discover_ad_accounts: { schema: apiSchemas.discover_ad_accounts, permission: 'read', execute: handleDiscoverAdAccounts },
  list_facebook_pages: { schema: apiSchemas.list_facebook_pages, permission: 'read', execute: handleListFacebookPages },
  get_instagram_account: { schema: apiSchemas.get_instagram_account, permission: 'read', execute: handleGetInstagramAccount },
  list_campaigns: { schema: apiSchemas.list_campaigns, permission: 'read', execute: handleListCampaigns },
  get_campaign: { schema: apiSchemas.get_campaign, permission: 'read', execute: handleGetCampaign },
  create_campaign: { schema: apiSchemas.create_campaign, permission: 'write', execute: handleCreateCampaign },
  update_campaign: { schema: apiSchemas.update_campaign, permission: 'write', execute: handleUpdateCampaign },
  pause_campaign: { schema: apiSchemas.pause_campaign, permission: 'write', execute: handlePauseCampaign },
  activate_campaign: { schema: apiSchemas.activate_campaign, permission: 'write', execute: handleActivateCampaign },
  list_adsets: { schema: apiSchemas.list_adsets, permission: 'read', execute: handleListAdsets },
  get_adset: { schema: apiSchemas.get_adset, permission: 'read', execute: handleGetAdset },
  create_adset: { schema: apiSchemas.create_adset, permission: 'write', execute: handleCreateAdset },
  update_adset: { schema: apiSchemas.update_adset, permission: 'write', execute: handleUpdateAdset },
  pause_adset: { schema: apiSchemas.pause_adset, permission: 'write', execute: handlePauseAdset },
  activate_adset: { schema: apiSchemas.activate_adset, permission: 'write', execute: handleActivateAdset },
  list_ads: { schema: apiSchemas.list_ads, permission: 'read', execute: handleListAds },
  list_campaign_ads: { schema: apiSchemas.list_campaign_ads, permission: 'read', execute: handleListCampaignAds },
  get_ad: { schema: apiSchemas.get_ad, permission: 'read', execute: handleGetAd },
  create_ad: { schema: apiSchemas.create_ad, permission: 'write', execute: handleCreateAd },
  update_ad: { schema: apiSchemas.update_ad, permission: 'write', execute: handleUpdateAd },
  pause_ad: { schema: apiSchemas.pause_ad, permission: 'write', execute: handlePauseAd },
  activate_ad: { schema: apiSchemas.activate_ad, permission: 'write', execute: handleActivateAd },
  list_creatives: { schema: apiSchemas.list_creatives, permission: 'read', execute: handleListCreatives },
  get_creative: { schema: apiSchemas.get_creative, permission: 'read', execute: handleGetCreative },
  create_creative: { schema: apiSchemas.create_creative, permission: 'write', execute: handleCreateCreative },
  get_account_insights: { schema: apiSchemas.get_account_insights, permission: 'read', execute: handleGetAccountInsights },
  get_campaign_insights: { schema: apiSchemas.get_campaign_insights, permission: 'read', execute: handleGetCampaignInsights },
  get_adset_insights: { schema: apiSchemas.get_adset_insights, permission: 'read', execute: handleGetAdsetInsights },
  get_ad_insights: { schema: apiSchemas.get_ad_insights, permission: 'read', execute: handleGetAdInsights },
  get_attribution_comparison: { schema: apiSchemas.get_attribution_comparison, permission: 'read', execute: handleGetAttributionComparison },
  get_performance_summary: { schema: apiSchemas.get_performance_summary, permission: 'read', execute: handleGetPerformanceSummary },
  list_campaign_ads_with_insights: { schema: apiSchemas.list_campaign_ads_with_insights, permission: 'read', execute: handleListCampaignAdsWithInsights },
  list_custom_audiences: { schema: apiSchemas.list_custom_audiences, permission: 'read', execute: handleListCustomAudiences },
  create_custom_audience: { schema: apiSchemas.create_custom_audience, permission: 'write', execute: handleCreateCustomAudience },
  get_reach_estimate: { schema: apiSchemas.get_reach_estimate, permission: 'read', execute: handleGetReachEstimate },
  list_pixels: { schema: apiSchemas.list_pixels, permission: 'read', execute: handleListPixels },
  upload_image: { schema: apiSchemas.upload_image, permission: 'write', execute: handleUploadImage },
  get_dataset_quality: { schema: apiSchemas.get_dataset_quality, permission: 'read', execute: handleGetDatasetQuality },
  search_geolocation: { schema: apiSchemas.search_geolocation, permission: 'read', execute: handleSearchGeolocation },
  execute_api: { schema: apiSchemas.execute_api, permission: 'method', execute: handleExecuteApi },
  upload_video: { schema: apiSchemas.upload_video, permission: 'write', execute: handleUploadVideo },
  get_video_status: { schema: apiSchemas.get_video_status, permission: 'read', execute: handleGetVideoStatus },
  create_value_rule_set: { schema: apiSchemas.create_value_rule_set, permission: 'write', execute: handleCreateValueRuleSet },
  list_value_rule_sets: { schema: apiSchemas.list_value_rule_sets, permission: 'read', execute: handleListValueRuleSets },
  get_value_rule_set: { schema: apiSchemas.get_value_rule_set, permission: 'read', execute: handleGetValueRuleSet },
  update_value_rule_set: { schema: apiSchemas.update_value_rule_set, permission: 'write', execute: handleUpdateValueRuleSet },
  delete_value_rule_set: { schema: apiSchemas.delete_value_rule_set, permission: 'write', execute: handleDeleteValueRuleSet },
  create_ad_label: { schema: apiSchemas.create_ad_label, permission: 'write', execute: handleCreateAdLabel },
  list_ad_labels: { schema: apiSchemas.list_ad_labels, permission: 'read', execute: handleListAdLabels },
  preview_creative: { schema: apiSchemas.preview_creative, permission: 'read', execute: handlePreviewCreative },
  create_budget_schedule: { schema: apiSchemas.create_budget_schedule, permission: 'write', execute: handleCreateBudgetSchedule },
  get_budget_schedules: { schema: apiSchemas.get_budget_schedules, permission: 'read', execute: handleGetBudgetSchedules },
  update_budget_schedule: { schema: apiSchemas.update_budget_schedule, permission: 'write', execute: handleUpdateBudgetSchedule },
  delete_budget_schedule: { schema: apiSchemas.delete_budget_schedule, permission: 'write', execute: handleDeleteBudgetSchedule },
  create_threads_ad_set: { schema: apiSchemas.create_threads_ad_set, permission: 'write', execute: handleCreateThreadsAdSet },
  create_click_to_message_ad_set: { schema: apiSchemas.create_click_to_message_ad_set, permission: 'write', execute: handleCreateClickToMessageAdSet },
  create_partnership_ad_creative: { schema: apiSchemas.create_partnership_ad_creative, permission: 'write', execute: handleCreatePartnershipAdCreative },
  get_skill: { schema: apiSchemas.get_skill, permission: 'read', requiresApi: false, execute: handleGetSkill },
  get_playbook: { schema: apiSchemas.get_playbook, permission: 'read', requiresApi: false, execute: handleGetPlaybook },
  get_andromeda: { schema: apiSchemas.get_andromeda, permission: 'read', requiresApi: false, execute: handleGetAndromeda },
};

for (const entry of Object.values(toolRegistry)) {
  if (entry.permission !== 'read') entry.schema = (entry.schema as z.ZodObject).safeExtend({
    request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/).optional().describe('Identificador estável desta escrita. Reutilize ao repetir a mesma requisição; permite recuperar recibo sem duplicar a operação. Resultado incerto bloqueia repetição mesmo com outro ID.'),
  });
}

// Fail during startup if catalog and executable registry ever diverge.
for (const tool of toolDescriptions) {
  if (!toolRegistry[tool.name]) throw new Error(`Tool sem contrato executável: ${tool.name}`);
}
if (toolDescriptions.length !== Object.keys(toolRegistry).length) throw new Error('Catálogo de tools incompleto');

export const apiTools = toolDescriptions.map((tool) => {
  const entry = toolRegistry[tool.name];
  const inputSchema = z.toJSONSchema(entry.schema, { io: 'output', unrepresentable: 'any' });
  delete inputSchema.$schema;
  // Defaults do not make a field mandatory for callers. Coercion remains an input convenience.
  const shape = (entry.schema as z.ZodObject).shape;
  inputSchema.required = Object.entries(shape).filter(([, field]) => !(field as z.ZodType).safeParse(undefined).success).map(([name]) => name);
  const paginationDescription = collectionTools.has(tool.name) && tool.name !== 'diagnose_connection'
    ? `${usesAutomaticPagination(tool.name) ? ' Percorre páginas automaticamente até os limites.' : ''} Confira pagination.complete; resultado incompleto não representa o total. Continue chamando next.tool com next.arguments, preservando cada coleção e reunindo as páginas anteriores.`
    : '';
  return { name: tool.name, description: tool.description + paginationDescription, inputSchema: inputSchema as {type: 'object'; properties: Record<string, any>; required: string[]}, annotations: {readOnlyHint: entry.permission === 'read', destructiveHint: entry.permission !== 'read', openWorldHint: entry.requiresApi !== false} };
});
