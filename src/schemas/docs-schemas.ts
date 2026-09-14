/**
 * Schemas Zod para Tools de Documentação
 */

import { z } from 'zod';

// ==================== SCHEMAS ====================

export const searchDocumentationSchema = z.strictObject({
  query: z.string().trim().min(1).max(1000).describe('Termo de busca (ex: "criar campanha", "insights", "conversions api")'),
  section: z.string().trim().max(100).regex(/^[a-zA-Z0-9_-]+$/).optional().describe('Filtrar por seção (ex: "insights", "audiences", "conversions-api", "ads-ai-connectors")'),
  limit: z.number().int().min(1).max(50).default(10).describe('Número máximo de resultados (default: 10)'),
});

export const getDocumentByPathSchema = z.strictObject({
  path: z.string().min(1).max(500).describe('Caminho relativo do documento (ex: "insights/error-codes.md")'),
});

export const listSectionsSchema = z.strictObject({});

export const getEndpointReferenceSchema = z.strictObject({
  endpoint: z.string().trim().min(1).max(200).describe('Nome do endpoint (ex: "campaigns", "adsets", "insights", "customaudiences")'),
});

export const getErrorCodeInfoSchema = z.strictObject({
  error_code: z.string().trim().min(1).max(50).describe('Código de erro (ex: "100", "190", "1504022")'),
});

export const getQuickReferenceSchema = z.strictObject({});

// ==================== TYPES ====================

export type SearchDocumentationArgs = z.infer<typeof searchDocumentationSchema>;
export type GetDocumentByPathArgs = z.infer<typeof getDocumentByPathSchema>;
export type ListSectionsArgs = z.infer<typeof listSectionsSchema>;
export type GetEndpointReferenceArgs = z.infer<typeof getEndpointReferenceSchema>;
export type GetErrorCodeInfoArgs = z.infer<typeof getErrorCodeInfoSchema>;
export type GetQuickReferenceArgs = z.infer<typeof getQuickReferenceSchema>;

// ==================== SCHEMA MAP ====================

export const docsSchemas = {
  search_documentation: searchDocumentationSchema,
  get_document_by_path: getDocumentByPathSchema,
  list_sections: listSectionsSchema,
  get_endpoint_reference: getEndpointReferenceSchema,
  get_error_code_info: getErrorCodeInfoSchema,
  get_quick_reference: getQuickReferenceSchema,
} as const;
