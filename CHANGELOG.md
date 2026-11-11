# Changelog

Mudanças da API do NeuralGrid, da mais recente para a mais antiga. O projeto
segue [SemVer](https://semver.org/lang/pt-BR/): a versão menor sobe a cada etapa
do roadmap e o patch a cada melhoria ou correção. As notas para os jogadores
ficam na aba Atualizações do
[frontend](https://github.com/Siay-y/Frontend-NeuralGrid).

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
