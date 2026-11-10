<p align="center">
  <a href="https://nestjs.com/"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS" /></a>
</p>

<h1 align="center">NeuralGrid API | Luiz Santos</h1>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12.4-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 12.4" />
  <img src="https://img.shields.io/badge/Node.js-24.18-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24.18" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <br />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
  <img src="https://img.shields.io/badge/TypeORM-1.1-FE0803?style=for-the-badge&logo=typeorm&logoColor=white" alt="TypeORM 1.1" />
  <img src="https://img.shields.io/badge/Argon2id-0.45-000000?style=for-the-badge&logoColor=white" alt="Argon2id 0.45" />
  <br />
  <img src="https://img.shields.io/badge/JWT-12.0-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT 12.0" />
  <img src="https://img.shields.io/badge/Passport-12.0-34E27A?style=for-the-badge&logo=passport&logoColor=white" alt="Passport 12.0" />
  <img src="https://img.shields.io/badge/Throttler-6.7-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="Throttler 6.7" />
  <br />
  <img src="https://img.shields.io/badge/Jest-30.5-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest 30.5" />
  <img src="https://img.shields.io/badge/Oxlint-1.93-00F7F1?style=for-the-badge&logo=oxc&logoColor=white" alt="Oxlint 1.93" />
  <img src="https://img.shields.io/badge/Prettier-3.9-F7B93E?style=for-the-badge&logo=prettier&logoColor=white" alt="Prettier 3.9" />
  <img src="https://img.shields.io/badge/Render-deploy-000000?style=for-the-badge&logo=render&logoColor=white" alt="Publicado no Render" />
</p>

API do NeuralGrid, um Virtual Tabletop privado para uma mesa de quatro pessoas:
o mestre e três jogadores. Construída em NestJS 12, cuida da autenticação, da
mesa em tempo real e das fichas dos personagens.

Não existe cadastro público nem recuperação de senha. As contas nascem por um
script de seed, e a segurança está presente desde o primeiro commit: hash
Argon2id, JWT assinado, limite de tentativas por IP e por conta e rotas
fechadas por padrão.

