# Deploy

Banco no Neon ou no Supabase, API num Web Service do Render. Voltar ao
[README](../README.md).

**Em resumo:** crie o banco, configure o Render com as variáveis abaixo, rode o
seed da sua máquina e confira `/api/health/db`. As migrations rodam sozinhas no
boot.

---

## 1. Banco

| Provedor | Connection string | `DATABASE_SSL_MODE` |
| --- | --- | --- |
| Neon | **Connection Details** do branch principal | `verify` (CA pública) |
| Supabase | **Session pooler**, porta 5432 | `require` (CA própria) |

No Supabase, o Transaction pooler (porta 6543) não mantém sessão e quebra as
migrations.

## 2. Render

| Configuração | Valor |
| --- | --- |
| Runtime / Branch | Node / `main` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/api/health` |
| Auto-Deploy | ligado |

O `--include=dev` é obrigatório: com `NODE_ENV=production` o `npm ci` pula o
`@nestjs/cli` e o `typescript`, que o build usa.

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.18.0` |
| `DATABASE_URL` | connection string do passo 1 |
| `DATABASE_SSL_MODE` | `verify` (Neon) ou `require` (Supabase) |
| `JWT_SECRET` | 48 bytes aleatórios em base64url |
| `JWT_EXPIRES_IN` | `8h`, ou a duração de uma sessão de jogo |
| `CORS_ORIGINS` | `https://<projeto>.web.app,https://<projeto>.firebaseapp.com` |
| `TRUST_PROXY_HOPS` | `1` |

Não defina `PORT`: o Render injeta a dele. WebSockets funcionam sem
configuração extra.

## 3. Contas

O seed roda da sua máquina, apontando para o banco de produção:

```bash
DATABASE_URL="<url de produção>" \
DATABASE_SSL_MODE=verify \
SEED_USERS="mestre:Mestre:master,ana:Ana:player,bruno:Bruno:player,caio:Caio:player" \
npm run seed
```

Entregue cada senha por um canal privado. `npm run seed:reset` gera senhas
novas para todos.

## 4. Conferência

```bash
curl https://<servico>.onrender.com/api/health/db
```

| Rota | O que confere |
| --- | --- |
| `/api/health` | só a API, sem tocar no banco, para o Neon poder dormir |
| `/api/health/db` | API e banco: `{"status":"ok","database":"up"}`, até 30 chamadas por minuto por IP |

Depois aponte o `environment.ts` e o `connect-src` do `firebase.json` do
frontend para a mesma URL. Com migration nova, publique a API antes do
frontend.

---

## Rotação de segredos

| Segredo | Como trocar | Efeito |
| --- | --- | --- |
| `JWT_SECRET` | valor novo no Render e redeploy | todas as sessões caem |
| Senhas das contas | `npm run seed:reset` | todas as senhas de `SEED_USERS` mudam |
| Senha do banco | painel do provedor e nova `DATABASE_URL` | nenhum, após o redeploy |

## Plano gratuito

O serviço hiberna após 15 minutos sem tráfego e leva até um minuto para
acordar. Abra o site alguns minutos antes da sessão; o frontend avisa no login
e, com a mesa aberta, chama `/api/health` a cada 10 minutos.
