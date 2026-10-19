---
subproject: backend
runner: jest+supertest
scope: phase-03-upload-processing
si: SI-03.10
target_file: nestjs-project/test/videos-playback.e2e-spec.ts
---

# GET /videos/{publicId} e GET /videos/{publicId}/playback Test Plan

## Application Overview

`GET /videos/{publicId}` devolve ao dono o estado do vídeo (eixo `processing_status`, `processing_error` quando `failed`, metadados extraídos pelo worker e `thumbnail_url` pré-assinada quando `ready`). `GET /videos/{publicId}/playback` emite, para vídeos `ready`, `stream_url` e `download_url` pré-assinadas com o cliente público e `expiresIn = PLAYBACK_URL_TTL`; o storage atende `Range` (206) e `Content-Disposition: attachment` (`phase-03-upload-processing/TD-09`, `TD-02`). Na Fase 03 todo vídeo é rascunho privado ao dono (AMB-1 → `TD-09`): anônimo recebe `401`, não-dono `403 VIDEO_FORBIDDEN`. Este plano cobre o contrato HTTP do SI-03.10 em `test/videos-playback.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** este spec testa os endpoints de leitura isoladamente do worker — o estado `ready`/`failed` é semeado diretamente no banco após subir o objeto no storage (o fluxo completo com o worker real é o `test/videos-upload-flow.e2e-spec.ts` do SI-03.11). `S3_PUBLIC_ENDPOINT` deve ser sobrescrito para `http://rustfs:9000` (a suíte roda dentro do container) e `PLAYBACK_URL_TTL` para um valor curto (ex.: `2` segundos) para o cenário de expiração.

## Test Scenarios

### 1. GET /videos/{publicId}

**Setup:** `beforeAll` — `process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT`, `process.env.PLAYBACK_URL_TTL = '2'`, bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`, `Repository<Video>` e `StorageService` via `app.get`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`, `cleanPrefix('videos/')` + `cleanPrefix('thumbnails/')`. Helpers: `authenticate(email)`; `seedVideo(token, state)` — `POST /videos` (`content_type: "video/mp4"`, `size_bytes` = tamanho da fixture) e então, conforme `state`: `uploading` (nada mais); `processing` (`videoRepository.update({ processing_status: 'processing' })`); `ready` (`storageService.putObject(storage_key, <fixture MP4 de src/test/video-fixtures.ts>, 'video/mp4')`, `putObject('thumbnails/<public_id>/auto.jpg', <JPEG pequeno>, 'image/jpeg')` e `update` com `processing_status: 'ready'`, `duration_seconds: 2`, `width: 320`, `height: 240`, `container: 'mp4'`, `video_codec: 'h264'`, `audio_codec: 'aac'`, `thumbnail_key`, `processed_at: now`); `failed` (`update` com `processing_status: 'failed'`, `processing_error: 'UNSUPPORTED_FORMAT'`, `processing_error_detail: 'codec hevc'`). Suíte roda com `--runInBand`.

#### 1.1. owner-reads-state-metadata-and-error

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `authenticate('owner-read@example.com')`; `seedVideo(token, 'uploading')` → `GET /videos/<public_id>`
    - expect: status `200`
    - expect: body `public_id`, `status = "draft"`, `processing_status = "uploading"`, `processing_error = null`, `original_filename`, `content_type = "video/mp4"`, `duration_seconds = null`, `thumbnail_url = null`, `processed_at = null`, `created_at` ISO-8601
  2. `seedVideo(token, 'ready')` → `GET /videos/<public_id>`
    - expect: status `200` com `processing_status = "ready"`, `duration_seconds = 2`, `width = 320`, `height = 240`, `container = "mp4"`, `video_codec = "h264"`, `audio_codec = "aac"`, `processed_at` não nulo
    - expect: `thumbnail_url` iniciando com `S3_PUBLIC_ENDPOINT` configurado; `fetch(thumbnail_url)` responde `200` com `content-type: image/jpeg`
  3. `seedVideo(token, 'failed')` → `GET /videos/<public_id>`
    - expect: status `200` com `processing_status = "failed"` e `processing_error = "UNSUPPORTED_FORMAT"`

### 2. GET /videos/{publicId}/playback

**Setup:** mesmo bootstrap da seção 1.

#### 2.1. ready-video-returns-signed-stream-and-download-urls

**Covers AC:** #2, #3
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `seedVideo(token, 'ready')` com `original_filename: "meu video.mp4"` → `GET /videos/<public_id>/playback` autenticado
    - expect: status `200`
    - expect: body `stream_url` e `download_url` iniciando com `S3_PUBLIC_ENDPOINT` configurado, `thumbnail_url` não nulo, `expires_at` ISO-8601 no futuro (≈ now + `PLAYBACK_URL_TTL`)
  2. `fetch(stream_url, { headers: { Range: 'bytes=0-1023' } })`
    - expect: status `206`
    - expect: header `content-range` iniciando com `bytes 0-1023/` e corpo com exatamente 1 024 bytes
  3. `fetch(download_url, { method: 'HEAD' })` (ou `GET` lendo só os headers)
    - expect: status `200`
    - expect: header `content-disposition` igual a `attachment; filename="meu video.mp4"`

#### 2.2. not-ready-video-returns-video-not-ready

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `seedVideo(token, 'processing')` → `GET /videos/<public_id>/playback` autenticado
    - expect: status `409` com body `error = "VIDEO_NOT_READY"`
  2. `seedVideo(token, 'failed')` → `GET /videos/<public_id>/playback` autenticado
    - expect: status `409` com `error = "VIDEO_NOT_READY"`
  3. `seedVideo(token, 'uploading')` → `GET /videos/<public_id>/playback` autenticado
    - expect: status `409` com `error = "VIDEO_NOT_READY"`

#### 2.3. expired-signed-url-is-refused-by-storage

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `seedVideo(token, 'ready')` → `GET /videos/<public_id>/playback` (com `PLAYBACK_URL_TTL = 2`)
    - expect: `200`; guardar `stream_url`
  2. Aguardar 3 s e `fetch(stream_url, { headers: { Range: 'bytes=0-1023' } })`
    - expect: status `403` (assinatura expirada, recusada pelo storage sem envolver a API)
  3. `GET /videos/<public_id>/playback` novamente
    - expect: `200` com `stream_url` diferente da anterior e `expires_at` renovado

### 3. Autorização nas rotas de leitura

**Setup:** mesmo bootstrap da seção 1; dois usuários autenticados (`owner-play@example.com` e `intruder-play@example.com`).

#### 3.1. non-owner-anonymous-and-unknown-ids-are-rejected

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `seedVideo(ownerToken, 'ready')` → `public_id`
    - expect: `201` + seed concluído
  2. Sem header `Authorization`: `GET /videos/<public_id>` e `GET /videos/<public_id>/playback`
    - expect: ambos `401`
  3. Com `intruderToken`: `GET /videos/<public_id>` e `GET /videos/<public_id>/playback`
    - expect: ambos `403` com `error = "VIDEO_FORBIDDEN"`
    - expect: nenhuma URL assinada presente no body
  4. Com `ownerToken`: `GET /videos/AAAAAAAAAAA` e `GET /videos/AAAAAAAAAAA/playback`
    - expect: ambos `404` com `error = "VIDEO_NOT_FOUND"`
