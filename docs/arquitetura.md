# Arquitetura

Camadas, dependências, guards, migrations e testes. Voltar ao
[README](../README.md).

**Em resumo:** cada módulo de negócio tem quatro camadas e as dependências
apontam sempre para o domínio. Módulos conversam só pelos casos de uso que
exportam, e um único gateway Socket.io serve a mesa inteira.

---

## Pastas

```text
src/
├── main.ts, app.module.ts     bootstrap e composição: módulos, guards e filtro globais
├── core/
│   ├── config/                validação do ambiente e EnvService tipado
│   ├── database/              opções do TypeORM, migrations e seed das contas
│   ├── health/                GET /api/health e /api/health/db
│   ├── http/                  Helmet, CORS, proxy, limite de corpo e ValidationPipe
│   ├── realtime/              adapter do Socket.io: CORS, origem e limites
│   └── security/              throttlers e @BruteForceProtected()
├── shared/                    DomainError, @Public() e filtro global de exceções
└── modules/
    └── <módulo>/
        ├── domain/            entidades, value objects, políticas, erros e portas
        ├── application/       casos de uso, DTOs de saída e portas técnicas
        ├── infrastructure/    TypeORM, Argon2, JWT, sorteio
        ├── presentation/      controllers, gateway, DTOs de entrada e guards
        └── testing/           dublês em memória
```

| Módulo | Domínio principal | Exporta |
| --- | --- | --- |
| `users` | `User`, `Username`, `UserRole` | `VerifyCredentials`, `GetUserById`, `ProvisionUser` |
| `auth` | sem domínio: só orquestra credencial e token | `AuthenticateAccessToken` |
| `chat` | `ChatMessage`, gramática de dados, `MessagePolicy` | `SendMessage`, `RollDice`, `ListRecentMessages` |
| `sheets` | `CharacterSheet`, `SheetPolicy` | casos de uso das fichas |
| `maps` | mapas, áreas, cena e névoa | casos de uso de mapas e névoa |
| `tabletop` | `Token`, `Drawing`, combate, status, `TokenPolicy` | gateway `/table` |

---

## Regra de dependência

```text
presentation    →  application  →  domain
infrastructure  →  application  →  domain
```

| Camada | Pode | Não pode |
| --- | --- | --- |
| `domain` | TypeScript puro e as invariantes | importar `@nestjs/*`, `typeorm` ou `class-validator` |
| `application` | orquestrar o domínio e declarar portas como classes abstratas | conhecer a implementação das portas |
| `infrastructure` | implementar as portas | conter regra de negócio |
| `presentation` | traduzir HTTP e socket para casos de uso | decidir permissão sozinha |

O módulo NestJS é o único lugar que liga porta e implementação:

```ts
{ provide: UserRepository, useClass: TypeOrmUserRepository },
{ provide: PasswordHasher, useClass: Argon2PasswordHasher },
```

Um módulo exporta casos de uso, nunca repositórios: `auth` pergunta "estas
credenciais valem?" sem ver a tabela `users`, e o hash nunca sai de `users`.

---

## Guards e erros

| Ordem | Guard | Papel |
| --- | --- | --- |
| 1 | `AppThrottlerGuard` | limita antes de gastar CPU com JWT ou Argon2 (só HTTP) |
| 2 | `JwtAuthGuard` | exige token em toda rota sem `@Public()`; no socket, exige o usuário do handshake |
| 3 | `RolesGuard` | confere `@Roles()` |

O `GlobalExceptionFilter` devolve sempre o mesmo corpo:

```json
{ "statusCode": 401, "error": "INVALID_CREDENTIALS", "message": "Usuário ou senha inválidos" }
```

| Categoria do `DomainError` | Status |
| --- | --- |
| `invalid` | 422 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `conflict` | 409 |
| inesperado | 500 genérico; o stack vai só para o log |

No socket, o filtro não alcança o gateway: cada handler responde no próprio ack.

---

## Migrations

Escritas à mão em SQL; as entidades ORM declaram as mesmas regras com os mesmos
nomes (`@Check`, `@Unique`, `@Index` com `where`, nomes de chaves). Antes de
commitar uma mudança de schema, rode o `migration:generate` num banco
atualizado e confira `No changes in database schema were found`. Regra que
existe só na migration seria removida pelo gerador na próxima.

## Criando um módulo

1. Crie `src/modules/<nome>/{domain,application,infrastructure,presentation}`.
2. Entidade, política e porta do repositório em `domain`, sem framework.
3. Casos de uso em `application`, recebendo o ator e as portas.
4. Repositório em `infrastructure/persistence/typeorm`; registre a entidade em
   `core/database/database.options.ts`.
5. Gere a migration e adicione a classe ao array `migrations` do mesmo arquivo.
6. Ligue tudo no módulo e importe-o no `AppModule`.

`tabletop` é o exemplo mais completo. Rotas novas já nascem exigindo token.

---

## Testes

| Tipo | Onde | Como |
| --- | --- | --- |
| Unitário | `src/**/*.spec.ts` | domínio e casos de uso com dublês em memória, sem banco e sem NestJS; o sorteio é roteirizado |
| E2E | `test/*.e2e-spec.ts` | `AppModule` inteiro contra o banco `neuralgrid_test`, com HTTP real e clientes `socket.io-client` |
