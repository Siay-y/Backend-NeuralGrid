# Mapas

Imagens de mapa, áreas, cena ativa e névoa de guerra. Voltar ao
[README](../README.md).

**Em resumo:** o mestre envia imagens que viram o fundo do tabuleiro. Elas
ficam no próprio Postgres, são validadas pelos bytes, e o jogador só recebe as
áreas visíveis do mapa na mesa.

---

## Onde as imagens ficam

Na coluna `bytea` da tabela `map_areas`, escolha de novembro de 2026:

| Alternativa | Por que não |
| --- | --- |
| Disco do Render | o plano gratuito não tem disco permanente |
| Firebase Storage | exige o plano pago Blaze desde 2024 |
| Cloudflare R2 | pede cartão, chaves e SDK novos |

| Detalhe | Como |
| --- | --- |
| Espaço | o Neon gratuito tem 1 GB; um mapa em WebP de até 4096 px fica entre 0,3 e 1,5 MB |
| Compressão | `image` e `thumbnail` com `STORAGE EXTERNAL`, porque já chegam comprimidas |
| Leitura | as colunas de imagem têm `select: false`; listar mapas não lê nenhum byte |
| Remoção | apagar um mapa apaga as áreas (`ON DELETE CASCADE`) |

---

## Envio

Só o mestre, `multipart/form-data`, 10 envios por minuto.

| Rota | O que faz |
| --- | --- |
| `POST /api/maps` | cria um mapa com a primeira área, visível |
| `POST /api/maps/:id/areas` | adiciona uma área, oculta para os jogadores |

| Campo | Regra |
| --- | --- |
| `name` | até 48 caracteres |
| `image` | PNG, JPEG ou WebP, até 3 MB e 8192 px de lado |
| `thumbnail` | até 512 px de lado e 96 kB |
| `centerCol`, `centerRow` | opcionais: o quadrado onde a imagem foi solta |

| Limite | Valor |
| --- | --- |
| Mapas | 40 |
| Áreas por mapa | 12 |
| Total | 300 MB |

Sem centro, o primeiro mapa fica na origem e uma área nova entra à direita das
outras. O frontend já reduz e converte para WebP, mas o servidor valida tudo de
novo.

## Validação

`readImageInfo` lê tipo e dimensões do cabeçalho dos bytes, sem decodificar:

- nome do arquivo e MIME declarado são ignorados; SVG, HTML ou disfarce dão
  `INVALID_MAP`;
- WebP animado é recusado;
- mais de 8192 px de lado ou 40 megapixels é recusado (bomba de pixels);
- o multer recusa com `413` acima de 3 MB, mais de 2 arquivos ou 3 campos.

## Leitura

`GET /api/maps/areas/:id/image` e `/thumbnail`, com login:

| Quem | Imagem | Miniatura |
| --- | --- | --- |
| Mestre | qualquer área | qualquer área |
| Jogador | só áreas visíveis do mapa na mesa (as outras dão 404) | nunca (403) |

Resposta com `Cache-Control: private, max-age=31536000, immutable` e
`Content-Security-Policy: default-src 'none'`. Um cache em memória de 32 MB faz
a troca de cena ler o banco uma vez, não uma por jogador.

---

## Cena

Um mapa ativo por vez (índice único parcial `uq_maps_single_active`). Cada área
guarda `col` e `row` do canto, `cell` (pixels da imagem por quadrado, de 8 a
1024, 70 na primeira) e `hidden`.

| Evento do cliente | Payload |
| --- | --- |
| `map:rename` | `{ id, name }` |
| `map:activate` | `{ id }`, ou `{ id: null }` para tirar da mesa |
| `map:delete` | `{ id }` |
| `area:update` | `{ id, name?, col?, row?, cell?, hidden? }` |
| `area:delete` | `{ id }`; recusado na última área do mapa |

Todos são só do mestre.

| Evento do servidor | Mestres | Jogadores |
| --- | --- | --- |
| `map:created`, `map:updated`, `map:deleted` | recebem | não recebem |
| `scene:changed` | todas as áreas | só as visíveis, sem `hidden` |
| snapshot | `maps` e `scene` completos | `maps` vazio e `scene` filtrada |

A cena não leva nome de mapa nem de área, para o título do mestre não entregar
nada.

---

## Névoa de guerra

Configuração da mesa na tabela `table_settings` (uma linha, `id = 1`):

| Coluna | Conteúdo |
| --- | --- |
| `fog_enabled` | jogadores só enxergam perto das luzes |
| `light_radius` | alcance em quadrados, de 2 a 20, 6 por padrão |
| `fog_memory` | lugares já visitados ficam à meia luz |

| Evento | Quem | Payload |
| --- | --- | --- |
| `fog:update` | mestre | `{ enabled?, radius?, memory? }` |
| `fog:forget` | mestre | `{}`: apaga a memória do mapa na mesa |
| `fog:changed` | servidor para todos | `{ fog: { enabled, radius, memory } }` |
| `fog:memory` | servidor para todos | `{ mapId, points, reset }` |

O servidor guarda só a configuração; cada navegador acende uma luz em todo
token com dono e `emitsLight`. A névoa esconde o desenho, não os dados: segredo
de verdade é área oculta ou token oculto, que nunca saem do servidor.

### Memória

Com `fog_memory`, a tabela `fog_explored` (`map_id`, `x2`, `y2`) guarda por onde
as luzes passaram, em meios quadrados.

| Quando | O que entra |
| --- | --- |
| Token criado, editado ou movido | o caminho da posição antiga à nova, a cada meio alcance, até 64 pontos |
| Névoa ou memória ligadas | a posição de cada luz |
| Mapa trocado | a posição de cada luz no mapa novo |

Só deixa rastro token com dono, com luz e visível. Até 20.000 pontos por mapa.
`fog:memory` com `reset: false` traz só os pontos novos; com `reset: true`, a
lista inteira.

---

## Testes

| Arquivo | O que cobre |
| --- | --- |
| `map-image.spec.ts` | cabeçalhos de cada formato e arquivos falsos |
| `map-use-cases.spec.ts` | permissões, limites, posição das áreas, cena, áreas ocultas e cache |
| `fog-use-cases.spec.ts`, `fog-memory.spec.ts` | névoa, alcance, memória e caminho entre posições |
| `test/maps.e2e-spec.ts` | envio real, SVG disfarçado, arquivo grande, cabeçalhos e a cena chegando pelo socket |
