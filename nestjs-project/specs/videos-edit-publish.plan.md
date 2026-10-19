---
subproject: backend
runner: jest+supertest
scope: phase-04-video-channel-management
si: SI-04.4
target_file: nestjs-project/test/videos-edit-publish.e2e-spec.ts
---

# PATCH /videos/{publicId}, POST …/publish e POST …/unpublish Test Plan

## Application Overview

`PATCH /videos/{publicId}` edita parcialmente os campos editoriais do vídeo (`title`, `description`, `category_id`, `visibility`) e nunca muda `status` (`video-channel-management/TD-03`). As ações dedicadas `POST /videos/{publicId}/publish` e `POST /videos/{publicId}/unpublish` controlam o eixo de publicação: publicar exige `processing_status = ready` e `title` não vazio, grava `published_at` só na primeira publicação e é idempotente; despublicar volta a `draft` preservando `visibility` e `published_at` (`TD-02`). As três rotas são do dono (`VideosOwnership.loadOwned`): anônimo `401`, não-dono `403 VIDEO_FORBIDDEN`, inexistente `404 VIDEO_NOT_FOUND`. Este plano cobre o contrato HTTP do SI-04.4 em `test/videos-edit-publish.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** os estados `processing`/`ready` são semeados diretamente no banco (`videoRepository.update`) após `POST /videos`, sem worker. As categorias vêm da data migration de SI-04.1 (`migration:run` no `beforeAll`); `cleanAllTables` não deve truncar `categories` (dado de plataforma) — se o helper o fizer, reaplicar a seed no `beforeEach`.

## Test Scenarios

### 1. PATCH /videos/{publicId}

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) + `DomainExceptionFilter` + `ValidationExceptionFilter` (reproduzindo `main.ts`); obter `DataSource` e `Repository<Video>` via `app.get`; ler as categorias com `GET /categories`. `beforeEach` — `cleanAllTables(dataSource)` preservando `categories`, `throttlerStorage.storage.clear()`, `cleanPrefix('videos/')`. Helpers: `authenticate(email)` (register + confirm + login, como nas suítes da Fase 03); `seedVideo(token, state)` — `POST /videos` (`original_filename: "aula.mp4"`, `content_type: "video/mp4"`, `size_bytes: 1048576`) e `videoRepository.update({ public_id }, { processing_status: state })` quando `state ≠ uploading`. Suíte roda com `--runInBand`.

#### 1.1. owner-edits-editorial-fields-without-changing-status

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('editor@example.com')`; `seedVideo(token, 'ready')` → `PATCH /videos/<public_id>` com `{ title: "Novo", visibility: "unlisted" }`
    - expect: status `200`
    - expect: body `title = "Novo"`, `visibility = "unlisted"`, `status = "draft"`, `published_at = null`
  2. `PATCH /videos/<public_id>` com `{ description: "Descrição", category_id: <id de "music"> }`
    - expect: status `200` com `description = "Descrição"` e `category = { id, slug: "music", name: "Music", sort_order: 1 }`
  3. `GET /videos/<public_id>` com o mesmo token
    - expect: `200` refletindo `title`, `description`, `visibility` e `category` persistidos

#### 1.2. invalid-bodies-are-rejected

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedVideo(token, 'ready')` → `PATCH /videos/<public_id>` com `{}`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  2. `PATCH /videos/<public_id>` com `{ title: "" }`
    - expect: status `400` com `error = "VALIDATION_ERROR"` (prova do `ValidationPipe` na rota)
  3. `PATCH /videos/<public_id>` com `{ category_id: "00000000-0000-4000-8000-000000000000" }`
    - expect: status `400` com `error = "CATEGORY_NOT_FOUND"`
  4. `PATCH /videos/<public_id>` com `{ status: "published" }`
    - expect: status `400` com `error = "VALIDATION_ERROR"` (campo não editável por `PATCH`; `forbidNonWhitelisted`)

### 2. POST /videos/{publicId}/publish e /unpublish

**Setup:** mesmo bootstrap da seção 1.

#### 2.1. publish-requires-ready-and-title

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedVideo(token, 'processing')` → `POST /videos/<public_id>/publish`
    - expect: status `409` com `error = "VIDEO_NOT_PUBLISHABLE"`; `GET` mostra `status = "draft"`
  2. `seedVideo(token, 'ready')` e `videoRepository.update({ title: '' })` → `POST /videos/<public_id>/publish`
    - expect: status `409` com `error = "VIDEO_NOT_PUBLISHABLE"`
  3. `seedVideo(token, 'ready')` (title padrão "aula") → `POST /videos/<public_id>/publish`
    - expect: status `200` com `status = "published"` e `published_at` ISO-8601 não nulo
  4. Repetir `POST /videos/<public_id>/publish`
    - expect: status `200` com `published_at` idêntico ao do passo 3 (idempotente, não reescreve)

#### 2.2. unpublish-preserves-visibility-and-published-at

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedVideo(token, 'ready')` → `PATCH` com `{ visibility: "unlisted" }` → `POST …/publish`; guardar `published_at`
    - expect: `200` com `status = "published"`
  2. `POST /videos/<public_id>/unpublish`
    - expect: status `200` com `status = "draft"`, `visibility = "unlisted"` e `published_at` igual ao guardado
  3. `POST /videos/<public_id>/unpublish` novamente
    - expect: status `200` (idempotente) com `status = "draft"`
  4. `POST /videos/<public_id>/publish` outra vez
    - expect: `200` com `published_at` igual ao guardado (só a primeira publicação grava)

### 3. Autorização nas três rotas

**Setup:** mesmo bootstrap da seção 1; dois usuários (`owner-edit@example.com`, `intruder-edit@example.com`).

#### 3.1. non-owner-anonymous-and-unknown-are-rejected

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedVideo(ownerToken, 'ready')` → `public_id`
    - expect: seed concluído
  2. Com `intruderToken`: `PATCH /videos/<public_id>` (`{ title: "x" }`), `POST …/publish`, `POST …/unpublish`
    - expect: as três respondem `403` com `error = "VIDEO_FORBIDDEN"`
    - expect: `GET /videos/<public_id>` com `ownerToken` mostra `title` e `status` inalterados
  3. Sem `Authorization`: as mesmas três chamadas
    - expect: as três respondem `401`
  4. Com `ownerToken`: `PATCH /videos/AAAAAAAAAAA`
    - expect: `404` com `error = "VIDEO_NOT_FOUND"`
