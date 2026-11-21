# Autenticação e segurança

Como uma credencial vira sessão e o que protege cada etapa. Voltar ao
[README](../README.md).

**Em resumo:** Argon2id, JWT HS256 conferido contra o banco a cada uso, três
limites contra força bruta, toda rota fechada por padrão e o mesmo token no
handshake do socket.

---

## Login

```text
POST /api/auth/login { username, password }
  ├─ AppThrottlerGuard      limites default, login-ip e por conta
  ├─ ValidationPipe         LoginRequestDto
  ├─ VerifyCredentials      Argon2id; hash fictício se a conta não existe
  └─ JwtAccessTokenIssuer   assina { sub, username, role } com HS256
```

Sucesso, sempre com `Cache-Control: no-store`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": { "id": "9417...", "username": "mestre", "displayName": "Mestre", "role": "master" }
}
```

| Situação | Status |
| --- | --- |
| Credenciais corretas | `200` com a sessão |
| Usuário inexistente ou senha errada | `401 INVALID_CREDENTIALS`, mesma mensagem e mesmo tempo |
| Campo ausente, inválido ou extra | `400` com as mensagens de validação |
| Limite excedido | `429` com `Retry-After` em segundos |

## Senhas

| Regra | Valor |
| --- | --- |
| Algoritmo | Argon2id, 19 MiB, 2 iterações, paralelismo 1 (mínimo da OWASP) |
| Tamanho | 12 a 128 caracteres no provisionamento; no login, só o máximo |
| Origem | o seed gera 24 caracteres aleatórios, grava o hash e mostra a senha uma vez |

---

## Força bruta

| Limite | Regra | Bloqueio |
| --- | --- | --- |
| `default` | 120 requisições por minuto por IP, todas as rotas | 1 minuto |
| `login-ip` | 10 tentativas em 10 minutos por IP | 15 minutos |
| Por conta | 5 erros na mesma conta em 15 minutos | só os IPs que erraram, por 15 minutos |

- Só senha errada conta; um login certo zera os erros daquele IP.
- Um IP sem erros continua entrando: ninguém tranca o mestre para fora
  sabendo só o nome de usuário.
- `req.ip` depende de `TRUST_PROXY_HOPS` certo (`1` no Render). Com `0`, todos
  parecem vir do balanceador; com valor maior, o cliente forja o IP.
- Os contadores ficam em memória: basta com uma instância; com várias, precisam
  ir para o Redis.

---

## JWT

| Regra | Efeito |
| --- | --- |
| `HS256` fixo na emissão e na validação | fecha a troca de algoritmo e o `alg: none` |
| `iss` e `aud` exigidos | token do mesmo segredo para outro uso não passa |
| Conta conferida no banco a cada uso | conta removida ou papel alterado invalidam o token na hora |
| Sem refresh token | ao expirar, o jogador entra de novo |

Trocar o `JWT_SECRET` derruba todas as sessões: é o botão de emergência.

## Autorização

`JwtAuthGuard` global e fail-closed: rota sem `@Public()` exige token.
`RolesGuard` responde `403` quando o papel não bate com `@Roles()`.

```ts
@Roles('master')
@Post('maps')
createMap(@CurrentUser() user: AuthenticatedUser) { ... }
```

## HTTP

| Proteção | Configuração |
| --- | --- |
| Helmet | HSTS, `nosniff`, `frame-ancestors`, CSP restritiva, sem `X-Powered-By` |
| CORS | só `CORS_ORIGINS`, sem cookies, expõe apenas `Retry-After` |
| Corpo | JSON até 64 kB |
| `ValidationPipe` | `whitelist` e `forbidNonWhitelisted`: campo não declarado é erro |

---

## WebSocket

| Regra | Como |
| --- | --- |
| Handshake | `AuthenticateAccessTokenUseCase` confere assinatura, `iss`, `aud`, `exp` e a conta no banco |
| Usuário | fica em `socket.data.user`; `RolesGuard` e `@CurrentUser()` funcionam igual ao HTTP |
| Expiração | o socket cai no instante do `exp`, com `session:expired` |
| Conexões | até 5 por conta (`MAX_CONNECTIONS_PER_USER`); a sexta recebe `session:limit` |
| Taxa | limite próprio por socket; o throttler HTTP não atua aqui |

Protocolo completo em [Tempo real](tempo-real.md).

## O que ainda falta

- Refresh token com rotação.
- Derrubar na hora o socket de conta removida ou com papel alterado (hoje só no
  próximo handshake ou no `exp`).
- Throttler e adapter do Socket.io no Redis, se houver mais de uma instância.
- Auditoria dos logins, com IP e resultado.
