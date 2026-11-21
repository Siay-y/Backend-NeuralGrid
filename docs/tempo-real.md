# Tempo real

Conexão, protocolo, permissões e limites do namespace `/table`. Voltar ao
[README](../README.md).

**Em resumo:** um único gateway Socket.io, autenticado pelo JWT no handshake.
Todo comando passa por DTO e política, responde no ack com `{ ok, data }` ou
`{ ok, error }` e só é transmitido para quem pode ver.

---

## Conexão

```ts
io('https://neuralgrid-api.onrender.com/table', { auth: { token: '<accessToken>' } });
```

| Barreira | Como |
| --- | --- |
| Origem | `AppSocketIoAdapter` recusa `Origin` fora de `CORS_ORIGINS`, inclusive no upgrade para WebSocket |
| Token | `AuthenticateAccessTokenUseCase` confere assinatura, `iss`, `aud`, `exp` e a conta; falha vira `connect_error` `UNAUTHORIZED` |
| Expiração | o socket cai no `exp` do JWT, com `session:expired` |
| Conexões | até 5 por conta; a sexta recebe `session:limit` |
| Salas | cada socket entra em `user:<id>`; o mestre também em `role:master` |

---

## Eventos do cliente

Todos respondem no ack. O cliente envia `token:drag` e `ruler:move` como
notificação volátil, sem esperar a resposta: se a rede engasga, a prévia some.

| Grupo | Eventos | Quem pode |
| --- | --- | --- |
| Tokens | `token:create`, `token:update`, `token:delete` | mestre |
| Tokens | `token:move`, `token:drag` | mestre ou dono |
| Chat | `chat:send`, `dice:roll` | todos |
| Chat | `chat:clear` | mestre |
| Desenho | `drawing:create`, `ruler:move`, `ruler:clear` | todos |
| Desenho | `drawing:erase` | autor ou mestre |
| Desenho | `drawing:clear` | `{ scope: 'mine' }` todos; `'all'` só o mestre |
| Fichas | `sheet:create` | todos (jogador até 5, mesa até 200) |
| Fichas | `sheet:update`, `sheet:delete` | dono ou mestre; tipo, dono e visibilidade só o mestre |
| Mapas e névoa | `map:*`, `area:*`, `fog:*` | mestre (veja [Mapas](mapas.md)) |
| Combate | `combat:join`, `leave`, `update`, `roll`, `start`, `step`, `end` | mestre |
| Combate | `combat:pass` | dono do token da vez |
| Status | `status:apply`, `status:remove`, `death:revive` | mestre |

Os payloads estão nos DTOs de `tabletop/presentation/ws/dtos`. Os principais:

| Evento | Payload |
| --- | --- |
| `token:create` | `{ label, kind, icon?, sex?, hidden?, nameHidden?, emitsLight?, ownerId?, col, row, size? }` |
| `token:move` / `token:drag` | `{ id, col, row }` |
| `chat:send` | `{ text, visibility, recipientId? }` |
| `dice:roll` | `{ expression, label?, visibility, recipientId? }` |
| `combat:step` | `{ step: 1 ou -1, round?, turnId? }` |
| `combat:pass` | `{ tokenId }` |
| `status:apply` | `{ tokenId, kind, turns?, amount?, immuneTo? }` |

## Eventos do servidor

| Evento | Quando |
| --- | --- |
| `table:snapshot` | ao conectar ou reconectar: você, membros, presença, tokens, mensagens, desenhos, fichas, mapas, cena, névoa, combate e status |
| `token:created`, `updated`, `deleted`, `dragged` | tokens mudaram ou estão sendo arrastados |
| `presence:changed` | alguém entrou ou saiu |
| `chat:message`, `chat:cleared` | mensagem nova que você pode ver; chat limpo |
| `drawing:created`, `drawing:erased`, `ruler:moved`, `ruler:cleared` | desenhos e régua |
| `sheet:created`, `updated`, `deleted` | fichas, só para o dono e os mestres |
| `sheet:stats` | HP e defesa públicos de uma ficha, para todos, quando não estão ocultos |
| `map:*`, `scene:changed`, `fog:changed`, `fog:memory` | mapas, cena e névoa |
| `combat:changed` | combate, na visão de quem recebe |
| `status:changed` | status de um token visível |
| `death:event` | alguém caiu, testou, morreu ou voltou |
| `session:expired`, `session:limit` | JWT venceu; conexões demais |

