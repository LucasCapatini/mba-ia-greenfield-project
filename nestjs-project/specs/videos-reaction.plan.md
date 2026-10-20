---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.2
target_file: nestjs-project/test/videos-reaction.e2e-spec.ts
---

# PUT / DELETE /videos/{publicId}/reaction Test Plan

## Application Overview

`PUT /videos/{publicId}/reaction` define a reação do usuário ao vídeo (`{ value: "like" | "dislike" }`) e `DELETE` a remove. As duas são **set-state idempotentes** e respondem `200` com o estado resultante `ReactionStateResponse` (`viewer_reaction`, `like_count`, `dislike_count`) (`social-interactions/TD-03`). Exigem JWT; o vídeo precisa estar `published` — rascunho → `404 VIDEO_NOT_FOUND` inclusive para o dono (`TD-03`, Revisions 2026-10-20). Os contadores denormalizados de `videos` são ajustados na mesma transação pelo delta da transição (`TD-02`). As rotas têm `@Throttle` próprio de 60 req/min por visitante. Este plano cobre o SI-06.2 em `test/videos-reaction.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Transições de reação

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter` e `trust proxy` = `loopback`; obter `DataSource` e `Repository<Video>`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `video_reactions`), `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, processing_status })`; `counts(publicId)` lê `like_count`/`dislike_count` direto do repositório.

#### 1.1. like-then-repeat-is-idempotent

**Covers AC:** #1, #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('canal@example.com')`; `seedVideo(ownerToken, { status: 'published', processing_status: 'ready' })`; `authenticate('ana@example.com')`
    - expect: um vídeo publicado com `like_count = 0`
  2. `PUT /videos/<public_id>/reaction` com o `Bearer` de `ana` e `{ "value": "like" }`
    - expect: status `200` com `{ viewer_reaction: "like", like_count: 1, dislike_count: 0 }`
  3. Repetir exatamente a mesma requisição
    - expect: status `200` com o mesmo corpo
    - expect: `counts(public_id)` = `{ like: 1, dislike: 0 }` e `video_reactions` tem 1 linha

#### 1.2. switch-to-dislike-and-remove

**Covers AC:** #3, #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado de outro canal; `ana` envia `PUT …/reaction { "value": "like" }`
    - expect: status `200` com `like_count: 1`
  2. `ana` envia `PUT …/reaction { "value": "dislike" }`
    - expect: status `200` com `{ viewer_reaction: "dislike", like_count: 0, dislike_count: 1 }`
  3. `ana` envia `DELETE /videos/<public_id>/reaction`
    - expect: status `200` com `{ viewer_reaction: null, like_count: 0, dislike_count: 0 }`
  4. Repetir o `DELETE`
    - expect: status `200` com o mesmo corpo e `video_reactions` vazia

### 2. Validação, autenticação e visibilidade

**Setup:** mesmo da seção 1.

#### 2.1. invalid-value-and-missing-token

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `PUT /videos/<public_id>/reaction` com `Bearer` válido e `{ "value": "love" }`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  2. `PUT /videos/<public_id>/reaction` sem `Authorization` e `{ "value": "like" }`
    - expect: status `401`
    - expect: `video_reactions` continua vazia

#### 2.2. owner-reacting-to-own-draft-gets-404

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('dono@example.com')`; `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: rascunho criado
  2. `PUT /videos/<public_id>/reaction` com o `Bearer` do dono e `{ "value": "like" }`
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
    - expect: `counts(public_id)` continua `{ like: 0, dislike: 0 }`

#### 2.3. reaction-route-throttles-at-60-per-minute

**Covers AC:** #7
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado de outro canal; `ana` envia 60 `PUT …/reaction` alternando `like`/`dislike` com o mesmo `X-Forwarded-For`
    - expect: as 60 respostas `200`
  2. 61ª requisição na mesma janela
    - expect: status `429`
