# Chamadas Graph específicas

`execute_api` recebe `method` (`GET`, `POST`, `DELETE`), `endpoint` relativo e `params`. A mesma autorização das tools tipadas é aplicada: método, conta selecionada, propriedade do objeto e referências suportadas são verificados antes da chamada.

## Leitura e paginação

```json
{
  "method": "GET",
  "endpoint": "act_ID_AUTORIZADO/campaigns",
  "params": { "fields": "id,name,status", "limit": 25 }
}
```

O resultado inclui a próxima chamada quando a Meta fornece cursor. Reutilize o mesmo endpoint e parâmetros com `after`. URLs de paginação com token não são devolvidas.

## Alteração

```json
{
  "method": "POST",
  "endpoint": "ID_DO_ANUNCIO_AUTORIZADO",
  "params": { "status": "PAUSED" }
}
```

A conexão precisa ter autorizado gerenciamento. A permissão real Meta e a elegibilidade do ativo continuam sendo exigidas pelo provedor. Faça a aprovação da ação no assistente antes de executar.

## Limites no HTTP

Endpoints são nomes relativos com no máximo objeto/edge. Não use URL completa, versão embutida, query no endpoint, batch, `ids`, substituição de método ou `access_token`. Expansões arbitrárias de `fields` são bloqueadas; consulte os objetos separadamente.

O guard tem uma lista explícita de edges operacionais. Uma API nova fora dessa lista pode funcionar na Meta e ainda assim ser negada pela v2. Acrescente a prova de autorização e os testes antes de liberar a edge, em vez de contornar o guard.

Agendamentos de orçamento exigem prova da campanha, disponível nas tools tipadas com `campaign_id`. O caminho genérico não deve operar um ID de agendamento sem essa prova.

Os erros são devolvidos com `isError`. Escritas não são repetidas automaticamente: se ocorrer timeout após envio, consulte o objeto ou os nomes usados antes de tentar novamente, pois a Meta pode ter aplicado a alteração.
