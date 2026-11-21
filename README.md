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

API do NeuralGrid, um Virtual Tabletop privado para o mestre e três jogadores.
NestJS 12 com autenticação, mesa em tempo real, fichas e mapas. O cliente
Angular fica em [Frontend-NeuralGrid](https://github.com/Siay-y/Frontend-NeuralGrid).

---

## Em resumo

| Tema | Como |
| --- | --- |
| Arquitetura | Clean Architecture por módulo; o domínio não conhece NestJS nem banco |
| Contas | sem cadastro público: nascem por seed, com senha aleatória mostrada uma vez |
| Login | Argon2id, JWT HS256 com `iss` e `aud`, mesma resposta para usuário ou senha errados |
| Força bruta | limite global, por IP e por conta, com `Retry-After` |
| Autorização | toda rota fechada por padrão; abrir exige `@Public()`, restringir usa `@Roles()` |
| Tempo real | Socket.io em `/table`, autenticado pelo mesmo JWT, ack `{ ok, data }` ou `{ ok, error }` |
| O servidor decide | posse de token, dados (`crypto.randomInt`), quem vê cada mensagem, combate, status e morte |
| Privacidade | tokens ocultos, sussurros e rolagens ocultas nunca saem para quem não pode ver |
| Banco | PostgreSQL com migrations em SQL e as regras repetidas em `CHECK` |

---

## Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `users` | identidade, credenciais e hash de senha |
| `auth` | login, emissão e verificação do JWT, guards |
| `chat` | mensagens, gramática de dados e sorteio |
| `sheets` | fichas de personagem e permissões por dono |
| `maps` | imagens de mapa, áreas, cena ativa e névoa |
| `tabletop` | tokens, desenhos, combate, status, morte, presença e o gateway `/table` |

Cada módulo tem `domain`, `application`, `infrastructure` e `presentation`. O
transversal fica em `core/` (config, banco, HTTP, socket, segurança) e
`shared/`. Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

---

## Rodar local

Requer Node.js 24.18+ e Docker com Compose v2 (ou qualquer PostgreSQL 14+).

```bash
git clone https://github.com/Siay-y/Backend-NeuralGrid.git
cd Backend-NeuralGrid
npm ci
cp .env.example .env      # preencha JWT_SECRET e SEED_USERS
npm run db:up
npm run seed              # mostra a senha de cada conta uma vez
npm run start:dev
```

A API responde em `http://localhost:3000/api` e aplica as migrations pendentes
sozinha ao iniciar.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe o banco e a API em modo observador |
| `npm run db:up` / `db:down` | sobe ou derruba o PostgreSQL do Compose |
| `npm run seed` / `seed:reset` | cria as contas de `SEED_USERS` / gera senhas novas |
| `npm run migration:run` | aplica as migrations pendentes |
| `npm run migration:generate -- src/core/database/migrations/Nome` | gera uma migration a partir das entidades |
| `npm test` / `npm run test:e2e` | testes unitários / ponta a ponta no banco `neuralgrid_test` |
| `npm run lint` | Oxlint com checagem de tipos |
| `npm run build` | compila para `dist/` |

---

## Variáveis de ambiente

Validadas no boot: se algo estiver errado, a API não sobe e lista cada problema.
Modelo em [`.env.example`](.env.example).

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `CORS_ORIGINS` | obrigatória | origens aceitas, separadas por vírgula |
| `DATABASE_URL` | obrigatória | URL `postgres://` |
| `JWT_SECRET` | obrigatória | no mínimo 32 caracteres |
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | o Render injeta a dele |
| `TRUST_PROXY_HOPS` | `0` | proxies confiáveis na frente da API; `1` no Render |
| `DATABASE_SSL_MODE` | `verify` | `disable`, `require` ou `verify`; o `sslmode` da URL é ignorado |
| `JWT_EXPIRES_IN` | `8h` | validade do token |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `neuralgrid-api` / `neuralgrid-web` | `iss` e `aud` emitidos e exigidos |
| `SEED_USERS` | só no seed | `usuario:Nome:papel`, separados por vírgula |

Gere o segredo com:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

---

## Deploy

API num Web Service do Render, banco no Neon ou no Supabase. Build
`npm ci --include=dev && npm run build`, start `npm run start:prod`, health check
`/api/health`. O passo a passo está em [docs/deploy.md](docs/deploy.md).

Com migration nova, publique a API antes do frontend.

---

## Documentação

| Doc | Conteúdo |
| --- | --- |
| [Arquitetura](docs/arquitetura.md) | camadas, regra de dependência, guards, migrations e como criar um módulo |
| [Autenticação](docs/autenticacao.md) | login, senhas, força bruta, JWT, autorização e WebSocket |
| [Tempo real](docs/tempo-real.md) | protocolo `/table`, tokens, fichas, combate, status, morte, chat e dados |
| [Mapas](docs/mapas.md) | armazenamento, envio, validação, cena e névoa de guerra |
| [Deploy](docs/deploy.md) | Render, Neon, Supabase e rotação de segredos |
| [Changelog](CHANGELOG.md) | o que mudou em cada versão |

---

## Licença

MIT. Veja [LICENSE](LICENSE).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
