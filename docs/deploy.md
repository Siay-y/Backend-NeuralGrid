# Deploy

Banco no Neon ou no Supabase, API num Web Service do Render. Para a
apresentação do projeto, volte ao [README](../README.md).

## 1. Banco de dados

### Neon

1. Crie um projeto e um banco, por exemplo `neuralgrid`.
2. Em **Connection Details**, copie a connection string do branch principal.
3. Use `DATABASE_SSL_MODE=verify`. O certificado do Neon é emitido por uma CA
   pública e a validação completa funciona sem configuração extra.

### Supabase

1. Crie um projeto e anote a senha do banco.
2. Em **Connect**, copie a URL do **Session pooler** (porta 5432). O Transaction
   pooler (porta 6543) não preserva sessão entre comandos e quebra as migrations.
3. Use `DATABASE_SSL_MODE=require`. O certificado do Supabase é assinado por uma
   CA própria, então a conexão é cifrada sem validar a cadeia.

Nos dois casos, a API cria as tabelas sozinha no primeiro boot, aplicando as
migrations pendentes.

## 2. Web Service no Render

| Configuração | Valor |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/api/health` |
| Auto-Deploy | ligado |

O `--include=dev` é obrigatório: com `NODE_ENV=production`, o `npm ci` pula as
devDependencies, e o build precisa do `@nestjs/cli` e do `typescript`.

Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.18.0` |
| `DATABASE_URL` | connection string do passo 1 |
| `DATABASE_SSL_MODE` | `verify` (Neon) ou `require` (Supabase) |
| `JWT_SECRET` | 48 bytes aleatórios em base64url |
| `JWT_EXPIRES_IN` | `8h`, ou o tamanho de uma sessão de jogo |
| `CORS_ORIGINS` | `https://<projeto>.web.app,https://<projeto>.firebaseapp.com` |
| `TRUST_PROXY_HOPS` | `1` |

Não defina `PORT`: o Render injeta a porta e a API a respeita.

## 3. Contas da mesa

O seed roda da sua máquina, apontando para o banco de produção. Não é preciso
shell no Render, que no plano gratuito nem existe.

```bash
DATABASE_URL="<url de produção>" \
DATABASE_SSL_MODE=verify \
SEED_USERS="mestre:Mestre:master,ana:Ana:player,bruno:Bruno:player,caio:Caio:player" \
npm run seed
```

Guarde a tabela impressa só até entregar as senhas. Para trocar todas depois:

```bash
npm run seed:reset
```

## 4. Conferência

```bash
curl https://<servico>.onrender.com/api/health/db
```

A resposta esperada é `{"status":"ok","database":"up"}`. O `/api/health`, usado
pelo Render, só confirma que a API está de pé e não consulta o banco, para o
Neon poder dormir quando ninguém está jogando. O `/api/health/db` consulta o
banco e aceita 30 chamadas por minuto por IP. Em seguida, aponte o
`apiUrl` de `src/environments/environment.ts` do frontend e o `connect-src` do
`firebase.json` para a mesma URL.

## Rotação de segredos

| Segredo | Como trocar | Efeito |
| --- | --- | --- |
| `JWT_SECRET` | novo valor no Render e redeploy | todas as sessões caem, cada jogador entra de novo |
| Senha de uma conta | `npm run seed:reset` | todas as senhas de `SEED_USERS` mudam |
| Senha do banco | painel do provedor e nova `DATABASE_URL` no Render | nenhum, após o redeploy |

## Plano gratuito

O Web Service gratuito hiberna depois de 15 minutos sem tráfego e leva até um
minuto para acordar. Para uma sessão marcada, abra o site alguns minutos antes.
O frontend avisa quando o login está esperando o servidor acordar.