`members` traz só `id`, `displayName` e `role`; login e hash nunca saem.

## Códigos de erro

| Código | Significado |
| --- | --- |
| `INVALID_PAYLOAD` | formato errado ou campo não declarado no DTO |
| `INVALID_TOKEN` | nome vazio, tamanho fora de 1 a 4, posição fora da grade, dono inexistente |
| `TOKEN_FORBIDDEN` / `TOKEN_NOT_FOUND` | sem permissão / token não existe (ou está oculto para você) |
| `INVALID_DICE` | expressão fora da gramática ou dos limites |
| `INVALID_MESSAGE` | texto vazio ou longo, sussurro sem destinatário ou para si |
| `CHAT_FORBIDDEN` | só o mestre limpa o chat de todos |
| `COMBAT_FORBIDDEN` / `INVALID_COMBAT` | só o mestre conduz / iniciativa fora de -99 a 999, mais de 40 participantes, vez que já passou |
| `STATUS_FORBIDDEN` / `INVALID_STATUS` | só o mestre aplica / duração fora de 1 a 99, valor indevido, efeito bloqueado por imunidade |
| `CHARACTER_DEAD` | jogador tentou agir com personagem caído ou morto |
| `RATE_LIMITED` | eventos rápidos demais neste socket |
| `INTERNAL` | erro inesperado, registrado no log |

---

## Tokens

| Campo | Regra |
| --- | --- |
| `kind` | `agent`, `npc` ou `threat` (Agente, NPC, Ameaça) |
| `label` | 1 a 32 caracteres |
| `icon` | id de `TOKEN_ICONS` ou `null` (iniciais) |
| `sex` | `female`, `male`, `other` ou `null` |
| `hidden` | só o mestre vê |
| `nameHidden` | jogadores recebem `???` no lugar do nome |
| `emitsLight` | `true` por padrão; `false` deixa o token no escuro da névoa |
| `ownerId` | um usuário ou `null`; vira `null` se o usuário for removido |
| `col`, `row` / `size` | inteiros de -500 a 500 / 1 a 4 células |
| `version` | começa em 1 e sobe a cada mudança; o último gravado vence |

As regras existem três vezes, de propósito: no DTO, na entidade `Token` e em
`CHECK` no banco.

**Token oculto** não existe para o jogador: não vem no snapshot, esconder um
visível envia `token:deleted`, revelar envia o token inteiro, e mover ou
arrastar responde `TOKEN_NOT_FOUND`, mesmo sendo dono.

---

## Combate

Uma linha na tabela `combat`: `round`, `turn_token_id` e `combatants` em JSONB
(`tokenId`, `initiative`, `hidden`).

| Regra | Como |
| --- | --- |
| Ordem | maior iniciativa primeiro; empate na ordem de entrada; sem valor no fim |
| Rolar | d20 + Mod de Agilidade da ficha, publicado no chat como "Iniciativa · nome" (só para mestres se oculto) |
| Turno | `combat:step` com `round` e `turnId` recusa se a vez já mudou; após o último, volta ao primeiro e soma a rodada |
| Finalizar turno | `combat:pass`: só o dono do token visível que está com a vez |
| Saída | quem sai com a vez passa a vez; token removido sai na hora |
| Fila | `CombatTracker` aplica uma mudança de cada vez |
| Quem vê | entra oculto se o token está oculto ou sem luz na névoa; o jogador só recebe os visíveis, e `turnId` vira `null` se a vez é de quem ele não vê |

## Status

Tabela `token_statuses`, chave `(token_id, kind)`: um status de cada tipo por
token, aplicados em fila pelo `StatusBook`.

