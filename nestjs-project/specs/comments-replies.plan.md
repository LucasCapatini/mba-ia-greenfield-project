---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.6
target_file: nestjs-project/test/comments-replies.e2e-spec.ts
---

# GET / POST /comments/{commentId}/replies Test Plan

## Application Overview

Respostas têm um único nível (`social-interactions/TD-05`): `POST /comments/{commentId}/replies` grava a resposta na **raiz** — se `commentId` já é uma resposta, a nova vai para a raiz dela — e soma 1 a `reply_count` da raiz e a `videos.comment_count` na mesma transação. `GET /comments/{commentId}/replies` lista as respostas de uma raiz em ordem cronológica (`created_at ASC, id ASC`) em keyset; sobre uma resposta → `404 COMMENT_NOT_FOUND` (`TD-06`). Responder exige JWT; listar é público com auth opcional. Este plano cobre o SI-06.6 em `test/comments-replies.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Responder

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource` e repositórios de `Video` e `Comment`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, …)`; `createRoot(token, publicId, text)` via `POST /videos/{publicId}/comments`.

#### 1.1. reply-to-root-increments-counters

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `ana` cria uma raiz; `authenticate('bia@example.com')`
    - expect: raiz com `reply_count: 0` e `videos.comment_count` = 1
  2. `POST /comments/<raiz>/replies` com o `Bearer` de `bia` e `{ "text": "Concordo" }`
    - expect: status `201` com `parent_id` = id da raiz e `reply_count: 0`
    - expect: a raiz passa a `reply_count: 1` e `videos.comment_count` = 2

#### 1.2. reply-to-reply-attaches-to-root

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Raiz de `ana` com uma resposta de `bia`
    - expect: resposta com `parent_id` = raiz
  2. `POST /comments/<resposta-de-bia>/replies` com o `Bearer` de `ana` e `{ "text": "@bia obrigado" }`
    - expect: status `201` com `parent_id` = id da **raiz** (não o da resposta)
    - expect: a raiz passa a `reply_count: 2`

#### 1.3. reply-without-token-returns-401

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Raiz existente; `POST /comments/<raiz>/replies` sem `Authorization`
    - expect: status `401` e `reply_count` da raiz não muda

### 2. Listar

**Setup:** mesmo da seção 1.

#### 2.1. replies-listed-oldest-first-with-cursor

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Raiz com 22 respostas criadas em sequência
    - expect: seed pronto
  2. `GET /comments/<raiz>/replies` sem `Authorization`
    - expect: status `200` com 20 itens da mais antiga para a mais nova e `next_cursor` não nulo
  3. `GET /comments/<raiz>/replies?cursor=<next_cursor>`
    - expect: as 2 últimas respostas e `next_cursor: null`

#### 2.2. replies-of-a-reply-returns-404

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Raiz com uma resposta
    - expect: resposta criada
  2. `GET /comments/<resposta>/replies`
    - expect: status `404` com `error = "COMMENT_NOT_FOUND"`
