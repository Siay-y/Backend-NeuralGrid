# Changelog

Mudanças da API do NeuralGrid, da mais recente para a mais antiga. O projeto
segue [SemVer](https://semver.org/lang/pt-BR/): a versão menor sobe a cada etapa
do roadmap e o patch a cada melhoria ou correção. As notas para os jogadores
ficam na aba Atualizações do
[frontend](https://github.com/Siay-y/Frontend-NeuralGrid).

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
