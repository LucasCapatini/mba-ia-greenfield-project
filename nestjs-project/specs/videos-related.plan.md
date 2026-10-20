---
subproject: backend
runner: jest+supertest
scope: phase-05-watch-page
si: SI-05.6
target_file: nestjs-project/test/videos-related.e2e-spec.ts
---

# GET /videos/{publicId}/related Test Plan

## Application Overview

`GET /videos/{publicId}/related` devolve as sugestões da sidebar da watch page (`watch-page/TD-04`): até `limit` itens (1..24, default 12) no shape `VideoCardItem`, dentro de `{ items }` **sem** `next_cursor` — lista fechada, exceção explícita ao cursor keyset das listagens (Revisions 2026-10-19). Elegíveis: `status = published`, `visibility = public`, `processing_status = ready`, excluindo o próprio vídeo — unlisted nunca aparece. Primeiro os da mesma `category_id` por `published_at DESC`; se faltar (ou o vídeo não tiver categoria), completa com os públicos mais recentes de outras categorias, sem repetir. O vídeo de origem segue a regra de leitura do `GET /videos/{publicId}` (rascunho alheio → 404). Este plano cobre o SI-05.6 em `test/videos-related.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Seleção das sugestões

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`, `Repository<Video>` e as categorias carregadas pela migration. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, visibility, processing_status, category, published_at })` — `POST /videos` + `update` direto no repositório.

#### 1.1. same-category-first-then-recent-fill

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Semear a origem `O` (`music`, publicado), 3 publicados `music` com `published_at` T1 < T2 < T3 e 12 publicados `gaming` mais recentes que T3
    - expect: 16 vídeos públicos prontos
  2. `GET /videos/<O>/related` sem `Authorization`
    - expect: status `200`
    - expect: o corpo tem apenas a chave `items` (nenhum `next_cursor`)
    - expect: `items` tem 12 elementos; os 3 primeiros são os `music` na ordem T3, T2, T1; os 9 seguintes são os `gaming` mais recentes, sem repetição
    - expect: cada item tem `public_id`, `title`, `thumbnail_url`, `duration_seconds`, `view_count`, `published_at` e `channel: { nickname, name }`
  3. `GET /videos/<O>/related?limit=2`
    - expect: status `200` com 2 itens, os `music` T3 e T2

#### 1.2. excludes-self-unlisted-drafts-and-not-ready

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Semear a origem `O` (`music`, publicado) e, também em `music`: um `unlisted` publicado, um rascunho, um publicado com `processing_status = processing` (forçado no repositório) e um público pronto `P`
    - expect: só `P` é elegível além da origem
  2. `GET /videos/<O>/related`
    - expect: status `200`
    - expect: `items` contém `P` e não contém `O`, o unlisted, o rascunho nem o não-pronto
  3. Semear um vídeo sem categoria `S` e chamar `GET /videos/<S>/related`
    - expect: status `200` com os públicos prontos mais recentes, sem `S`

### 2. Validação e autorização

**Setup:** mesmo da seção 1.

#### 2.1. limit-out-of-range-returns-400

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Semear um vídeo publicado `O`
    - expect: criado
  2. `GET /videos/<O>/related?limit=30`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  3. `GET /videos/<O>/related?limit=0`
    - expect: status `400` com `error = "VALIDATION_ERROR"`

#### 2.2. draft-origin-returns-404-for-anonymous

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('rascunho@example.com')`; semear um rascunho `D`
    - expect: criado
  2. `GET /videos/<D>/related` sem `Authorization`
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
  3. `GET /videos/<D>/related` com o `Bearer` do dono
    - expect: status `200` com `{ items }`
