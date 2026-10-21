---
subproject: backend
runner: jest+supertest
scope: phase-07-home-search-production
si: SI-07.2
target_file: nestjs-project/test/videos-list.e2e-spec.ts
---

# GET /videos Test Plan

## Application Overview

`GET /videos` é a listagem pública global da home e da busca (`home-search-production/TD-01`, `TD-02`, `TD-03`): rota `@Public()` com autenticação opcional (token presente e inválido → 401), elegíveis só `status = published`, `visibility = public` e `processing_status = ready` — unlisted e rascunhos nunca aparecem, nem para o dono —, em ordem `published_at DESC, id DESC`, no envelope keyset `{ items, next_cursor }` (`limit` 1..50, default 20) com itens `VideoCardItem`. `category` filtra pelo `slug` (sem correspondência → 404 `CATEGORY_NOT_FOUND`); `q` (`trim`, 2–100 caracteres) casa por substring, sem acento nem caixa, o título do vídeo ou o `name`/`nickname` do canal, com `%`/`_`/`\` escapados. A rota, `GET /channels/{nickname}/videos` e `GET /me/subscriptions/videos` têm `@Throttle(LISTING_THROTTLE)` — 60 req/min por visitante. Este plano cobre o SI-07.2 em `test/videos-list.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Listagem, ordem e paginação

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter` (como em `main.ts`); obter `DataSource`, `Repository<Video>`, `Repository<Channel>` e as categorias carregadas pela migration. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `seedUserWithChannel` (`src/test/social-fixtures.ts`) e `seedVideo(channel, { title, status, visibility, processing_status, category, published_at })` com `update` direto no repositório.

#### 1.1. anonymous-lists-recent-public-ready-videos

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Semear 22 vídeos publicados, públicos e prontos com `published_at` distintos (T1 < … < T22)
    - expect: 22 vídeos elegíveis
  2. `GET /videos` sem `Authorization`
    - expect: status `200`
    - expect: `items` tem 20 elementos, do T22 ao T3, e `next_cursor` é uma string
    - expect: cada item tem `public_id`, `title`, `thumbnail_url`, `duration_seconds`, `view_count`, `published_at` e `channel: { nickname, name }`

#### 1.2. cursor-returns-next-page-without-repeats

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Com o seed de 1.1, `GET /videos` e guardar `next_cursor`
    - expect: 20 itens
  2. `GET /videos?cursor=<next_cursor>`
    - expect: status `200` com os 2 itens restantes (T2, T1) e `next_cursor: null`
    - expect: nenhum `public_id` repete os da primeira página
  3. `GET /videos?cursor=nao-e-um-cursor`
    - expect: status `400` com `error: "VALIDATION_ERROR"`

#### 1.3. never-lists-drafts-unlisted-or-not-ready

**Covers AC:** #7
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. No canal do usuário `U`, semear um publicado público pronto `P`, um rascunho, um publicado `unlisted`, um publicado em `processing` e um publicado `failed`
    - expect: só `P` é elegível
  2. `GET /videos` sem `Authorization`
    - expect: `items` contém só `P`
  3. `GET /videos` com o `Bearer` de `U` (dono de todos)
    - expect: status `200` e `items` contém só `P`
  4. `GET /videos` com `Authorization: Bearer token-invalido`
    - expect: status `401`

### 2. Filtro por categoria

**Setup:** mesmo da seção 1.

#### 2.1. category-filters-by-slug

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Semear 3 vídeos elegíveis em `music`, 2 em `gaming` e 1 sem categoria
    - expect: 6 elegíveis
  2. `GET /videos?category=music`
    - expect: status `200` com os 3 vídeos `music`, do mais recente ao mais antigo
  3. `GET /videos?category=inexistente`
    - expect: status `404` com `error: "CATEGORY_NOT_FOUND"`
  4. `GET /videos?category=Music%20!`
    - expect: status `404` com `error: "CATEGORY_NOT_FOUND"` (formato inválido também é "não encontrada")

### 3. Busca por título e canal

**Setup:** mesmo da seção 1; canais semeados com `name` controlado.

#### 3.1. q-matches-title-and-channel-without-accents

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Semear o vídeo elegível "Música ao vivo" (canal "Rock Club"), dois vídeos elegíveis do canal de nome "Músicas do Bia" com títulos sem "musica", e o vídeo elegível "Aula de cálculo" (canal "Edu")
    - expect: 4 elegíveis
  2. `GET /videos?q=musica`
    - expect: status `200` com "Música ao vivo" e os dois vídeos de "Músicas do Bia"; sem "Aula de cálculo"
  3. `GET /videos?q=MÚSICA`
    - expect: o mesmo resultado (sem caixa nem acento)
  4. `GET /videos?q=<nickname do canal de "Músicas do Bia">`
    - expect: os dois vídeos desse canal
  5. `GET /videos?q=musica&category=music` com só "Música ao vivo" em `music`
    - expect: só "Música ao vivo"

#### 3.2. q-length-is-validated

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. `GET /videos?q=a`
    - expect: status `400` com `error: "VALIDATION_ERROR"`
  2. `GET /videos?q=%20%20%20` (só espaços)
    - expect: status `400` com `error: "VALIDATION_ERROR"`
  3. `GET /videos?q=<101 caracteres>`
    - expect: status `400` com `error: "VALIDATION_ERROR"`
  4. `GET /videos?q=%20ab%20`
    - expect: status `200` (o `trim` deixa 2 caracteres)

#### 3.3. q-wildcards-are-literal

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Semear os elegíveis "Desconto de 100% hoje", "100 vídeos", "Tutorial_avancado" e "Tutorialxavancado"
    - expect: 4 elegíveis
  2. `GET /videos?q=100%25`
    - expect: status `200` só com "Desconto de 100% hoje" (o `%` não é curinga — "100 vídeos" fica de fora)
  3. `GET /videos?q=l_a`
    - expect: status `200` só com "Tutorial_avancado" (o `_` não é curinga — "Tutorialxavancado" fica de fora)

### 4. Limite de requisições

**Setup:** mesmo da seção 1; todas as requisições do cenário com o mesmo `X-Forwarded-For` (o mesmo visitante).

#### 4.1. listing-routes-allow-60-per-minute

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. 60 × `GET /videos` com `X-Forwarded-For: 203.0.113.7`
    - expect: todas respondem `200`
  2. 61ª `GET /videos` com o mesmo `X-Forwarded-For`
    - expect: status `429`
  3. Repetir 61 × `GET /channels/<nickname>/videos` com `X-Forwarded-For: 203.0.113.8`
    - expect: as 60 primeiras `200` e a 61ª `429`
  4. Repetir 61 × `GET /me/subscriptions/videos` com um `Bearer` válido e `X-Forwarded-For: 203.0.113.9`
    - expect: as 60 primeiras `200` e a 61ª `429`