| Grupo | Status | Valor |
| --- | --- | --- |
| Debuff | `bleeding`, `poison`, `burning` | dano por turno em dados |
| Debuff | `slow`, `mind-control`, `blind`, `confused`, `death` | nenhum |
| Buff | `regeneration` | cura por turno em dados |
| Buff | `damage-reduction`, `iron-skin` | dados ou número, informativo |
| Buff | `giant`, `invisible`, `haste` | nenhum |
| Buff | `immune` | `immuneTo`: os debuffs bloqueados |

| Regra | Como |
| --- | --- |
| Aplicar de novo | substitui o do mesmo tipo |
| Duração | `turns` de 1 a 99, ou `null` até o mestre remover |
| Início do turno | dano e cura rolados no chat ("Veneno · nome"), duração cai 1, status em 0 sai; uma vez por token por rodada |
| HP | o total ajusta o HP da ficha ligada: dano pode deixar negativo, cura para no máximo |

### Morte

O status `death` com `turns` é queda (as tentativas); sem `turns`, morte de vez.

| Regra | Como |
| --- | --- |
| Queda | HP abaixo de -(Resistência + Mod): Agente e NPC caem com 3 tentativas; Ameaça morre na hora. Imunidade a Morte impede |
| Teste | no início do turno, 1d20: 15 ou mais acorda com 1 de vida; menos gasta uma tentativa; a última falha mata |
| Cura | HP positivo tira a queda; a morte de vez só sai pelo mestre |
| Sem ação | o turno do caído passa sozinho após o teste; o jogador recebe `CHARACTER_DEAD` |
| Mestre | `status:apply` com `death` derruba ou mata; `status:remove` ou `death:revive` revivem com 1 de vida |
| Aviso | `death:event` para os mestres e, se o token é visível, para os jogadores; o teste traz a rolagem para o dono animar |

---

## Chat e dados

| `visibility` | Quem recebe |
| --- | --- |
| `public` | toda a mesa |
| `gm` | o autor e o mestre; rolada pelo mestre, só ele vê |
| `whisper` | o autor e o `recipientId`; o mestre não lê sussurros entre jogadores |

`MessagePolicy.canSee` vale no SQL do histórico e na entrega ao vivo, que usa só
as salas de quem pode ler. O snapshot traz as últimas 100 mensagens visíveis.

### Expressões

Gramática fechada, sem `eval`, normalizada na volta (`3D20KH + 5` vira
`3d20kh1+5`):

| Termo | Exemplo | Significado |
| --- | --- | --- |
| `NdF` | `2d6` | rola e soma |
| `NdFkhK` / `NdFklK` | `3d20kh1` | mantém os K maiores / menores |
| número | `5` | modificador |

| Limite | Valor |
| --- | --- |
| Expressão | 64 caracteres, 12 termos |
| Dados | 1 a 50 por termo, 100 por rolagem |
| Faces / modificador | 2 a 100 / até 999 |

O teste de Ordem Paranormal é só uma expressão: atributo 3 com perícia vira
`3d20kh1+5`; atributo 0 vira `2d20kl1`. O sorteio usa `crypto.randomInt`, sem
viés, e grava cada dado, se foi mantido, os subtotais e o total.

---

## Limites

| Limite | Valor |
| --- | --- |
| Taxa por socket | balde de 30 eventos, recarga de 15 por segundo |
| Pacote | 16 kB (`maxHttpBufferSize`) |
| Texto do chat / nome da rolagem | 500 / 48 caracteres |
| Heartbeat | ping a cada 25 s, queda após 20 s sem resposta |
| Instâncias | uma: presença e taxa ficam em memória; mais exige o adapter de Redis |

## Testes

`test/table.e2e-spec.ts` conecta clientes `socket.io-client` reais numa porta
aleatória e cobre handshake inválido, origem estranha, ciclo dos tokens com três
pessoas, privacidade do chat, rolagens, combate, status, morte, payloads
malformados, presença e limite de taxa.
