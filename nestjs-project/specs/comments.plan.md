---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.5
target_file: nestjs-project/test/comments.e2e-spec.ts
---

# Comentários — GET/POST /videos/{publicId}/comments, PATCH/DELETE /comments/{commentId} Test Plan

## Application Overview

Usuários autenticados comentam em vídeos `published` (público ou unlisted); a listagem de raízes é pública com auth opcional, paginada em keyset `{ items, next_cursor }` com `sort=latest` (default) ou `top` (`like_count DESC`) (`social-interactions/TD-06`). O texto é puro, 1–2.000 caracteres após `trim` (`TD-07`). Só o autor edita (grava `edited_at`) ou exclui (exclusão física; apagar a raiz apaga as respostas e desconta `1 + reply_count` de `videos.comment_count`) — outro usuário recebe `403 COMMENT_FORBIDDEN` (`TD-06`, Revisions 2026-10-20). Vídeo não publicado → `404 VIDEO_NOT_FOUND` inclusive para o dono (`TD-03`, Revisions 2026-10-20). Este plano cobre o SI-06.5 em `test/comments.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Criar e listar

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource` e repositórios de `Video` e `Comment`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `comments`, `comment_reactions`), `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, processing_status })`; `commentCount(publicId)` lê `videos.comment_count`; `seedComment(videoId, userId, { text, like_count, parent_id })` insere direto pelo repositório quando o cenário precisa de muitos itens.

#### 1.1. create-trims-text-and-increments-count

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('criador@example.com')`; vídeo publicado; `authenticate('ana@example.com')`
    - expect: `commentCount(public_id)` = 0
  2. `POST /videos/<public_id>/comments` com o `Bearer` de `ana` e `{ "text": "  Ótimo vídeo  " }`
    - expect: status `201` com `text: "Ótimo vídeo"`, `parent_id: null`, `reply_count: 0`, `edited_at: null`, `viewer_is_author: true` e `author.nickname: "ana"`
    - expect: `commentCount(public_id)` = 1

#### 1.2. invalid-text-and-missing-token

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `POST …/comments` com `Bearer` válido e `{ "text": "   " }`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  2. `POST …/comments` com `text` de 2.001 caracteres
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  3. `POST …/comments` com `text` de exatamente 2.000 caracteres
    - expect: status `201`
  4. `POST …/comments` sem `Authorization`
    - expect: status `401`

#### 1.3. list-roots-by-top-with-cursor

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado com 25 raízes (`seedComment`, `like_count` distintos) e 2 respostas numa delas
    - expect: seed pronto
  2. `GET /videos/<public_id>/comments?sort=top` sem `Authorization`
    - expect: status `200` com 20 itens em `like_count` decrescente, todos com `parent_id: null`, e `next_cursor` não nulo
    - expect: cada item traz `viewer_reaction: null` e `viewer_is_author: false`
  3. `GET …/comments?sort=top&cursor=<next_cursor>`
    - expect: os 5 restantes, nenhum repetido da primeira página, e `next_cursor: null`
  4. `GET …/comments?sort=newest`
    - expect: status `400` com `error = "VALIDATION_ERROR"`

#### 1.4. draft-comments-are-hidden-even-from-owner

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('dono@example.com')`; `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: rascunho criado
  2. `GET /videos/<public_id>/comments` com o `Bearer` do dono
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
  3. `POST /videos/<public_id>/comments` com o `Bearer` do dono
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`

### 2. Editar e excluir

**Setup:** mesmo da seção 1.

#### 2.1. only-author-can-edit

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `ana` cria um comentário; `authenticate('bia@example.com')`
    - expect: comentário com `edited_at: null`
  2. `PATCH /comments/<id>` com o `Bearer` de `ana` e `{ "text": "Texto revisto" }`
    - expect: status `200` com `text: "Texto revisto"` e `edited_at` preenchido
  3. `PATCH /comments/<id>` com o `Bearer` de `bia`
    - expect: status `403` com `error = "COMMENT_FORBIDDEN"` e o texto continua "Texto revisto"

#### 2.2. deleting-root-cascades-replies-and-counts

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado; `ana` cria uma raiz; `bia` cria 2 respostas nela (`POST /comments/<raiz>/replies`) e reage a uma delas
    - expect: `commentCount(public_id)` = 3 e a raiz com `reply_count: 2`
  2. `DELETE /comments/<raiz>` com o `Bearer` de `bia`
    - expect: status `403` com `error = "COMMENT_FORBIDDEN"`
  3. `DELETE /comments/<raiz>` com o `Bearer` de `ana`
    - expect: status `204`
    - expect: `comments` e `comment_reactions` não têm mais linhas do vídeo e `commentCount(public_id)` = 0

#### 2.3. deleting-unknown-comment-returns-404

**Covers AC:** #7
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `DELETE /comments/00000000-0000-4000-8000-000000000000` com `Bearer` válido
    - expect: status `404` com `error = "COMMENT_NOT_FOUND"`
  2. `DELETE /comments/nao-e-uuid` com `Bearer` válido
    - expect: status `404` com `error = "COMMENT_NOT_FOUND"`
