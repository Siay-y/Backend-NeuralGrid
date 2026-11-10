# Arquitetura

A API segue Clean Architecture organizada por módulo. Cada módulo de negócio tem
as próprias camadas, e o que é transversal ao framework fica em `core/`. Para a
apresentação do projeto, volte ao [README](../README.md).

## Árvore de diretórios

```text
backend-neural-grid/
├── docker-compose.yml                 PostgreSQL 18 local
├── docker/postgres/init/              cria o banco neuralgrid_test
├── .env.example                       contrato de configuração
├── docs/
├── test/                              testes e2e (*.e2e-spec.ts)
└── src/
    ├── main.ts                        bootstrap HTTP
    ├── app.module.ts                  raiz de composição
    │
    ├── core/                          infraestrutura sem regra de negócio
    │   ├── config/
    │   │   ├── env.validation.ts      schema do ambiente com class-validator
    │   │   ├── env.service.ts         leitura tipada: env.get('PORT') é number
    │   │   └── duration.ts            "8h" para segundos
    │   ├── database/
    │   │   ├── database.options.ts    opções compartilhadas por app, CLI e seed
    │   │   ├── data-source.ts         DataSource da CLI do TypeORM
    │   │   ├── migrations/
    │   │   └── seeds/seed-users.ts    provisionamento das contas da mesa
    │   ├── health/                    GET /api/health
    │   ├── http/configure-http.ts     Helmet, CORS, proxy, body limit, pipes
    │   ├── realtime/                  AppSocketIoAdapter e configureRealtime
    │   └── security/                  throttlers e @BruteForceProtected()
    │
    ├── shared/
    │   ├── domain/errors/             DomainError e suas categorias
    │   └── presentation/http/
    │       ├── decorators/            @Public()
    │       └── filters/               DomainError e HttpException para JSON
    │
    └── modules/
        ├── users/
        │   ├── domain/
        │   │   ├── entities/          User
        │   │   ├── value-objects/     Username, UserRole
        │   │   ├── errors/
        │   │   └── repositories/      UserRepository (porta)
        │   ├── application/
        │   │   ├── ports/             PasswordHasher
        │   │   ├── dtos/              UserView, sem hash
        │   │   └── use-cases/         VerifyCredentials, GetUserById, ListUsers, ProvisionUser
        │   ├── infrastructure/
        │   │   ├── crypto/            Argon2PasswordHasher
        │   │   └── persistence/typeorm/
        │   ├── testing/               dublês em memória para os testes
        │   └── users.module.ts
        │
        ├── auth/
        │   ├── application/
        │   │   ├── ports/             AccessTokenIssuer, AccessTokenVerifier
        │   │   ├── dtos/              AccessTokenClaims, AuthSession
        │   │   ├── errors/            InvalidCredentials, InvalidSession
        │   │   └── use-cases/         Login, ResolveSessionUser, AuthenticateAccessToken
        │   ├── infrastructure/jwt/    JwtAccessTokenIssuer, JwtAccessTokenVerifier
        │   ├── presentation/http/
        │   │   ├── controllers/       AuthController
        │   │   ├── decorators/        @Roles(), @CurrentUser()
        │   │   ├── dtos/              LoginRequestDto
        │   │   ├── guards/            JwtAuthGuard, RolesGuard (http e ws)
        │   │   ├── strategies/        JwtStrategy (Passport)
        │   │   └── request-user.ts    lê o usuário em contexto http ou ws
        │   └── auth.module.ts
        │
        ├── chat/
        │   ├── domain/
        │   │   ├── dice/              gramática de dados e rolagem, sem I/O
        │   │   ├── entities/          ChatMessage
        │   │   ├── value-objects/     MessageVisibility
        │   │   ├── policies/          MessagePolicy: quem vê cada mensagem
        │   │   ├── errors/
        │   │   └── repositories/      ChatMessageRepository (porta)
        │   ├── application/
        │   │   ├── ports/             RandomSource
        │   │   ├── dtos/              MessageView
        │   │   ├── services/          MessageAudienceValidator
        │   │   └── use-cases/         SendMessage, RollDice, ListRecentMessages
        │   ├── infrastructure/
        │   │   ├── random/            CryptoRandomSource
        │   │   └── persistence/typeorm/
        │   ├── testing/               repositório em memória e sorteio roteirizado
        │   └── chat.module.ts
        │
        └── tabletop/
            ├── domain/
            │   ├── entities/          Token
            │   ├── value-objects/     TokenKind, GridPosition
            │   ├── policies/          TokenPolicy: quem cria, edita e move
            │   ├── errors/
            │   └── repositories/      TokenRepository (porta)
            ├── application/
            │   ├── dtos/              TokenView
            │   ├── services/          TokenOwnerValidator
            │   └── use-cases/         ListTokens, CreateToken, UpdateToken, MoveToken,
            │                          AuthorizeTokenDrag, DeleteToken
            ├── infrastructure/persistence/typeorm/
            ├── presentation/ws/
            │   ├── table.gateway.ts   handshake, snapshot, salas, eventos e broadcast
            │   ├── dtos/              DTOs dos eventos de tokens, chat e dados
            │   ├── presence-tracker.ts
            │   ├── socket-rate-limiter.ts
            │   └── ws-payload.ts      validação de payload e formato do ack
            ├── testing/
            └── tabletop.module.ts
```

