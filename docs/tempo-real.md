# Tempo real

Como a mesa conversa ao vivo: conexão, protocolo, permissões e limites. Para a
apresentação do projeto, volte ao [README](../README.md).

## Conexão

O gateway `TableGateway` vive no namespace `/table` do Socket.io, no mesmo
processo e na mesma porta da API HTTP.

```ts
io('https://neuralgrid-api.onrender.com/table', {
  auth: { token: '<accessToken do login>' },
});
```

O handshake passa por três barreiras antes de qualquer evento:

1. **Origem.** O `AppSocketIoAdapter` recusa conexões cujo cabeçalho `Origin`
   não esteja em `CORS_ORIGINS`. A opção `cors` do Socket.io só cobre o long
   polling; a checagem em `allowRequest` cobre também o upgrade para WebSocket.
2. **Token.** Um middleware do namespace chama
   `AuthenticateAccessTokenUseCase`: verifica assinatura, algoritmo, `iss`,
   `aud` e expiração, e confere a conta no banco como no HTTP. Falhou, o cliente
   recebe `connect_error` com a mensagem `UNAUTHORIZED`.
3. **Expiração.** Ao conectar, o servidor agenda a queda do socket para o
   instante do `exp` do JWT e avisa com `session:expired`.

Depois disso, o `JwtAuthGuard` global continua valendo para cada evento: no
contexto `ws` ele exige o usuário resolvido no handshake e recusa qualquer outro
tipo de transporte.

## Protocolo

### Cliente para servidor

Todos respondem pelo callback de ack com `{ ok: true, data }` ou
`{ ok: false, error: { code, message } }`, exceto `token:drag`, que é
fire-and-forget.

| Evento | Quem pode | Payload | Resposta |
| --- | --- | --- | --- |
| `token:create` | mestre | `{ label, kind, ownerId?, col, row, size? }` | token criado |
| `token:update` | mestre | `{ id, label?, kind?, ownerId?, size? }` | token atualizado |
| `token:move` | mestre ou dono | `{ id, col, row }` | token com `version` nova |
| `token:drag` | mestre ou dono | `{ id, col, row }` | nenhuma |
| `token:delete` | mestre | `{ id }` | `{ id }` |
| `chat:send` | todos | `{ text, visibility, recipientId? }` | mensagem gravada |
| `dice:roll` | todos | `{ expression, label?, visibility, recipientId? }` | rolagem gravada |
| `chat:clear` | mestre | nenhum | `{ by, removed }` |

### Servidor para cliente

| Evento | Quando | Payload |
| --- | --- | --- |
| `table:snapshot` | logo após conectar ou reconectar | `{ you, tokens, members, online, messages }` |
| `token:created` | alguém criou um token | token |
| `token:updated` | alguém moveu ou editou | token |
| `token:deleted` | o mestre removeu | `{ id }` |
| `token:dragged` | alguém está arrastando | `{ id, by, col, row }` |
| `presence:changed` | alguém entrou ou saiu | `{ online: string[] }` |
| `session:expired` | o JWT venceu | nenhum |
| `chat:message` | mensagem ou rolagem nova que você pode ver | mensagem |
| `chat:cleared` | o mestre limpou o chat | `{ by, removed }` |

`members` traz só `id`, `displayName` e `role`. O nome de login e o hash nunca
saem do servidor.

### Códigos de erro

| Código | Significado |
| --- | --- |
| `INVALID_PAYLOAD` | formato errado, tipo errado ou campo que o DTO não declara |
| `INVALID_TOKEN` | regra de domínio violada: nome vazio, tamanho fora de 1 a 4, posição fora da grade, dono inexistente |
| `TOKEN_FORBIDDEN` | o papel ou a posse não permitem a ação |
| `TOKEN_NOT_FOUND` | o token não existe mais |
| `INVALID_DICE` | expressão de dados fora da gramática ou dos limites |
| `CHAT_FORBIDDEN` | só o mestre limpa o chat de toda a mesa |
| `INVALID_MESSAGE` | texto vazio ou longo demais, sussurro sem destinatário ou para si mesmo |
| `RATE_LIMITED` | eventos rápidos demais neste socket |
| `INTERNAL` | erro inesperado, registrado no log do servidor |

## Tokens

