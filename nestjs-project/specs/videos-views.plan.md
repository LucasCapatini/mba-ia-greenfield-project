---
subproject: backend
runner: jest+supertest
scope: phase-05-watch-page
si: SI-05.4
target_file: nestjs-project/test/videos-views.e2e-spec.ts
---

# POST /videos/{publicId}/views Test Plan

## Application Overview

`POST /videos/{publicId}/views` registra uma visualização disparada pelo player após o limiar de reprodução (`watch-page/TD-01`). É público com autenticação opcional e segue a regra de leitura do `GET /videos/{publicId}` (rascunho alheio → 404). Responde `204` sempre que o vídeo é legível, tenha contado ou não. Só conta quando o vídeo está `published`, o solicitante não é o dono do canal e a linha `(video_id, viewer_key, window_start)` ainda não existia em `video_views` — `viewer_key` = `user:{id}` para autenticados e `anon:{sha256}` (salt diário + IP real + `User-Agent`) para anônimos, `window_start` = dia UTC (`watch-page/TD-02`, Revisions 2026-10-19). O incremento de `videos.view_count` acontece na mesma transação do insert. O IP vem de `req.ip`, resolvido pelo `trust proxy` de `TRUST_PROXY` (SI-05.1). Este plano cobre o SI-05.4 em `test/videos-views.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** o app de teste configura `app.set('trust proxy', 'loopback')` para que o `X-Forwarded-For` enviado pelo supertest (conexão em loopback) defina `req.ip` — é assim que os cenários simulam visitantes distintos. Sempre enviar `User-Agent` explícito para o hash ser determinístico.

## Test Scenarios

### 1. Contagem e deduplicação

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter` e `trust proxy` = `loopback`; obter `DataSource`, `Repository<Video>`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `video_views`), `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)`; `seedVideo(token, { status, processing_status })`; `viewCount(publicId)` lê `view_count` direto do repositório.

#### 1.1. anonymous-view-counts-once-per-day

**Covers AC:** #1, #2
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('canal@example.com')`; `seedVideo(token, { status: 'published', processing_status: 'ready' })`
    - expect: `viewCount(public_id)` = 0
  2. `POST /videos/<public_id>/views` sem `Authorization`, com `X-Forwarded-For: 203.0.113.10` e `User-Agent: e2e-agent`
    - expect: status `204` com corpo vazio
    - expect: `viewCount(public_id)` = 1
    - expect: `GET /videos/<public_id>` anônimo devolve `view_count = 1`
  3. Repetir a mesma requisição (mesmo IP e `User-Agent`)
    - expect: status `204`
    - expect: `viewCount(public_id)` continua 1 e `video_views` tem 1 linha para o vídeo
  4. Repetir com `X-Forwarded-For: 203.0.113.11`
    - expect: status `204` e `viewCount(public_id)` = 2

#### 1.2. distinct-authenticated-users-count-separately

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('canal@example.com')`; `seedVideo(ownerToken, { status: 'published', processing_status: 'ready' })`; `authenticate('ana@example.com')`; `authenticate('bia@example.com')`
    - expect: três usuários e um vídeo publicado
  2. `POST /videos/<public_id>/views` com o `Bearer` de `ana`, depois com o `Bearer` de `bia` (mesmo `X-Forwarded-For` e `User-Agent`)
    - expect: as duas respostas `204`
    - expect: `viewCount(public_id)` = 2
    - expect: `video_views` tem as chaves `user:<id de ana>` e `user:<id de bia>`

#### 1.3. stored-viewer-keys-never-contain-raw-ip

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `seedVideo` publicado; `POST /videos/<public_id>/views` anônimo com `X-Forwarded-For: 198.51.100.77` e `User-Agent: e2e-agent`
    - expect: status `204`
  2. `SELECT viewer_key FROM video_views`
    - expect: a única chave começa com `anon:` seguida de 64 caracteres hexadecimais
    - expect: nenhuma linha contém a string `198.51.100.77`

### 2. Dono e rascunhos

**Setup:** mesmo da seção 1.

#### 2.1. owner-view-returns-204-without-counting

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('dono@example.com')`; `seedVideo(token, { status: 'published', processing_status: 'ready' })` e `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: um vídeo publicado e um rascunho do mesmo dono
  2. `POST /videos/<publicado>/views` e `POST /videos/<rascunho>/views` com o `Bearer` do dono
    - expect: as duas respostas `204`
    - expect: `viewCount` dos dois continua 0 e `video_views` está vazia

#### 2.2. anonymous-view-on-draft-returns-404

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. `authenticate('rascunho@example.com')`; `seedVideo(token, { status: 'draft', processing_status: 'ready' })`
    - expect: rascunho criado
  2. `POST /videos/<public_id>/views` sem `Authorization`
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
    - expect: `video_views` continua vazia
