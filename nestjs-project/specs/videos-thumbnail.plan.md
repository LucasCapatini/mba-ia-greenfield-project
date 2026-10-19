---
subproject: backend
runner: jest+supertest
scope: phase-04-video-channel-management
si: SI-04.6
target_file: nestjs-project/test/videos-thumbnail.e2e-spec.ts
---

# PUT e DELETE /videos/{publicId}/thumbnail Test Plan

## Application Overview

`PUT /videos/{publicId}/thumbnail` recebe a thumbnail customizada do dono por `multipart/form-data` (campo `file`), valida pelos bytes com `sharp` (JPEG/PNG/WebP, ≥ 640×360, ≤ `THUMBNAIL_MAX_BYTES` = 5 MiB), normaliza para JPEG 1280×720 e grava em `thumbnails/{public_id}/custom.jpg`, preenchendo `custom_thumbnail_key`; a thumbnail automática do worker permanece intacta (`video-channel-management/TD-04`). `thumbnail_url` passa a ser a URL pública estável `custom ?? auto` com `?v=` (TD-10). `DELETE /videos/{publicId}/thumbnail` remove a customizada e volta à automática, de forma idempotente. Ambas as rotas são do dono. Este plano cobre o contrato HTTP do SI-04.6 em `test/videos-thumbnail.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** as imagens de entrada são geradas em memória com `sharp({ create: { width, height, channels: 3, background } }).png().toBuffer()`; nada binário no repositório. A suíte roda dentro do container, então `S3_PUBLIC_ENDPOINT` deve ser sobrescrito para `S3_ENDPOINT` (como nas suítes da Fase 03) para que `fetch(thumbnail_url)` funcione; a leitura anônima depende da bucket policy de SI-04.5.

## Test Scenarios

### 1. Enviar thumbnail customizada

**Setup:** `beforeAll` — `process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT`; bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource`, `Repository<Video>` e `StorageService`. `beforeEach` — `cleanAllTables(dataSource)`, `throttlerStorage.storage.clear()`, `cleanPrefix('videos/')`, `cleanPrefix('thumbnails/')`. Helpers: `authenticate(email)`; `seedReadyVideo(token)` — `POST /videos` + `storageService.putObject('thumbnails/<public_id>/auto.jpg', <JPEG 640×360>, 'image/jpeg')` + `videoRepository.update({ processing_status: 'ready', thumbnail_key })`; `png(w, h)`/`bigBuffer(bytes)` geradores em memória.

#### 1.1. valid-png-becomes-normalized-custom-jpeg

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `authenticate('thumb@example.com')`; `seedReadyVideo(token)` → `PUT /videos/<public_id>/thumbnail` com `attach('file', png(1920, 1080), 'capa.png')`
    - expect: status `200`
    - expect: body `has_custom_thumbnail = true` e `thumbnail_url` contendo `thumbnails/<public_id>/custom.jpg?v=`, sem parâmetros `X-Amz-*`
  2. `storageService.headObject('thumbnails/<public_id>/custom.jpg')` e leitura do objeto
    - expect: objeto existe com `content-type: image/jpeg`; `sharp(objeto).metadata()` retorna `format = "jpeg"`, `width = 1280`, `height = 720`
  3. `fetch(thumbnail_url)` sem credenciais
    - expect: status `200` com `content-type: image/jpeg`
  4. `storageService.headObject('thumbnails/<public_id>/auto.jpg')`
    - expect: a thumbnail automática continua existindo

#### 1.2. oversized-and-non-image-files-are-rejected

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedReadyVideo(token)` → `PUT …/thumbnail` com `attach('file', bigBuffer(6 * 1024 * 1024), 'grande.png')`
    - expect: status `413` com `error = "THUMBNAIL_TOO_LARGE"`
  2. `PUT …/thumbnail` com `attach('file', Buffer.from('não sou imagem'), 'falso.png')`
    - expect: status `400` com `error = "THUMBNAIL_INVALID"`
  3. `PUT …/thumbnail` com `attach('file', png(320, 180), 'pequena.png')`
    - expect: status `400` com `error = "THUMBNAIL_INVALID"`
  4. `PUT …/thumbnail` sem campo `file` (multipart vazio)
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  5. `GET /videos/<public_id>`
    - expect: `has_custom_thumbnail = false` (nenhuma rejeição gravou chave) e `custom.jpg` ausente no storage

### 2. Remover thumbnail customizada

**Setup:** mesmo bootstrap da seção 1.

#### 2.1. delete-reverts-to-automatic-and-is-idempotent

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. `seedReadyVideo(token)` → `PUT …/thumbnail` com `png(1280, 720)`
    - expect: `200` com `has_custom_thumbnail = true`
  2. `DELETE /videos/<public_id>/thumbnail`
    - expect: status `204`
    - expect: `GET /videos/<public_id>` retorna `has_custom_thumbnail = false` e `thumbnail_url` contendo `thumbnails/<public_id>/auto.jpg?v=`
    - expect: `custom.jpg` ausente no storage
  3. `DELETE /videos/<public_id>/thumbnail` novamente
    - expect: status `204`
  4. Com outro usuário autenticado: `PUT …/thumbnail` e `DELETE …/thumbnail`
    - expect: ambos `403` com `error = "VIDEO_FORBIDDEN"`; sem token, ambos `401`