O módulo `auth` não tem camada `domain`: ele não guarda estado próprio. As
regras de identidade vivem em `users`, e `auth` só orquestra credencial e token.

## Regra de dependência

As setas apontam sempre para dentro:

```text
presentation  →  application  →  domain
infrastructure  →  application  →  domain
```

- **`domain`** é TypeScript puro. Não importa `@nestjs/*`, `typeorm` nem
  `class-validator`. Aqui ficam as invariantes, como "o nome de usuário só existe
  normalizado" e "o papel é `master` ou `player`".
- **`application`** orquestra o domínio e declara as portas de que precisa
  (`UserRepository`, `PasswordHasher`, `AccessTokenIssuer`) como classes
  abstratas. A classe abstrata serve ao mesmo tempo de contrato e de token de
  injeção, sem `@Inject('STRING')` espalhado.
- **`infrastructure`** implementa as portas com ferramentas concretas.
- **`presentation`** traduz HTTP para casos de uso e de volta.

O módulo NestJS de cada contexto é o único lugar que liga porta e implementação:

```ts
{ provide: UserRepository, useClass: TypeOrmUserRepository },
{ provide: PasswordHasher, useClass: Argon2PasswordHasher },
```

Trocar Argon2 por outro algoritmo, ou TypeORM por outro ORM, mexe só nessas
linhas e na pasta `infrastructure` correspondente.

## Comunicação entre módulos

Um módulo só enxerga o que o outro exporta. `UsersModule` exporta casos de uso,
nunca o repositório:

```ts
exports: [VerifyCredentialsUseCase, GetUserByIdUseCase, ProvisionUserUseCase],
```

Assim `auth` pergunta "estas credenciais são válidas?" sem saber que existe uma
tabela `users`, e o hash da senha nunca sai do módulo: os casos de uso devolvem
`UserView`, que não tem esse campo.

O mesmo vale para `chat`: ele exporta `SendMessage`, `RollDice` e
`ListRecentMessages`, e o `TableGateway` de `tabletop` os chama. Existe um único
gateway no namespace `/table`, com um único handshake, e cada módulo cuida só
das próprias regras.

## Guards e filtro globais

A ordem de registro em `app.module.ts` é a ordem de execução:

1. `AppThrottlerGuard`: limita antes de gastar CPU com JWT ou Argon2.
2. `JwtAuthGuard`: exige token em toda rota sem `@Public()`.
3. `RolesGuard`: confere `@Roles()` quando a rota declara papéis.

O `GlobalExceptionFilter` transforma qualquer erro no mesmo formato:

```json
{ "statusCode": 401, "error": "INVALID_CREDENTIALS", "message": "Usuário ou senha inválidos" }
```

Erros de domínio declaram uma categoria (`invalid`, `unauthorized`, `forbidden`,
`not_found`, `conflict`) e o filtro escolhe o status. Erros inesperados viram
`500` com mensagem genérica, e o stack vai só para o log.

Os guards globais rodam também nos eventos de WebSocket. Por isso o throttler
HTTP pula o contexto `ws` e o `JwtAuthGuard` tem um ramo próprio para ele. Os
filtros globais não alcançam o gateway: lá, cada handler devolve o próprio
resultado no ack. O desenho completo está em [Tempo real](tempo-real.md).

## Entidades ORM e migrations

As migrations são escritas à mão, em SQL, e as entidades ORM declaram as mesmas
regras com os mesmos nomes: `@Check`, `@Unique`, `@Index` com `where`, nome da
chave primária e da chave estrangeira. Assim o `migration:generate` compara
entidade e banco e não encontra diferença nenhuma.

Se uma regra existir só na migration, o gerador entende que ela sobra e propõe
removê-la na próxima migration. Antes de commitar uma mudança de schema, rode o
gerador contra um banco atualizado e confira que ele responde
`No changes in database schema were found`.

## Criando um módulo

O módulo `tabletop` é o exemplo mais completo a seguir:

1. Crie `src/modules/<nome>/{domain,application,infrastructure,presentation}`.
2. Escreva a entidade, a política e a porta do repositório em `domain`, sem framework.
3. Escreva os casos de uso em `application`, recebendo o ator e as portas.
4. Implemente o repositório em `infrastructure/persistence/typeorm` e registre a
   entidade ORM em `core/database/database.options.ts`.
5. Gere a migration com `npm run migration:generate -- src/core/database/migrations/Nome`
   e adicione a classe gerada ao array `migrations` do mesmo arquivo.
6. Ligue tudo no módulo e importe-o no `AppModule`.

Rotas novas já nascem exigindo token. Para restringir ao mestre, basta
`@Roles('master')`.

## Testes

- **Unitários** (`src/**/*.spec.ts`): entidades, políticas e casos de uso com os
  dublês em memória de `modules/*/testing`, sem banco e sem NestJS. A rolagem
  recebe o sorteio por parâmetro, então os testes de dados usam valores
  roteirizados e conferem o resultado exato.
- **E2E** (`test/*.e2e-spec.ts`): sobem o `AppModule` inteiro contra o banco
  `neuralgrid_test`. `auth.e2e-spec.ts` percorre o pipeline HTTP, incluindo
  throttling e token adulterado; `table.e2e-spec.ts` conecta clientes Socket.io
  reais e cobre o ciclo completo dos tokens. Variáveis próprias podem ir num
  `.env.test`.
