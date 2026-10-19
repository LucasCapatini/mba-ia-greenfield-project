---
subproject: backend
runner: jest+supertest
scope: phase-04-video-channel-management
si: SI-04.7
target_file: nestjs-project/test/channels-me.e2e-spec.ts
---

# GET/PATCH /channels/me e GET /channels/{nickname} Test Plan

## Application Overview

`GET /channels/me` devolve o canal do usuário autenticado (`ChannelResponse`: `id`, `nickname`, `name`, `description`, `video_count`, `created_at`, `updated_at`); `PATCH /channels/me` edita parcialmente `nickname`, `name` e `description` com a política de TD-08 — nickname na URL, mutável, sem redirecionamento, allowlist `^[a-z0-9_]{3,50}$` herdada de `phase-02-auth/TD-10`, lista de reservados e `409 NICKNAME_TAKEN` em conflito. `GET /channels/{nickname}` é público (`ChannelPublicResponse`) e `video_count` conta só vídeos `published` + `public`. Este plano cobre o contrato HTTP do SI-04.7 em `test/channels-me.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** o nickname inicial vem do prefixo do e-mail no cadastro (ex.: `canal_a@example.com` → `canal_a`). Os vídeos para `video_count` são semeados direto no repositório (`status`/`visibility`) após `POST /videos`.

## Test Scenarios

### 1. Leitura do próprio canal

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource` e `Repository<Video>`. `beforeEach` — `cleanAllTables(dataSource)` preservando `categories`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, visibility })` — `POST /videos` + `videoRepository.update({ processing_status: 'ready', status, visibility })`.

#### 1.1. me-returns-own-channel-and-requires-auth

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('canal_a@example.com')` → `GET /channels/me`
    - expect: status `200`
    - expect: body `{ id, nickname: "canal_a", name: "canal_a", description: null, video_count: 0, created_at, updated_at }`
  2. `GET /channels/me` sem `Authorization`
    - expect: status `401`
  3. `PATCH /channels/me` sem `Authorization` com `{ name: "x" }`
    - expect: status `401`

### 2. Edição do canal e política de nickname

**Setup:** mesmo bootstrap da seção 1; dois usuários (`canal_a@example.com`, `canal_b@example.com`).

#### 2.1. changing-nickname-moves-the-public-url

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Com `tokenA`: `PATCH /channels/me` com `{ nickname: "novo_nick", name: "Canal Novo", description: "Sobre o canal" }`
    - expect: status `200` com `nickname = "novo_nick"`, `name = "Canal Novo"`, `description = "Sobre o canal"` e `updated_at` posterior ao anterior
  2. `GET /channels/novo_nick` sem token
    - expect: status `200` com `nickname = "novo_nick"` e `name = "Canal Novo"`
  3. `GET /channels/canal_a` sem token
    - expect: status `404` com `error = "CHANNEL_NOT_FOUND"` (sem redirecionamento)
  4. Com `tokenB`: `PATCH /channels/me` com `{ nickname: "canal_a" }`
    - expect: status `200` (o nickname antigo foi liberado imediatamente)

#### 2.2. taken-reserved-and-malformed-nicknames-are-rejected

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Com `tokenA`: `PATCH /channels/me` com `{ nickname: "canal_b" }` (nickname de B)
    - expect: status `409` com `error = "NICKNAME_TAKEN"`
  2. `PATCH /channels/me` com `{ nickname: "admin" }`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  3. `PATCH /channels/me` com `{ nickname: "Ab" }` e com `{ nickname: "@canal" }`
    - expect: ambos `400` com `error = "VALIDATION_ERROR"` (prova do `ValidationPipe`)
  4. `PATCH /channels/me` com `{}` e com `{ name: "" }`
    - expect: ambos `400` com `error = "VALIDATION_ERROR"`
  5. `GET /channels/me` com `tokenA`
    - expect: `nickname = "canal_a"` inalterado

### 3. Página pública do canal

**Setup:** mesmo bootstrap da seção 1.

#### 3.1. public-channel-counts-only-published-public-videos

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Com `tokenA`: semear 2 vídeos `published` + `public`, 1 `published` + `unlisted` e 1 `draft` + `public`
    - expect: seeds concluídos
  2. `GET /channels/canal_a` sem `Authorization`
    - expect: status `200` com body `{ nickname: "canal_a", name, description, video_count: 2, created_at }`
    - expect: o body não contém `id`, `user_id` nem e-mail
  3. `GET /channels/me` com `tokenA`
    - expect: `video_count = 2` (mesma regra)
  4. `GET /channels/nao_existe`
    - expect: status `404` com `error = "CHANNEL_NOT_FOUND"`
