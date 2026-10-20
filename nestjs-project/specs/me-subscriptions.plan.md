---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.8
target_file: nestjs-project/test/me-subscriptions.e2e-spec.ts
---

# GET /me/subscriptions e GET /me/subscriptions/videos Test Plan

## Application Overview

A área de canais seguidos (`social-interactions/TD-08`) usa dois endpoints autenticados: `GET /me/subscriptions` devolve os canais seguidos (`{ nickname, name }`) em ordem alfabética do nome (desempate por id) em keyset — o menu lateral pede `limit=7` e pagina o resto (`TD-08`, Revisions 2026-10-20); `GET /me/subscriptions/videos` devolve o feed dos vídeos `published` + `public` + `ready` dos canais seguidos, por `published_at DESC, id DESC`, como `VideoCardItem`. `limit` 1..50 (default 20). Sem JWT → `401`. Este plano cobre o SI-06.8 em `test/me-subscriptions.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Canais seguidos

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `subscribe(token, nickname)` via `PUT /channels/{nickname}/subscription`; `seedVideo(token, { status, processing_status, visibility, published_at })`.

#### 1.1. subscribed-channels-alphabetical-with-cursor

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. 9 canais criados (`authenticate` com prefixos `ana`…`ivo` em ordem embaralhada); `authenticate('fa@example.com')` se inscreve nos 9
    - expect: 9 inscrições de `fa`
  2. `GET /me/subscriptions?limit=7` com o `Bearer` de `fa`
    - expect: status `200` com 7 itens `{ nickname, name }` em ordem alfabética do nome e `next_cursor` não nulo
  3. `GET /me/subscriptions?limit=7&cursor=<next_cursor>`
    - expect: os 2 restantes, sem repetir, e `next_cursor: null`

### 2. Feed das inscrições

**Setup:** mesmo da seção 1.

#### 2.1. feed-lists-public-ready-videos-newest-first

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Canais `ana` e `bia` com 2 vídeos publicados, públicos e prontos cada (`published_at` distintos); canal `caio` com 1 vídeo publicado; `fa` segue `ana` e `bia`
    - expect: seed pronto
  2. `GET /me/subscriptions/videos` com o `Bearer` de `fa`
    - expect: status `200` com os 4 vídeos de `ana` e `bia` em `published_at` decrescente, cada um com `channel: { nickname, name }`
    - expect: nenhum vídeo de `caio`

#### 2.2. feed-excludes-unlisted-and-drafts

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Canal `ana` com um vídeo `unlisted` publicado, um rascunho e um publicado ainda `processing`; `fa` segue `ana`
    - expect: seed pronto
  2. `GET /me/subscriptions/videos` com o `Bearer` de `fa`
    - expect: status `200` com `items: []` e `next_cursor: null`

### 3. Recusas

**Setup:** mesmo da seção 1.

#### 3.1. requires-token-and-valid-limit

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `GET /me/subscriptions` e `GET /me/subscriptions/videos` sem `Authorization`
    - expect: as duas respostas `401`
  2. `GET /me/subscriptions?limit=0` com `Bearer` válido
    - expect: status `400` com `error = "VALIDATION_ERROR"`
