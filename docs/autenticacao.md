# Autenticação e segurança

Como uma credencial vira sessão, o que cada proteção faz e o que ainda falta.
Para a apresentação do projeto, volte ao [README](../README.md).

## Fluxo de login

```text
POST /api/auth/login { username, password }
  │
  ├─ AppThrottlerGuard      default, login-ip e login-account
  ├─ ValidationPipe         LoginRequestDto: normaliza e valida o formato
  ├─ LoginUseCase
  │    └─ VerifyCredentialsUseCase
  │         ├─ busca o usuário pelo nome normalizado
  │         └─ verifica o Argon2id (hash fictício se a conta não existe)
  └─ JwtAccessTokenIssuer   assina { sub, username, role } com HS256
```

Resposta de sucesso, sempre com `Cache-Control: no-store`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": { "id": "9417...", "username": "mestre", "displayName": "Mestre", "role": "master" }
}
```

| Situação | Status | Corpo |
| --- | --- | --- |
| Credenciais corretas | `200` | sessão acima |
| Usuário inexistente ou senha errada | `401` | `INVALID_CREDENTIALS`, mesma mensagem nos dois casos |
| Campo ausente, formato inválido ou campo extra | `400` | lista de mensagens de validação |
| Limite excedido | `429` | cabeçalho `Retry-After` em segundos |

## Senhas

`Argon2PasswordHasher` usa Argon2id com 19 MiB de memória, 2 iterações e
paralelismo 1, o mínimo recomendado pela OWASP. O custo de memória torna ataques
com GPU caros e ainda cabe numa instância de 512 MB do Render.

A política de senha (12 a 128 caracteres) vale no provisionamento. O login só
limita o tamanho máximo, para um corpo gigante não virar trabalho de hash.

## Proteção contra força bruta

Configurada em `src/core/security/throttler.options.ts`:

| Throttler | Alcance | Limite | Bloqueio | Chave |
| --- | --- | --- | --- | --- |
| `default` | todas as rotas | 120 por minuto | 1 minuto | IP |
| `login-ip` | rotas com `@BruteForceProtected()` | 10 em 10 minutos | 15 minutos | IP |
| `login-account` | rotas com `@BruteForceProtected()` | 5 em 15 minutos | 15 minutos | nome de usuário |

O limite por IP para um atacante numa única máquina. O limite por conta para o
ataque distribuído, em que cada tentativa vem de um IP diferente. A chave da
conta é lida do corpo cru, porque guards rodam antes dos pipes, e normalizada do
mesmo jeito que o DTO faz.

O lado ruim do limite por conta é conhecido: alguém que saiba o nome de usuário
do mestre consegue bloqueá-lo por 15 minutos. Numa mesa privada de quatro
pessoas, com nomes que não aparecem em lugar público, a troca vale a pena.

`req.ip` só é confiável com `TRUST_PROXY_HOPS` certo. Com `0` atrás do Render,
todos os jogadores pareceriam vir do mesmo IP do balanceador. Com um número
maior que o real, um cliente poderia forjar o próprio IP pelo cabeçalho
`X-Forwarded-For` e escapar do limite.

Os contadores ficam em memória. Com uma instância só, como no plano atual,
isso basta. Ao escalar horizontalmente, o storage do Throttler precisa ir para
o Redis.

## JWT

- Algoritmo fixo em `HS256` na emissão e na validação, o que fecha a porta para
  ataques de troca de algoritmo e para tokens `alg: none`.
- `iss` e `aud` são emitidos e exigidos, então um token assinado com o mesmo
  segredo para outro propósito não passa.
- `JwtStrategy.validate` confere o formato das claims e chama
  `ResolveSessionUserUseCase`, que busca a conta no banco. Conta removida, nome
  diferente ou papel diferente invalidam o token na hora.
- Não há refresh token nesta etapa. Quando o token expira, o frontend volta para
  o login e avisa que a sessão expirou.

Trocar o `JWT_SECRET` derruba todas as sessões de uma vez. Use isso como botão
de emergência se suspeitar de vazamento.

## Autorização

`JwtAuthGuard` é global e fail-closed: rota sem `@Public()` exige token.
`RolesGuard` lê `@Roles()` e responde `403` quando o papel não bate.

```ts
@Roles('master')
@Post('maps')
createMap(@CurrentUser() user: AuthenticatedUser) { ... }
```

## Cabeçalhos e transporte

`configureHttp` aplica:

- **Helmet** com os padrões: HSTS, `nosniff`, `frame-ancestors`, CSP restritiva
  e remoção do `X-Powered-By`.
- **CORS** só para as origens de `CORS_ORIGINS`, sem cookies
  (`credentials: false`), expondo apenas `Retry-After`.
- **Limite de corpo** de 64 kB para JSON.
- **ValidationPipe** com `whitelist` e `forbidNonWhitelisted`: um campo que o DTO
  não declara é erro, não é ignorado em silêncio.

## WebSockets

O Socket.io usa o mesmo JWT, validado uma vez no handshake:

- `AuthenticateAccessTokenUseCase` junta o `AccessTokenVerifier` (assinatura,
  algoritmo, `iss`, `aud` e `exp`) com o `ResolveSessionUserUseCase` (conta e
  papel ainda batem com o banco). É o único caso de uso que o `AuthModule`
  exporta para outros módulos.
- O usuário resolvido fica em `socket.data.user`. `getRequestUser` lê dali no
  contexto `ws`, então `RolesGuard` e `@CurrentUser()` funcionam sem alteração.
- Os guards globais também rodam nos eventos de socket. O `JwtAuthGuard` exige o
  usuário do handshake no contexto `ws` e recusa qualquer outro tipo de
  transporte; o `AppThrottlerGuard` só atua em HTTP, e o socket tem um limite de
  taxa próprio.
- O socket é derrubado no instante em que o token expira.

Os detalhes do protocolo estão em [Tempo real](tempo-real.md).

## O que ainda falta

- Refresh token com rotação, para sessões mais longas que `JWT_EXPIRES_IN`.
- Derrubar na hora o socket de uma conta removida ou com papel alterado. Hoje
  isso acontece no próximo handshake ou na expiração do token.
- Storage do Throttler e adapter do Socket.io no Redis, se a API passar de uma
  instância.
- Registro de auditoria dos logins, com IP e resultado.
