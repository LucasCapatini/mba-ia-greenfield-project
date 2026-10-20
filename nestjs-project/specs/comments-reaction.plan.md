---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.7
target_file: nestjs-project/test/comments-reaction.e2e-spec.ts
---

# PUT / DELETE /comments/{commentId}/reaction Test Plan

## Application Overview

Reações a comentários e respostas seguem a mesma semântica das reações a vídeo (`social-interactions/TD-03`): `PUT` com `{ value }` define, `DELETE` remove, ambas idempotentes e com `200` + `ReactionStateResponse` dos contadores do comentário. O delta é aplicado em `comments.like_count`/`dislike_count` na mesma transação (`TD-02`). Exigem JWT; comentário inexistente ou de vídeo não publicado → `404 COMMENT_NOT_FOUND`. A listagem `GET /videos/{publicId}/comments` reflete `viewer_reaction` por espectador. Este plano cobre o SI-06.7 em `test/comments-reaction.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Reagir a comentários

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, …)`; `createRoot(token, publicId, text)`.

#### 1.1. like-comment-is-idempotent

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `ana` cria uma raiz; `authenticate('bia@example.com')`
    - expect: comentário com `like_count: 0`
  2. `PUT /comments/<id>/reaction` com o `Bearer` de `bia` e `{ "value": "like" }`
    - expect: status `200` com `{ viewer_reaction: "like", like_count: 1, dislike_count: 0 }`
  3. Repetir a requisição
    - expect: status `200` com o mesmo corpo e `comment_reactions` tem 1 linha

#### 1.2. remove-comment-reaction

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `bia` com like numa raiz
    - expect: `like_count: 1`
  2. `DELETE /comments/<id>/reaction` com o `Bearer` de `bia`
    - expect: status `200` com `{ viewer_reaction: null, like_count: 0, dislike_count: 0 }`

#### 1.3. listing-reflects-viewer-reaction

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Raiz de `ana` com uma resposta de `ana`; `bia` dá `dislike` na raiz e `like` na resposta
    - expect: as duas respostas `200`
  2. `GET /videos/<public_id>/comments` com o `Bearer` de `bia`
    - expect: a raiz traz `viewer_reaction: "dislike"` e `dislike_count: 1`
  3. `GET /comments/<raiz>/replies` com o `Bearer` de `bia`
    - expect: a resposta traz `viewer_reaction: "like"` e `like_count: 1`
  4. As duas leituras sem `Authorization`
    - expect: `viewer_reaction: null` em todos os itens

### 2. Recusas

**Setup:** mesmo da seção 1.

#### 2.1. unknown-comment-and-missing-token

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `PUT /comments/00000000-0000-4000-8000-000000000000/reaction` com `Bearer` válido e `{ "value": "like" }`
    - expect: status `404` com `error = "COMMENT_NOT_FOUND"`
  2. `PUT /comments/<id-existente>/reaction` sem `Authorization`
    - expect: status `401`
