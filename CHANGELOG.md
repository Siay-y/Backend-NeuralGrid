# Changelog

Mudanças da API do NeuralGrid, da mais recente para a mais antiga. O projeto
segue [SemVer](https://semver.org/lang/pt-BR/): a versão menor sobe a cada etapa
do roadmap e o patch a cada melhoria ou correção. As notas para os jogadores
ficam na aba Atualizações do
[frontend](https://github.com/Siay-y/Frontend-NeuralGrid).

## 0.6.0 (2026-11-12)

Etapa 6: névoa de guerra.

### Novo

- Tabela `table_settings`, com uma linha só, guardando `fog_enabled` e
  `light_radius` (de 2 a 20 quadrados, 6 por padrão). Migration
  `CreateTableSettings`.
- Evento `fog:update` (só o mestre, `{ enabled?, radius? }`) e `fog:changed`
  para todos. O snapshot traz `fog`. A luz e a escuridão são calculadas no
  navegador, a partir dos tokens que têm dono.

## 0.5.0 (2026-11-11)

Etapa 5: mapas.

### Novo

- Módulo `maps`, com as imagens guardadas no próprio Postgres (`bytea`). Um
  mapa (`maps`) reúne várias áreas (`map_areas`), cada uma com a própria
  imagem, posição, escala e a opção de ficar oculta. Migration `CreateMaps`.
  Não exige serviço nem segredo novo.
- `POST /api/maps` cria um mapa com a primeira área e `POST /api/maps/:id/areas`
  adiciona uma área (só o mestre, multipart com `name`, `image`, `thumbnail` e,
  opcionais, `centerCol` e `centerRow`, 10 envios por minuto). O tipo vem dos
  bytes, nunca do nome ou do MIME declarado: só PNG, JPEG e WebP estático
  passam, com até 3 MB e 8192 px de lado. Até 40 mapas, 12 áreas por mapa e
  300 MB no total.
- Novas áreas chegam ocultas para os jogadores, para o mestre posicionar antes
  de revelar.
- `GET /api/maps/areas/:id/image` e `GET /api/maps/areas/:id/thumbnail`, com
  `Cache-Control: private, immutable` e `Content-Security-Policy:
  default-src 'none'`. Jogador só recebe as áreas visíveis do mapa na mesa, e
  miniaturas são só do mestre.
- Eventos `map:rename`, `map:activate`, `map:delete`, `area:update` e
  `area:delete` (só o mestre), e `map:created`, `map:updated`, `map:deleted` e
  `scene:changed`. A cena dos jogadores leva só as áreas visíveis, sem nomes.
- Cache em memória de 32 MB para as imagens, para uma troca de cena custar
  uma leitura no banco em vez de uma por jogador.

## 0.4.2 (2026-11-11)

Desempenho do tempo real e reforço de segurança.

### Melhorias

- O Socket.io comprime com `perMessageDeflate` as mensagens acima de 1 kB. O
  snapshot de uma mesa com 60 desenhos caiu de 213 kB para cerca de 57 kB, e
  os eventos pequenos, como arrastar e régua, seguem sem compressão.

### Segurança

- O limite de login por conta passou para o `LoginAttemptLimiter` e só conta
  erros de senha, por IP. Login certo não soma mais, então várias abas não
  bloqueiam o jogador, e quem souber o nome de usuário do mestre não consegue
  mais trancá-lo para fora: com 5 erros na conta, só os IPs que erraram ficam
  bloqueados. O throttler `login-account` saiu.
- Cada conta abre no máximo 5 conexões de tempo real ao mesmo tempo. A sexta
  recebe `session:limit` e é derrubada.
- `GET /api/health` não consulta mais o banco, e o Neon pode dormir mesmo com
  alguém chamando a API. A checagem do banco foi para `GET /api/health/db`,
  com limite de 30 chamadas por minuto por IP.

## 0.4.1 (2026-11-11)

Destreza e visibilidade controlada pela ficha.

### Novo

- Atributo `dexterity` (Destreza), de 0 a 30, também aceito como atributo de
  ataque das armas. Fichas salvas antes dele leem 10.
- Campos `hidden` e `nameHidden` na ficha, que só o mestre muda (migration
  `AddSheetVisibility`). O token ligado recebe as duas flags da ficha na
  criação, na edição e ao ligar, e esconder pela ficha tira o token da tela dos
  jogadores na hora.
- Campo `statsHidden` na ficha, ligado por padrão e só o mestre muda (migration
  `AddSheetStatsVisibility`). Com ele desligado, e a ficha sem nome ou token
  escondido, a mesa recebe só o HP e a Defesa dela: no snapshot (`sheetStats`)
  e no evento `sheet:stats`, que leva `null` quando volta a esconder ou a ficha
  é apagada. O resto da ficha continua só com o mestre e o dono.

## 0.4.0 (2026-11-10)

Etapa 4: fichas de personagem.

### Novo

- Módulo `sheets`, com a tabela `character_sheets`: dono, tipo (`token_kind`),
  nome e os dados da ficha em `jsonb`, validados no domínio. Campos fora do
  formato são descartados e valores fora das regras são recusados.
- Ficha em cinco seções: identidade (nome, codinome, idade, gênero e classe
  livre), status (HP, XP, movimento, dinheiro, armadura e carga máxima), sete
  atributos de 0 a 30, onze habilidades com bônus livre de −20 a +20, e
  equipamentos (armas com atributo, bônus e dano em dados,
  armaduras com defesa e bônus, itens com quantidade e peso).
- Fichas gravadas num formato antigo são lidas com os valores padrão em vez de
  derrubar a mesa.
- Eventos `sheet:create`, `sheet:update` e `sheet:delete`. A atualização troca
  só as seções enviadas. `sheet:created`, `sheet:updated` e `sheet:deleted`
  vão só para o mestre e para o dono; quem perde a ficha recebe
  `sheet:deleted`.
- Jogadores criam fichas próprias, até 5 cada, e só veem as suas. O mestre vê
  todas, cria NPCs e ameaças e muda o tipo e o dono. A mesa aceita até 200
  fichas.
- Fichas no snapshot, conforme quem conectou.
- Campo `sheetId` no token, validado na criação e na edição. Apagar a ficha
  deixa o token sem vínculo. Jogadores não recebem o vínculo de um token com
  nome oculto.
- A ficha manda no token ligado: nome (codinome ou nome), tipo, sexo e dono vêm
  dela na criação, na edição e ao ligar. Quando a ficha muda essas informações,
  os tokens ligados são atualizados e a mesa recebe `token:updated`.
- Migration `CreateCharacterSheets`, aplicada sozinha no boot.

## 0.3.3 (2026-11-10)

Desenhos, régua, token incógnito e limite de envios.

### Novo

- Tabela `drawings` com forma (`free`, `arrow`, `rect`, `ellipse`), cor de uma
  paleta fechada, espessura (2, 4 ou 8) e pontos em células, arredondados em
  duas casas. Até 1000 pontos por traço e 500 desenhos por mesa.
- Eventos `drawing:create`, `drawing:erase` e `drawing:clear`, com
  `drawing:created` e `drawing:erased` para o resto da mesa. Jogadores apagam
  só os próprios desenhos; o mestre apaga qualquer um e pode limpar todos.
- Desenhos no snapshot, na ordem em que foram feitos.
- Régua ao vivo: `ruler:move` e `ruler:clear` repassam `ruler:moved` e
  `ruler:cleared` aos outros, sem gravar nada.
- Migration `CreateDrawings`, aplicada sozinha no boot.

### Melhorado

- Cada pessoa tem uma reserva de 4 envios para `chat:send` e outra para
  `dice:roll`, recarregada a 1 a cada 2 segundos. Vale para todas as abas da
  mesma conta. Passou disso, a resposta é `COOLDOWN` com `retryAfterMs`, e nada
  é gravado.
- O histórico do chat guarda as 500 mensagens mais recentes. A limpeza roda a
  cada 20 envios e no primeiro envio depois do boot.

### Corrigido

- Com `nameHidden`, os jogadores recebem o token sem identidade: nome `???`,
  tipo neutro `npc`, ícone e sexo nulos. Antes só o nome era escondido.

## 0.3.2 (2026-11-10)

Sexo e nome oculto.

### Novo

- Campo `sex` no token: `female`, `male`, `other` ou `null`, guardado no enum
  `token_sex`.
- Campo `nameHidden`: os jogadores recebem `???` no lugar do nome, no snapshot,
  nos eventos e na resposta do próprio movimento. O nome real nunca sai do
  servidor para eles; o mestre continua recebendo tudo.
- Migration `AddTokenSexAndNameVisibility`, aplicada sozinha no boot.

## 0.3.1 (2026-11-10)

Ícones e tokens ocultos.

### Novo

- Campo `icon` no token, validado contra uma lista fechada de ícones.
- Campo `hidden`: o token só existe para o mestre até ser revelado. Jogadores
  não o recebem no snapshot nem nos eventos, e mover ou arrastar um token oculto
  responde `TOKEN_NOT_FOUND`, mesmo para o dono.
- Ao esconder um token visível, os jogadores recebem `token:deleted`; ao
  revelar, recebem `token:updated` com o token inteiro.
- Migration `AddTokenIconAndVisibility`, aplicada sozinha no boot.

## 0.3.0 (2026-11-10)

Dados e chat.

### Novo

- Módulo `chat`, com mensagens e rolagens gravadas na tabela `chat_messages`.
- Gramática de dados própria: `NdF`, `khK`, `klK` e modificadores, com limites
  de tamanho, faces e quantidade.
- Sorteio no servidor com `crypto.randomInt`; o cliente envia só a expressão.
- Eventos `chat:send`, `dice:roll` e `chat:message`, e as últimas 100 mensagens
  visíveis no snapshot.
- Visibilidade `public`, `gm` (rolagem oculta ou só para o mestre) e `whisper`.
  Mensagens privadas vão só para as salas de quem pode lê-las.
- Evento `chat:clear`, só para o mestre, que apaga o histórico e avisa a mesa
  com `chat:cleared`.
- Migration `CreateChatMessages`, aplicada sozinha no boot.

## 0.2.0 (2026-11-10)

Mesa ao vivo.

### Novo

- Namespace Socket.io `/table`, autenticado pelo mesmo JWT no handshake.
- Tokens de Agente, NPC e Ameaça persistidos no PostgreSQL, com versão para
  descartar eventos fora de ordem.
- Permissões no servidor: o mestre cria, edita e remove; cada jogador move só
  os próprios tokens.
- Prévia de arraste repassada aos outros jogadores sem gravar no banco.
- Presença: quem está conectado entra no snapshot e em cada mudança.
- Limite de taxa por socket e desconexão no instante em que o token expira.
- Migration `CreateTokens`, aplicada sozinha no boot.

### Melhoria

- Guards globais preparados para o contexto WebSocket.
- Entidades ORM declaram as mesmas regras das migrations, e o
  `migration:generate` não acusa diferença.

## 0.1.0 (2026-11-10)

Primeira mesa.

### Novo

- Login com Argon2id, JWT HS256 com `iss` e `aud`, e `GET /api/auth/me`.
- Proteção contra força bruta por IP e por conta.
- Seed das contas da mesa, sem cadastro público.
- Health check em `/api/health` e deploy no Render com Neon ou Supabase.
