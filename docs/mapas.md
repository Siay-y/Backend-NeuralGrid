# Mapas

O mestre envia imagens de mapa que viram o fundo do tabuleiro, um mapa por vez.
Cada mapa reúne uma ou mais áreas (por exemplo, a entrada da caverna e a parte
mais funda), que ficam lado a lado na mesa. Tokens e desenhos continuam por
cima.

## Onde as imagens ficam

No próprio Postgres, na coluna `bytea` da tabela `map_areas`. A escolha foi feita em
novembro de 2026, comparando os planos gratuitos:

| Opção | Por que não |
| --- | --- |
| Disco do Render | o plano gratuito não tem disco permanente |
| Firebase Storage | exige o plano pago Blaze desde 2024 |
| Cloudflare R2 | pede cartão e acrescenta chaves e SDK novos |

O Neon gratuito oferece 1 GB por projeto e 5 GB de transferência por mês. Com o
navegador comprimindo cada mapa para WebP de até 4096 px, um mapa fica entre
0,3 e 1,5 MB, e a biblioteca é limitada a 300 MB.

As colunas `image` e `thumbnail` usam `STORAGE EXTERNAL`, porque a imagem já
vem comprimida e o Postgres gastaria tempo tentando comprimir de novo. Elas
ficam fora dos `SELECT` comuns (`select: false`), então listar mapas não lê
nenhum byte de imagem. A tabela `maps` guarda só o nome e qual mapa está na
mesa, e apagar um mapa apaga as áreas junto (`ON DELETE CASCADE`).

## Envio

Só para o mestre, em `multipart/form-data`, com 10 envios por minuto:

| Rota | O que faz |
| --- | --- |
| `POST /api/maps` | cria um mapa com a primeira área, visível |
| `POST /api/maps/:id/areas` | adiciona uma área ao mapa, oculta para os jogadores |

| Campo | Conteúdo |
| --- | --- |
| `name` | nome, até 48 caracteres depois de normalizado |
| `image` | PNG, JPEG ou WebP, até 3 MB e 8192 px de lado |
| `thumbnail` | a mesma imagem com até 512 px de lado e 96 kB |
| `centerCol`, `centerRow` | opcionais, o quadrado onde a imagem foi solta no tabuleiro |

Sem centro, o primeiro mapa entra centralizado na origem e uma área nova entra à
direita das outras, com a escala da última área. Com centro, a imagem é
centralizada ali, arredondada para quadrados inteiros.

Limites: 40 mapas, 12 áreas por mapa e 300 MB no total.

O frontend reduz a imagem para no máximo 4096 px, converte para WebP (ou JPEG
quando o navegador não codifica WebP) e gera a miniatura antes de enviar. O
servidor não confia nisso e valida tudo de novo.

## Validação

`readImageInfo` lê o tipo e as dimensões direto do cabeçalho dos bytes, sem
decodificar a imagem e sem dependência nativa:

- O nome do arquivo e o MIME declarado são ignorados. SVG, HTML ou qualquer
  arquivo disfarçado de imagem é recusado com `INVALID_MAP`.
- WebP animado é recusado.
- Lado acima de 8192 px ou mais de 40 megapixels é recusado, o que protege o
  navegador dos jogadores contra bombas de pixels.
- O multer recusa com 413 qualquer arquivo acima de 3 MB antes de chegar ao
  caso de uso, e aceita no máximo 2 arquivos e 3 campos.

## Leitura

`GET /api/maps/areas/:id/image` e `GET /api/maps/areas/:id/thumbnail` exigem
login:

| Quem | Imagem | Miniatura |
| --- | --- | --- |
| Mestre | qualquer área | qualquer área |
| Jogador | só as áreas visíveis do mapa na mesa, as outras dão 404 | nunca (403) |

A resposta leva `Cache-Control: private, max-age=31536000, immutable`, porque
uma imagem nunca muda depois do envio, e `Content-Security-Policy: default-src
'none'`. As imagens ficam num cache em memória de 32 MB, então uma troca de cena
lê o banco uma vez, e não uma vez por jogador.

## Cena

Um mapa ativo por vez, garantido pelo índice único parcial
`uq_maps_single_active`. Cada área guarda a posição em quadrados da grade (`col`
e `row` do canto superior esquerdo), a escala em pixels da imagem por quadrado
(`cell`, de 8 a 1024) e se está oculta (`hidden`). A primeira área entra com 70
px por quadrado.

