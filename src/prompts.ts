/**
 * Prompts - Contextos Pré-Configurados
 *
 * Prompts são "atalhos" que retornam contexto relevante para tarefas comuns,
 * agregando múltiplos documentos por contexto.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadMarkdownFile, getDocsPath, loadAllDocuments } from './utils/fileLoader.js';
import { searchDocuments } from './utils/search.js';
import { isMetaConfigured } from './utils/config.js';
import * as path from 'path';
import * as fs from 'fs';

const operationContract = `Este é um guia de contexto, não uma autorização de escrita. Confira tools/list, o schema e diagnose_connection antes de operar. Documentação de Catalog, CAPI, Gateway ou do MCP oficial não habilita essas operações no FaceAds.

Listas e Insights percorrem páginas automaticamente dentro dos limites. Antes de concluir quantidade ou desempenho global, confira structuredContent.pagination.complete; se for false, informe que o resultado é parcial e chame collections[].next.tool com collections[].next.arguments. Se houver erro, siga primeiro a orientação de recuperação antes de continuar. Uma consulta iniciada em after não inclui as páginas anteriores. Preserve todas as linhas, dimensões e períodos; métrica ausente ou consulta com erro não equivale a zero.

Campanhas, conjuntos e anúncios são criados ou copiados sempre PAUSED. Ativação é uma operação separada e exige intenção explícita do usuário. Use request_id por intenção de escrita e get_operation_status após timeout; não repita uma criação de resultado incerto nem tente contornar o bloqueio usando outro ID. Não peça nem exponha tokens pelo chat.`;

interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/**
 * Definição dos prompts disponíveis
 */
const prompts: PromptDefinition[] = [
  // ==================== PROMPTS DE CONSULTA ====================
  {
    name: 'create_campaign_guide',
    description: 'Guia completo para criar campanhas na Facebook Marketing API',
    arguments: [
      {
        name: 'objective',
        description: 'Objetivo da campanha (awareness, engagement, leads, sales, traffic, app)',
        required: false,
      },
    ],
  },
  {
    name: 'conversions_api_setup',
    description: 'Guia para configurar a Conversions API (CAPI)',
    arguments: [
      {
        name: 'platform',
        description: 'Plataforma de integração (web, app, offline)',
        required: false,
      },
    ],
  },
  {
    name: 'audience_targeting_guide',
    description: 'Guia completo de targeting e audiências',
    arguments: [
      {
        name: 'audience_type',
        description: 'Tipo de audiência (custom, lookalike, saved)',
        required: false,
      },
    ],
  },
  {
    name: 'pixel_setup',
    description: 'Guia para configurar o Facebook Pixel',
    arguments: [],
  },
  {
    name: 'insights_reporting',
    description: 'Guia para extrair e analisar insights e métricas',
    arguments: [
      {
        name: 'level',
        description: 'Nível de agregação (account, campaign, adset, ad)',
        required: false,
      },
    ],
  },

  // ==================== PROMPTS DE EXECUÇÃO ====================
  {
    name: 'traffic_manager_mode',
    description:
      'Ativa o modo gestor de tráfego com contexto completo para gerenciar campanhas. Requer API configurada.',
    arguments: [],
  },
  {
    name: 'campaign_audit',
    description: 'Contexto para auditoria de campanhas existentes. Requer API configurada.',
    arguments: [],
  },
  {
    name: 'quick_optimization',
    description: 'Contexto para otimização rápida de campanhas. Requer API configurada.',
    arguments: [],
  },
];

/**
 * Carrega conteúdo de múltiplos arquivos
 */
function loadMultipleFiles(relativePaths: string[]): string {
  const docsPath = getDocsPath();
  const contents: string[] = [];

  for (const relativePath of relativePaths) {
    const fullPath = path.join(docsPath, relativePath);
    if (fs.existsSync(fullPath)) {
      const doc = loadMarkdownFile(fullPath);
      if (doc) {
        contents.push(`# ${doc.title}\n\n${doc.content}`);
      }
    }
  }

  return contents.join('\n\n---\n\n');
}

/**
 * Busca documentos relevantes para um tópico
 */
function searchRelevantDocs(query: string, limit: number = 5): string {
  const documents = loadAllDocuments();
  const results = searchDocuments(documents, query, { limit });

  if (results.length === 0) {
    return '';
  }

  return results.map((r) => `# ${r.document.title}\n\n${r.document.content}`).join('\n\n---\n\n');
}

/**
 * Gera conteúdo do prompt
 */
