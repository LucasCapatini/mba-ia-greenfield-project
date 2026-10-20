---
subproject: backend
runner: jest+supertest
scope: phase-05-watch-page
si: SI-05.2
target_file: nestjs-project/test/videos-get.e2e-spec.ts
---

# GET /videos/{publicId} com o canal do vídeo Test Plan

## Application Overview

`GET /videos/{publicId}` é a leitura pública com autenticação opcional (`video-channel-management/TD-07`): o dono vê o vídeo em qualquer `status`, anônimos e outros usuários só veem `published` (public ou unlisted, pois a leitura é por `public_id`), e um rascunho alheio responde 404 sem revelar que existe. Na Fase 05 a resposta `VideoResponse` ganha `channel: { nickname, name }` — o mesmo shape do `VideoCardChannel` das listagens — para a watch page exibir o canal numa única leitura (resolução OQ-1 do `/plan-validate 5`). Todo endpoint que devolve `VideoResponse` (incluindo `PATCH /videos/{publicId}`) passa a carregar o objeto. Este plano cobre o SI-05.2 em `test/videos-get.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Leitura pública com o canal

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource` e `Repository<Video>`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)` (registro + confirmação + login, devolve token e `nickname` do canal); `seedVideo(token, { status, processing_status })` — `POST /videos` e `update` direto no repositório para o estado desejado.

#### 1.1. anonymous-reads-published-video-with-channel

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('canal@example.com')`; `seedVideo(token, { status: 'published', processing_status: 'ready' })`
    - expect: o vídeo existe com `status = published`
  2. `GET /videos/<public_id>` sem `Authorization`
    - expect: status `200`
    - expect: `body.channel` é `{ nickname: <nickname do dono>, name: <nome do canal> }` e não traz outros campos do canal (ex.: `id`, `description`)
    - expect: os campos já existentes de `VideoResponse` (`public_id`, `status`, `visibility`, `view_count`…) continuam presentes

#### 1.2. owner-patch-response-carries-channel

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('dono@example.com')`; `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: rascunho criado
  2. `PATCH /videos/<public_id>` com `Authorization: Bearer <token>` e `{ "title": "Novo título" }`
    - expect: status `200` com `title = "Novo título"`
    - expect: `body.channel.nickname` igual ao `nickname` do dono

### 2. Regra de leitura inalterada

**Setup:** mesmo da seção 1.

#### 2.1. anonymous-gets-404-for-draft

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('rascunho@example.com')`; `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: rascunho criado
  2. `GET /videos/<public_id>` sem `Authorization`
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
    - expect: o corpo não contém `channel` nem nenhum dado do vídeo