O cliente Angular vive em
[Frontend-NeuralGrid](https://github.com/Siay-y/Frontend-NeuralGrid).

---

## Visão geral

| Característica | Implementação |
| --- | --- |
| Arquitetura | Clean Architecture por módulo, domínio isolado de framework e banco |
| Autenticação | JWT HS256 com `iss` e `aud` fixos, validado por Passport e `JwtStrategy` |
| Senhas | Argon2id com os parâmetros mínimos da OWASP (19 MiB, 2 iterações) |
| Força bruta | Throttler com três limites: global, por IP no login e por conta no login |
| Autorização | Guard global fail-closed, `@Public()` explícito e `@Roles('master', 'player')` |
| Tempo real | Socket.io no namespace `/table`, autenticado no handshake pelo mesmo JWT |
| Tokens | Agentes, NPCs e ameaças com posse, versão e permissões checadas no servidor |
| Validação | DTOs com `class-validator`, campos desconhecidos rejeitados com `400` |
| Erros | Filtro global com corpo único `{ statusCode, error, message }` |
| Banco | PostgreSQL com migrations versionadas, regras repetidas em `CHECK` |

---

## Funcionalidades

- **Login que não entrega nada de graça.** Usuário inexistente e senha errada
  respondem a mesma mensagem, no mesmo tempo: quando a conta não existe, a API
  ainda verifica um hash fictício para não denunciar quais nomes são válidos.
- **Força bruta bloqueada em duas frentes.** Um IP que erra dez vezes em dez
  minutos fica 15 minutos bloqueado. Uma conta que recebe cinco tentativas em
  15 minutos também, mesmo vindas de IPs diferentes. A resposta `429` traz o
  cabeçalho `Retry-After` com os segundos restantes.
- **Token que se invalida sozinho.** O JWT carrega `id`, `username` e `role`, e
  cada requisição confere esses dados contra o banco. Remover uma conta ou mudar
  o papel de alguém derruba os tokens emitidos antes da mudança.
- **Toda rota nasce protegida.** O guard JWT é global. Para abrir uma rota é
  preciso marcá-la com `@Public()`, de propósito.
- **Seed sem senha no repositório.** O script gera senhas aleatórias de 24
  caracteres, grava apenas o hash e mostra cada senha uma única vez no terminal.
- **Mesa ao vivo.** O mestre cria, edita e remove tokens; cada jogador move só
  os seus. Enquanto alguém arrasta, os outros veem a prévia célula a célula, e
  a posição final é gravada no banco com número de versão.
- **O servidor decide.** Toda ação pelo socket passa pela mesma validação de
  DTO, pela mesma política de permissão e responde com `{ ok, data }` ou
  `{ ok, error }`. Nenhuma regra mora só no cliente.
- **Presença e sessão.** A mesa sabe quem está conectado, e o socket cai sozinho
  quando o JWT expira.

---

## Arquitetura

Cada módulo de negócio tem suas camadas: `domain` (regras puras, sem NestJS),
`application` (casos de uso e portas), `infrastructure` (TypeORM, Argon2, JWT) e
`presentation` (controllers, DTOs, guards). O que é transversal ao framework
fica em `core/`, e os blocos reutilizáveis entre módulos em `shared/`.

```text
src/
├── main.ts                       bootstrap HTTP
├── app.module.ts                 raiz de composição: módulos, guards e filtro globais
├── core/
│   ├── config/                   validação do ambiente e EnvService tipado
│   ├── database/                 opções do TypeORM, migrations e seed
│   ├── health/                   GET /api/health
│   ├── http/                     Helmet, CORS, proxy, body limit e ValidationPipe
│   ├── realtime/                 adapter do Socket.io: CORS, origem e limites
│   └── security/                 throttlers e guard que emite Retry-After
├── shared/
│   ├── domain/errors/            DomainError: base de todo erro de negócio
│   └── presentation/http/        @Public() e filtro global de exceções
└── modules/
    ├── users/                    identidade, credenciais e hash de senha
    ├── auth/                     login, emissão e verificação de JWT, guards
    └── tabletop/                 tokens, permissões, presença e gateway /table
```

A árvore completa, a regra de dependência entre camadas e como criar um novo
módulo estão em [docs/arquitetura.md](docs/arquitetura.md).

---

## Variáveis de ambiente

Toda a configuração vem de variáveis de ambiente, descritas em
[`.env.example`](.env.example) e validadas no boot. Se algo estiver errado, a API
não sobe e lista cada problema.

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `PORT` | Não | `3000` | Porta HTTP. O Render injeta a dele |
| `CORS_ORIGINS` | Sim | | Origens aceitas, separadas por vírgula, no formato `protocolo://host[:porta]` |
| `TRUST_PROXY_HOPS` | Não | `0` | Quantos proxies confiáveis existem na frente da API. Use `1` no Render |
| `DATABASE_URL` | Sim | | URL `postgres://` do banco |
| `DATABASE_SSL_MODE` | Não | `verify` | `disable`, `require` (cifra sem validar a CA) ou `verify` (cifra e valida) |
| `JWT_SECRET` | Sim | | Segredo de assinatura, no mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | Não | `8h` | Validade do token: `30m`, `8h`, `1d` |
| `JWT_ISSUER` | Não | `neuralgrid-api` | Valor de `iss` emitido e exigido |
| `JWT_AUDIENCE` | Não | `neuralgrid-web` | Valor de `aud` emitido e exigido |
| `SEED_USERS` | Só no seed | | Contas da mesa, no formato `usuario:Nome:papel`, separadas por vírgula |

Gere o `JWT_SECRET` com:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

O parâmetro `sslmode` da `DATABASE_URL` é descartado de propósito: quem decide o
TLS é `DATABASE_SSL_MODE`, para a URL copiada do painel do Neon ou do Supabase
não sobrescrever a configuração em silêncio.

---

## Execução local

Requer Node.js 24.18 ou superior e Docker com Docker Compose v2.

```bash
git clone https://github.com/Siay-y/Backend-NeuralGrid.git
cd Backend-NeuralGrid
npm ci
cp .env.example .env
```

Preencha o `JWT_SECRET` no `.env` e ajuste `SEED_USERS` com os nomes da mesa.
Depois suba o banco, crie as contas e inicie a API:

```bash
npm run db:up
npm run seed
npm run start:dev
```

O seed imprime uma tabela com a senha de cada conta. Ela não fica gravada em
lugar nenhum, então entregue cada uma por um canal privado. Rodar o seed de
novo mantém as contas existentes; `npm run seed:reset` gera senhas novas.

A API responde em `http://localhost:3000/api`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mestre","password":"<senha do seed>"}'
```

> **Sem Docker?** Qualquer PostgreSQL 14 ou superior serve. Aponte a
> `DATABASE_URL` para ele e mantenha `DATABASE_SSL_MODE=disable` se a conexão
> for local.

---

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe o banco e inicia a API em modo observador |
| `npm run start:dev` | Só a API em modo observador |
| `npm run db:up` / `db:down` | Sobe ou derruba o PostgreSQL do Docker Compose |
| `npm run seed` | Cria as contas de `SEED_USERS` que ainda não existem |
| `npm run seed:reset` | Gera senhas novas para todas as contas de `SEED_USERS` |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:generate -- src/core/database/migrations/Nome` | Gera uma migration a partir das entidades |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de ponta a ponta contra o banco `neuralgrid_test` |
| `npm run lint` | Oxlint com checagem de tipos |
| `npm run build` | Compila para `dist/` |

A API aplica as migrations pendentes sozinha ao iniciar, então o deploy não
depende de um passo manual.

---

## Deploy no Render

O banco fica no [Neon](https://neon.tech) ou no [Supabase](https://supabase.com),
e a API num Web Service do Render.

1. Crie o banco e copie a connection string. No Supabase, use a do **Session
   pooler** (porta 5432): o Transaction pooler não mantém sessão e quebra as
   migrations.
2. No Render, crie um **Web Service** apontando para este repositório.

   | Configuração | Valor |
   | --- | --- |
   | Runtime | Node |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm run start:prod` |
   | Health Check Path | `/api/health` |

3. Em **Environment**, defina:

   | Variável | Valor |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `24.18.0` |
   | `DATABASE_URL` | a connection string do passo 1 |
   | `DATABASE_SSL_MODE` | `verify` no Neon, `require` no Supabase |
   | `JWT_SECRET` | um valor novo, gerado pelo comando acima |
   | `CORS_ORIGINS` | a URL do Firebase Hosting, por exemplo `https://neuralgrid.web.app` |
   | `TRUST_PROXY_HOPS` | `1` |

4. Crie as contas a partir da sua máquina, apontando para o banco de produção:

   ```bash
   DATABASE_URL="<url de produção>" DATABASE_SSL_MODE=verify npm run seed
   ```

O plano gratuito do Render hiberna o serviço depois de 15 minutos sem tráfego,
e a primeira requisição seguinte leva até um minuto. O frontend avisa o jogador
quando o login demora por esse motivo e, enquanto a mesa estiver aberta, faz
uma chamada leve ao `/api/health` a cada 10 minutos para o serviço não dormir
no meio da sessão. WebSockets funcionam no Web Service do Render sem
configuração extra. O passo a passo com as armadilhas de cada
provedor está em [docs/deploy.md](docs/deploy.md).

---

## Documentação

- [Arquitetura](docs/arquitetura.md): camadas, regra de dependência e como criar um módulo.
- [Autenticação e segurança](docs/autenticacao.md): fluxo de login, JWT, throttling e guards em HTTP e WebSocket.
- [Tempo real](docs/tempo-real.md): protocolo do namespace `/table`, permissões, presença e limites.
- [Deploy](docs/deploy.md): Render, Neon, Supabase e rotação de segredos.

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