async function generatePromptContent(
  name: string,
  args: Record<string, string>
): Promise<{ role: 'user'; content: { type: 'text'; text: string } }[]> {
  let content = '';

  switch (name) {
    case 'create_campaign_guide': {
      content = `# Guia de Criação de Campanhas - Facebook Marketing API

Você está consultando a documentação para criar campanhas na plataforma Meta Ads.

## Estrutura de Anúncios

\`\`\`
Campaign (Campanha) - Define objetivo e orçamento geral
└── Ad Set (Conjunto de Anúncios) - Define público, posicionamento e lance
    └── Ad (Anúncio) - Define o criativo e CTA
        └── Creative (Criativo) - Arte, texto e mídia
\`\`\`

## Objetivos Disponíveis

- \`OUTCOME_AWARENESS\` - Reconhecimento de marca
- \`OUTCOME_ENGAGEMENT\` - Engajamento (curtidas, comentários)
- \`OUTCOME_LEADS\` - Geração de leads
- \`OUTCOME_SALES\` - Conversões e vendas
- \`OUTCOME_TRAFFIC\` - Tráfego para site/app
- \`OUTCOME_APP_PROMOTION\` - Instalações de app

`;
      // Adicionar documentação relevante
      const campaignDocs = searchRelevantDocs('criar campanha campaign create', 5);
      if (campaignDocs) {
        content += '\n\n## Documentação Relevante\n\n' + campaignDocs;
      }

      if (args.objective) {
        const objectiveDocs = searchRelevantDocs(args.objective, 3);
        if (objectiveDocs) {
          content += `\n\n## Documentação Específica: ${args.objective}\n\n` + objectiveDocs;
        }
      }
      break;
    }

    case 'conversions_api_setup': {
      content = `# Guia de Configuração - Conversions API (CAPI)

A Conversions API permite enviar eventos do servidor diretamente para a Meta, 
complementando o Pixel do Facebook para melhor atribuição e mensuração.

## Benefícios

- Maior confiabilidade de dados
- Não é afetada por bloqueadores de anúncios
- Melhor atribuição de conversões
- Compatível com iOS 14+

## Eventos Principais

- \`Purchase\` - Compra
- \`Lead\` - Lead gerado
- \`AddToCart\` - Adição ao carrinho
- \`InitiateCheckout\` - Início de checkout
- \`ViewContent\` - Visualização de conteúdo

`;
      const capiDocs = searchRelevantDocs('conversions api capi server side', 5);
      if (capiDocs) {
        content += '\n\n## Documentação Relevante\n\n' + capiDocs;
      }

      if (args.platform) {
        const platformDocs = searchRelevantDocs(`${args.platform} conversions`, 3);
        if (platformDocs) {
          content += `\n\n## Integração: ${args.platform}\n\n` + platformDocs;
        }
      }
      break;
    }

    case 'audience_targeting_guide': {
      content = `# Guia de Audiências e Targeting

## Tipos de Audiência

### Custom Audiences (Audiências Personalizadas)
- Website visitors (visitantes do site)
- Customer list (lista de clientes)
- App activity (atividade no app)
- Engagement (engajamento)

### Lookalike Audiences (Audiências Semelhantes)
- Baseadas em audiências personalizadas
- Expandem alcance para pessoas similares

### Saved Audiences (Audiências Salvas)
- Baseadas em dados demográficos
- Interesses e comportamentos

## Opções de Targeting

- Localização (países, estados, cidades, raio)
- Idade e gênero
- Interesses
- Comportamentos
- Conexões (páginas, apps, eventos)

`;
      const audienceDocs = searchRelevantDocs('audience targeting público segmentação', 5);
      if (audienceDocs) {
        content += '\n\n## Documentação Relevante\n\n' + audienceDocs;
      }

      if (args.audience_type) {
        const typeDocs = searchRelevantDocs(`${args.audience_type} audience`, 3);
        if (typeDocs) {
          content += `\n\n## Tipo: ${args.audience_type}\n\n` + typeDocs;
        }
      }
      break;
    }

    case 'pixel_setup': {
      content = `# Guia de Configuração - Facebook Pixel

O Pixel do Facebook é um código JavaScript que rastreia ações dos visitantes no seu site.

## Funcionalidades

- Rastreamento de conversões
- Criação de audiências personalizadas
- Otimização de entrega de anúncios
- Remarketing

## Eventos Padrão

- \`PageView\` - Visualização de página
- \`ViewContent\` - Visualização de conteúdo
- \`AddToCart\` - Adição ao carrinho
- \`InitiateCheckout\` - Início de checkout
- \`Purchase\` - Compra
- \`Lead\` - Lead gerado
- \`CompleteRegistration\` - Cadastro completo

`;
      const pixelDocs = searchRelevantDocs('facebook pixel rastreamento tracking', 5);
      if (pixelDocs) {
        content += '\n\n## Documentação Relevante\n\n' + pixelDocs;
      }
      break;
    }

    case 'insights_reporting': {
      content = `# Guia de Insights e Relatórios

## Métricas Principais

### Performance
- \`impressions\` - Impressões
- \`reach\` - Alcance
- \`clicks\` - Cliques
- \`ctr\` - Taxa de cliques

### Custos
- \`spend\` - Gasto total
- \`cpc\` - Custo por clique
- \`cpm\` - Custo por mil impressões
- \`cost_per_action_type\` - Custo por tipo de ação, preservando suas dimensões

### Conversões
- \`actions\` - Ações realizadas
- \`conversions\` - Conversões
- \`purchase_roas\` - ROAS

## Níveis de Agregação

- \`account\` - Toda a conta
- \`campaign\` - Por campanha
- \`adset\` - Por conjunto de anúncios
- \`ad\` - Por anúncio

## Períodos Predefinidos

- \`today\`, \`yesterday\`
- \`last_7d\`, \`last_14d\`, \`last_30d\`
- \`this_month\`, \`last_month\`

`;
      const insightsDocs = searchRelevantDocs('insights metrics métricas relatórios', 5);
      if (insightsDocs) {
        content += '\n\n## Documentação Relevante\n\n' + insightsDocs;
      }

      if (args.level) {
        const levelDocs = searchRelevantDocs(`${args.level} insights`, 3);
        if (levelDocs) {
          content += `\n\n## Nível: ${args.level}\n\n` + levelDocs;
        }
      }
      break;
    }

    // ==================== PROMPTS DE EXECUÇÃO ====================
    case 'traffic_manager_mode': {
      const apiConfigured = isMetaConfigured();

      content = `# Modo Gestor de Tráfego

${
  apiConfigured
    ? 'Credencial configurada. Confira permissões com diagnose_connection e valide a leitura na conta; configuração não comprova acesso a toda operação.'
    : 'Credencial Meta indisponível neste contexto. Consulte o fluxo de conexão do README para HTTP ou stdio. Documentação continua disponível.'
}

## Capacidades

### Consulta (sempre disponível)
- Buscar documentação
- Consultar referência de endpoints
- Verificar códigos de erro

### Operações sujeitas a permissões, conta e intenção do usuário
- Criar/editar campanhas
- Gerenciar ad sets e anúncios
- Pausar/ativar campanhas
- Obter insights e métricas
- Gerenciar audiências

## Fluxo de Trabalho Típico

1. **Análise**: Verificar campanhas existentes com \`list_campaigns\`
2. **Insights**: Analisar performance com \`get_account_insights\`
3. **Ação**: Criar ou otimizar campanhas
4. **Monitoramento**: Acompanhar resultados

## Boas Práticas

- Sempre começar campanhas com status PAUSED
- Validar targeting antes de ativar
- Monitorar métricas diariamente
- Respeitar limites de orçamento

## Tools de Execução Disponíveis

| Categoria | Tools |
|-----------|-------|
| Campanhas | list_campaigns, create_campaign, update_campaign, pause_campaign, activate_campaign |
| Ad Sets | list_adsets, create_adset, update_adset |
| Anúncios | create_ad |
| Criativos | create_creative |
| Insights | get_account_insights, get_campaign_insights, get_adset_insights |
| Audiências | list_custom_audiences, create_custom_audience, get_reach_estimate |
| Diagnóstico e histórico | diagnose_connection, get_operation_status |
| Avançado | execute_api (somente endpoints aceitos pela política de autorização) |

## Tools de Documentação

Para consultar parâmetros, campos disponíveis e exemplos, use as tools de documentação:

| Tool | Uso |
|------|-----|
| \`search_documentation\` | Busca por termo (ex: "targeting", "billing_event", "optimization_goal") |
| \`get_document_by_path\` | Obtém documento completo pelo caminho |
| \`get_endpoint_reference\` | Detalhes de um endpoint específico (ex: "adsets", "campaigns") |
| \`get_error_code_info\` | Informações sobre códigos de erro |
| \`list_sections\` | Lista todas as seções da documentação |

**Dica**: Antes de criar campanhas/adsets, busque os parâmetros disponíveis com \`search_documentation\` seguido de \`get_document_by_path\` nos documentos relevantes ou \`get_endpoint_reference\`.

## Tool Avançada: execute_api

Use \`execute_api\` para endpoints sem ferramenta dedicada que estejam aceitos pela política de autorização. Batch e endpoints arbitrários não são suportados no HTTP. Confira o schema e a documentação vigente antes de montar a chamada.

### Exemplos de Uso

**Duplicar Campanha:**
\`\`\`
method: POST
endpoint: {campaign_id}/copies
params: { deep_copy: true, status_option: "PAUSED" }
\`\`\`

**Listar Ads de uma Campanha:**
\`\`\`
tool: list_campaign_ads
arguments: { campaign_id: "{campaign_id}", fields: ["id", "name", "status"] }
\`\`\`

### Cópias

As cópias ficam PAUSED. Limites de cópia e campos obrigatórios dependem do objeto e da resposta da Meta. Se a cópia for grande demais, verifique a causa antes de propor copiar somente a campanha ou copiar conjuntos individualmente. Cada nova escrita deve respeitar a intenção autorizada; não use batch como recuperação neste MCP.
`;
      break;
    }

    case 'campaign_audit': {
      const apiConfigured = isMetaConfigured();

      content = `# Auditoria de Campanhas

${
  apiConfigured
    ? 'Credencial configurada. Confira permissões com diagnose_connection e valide a leitura na conta antes da auditoria.'
    : 'Credencial Meta indisponível neste contexto. Consulte o fluxo de conexão do README; nenhuma leitura de conta foi confirmada.'
}

## Checklist de Auditoria

### 1. Cobertura dos dados e estrutura
- [ ] Paginação completa ou recorte explicitamente identificado como parcial
- [ ] Nomenclatura consistente
- [ ] Objetivos alinhados com metas
- [ ] Orçamentos adequados

### 2. Ad Sets
- [ ] Targeting relevante
- [ ] Sobreposição de audiências
- [ ] Posicionamentos otimizados

### 3. Performance
- [ ] Objetivo e metas acordados para o negócio
- [ ] CPA, CTR, CPC e ROAS interpretados com volume, margem, atribuição e período comparáveis
- [ ] Métricas ausentes e falhas de consulta separadas de zero

### 4. Criativos
- [ ] A/B testing
- [ ] Frequência controlada
- [ ] Relevância do anúncio

## Comandos Sugeridos

1. Listar campanhas: \`list_campaigns\`
2. Ver insights da conta: \`get_account_insights\` (últimos 30 dias)
3. Analisar campanhas individualmente: \`get_campaign_insights\`
`;
      break;
    }

    case 'quick_optimization': {
      const apiConfigured = isMetaConfigured();

      content = `# Otimização Rápida

${
  apiConfigured
    ? 'Credencial configurada. Confira permissões com diagnose_connection, valide a leitura na conta e reúna os dados antes de propor alterações.'
    : 'Credencial Meta indisponível neste contexto. Consulte o fluxo de conexão do README; a análise ainda depende de dados reais.'
}

## Análise antes de propor alterações

Defina objetivo, margem, ciclo de venda, orçamento autorizado e janela de atribuição. Não existe um corte universal de CTR, CPC ou frequência que justifique pausar uma campanha. Separe observação, hipótese e proposta.

### Campanhas e audiências
- Confira que a consulta está completa para o período e filtros escolhidos
- Compare resultados com metas do negócio e períodos equivalentes
- Avalie volume, atraso de conversão e qualidade comercial antes de interpretar variações
- Apresente os objetos, a mudança exata, limite de gasto e critério de avaliação

### Criativos
- Identifique hipóteses de mensagem e formato a partir dos dados disponíveis
- Prepare variações pausadas somente quando a criação estiver autorizada

## Leituras úteis

\`\`\`
# Ver performance geral
get_account_insights (date_preset: last_7d)

# Examinar campanhas e sua cobertura
list_campaigns (account_id: ID_REAL_DA_CONTA)

# Investigar uma campanha real
get_campaign_insights (campaign_id: ID_REAL_DA_CAMPANHA)
\`\`\`

Pausa, ativação e mudança de orçamento dependem da intenção explícita do usuário para os objetos concretos. Uma hipótese de melhoria não autoriza executar a alteração.
`;
      break;
    }

    default:
      content = `Prompt não encontrado: ${name}`;
  }

  return [
    {
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `${operationContract}\n\n${content}`,
      },
    },
  ];
}

/**
 * Registra handlers de prompts no servidor
 */
export function registerPromptHandlers(server: Server): void {
  // Handler para listar prompts disponíveis
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts };
  });

  // Handler para obter um prompt específico
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const prompt = prompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt não encontrado: ${name}`);
    }

    const messages = await generatePromptContent(name, (args as Record<string, string>) || {});

    return {
      description: prompt.description,
      messages,
    };
  });
}
