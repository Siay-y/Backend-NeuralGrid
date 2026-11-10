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
        │   │   └── use-cases/         VerifyCredentials, GetUserById, ProvisionUser
        │   ├── infrastructure/
        │   │   ├── crypto/            Argon2PasswordHasher
        │   │   └── persistence/typeorm/
        │   ├── testing/               dublês em memória para os testes
        │   └── users.module.ts
        │
        └── auth/
            ├── application/
            │   ├── ports/             AccessTokenIssuer
            │   ├── dtos/              AccessTokenClaims, AuthSession
            │   ├── errors/            InvalidCredentials, InvalidSession
            │   └── use-cases/         Login, ResolveSessionUser
            ├── infrastructure/jwt/    JwtAccessTokenIssuer
            ├── presentation/http/
            │   ├── controllers/       AuthController
            │   ├── decorators/        @Roles(), @CurrentUser()
            │   ├── dtos/              LoginRequestDto
            │   ├── guards/            JwtAuthGuard, RolesGuard
            │   ├── strategies/        JwtStrategy (Passport)
            │   └── request-user.ts    lê o usuário em contexto http ou ws
            └── auth.module.ts
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

## Criando um módulo

Para a Etapa 2, um módulo `tables` seguiria o mesmo desenho:

1. Crie `src/modules/tables/{domain,application,infrastructure,presentation}`.
2. Escreva a entidade e a porta do repositório em `domain`, sem framework.
3. Escreva os casos de uso em `application`, recebendo portas no construtor.
4. Implemente o repositório em `infrastructure/persistence/typeorm` e registre a
   entidade ORM em `core/database/database.options.ts`.
5. Gere a migration com `npm run migration:generate -- src/core/database/migrations/CreateTables`
   e adicione a classe gerada ao array `migrations` do mesmo arquivo.
6. Ligue tudo em `tables.module.ts` e importe o módulo no `AppModule`.

Rotas novas já nascem exigindo token. Para restringir ao mestre, basta
`@Roles('master')`.

## Testes

- **Unitários** (`src/**/*.spec.ts`): casos de uso com os dublês de
  `modules/users/testing`, sem banco e sem NestJS.
- **E2E** (`test/*.e2e-spec.ts`): sobem o `AppModule` inteiro contra o banco
  `neuralgrid_test` e percorrem o pipeline HTTP real, incluindo throttling e
  rejeição de token adulterado. Variáveis próprias podem ir num `.env.test`.
