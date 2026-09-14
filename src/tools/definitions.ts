/** Human descriptions only. Input schemas and permissions come from the executable registry. */
export const toolDescriptions = [
  { name: 'diagnose_connection', description: 'Diagnostica permissões Meta para Ads, Pages e Instagram, escopo local e contas autorizadas. Permissões presentes não comprovam acesso ao ativo ou liberação pelo provedor. Não refaz autenticação.' },
  { name: 'get_operation_status', description: 'Consulta o recibo durável das escritas pelo request_id desta conexão. inspect permite observar o estado atual de IDs conhecidos; não repita operações pending/unknown.' },
  {
    "name": "discover_ad_accounts",
    "description": "Lista as contas de anúncios autorizadas nesta conexão. Use primeiro para obter os IDs reais das contas (act_...)."
  },
  {
    "name": "list_facebook_pages",
    "description": "Lista as páginas Facebook disponíveis para criar criativos. Não expõe tokens das páginas."
  },
  {
    "name": "get_instagram_account",
    "description": "Obtém a conta Instagram vinculada a uma página Facebook e seu ID para uso nos criativos."
  },
  {
    "name": "list_campaigns",
    "description": "Lista as campanhas da conta, com campos e filtro de status opcionais."
  },
  {
    "name": "get_campaign",
    "description": "Obtém os dados de uma campanha, incluindo orçamento e categorias especiais."
  },
  {
    "name": "create_campaign",
    "description": "Cria uma campanha, sempre pausada. Orçamento no nível da campanha é CBO; informe daily_budget ou lifetime_budget, nunca os dois."
  },
  {
    "name": "update_campaign",
    "description": "Atualiza campos de uma campanha existente. Valores monetários usam a unidade mínima da moeda da conta."
  },
  {
    "name": "pause_campaign",
    "description": "Pausa uma campanha pelo ID."
  },
  {
    "name": "activate_campaign",
    "description": "Ativa uma campanha pelo ID. Uma campanha elegível pode começar a gastar o orçamento configurado."
  },
  {
    "name": "list_adsets",
    "description": "Lista os conjuntos de anúncios da conta, com filtro de status opcional."
  },
  {
    "name": "get_adset",
    "description": "Obtém um conjunto de anúncios, incluindo campanha, orçamento e targeting."
  },
  {
    "name": "create_adset",
    "description": "Cria um conjunto de anúncios, sempre pausado. Informe targeting explícito; use search_geolocation para localizar regiões. Respeita a versão da API e as regras de categoria especial. Lance com teto exige bid_amount."
  },
  {
    "name": "update_adset",
    "description": "Atualiza um conjunto de anúncios. Targeting mantém a opção de audiência existente se você não enviar uma nova escolha."
  },
  {
    "name": "pause_adset",
    "description": "Pausa um conjunto de anúncios pelo ID."
  },
  {
    "name": "activate_adset",
    "description": "Ativa um conjunto de anúncios pelo ID. Pode iniciar entrega e consumo de orçamento."
  },
  {
    "name": "list_ads",
    "description": "Lista os anúncios da conta, com filtro de status opcional."
  },
  {
    "name": "list_campaign_ads",
    "description": "Lista os anúncios de uma campanha."
  },
  {
    "name": "get_ad",
    "description": "Obtém os dados de um anúncio pelo ID."
  },
  {
    "name": "create_ad",
    "description": "Cria um anúncio vinculado a um ad set e a um criativo existente, sempre pausado."
  },
  {
    "name": "update_ad",
    "description": "Atualiza nome, status ou criativo de um anúncio existente."
  },
  {
    "name": "pause_ad",
    "description": "Pausa um anúncio pelo ID."
  },
  {
    "name": "activate_ad",
    "description": "Ativa um anúncio pelo ID. Pode iniciar entrega e consumo de orçamento."
  },
  {
    "name": "list_creatives",
    "description": "Lista os criativos da conta."
  },
  {
    "name": "get_creative",
    "description": "Obtém a especificação de um criativo existente."
  },
  {
    "name": "create_creative",
    "description": "Cria um criativo com object_story_spec ou object_story_id. creative_features_spec é envelopado em degrees_of_freedom_spec. A identidade da página e eventuais autorizações de parceiros precisam existir na Meta."
  },
  {
    "name": "get_account_insights",
    "description": "Consulta métricas da conta por período e dimensões, preservando todas as linhas retornadas. Valores monetários usam a moeda da conta."
  },
  {
    "name": "get_campaign_insights",
    "description": "Consulta métricas de uma campanha por período, dimensões e janelas de atribuição."
  },
  {
    "name": "get_adset_insights",
    "description": "Consulta métricas de um conjunto de anúncios por período, dimensões e janelas de atribuição."
  },
  {
    "name": "get_ad_insights",
    "description": "Consulta métricas de um anúncio por período, dimensões e janelas de atribuição."
  },
  {
    "name": "get_attribution_comparison",
    "description": "Compara as métricas de conversão retornadas pela Meta nas janelas de atribuição solicitadas. Disponibilidade de atribuição incremental depende da conta e da API."
  },
  {
    "name": "get_performance_summary",
    "description": "Resume gasto, conversões, CPA e ROAS da conta quando os dados necessários estão disponíveis. Valores monetários usam a moeda da conta."
  },
  {
    "name": "list_campaign_ads_with_insights",
    "description": "Lista anúncios e consulta métricas da campanha no nível de anúncio, percorrendo páginas automaticamente. Preserva todas as linhas e distingue falha de consulta de ausência de dados."
  },
  {
    "name": "list_custom_audiences",
    "description": "Lista as audiências customizadas da conta, com limites estimados de tamanho."
  },
  {
    "name": "create_custom_audience",
    "description": "Cria uma audiência customizada, de site, aplicativo, engajamento ou semelhante. Os campos necessários dependem do subtipo e da origem dos dados."
  },
  {
    "name": "get_reach_estimate",
    "description": "Consulta a estimativa de alcance de um targeting na conta. Estimativas não garantem entrega."
  },
  {
    "name": "list_pixels",
    "description": "Lista os pixels e datasets disponíveis na conta."
  },
  {
    "name": "upload_image",
    "description": "Baixa uma imagem raster de URL pública e envia os bytes à conta. Limite de 10 MB; redes privadas e redirecionamentos inseguros são bloqueados."
  },
  {
    "name": "get_dataset_quality",
    "description": "Consulta a qualidade de eventos de um pixel ou dataset. Requer disponibilidade e permissões correspondentes na Meta."
  },
  {
    "name": "search_geolocation",
    "description": "Busca países, regiões e cidades para obter keys reais de targeting. Retorna uma página de sugestões por padrão; use after ou pagination_mode all para continuar. Resultados podem se repetir entre páginas. Use cada key somente no tipo de localização correspondente."
  },
  {
    "name": "execute_api",
    "description": "Executa GET, POST ou DELETE em um endpoint Graph permitido, com a mesma permissão e restrição de contas das demais tools. Use também para continuar páginas com after. Tokens, batch e troca do método via params são bloqueados."
  },
  {
    "name": "upload_video",
    "description": "Envia um vídeo de URL pública à Meta para processamento. Consulte get_video_status antes de usar o vídeo no criativo."
  },
  {
    "name": "get_video_status",
    "description": "Consulta o estado de processamento de um vídeo enviado à Meta."
  },
  {
    "name": "create_value_rule_set",
    "description": "Cria um conjunto de regras de valor para otimização de conversões."
  },
  {
    "name": "list_value_rule_sets",
    "description": "Lista os conjuntos de regras de valor da conta."
  },
  {
    "name": "get_value_rule_set",
    "description": "Obtém um conjunto de regras de valor pelo ID."
  },
  {
    "name": "update_value_rule_set",
    "description": "Atualiza nome ou regras de um conjunto de regras de valor."
  },
  {
    "name": "delete_value_rule_set",
    "description": "Exclui um conjunto de regras de valor pelo ID."
  },
  {
    "name": "create_ad_label",
    "description": "Cria um rótulo para organizar os objetos da conta."
  },
  {
    "name": "list_ad_labels",
    "description": "Lista os rótulos da conta."
  },
  {
    "name": "preview_creative",
    "description": "Solicita o HTML de prévia de um criativo no formato escolhido. Prévia não comprova aprovação nem entrega."
  },
  {
    "name": "create_budget_schedule",
    "description": "Cria um agendamento de orçamento de campanha. Informe datas ISO 8601 com fuso e término posterior ao início."
  },
  {
    "name": "get_budget_schedules",
    "description": "Lista os agendamentos de orçamento da campanha."
  },
  {
    "name": "update_budget_schedule",
    "description": "Atualiza valor ou datas de um agendamento de orçamento existente."
  },
  {
    "name": "delete_budget_schedule",
    "description": "Exclui um agendamento de orçamento pelo ID."
  },
  {
    "name": "get_skill",
    "description": "Lê o guia local de operação deste MCP e os fluxos disponíveis."
  },
  {
    "name": "get_playbook",
    "description": "Lê o playbook local de análise e otimização. Recomendações dependem dos objetivos e dados da conta."
  },
  {
    "name": "get_andromeda",
    "description": "Lê o guia local de referência sobre criativos, públicos, sinais e estrutura de campanhas."
  },
  {
    "name": "create_threads_ad_set",
    "description": "Cria um ad set com Instagram Feed e Threads Feed, compartilhando validação e preparação com create_adset. Targeting explícito é obrigatório. Outros placements são substituídos com aviso; status inicial PAUSED."
  },
  {
    "name": "create_click_to_message_ad_set",
    "description": "Cria um ad set para WhatsApp, Messenger ou Instagram Direct, compartilhando validação e preparação com create_adset. Exige targeting e página explícitos. Esta ferramenta exige telefone E.164 para WhatsApp, para evitar selecionar um número implicitamente. Status inicial PAUSED."
  },
  {
    "name": "create_partnership_ad_creative",
    "description": "Cria um criativo de parceria por post Instagram, ad code Facebook ou novo criativo. Instagram aceita media ID ou ad code. Ad codes e ad_format são enviados em branded_content; novo criativo exige ao menos uma identidade de parceiro. Autorizações e elegibilidade são verificadas pela Meta."
  }
];