| Campo | Regra |
| --- | --- |
| `kind` | `agent` (Agente), `npc` ou `threat` (Ameaça), na linguagem de Ordem Paranormal |
| `label` | 1 a 32 caracteres, sem espaços nas pontas |
| `ownerId` | um usuário da mesa ou `null`; se o usuário for removido, vira `null` |
| `col`, `row` | inteiros entre -500 e 500 |
| `size` | 1 a 4 células por lado |
| `version` | começa em 1 e sobe a cada mudança |

As mesmas regras existem três vezes, de propósito: no DTO (mensagem amigável),
na entidade `Token` (invariante do domínio) e em `CHECK` no PostgreSQL (última
linha de defesa).

**Quem move o quê** fica em `TokenPolicy`: o mestre move qualquer token, o
jogador só os que têm o seu `ownerId`. A mesma regra vale para a prévia de
arraste, que não grava nada mas também não deixa um jogador mexer, nem
visualmente, no token de outro.

**Versão.** O servidor é a fonte da verdade e o último movimento gravado vence.
O campo `version` deixa o cliente descartar uma atualização mais velha que
chegue fora de ordem e desfazer só o próprio movimento otimista que foi
recusado.

## Chat e dados

### Quem vê cada mensagem

| `visibility` | Quem recebe |
| --- | --- |
| `public` | toda a mesa |
| `gm` | o autor e o mestre. Rolada pelo mestre, é a rolagem oculta: só ele vê |
| `whisper` | o autor e o `recipientId`. O mestre não lê sussurros entre jogadores |

A regra mora em `MessagePolicy.canSee` e é aplicada duas vezes: na consulta do
histórico, que filtra no SQL, e na entrega ao vivo. Ao conectar, cada socket
entra na sala `user:<id>`, e o mestre também em `role:master`. Mensagens
privadas vão só para essas salas, então o payload nunca chega a quem não pode
lê-lo, nem escondido na rede.

O snapshot traz as últimas 100 mensagens visíveis para quem conectou.

O mestre pode apagar o histórico inteiro com `chat:clear`; todos recebem
`chat:cleared` e esvaziam a tela. Limpar só para si é coisa do cliente: a API
não guarda nada sobre isso.

### Expressões de dados

A gramática é pequena e fechada, sem `eval`:

| Termo | Exemplo | Significado |
| --- | --- | --- |
| `NdF` | `2d6` | rola N dados de F faces e soma |
| `NdFkhK` | `3d20kh1` | mantém os K maiores |
| `NdFklK` | `2d20kl1` | mantém os K menores |
| número | `5` | modificador fixo |

Termos se juntam com `+` e `-`, espaços e maiúsculas são ignorados, e a
expressão volta normalizada (`3D20KH + 5` vira `3d20kh1+5`).

| Limite | Valor |
| --- | --- |
| Tamanho da expressão | 64 caracteres |
| Termos | 12 |
| Dados por termo | 1 a 50 |
| Dados por rolagem | 100 |
| Faces | 2 a 100 |
| Modificador | até 999 |

O teste de Ordem Paranormal é só uma expressão: atributo 3 com perícia treinada
vira `3d20kh1+5`, e atributo 0 vira `2d20kl1`. O frontend monta a expressão; o
servidor não precisa conhecer o sistema para rolar certo.

### Sorteio

`CryptoRandomSource` usa `crypto.randomInt`, que lê do gerador criptográfico do
sistema e não tem viés de módulo. O cliente nunca envia resultado, só a
expressão. A rolagem gravada guarda cada dado, se foi mantido ou descartado, o
subtotal de cada termo e o total, e é isso que todos recebem.

## Limites

- **Taxa por socket.** Balde de 30 eventos que recarrega 15 por segundo. A prévia
  de arraste só é enviada quando o token troca de célula, então um arraste
  normal fica muito abaixo disso.
- **Tamanho de mensagem.** 16 kB por pacote (`maxHttpBufferSize`). Texto do
  chat até 500 caracteres, nome da rolagem até 48.
- **Heartbeat.** Ping a cada 25 segundos, queda após 20 sem resposta.
- **Uma instância.** Presença e contadores de taxa ficam em memória. Para mais
  de uma instância, o Socket.io precisa do adapter de Redis e a presença precisa
  sair do processo.

## Testes

`test/table.e2e-spec.ts` sobe a API numa porta aleatória e conecta clientes reais
do `socket.io-client`. Cobre handshake sem token, token forjado e origem
estranha, snapshot sem credenciais, o ciclo completo de um token com três
pessoas conectadas, a entrega de chat e rolagens só para quem pode ver, o
histórico no snapshot, expressões e sussurros inválidos, payloads malformados,
presença e o limite de taxa.
