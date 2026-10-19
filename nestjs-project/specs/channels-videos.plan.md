---
subproject: backend
runner: jest+supertest
scope: phase-04-video-channel-management
si: SI-04.8
target_file: nestjs-project/test/channels-videos.e2e-spec.ts
---

# GET /channels/me/videos e GET /channels/{nickname}/videos Test Plan

## Application Overview

As duas listagens paginam por cursor keyset (`{ items, next_cursor }`, `limit` 1..50, default 20; `video-channel-management/TD-06`). `GET /channels/me/videos` é o painel do dono: todos os status, filtros `status`, `visibility`, `processing_status`, `from`/`to`, busca `q` (`ILIKE` em `title`), ordenação `latest|oldest|views` e `total` (o `COUNT` dos filtros, sem o cursor); itens `VideoListItem`. `GET /channels/{nickname}/videos` é público: só `published` + `public`, ordenação `latest|popular|oldest`, itens `VideoCardItem` com `channel: { nickname, name }`. Cursor inválido → `400 VALIDATION_ERROR`; nickname inexistente → `404 CHANNEL_NOT_FOUND`. Este plano cobre o contrato HTTP do SI-04.8 em `test/channels-videos.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** os vídeos são semeados direto no repositório (`videoRepository.insert`) com `channel_id` do usuário, `created_at`/`published_at` espaçados de 1 minuto e `view_count` distinto, para que a ordenação seja determinística; não é preciso abrir multipart no storage.

## Test Scenarios

### 1. Painel do dono

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`, `Repository<Video>` e `ChannelsService`. `beforeEach` — `cleanAllTables(dataSource)` preservando `categories`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)` → `{ token, channelId }`; `seedVideos(channelId, specs[])` — `insert` com `public_id` gerado, `title`, `status`, `visibility`, `processing_status`, `created_at`, `published_at`, `view_count`.

#### 1.1. owner-list-paginates-with-cursor-and-total

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('lista@example.com')`; `seedVideos` com 25 vídeos de status variados → `GET /channels/me/videos`
    - expect: status `200` com `items.length = 20`, `total = 25` e `next_cursor` não nulo
    - expect: itens em `created_at` decrescente, cada um com `{ public_id, title, status, visibility, processing_status, processing_error, thumbnail_url, duration_seconds, view_count, like_count, comment_count, published_at, created_at }`
  2. `GET /channels/me/videos?cursor=<next_cursor>`
    - expect: status `200` com `items.length = 5`, `next_cursor = null`, `total = 25`
    - expect: nenhum `public_id` repetido entre as duas páginas
  3. Inserir um vídeo novo e repetir `GET …?cursor=<next_cursor da página 1>`
    - expect: os mesmos 5 itens (o vídeo novo não desloca a página 2)

#### 1.2. owner-filters-search-and-sort

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedVideos` com títulos "Aula 1", "aula 2", "Outro" (rascunhos) e "Aula publicada" (`published`) → `GET /channels/me/videos?status=draft&q=aula`
    - expect: status `200` com exatamente "Aula 1" e "aula 2" (case-insensitive) e `total = 2`
  2. `GET /channels/me/videos?visibility=unlisted` sobre um seed com 1 `unlisted`
    - expect: apenas esse item e `total = 1`
  3. `GET /channels/me/videos?sort=views`
    - expect: itens em `view_count` decrescente
  4. `GET /channels/me/videos?limit=500` e `?from=2026-10-10&to=2026-10-01`
    - expect: ambos `400` com `error = "VALIDATION_ERROR"`
  5. Sem `Authorization`: `GET /channels/me/videos`
    - expect: `401`

### 2. Listagem pública do canal

**Setup:** mesmo bootstrap da seção 1; nickname do canal = prefixo do e-mail.

#### 2.1. public-list-shows-only-published-public-videos

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('publico@example.com')`; semear 3 `published` + `public`, 1 `published` + `unlisted`, 2 `draft` → `GET /channels/publico/videos` sem token
    - expect: status `200` com `items.length = 3` e `next_cursor = null`
    - expect: cada item é exatamente `{ public_id, title, thumbnail_url, duration_seconds, view_count, published_at, channel: { nickname: "publico", name } }`
    - expect: ordem por `published_at` decrescente; nenhum `unlisted` ou `draft`

#### 2.2. public-list-sort-cursor-and-not-found

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Semear 3 vídeos `published` + `public` com `view_count` 10, 300 e 50 → `GET /channels/publico/videos?sort=popular`
    - expect: status `200` com `view_count` na ordem 300, 50, 10
  2. `GET /channels/publico/videos?sort=oldest`
    - expect: ordem por `published_at` crescente
  3. `GET /channels/publico/videos?cursor=xxx`
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  4. `GET /channels/nao_existe/videos`
    - expect: status `404` com `error = "CHANNEL_NOT_FOUND"`
