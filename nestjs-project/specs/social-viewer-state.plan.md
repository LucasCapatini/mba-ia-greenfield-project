---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.4
target_file: nestjs-project/test/social-viewer-state.e2e-spec.ts
---

# Estado do espectador em GET /videos/{publicId} e GET /channels/{nickname} Test Plan

## Application Overview

As leituras públicas que as páginas já fazem passam a carregar o estado do espectador (`social-interactions/TD-04`): `GET /videos/{publicId}` ganha `viewer_reaction` (`'like' | 'dislike' | null`) e o `channel` embutido vira `VideoChannel` (`{ nickname, name, subscriber_count, viewer_subscribed }`); `GET /channels/{nickname}` ganha `subscriber_count` e `viewer_subscribed`. Anônimo recebe `null`/`false`. As listagens (`/channels/{nickname}/videos`, `/related`) continuam com `channel: { nickname, name }`. Este plano cobre o SI-06.4 em `test/social-viewer-state.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Vídeo

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, processing_status, visibility })`.

#### 1.1. anonymous-gets-neutral-viewer-state

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('criador@example.com')`; `seedVideo(token, { status: 'published', processing_status: 'ready' })`
    - expect: vídeo publicado
  2. `GET /videos/<public_id>` sem `Authorization`
    - expect: status `200` com `viewer_reaction: null`
    - expect: `channel` = `{ nickname: "criador", name, subscriber_count: 0, viewer_subscribed: false }`

#### 1.2. authenticated-sees-own-reaction-and-subscription

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Vídeo publicado de `criador`; `authenticate('ana@example.com')`
    - expect: `ana` autenticada
  2. `ana` envia `PUT /videos/<public_id>/reaction { "value": "like" }` e `PUT /channels/criador/subscription`
    - expect: as duas respostas `200`
  3. `GET /videos/<public_id>` com o `Bearer` de `ana`
    - expect: `viewer_reaction: "like"`, `like_count: 1`
    - expect: `channel.subscriber_count: 1` e `channel.viewer_subscribed: true`
  4. O mesmo `GET` sem `Authorization`
    - expect: `viewer_reaction: null`, `channel.viewer_subscribed: false` e `channel.subscriber_count: 1`

### 2. Canal e listagens

**Setup:** mesmo da seção 1.

#### 2.1. channel-public-read-carries-subscription-state

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('criador@example.com')`; `ana` e `bia` autenticadas; `ana` inscrita em `criador`
    - expect: `subscriber_count` de `criador` = 1
  2. `GET /channels/criador` sem `Authorization`
    - expect: status `200` com `subscriber_count: 1` e `viewer_subscribed: false`
  3. `GET /channels/criador` com o `Bearer` de `ana`, depois com o de `bia`
    - expect: `viewer_subscribed: true` para `ana` e `false` para `bia`

#### 2.2. listings-keep-compact-channel-shape

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Dois vídeos publicados, públicos e prontos de `criador` na mesma categoria; `ana` inscrita em `criador`
    - expect: seed pronto
  2. `GET /channels/criador/videos` e `GET /videos/<um dos vídeos>/related` com o `Bearer` de `ana`
    - expect: cada item traz `channel` com exatamente as chaves `nickname` e `name` (sem `subscriber_count` nem `viewer_subscribed`)