| Evento | Quem pode | Payload |
| --- | --- | --- |
| `map:rename` | mestre | `{ id, name }` |
| `map:activate` | mestre | `{ id }` ou `{ id: null }` para tirar da mesa |
| `map:delete` | mestre | `{ id }` |
| `area:update` | mestre | `{ id, name?, col?, row?, cell?, hidden? }` |
| `area:delete` | mestre | `{ id }`, recusado se for a última área do mapa |

| Evento do servidor | Para quem | Payload |
| --- | --- | --- |
| `map:created`, `map:updated` | mestres | mapa completo, com as áreas |
| `map:deleted` | mestres | `{ id }` |
| `scene:changed` | mestres | `{ scene }` com todas as áreas, inclusive as ocultas |
| `scene:changed` | jogadores | `{ scene }` só com as áreas visíveis, sem `hidden` |

O snapshot traz `maps`, vazio para jogadores, e `scene`, filtrada do mesmo jeito.
A cena não leva nome de mapa nem de área, para o título que o mestre deu não
entregar nada. No tabuleiro do mestre, as áreas ocultas aparecem apagadas.

## Névoa de guerra

A névoa vale para a mesa inteira e fica na tabela `table_settings`, que tem uma
linha só (`id = 1`):

| Coluna | Conteúdo |
| --- | --- |
| `fog_enabled` | se os jogadores enxergam só perto das luzes |
| `light_radius` | alcance da luz em quadrados, de 2 a 20, 6 por padrão |
| `fog_memory` | se os lugares já visitados ficam à meia luz |

| Evento | Quem pode | Payload |
| --- | --- | --- |
| `fog:update` | mestre | `{ enabled?, radius?, memory? }` |
| `fog:changed` | todos, do servidor | `{ fog: { enabled, radius, memory } }` |
| `fog:forget` | mestre | `{}`, apaga a memória do mapa na mesa |
| `fog:memory` | todos, do servidor | `{ mapId, points, reset }` |

O snapshot traz `fog`. O servidor só guarda a configuração: cada navegador
acende uma luz no centro de cada token que tem dono e `emitsLight`, com o
alcance escolhido, e escurece o resto do tabuleiro para os jogadores. Um token
com `emitsLight: false` fica no escuro e só aparece perto da luz de outro.

A névoa esconde o que o navegador desenha, não os dados. A imagem do mapa e os
tokens no escuro continuam chegando ao jogador. Para um segredo de verdade, o
mestre usa uma área oculta ou um token oculto, que nunca saem do servidor.

### Memória da névoa

Com `fog_memory` ligado, o servidor guarda por onde as luzes passaram, por mapa,
na tabela `fog_explored` (`map_id`, `x2`, `y2`, apagada junto com o mapa). Cada
ponto é o centro de uma luz em meios quadrados, por isso `x2` e `y2`.

| Quando | O que entra na memória |
| --- | --- |
| Token criado, editado ou movido | o caminho da posição antiga até a nova, a cada meio alcance, até 64 pontos |
| Névoa ou memória ligadas | a posição de cada luz na mesa |
| Mapa trocado | a posição de cada luz no mapa novo |

Só deixa rastro o token com dono, com `emitsLight` e que não está oculto. Cada
mapa guarda até 20.000 pontos. `fog:memory` com `reset: false` traz só os pontos
novos; com `reset: true` (troca de mapa ou `fog:forget`) traz a lista inteira. O
snapshot traz `fogMemory` do mapa na mesa.

## Testes

`map-image.spec.ts` monta cabeçalhos byte a byte de cada formato e de arquivos
falsos. `map-use-cases.spec.ts` cobre permissões, limites, posição das áreas
novas, cena única, áreas ocultas, o que o jogador pode ler e o cache.
`fog-use-cases.spec.ts` cobre o padrão da névoa, as permissões, os limites do
alcance e a memória. `fog-memory.spec.ts` cobre o caminho entre duas posições. `test/maps.e2e-spec.ts` envia arquivos de verdade
por HTTP, tenta SVG disfarçado e arquivo grande demais, confere os cabeçalhos da
resposta e acompanha pelo socket a troca de cena, a revelação de uma área e a
névoa chegando ao jogador.
