# Referência rápida do FaceAds MCP v2

Guia curado do projeto. Consulte `tools/list` para os nomes, argumentos e permissões efetivamente disponíveis nesta instalação.

## Hierarquia

Conta de anúncios → campanha → conjunto de anúncios → anúncio → criativo.

Cada operação deve usar IDs reais da conta autorizada. Exemplos de documentação não identificam objetos do usuário.

## Navegação

| Necessidade | Ferramenta |
|---|---|
| Conhecer as seções | `list_sections` |
| Pesquisar em português ou inglês | `search_documentation` |
| Abrir um resultado | `get_document_by_path` |
| Referência de objeto ou endpoint | `get_endpoint_reference` |
| Contexto de código de erro | `get_error_code_info` |
| Identificar contas disponíveis | `discover_ad_accounts` |

## Famílias oficiais

- Marketing API: https://developers.facebook.com/documentation/ads-commerce/marketing-api
- Conversions API: https://developers.facebook.com/documentation/ads-commerce/conversions-api
- Catálogos: https://developers.facebook.com/documentation/ads-commerce/catalog
- Produtos Gateway: https://developers.facebook.com/documentation/ads-commerce/gateway-products
- Conectores de IA para anúncios: https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors

As famílias CAPI e Catalog mantêm os caminhos locais `conversions-api/` e `catalog/`. Um arquivo com `stale: true` foi preservado de coleta anterior e deve ser conferido na fonte antes de embasar uma implementação.

As referências do MCP oficial ficam em `ads-ai-connectors/`. Documentar uma operação não a torna executável no FaceAds: consulte `tools/list` e o schema da conexão. O MCP oficial da Meta possui contrato, permissões e disponibilidade próprios; suas regras não são aplicadas automaticamente pelo FaceAds.

## Operações

| Recurso | Referência de endpoint Graph |
|---|---|
| Campanhas | `/{ad_account_id}/campaigns` |
| Conjuntos | `/{ad_account_id}/adsets` |
| Anúncios | `/{ad_account_id}/ads` |
| Criativos | `/{ad_account_id}/adcreatives` |
| Relatórios | `/{object_id}/insights` |
| Públicos personalizados | `/{ad_account_id}/customaudiences` |

Consulte a versão configurada do servidor e o schema da ferramenta. Uma referência de endpoint não é autorização para uma operação. Acesso, método, campos e combinações aceitas devem ser verificados na conta real.

Leia antes de escrever. Prepare testes com objetos pausados. Não repita uma criação cegamente após timeout e confirme o estado remoto antes de declarar uma alteração concluída.
