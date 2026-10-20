---
subproject: backend
runner: jest+supertest
scope: phase-04-video-channel-management
si: SI-04.9
target_file: nestjs-project/test/videos-delete.e2e-spec.ts
---

# DELETE /videos/{publicId} e job video.delete Test Plan

## Application Overview

`DELETE /videos/{publicId}` exclui um vídeo do dono com hard delete transacional: se há sessão multipart `active`, aborta-a no storage antes; então, na mesma transação, apaga a linha (a `VideoUpload` cai em cascata) e enfileira `video.delete` com as chaves de storage (`singletonKey: video-delete:<videoId>`, 3 tentativas com backoff) — `video-channel-management/TD-09`, mesmo padrão de `phase-03-videos/TD-11`. O `VideoDeletionWorker` remove `videos/{publicId}/source` e as thumbnails, tolerando objetos ausentes. Este plano cobre o contrato HTTP do SI-04.9 e o efeito do worker em `test/videos-delete.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** como em `test/videos-upload-flow.e2e-spec.ts`, os handlers do worker rodam no próprio processo de teste sobre o schema `pgboss_test` (o shim `jest-env.cjs` já isola do `video-worker` do compose). A remoção é assíncrona: aguardar com polling (1 s, até 20 s) até `headObject` retornar `null`. `S3_PUBLIC_ENDPOINT` sobrescrito para `S3_ENDPOINT`.

## Test Scenarios

### 1. Excluir vídeo pronto

**Setup:** `beforeAll` — `process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT`; bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter` e do consumo da fila `video.delete` no processo de teste; obter `DataSource`, `Repository<Video>`, `StorageService`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `pgboss_test.job`), `throttlerStorage.storage.clear()`, `cleanPrefix('videos/')`, `cleanPrefix('thumbnails/')`. Helpers: `authenticate(email)`; `seedReadyVideo(token, { withCustomThumbnail })` — `POST /videos`, `putObject` de `source` (fixture MP4), `auto.jpg` e opcionalmente `custom.jpg`, `update` com `processing_status: 'ready'`, `thumbnail_key`, `custom_thumbnail_key`; `waitUntilGone(key)`.

#### 1.1. owner-deletes-ready-video-and-worker-frees-storage

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('apagar@example.com')`; `seedReadyVideo(token, { withCustomThumbnail: true })` → `DELETE /videos/<public_id>`
    - expect: status `204` com corpo vazio
  2. `GET /videos/<public_id>` com o mesmo token
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
    - expect: `SELECT count(*) FROM video_uploads WHERE video_id = <id>` retorna 0
  3. `waitUntilGone` para `videos/<public_id>/source`, `thumbnails/<public_id>/auto.jpg` e `thumbnails/<public_id>/custom.jpg`
    - expect: os três `headObject` retornam `null` dentro do prazo
  4. Consultar `pgboss_test.job` pela fila `video.delete`
    - expect: um único job com `singletonKey = video-delete:<videoId>` em estado `completed`

### 2. Excluir durante o upload

**Setup:** mesmo bootstrap da seção 1.

#### 2.1. deleting-with-active-upload-aborts-multipart

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `POST /videos` (sessão `active`, nenhuma parte enviada); guardar `upload_id`
    - expect: `201` com `processing_status = "uploading"`
  2. `DELETE /videos/<public_id>`
    - expect: status `204`
  3. `storageService.listParts(storage_key, upload_id)`
    - expect: retorna `null` (o multipart deixou de existir)
  4. `GET /videos/<public_id>/upload`
    - expect: `404` com `error = "VIDEO_NOT_FOUND"`

### 3. Autorização

**Setup:** mesmo bootstrap da seção 1; dois usuários (`dono-del@example.com`, `intruso-del@example.com`).

#### 3.1. non-owner-anonymous-and-unknown-cannot-delete

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedReadyVideo(donoToken, { withCustomThumbnail: false })`
    - expect: seed concluído
  2. `DELETE /videos/<public_id>` com `intrusoToken`
    - expect: status `403` com `error = "VIDEO_FORBIDDEN"`
    - expect: `GET /videos/<public_id>` com `donoToken` continua `200` e `source` continua no storage
  3. `DELETE /videos/<public_id>` sem `Authorization`
    - expect: status `401`
  4. `DELETE /videos/AAAAAAAAAAA` com `donoToken`
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
