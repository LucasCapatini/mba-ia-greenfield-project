---
subproject: backend
runner: jest+supertest
scope: phase-03-upload-processing
si: SI-03.6
target_file: nestjs-project/test/videos-upload.e2e-spec.ts
---

# Upload multipart — parts, state, complete e abort Test Plan

## Application Overview

Os quatro endpoints de `/videos/{publicId}/upload*` orquestram o multipart pré-assinado sem que nenhum byte passe pela API (`phase-03-upload-processing/TD-03`): `POST …/upload/parts` emite URLs de `UploadPart` em lote (cliente público, `UPLOAD_URL_TTL`); `GET …/upload` devolve as partes já aceitas via `ListParts` para retomada; `POST …/upload/complete` valida a lista do cliente contra o storage, chama `CompleteMultipartUpload`, grava `size_bytes`, marca a sessão `completed`, transita `processing_status` `uploading → processing` e enfileira `video.process` com `singletonKey video:<id>` na mesma transação (`TD-11`); `DELETE …/upload` aborta o multipart e remove o rascunho (`TD-12`). Todos exigem o dono do canal (`### Authorization Matrix`). Este plano cobre o contrato HTTP do SI-03.6 em `test/videos-upload.e2e-spec.ts`, com `describe` único e um `it` por cenário.

**Atenção para o implementador:** a suíte roda dentro do container `nestjs-api`; `S3_PUBLIC_ENDPOINT` deve ser sobrescrito para `http://rustfs:9000` antes de compilar o módulo (a assinatura fixa o host), e os `PUT` das partes usam `fetch` nativo do Node contra as URLs devolvidas. Com `UPLOAD_PART_SIZE = 5 MiB`, um arquivo de 12 MiB gera 3 partes (5 + 5 + 2 MiB) — "10 GB sem 10 GB" (`TD-13`).

## Test Scenarios

### 1. POST /videos/{publicId}/upload/parts

**Setup:** `beforeAll` — `process.env.UPLOAD_PART_SIZE = '5242880'`, `process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT`, bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter` (reproduz `main.ts`); obter `DataSource` e `StorageService` via `app.get`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `pgboss.*`), `throttlerStorage.storage.clear()`, `abortAllMultipart('videos/')` + `cleanPrefix('videos/')`. Helpers: `authenticate(email)` (registro + confirmação via spy do `MailService` + login → `access_token`); `createUpload(token, sizeBytes)` → `POST /videos` com `content_type: "video/mp4"`; `putPart(url, buffer)` → `fetch(url, { method: 'PUT', body })` devolvendo o header `ETag`; `buffers(sizeBytes)` → fatias de 5 MiB preenchidas com bytes determinísticos. Suíte roda com `--runInBand`.

#### 1.1. owner-gets-presigned-urls-for-batch

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `authenticate('owner-parts@example.com')`; `createUpload(token, 12582912)` (12 MiB → `part_count = 3`)
    - expect: `201`
  2. `POST /videos/<public_id>/upload/parts` autenticado com `{ part_numbers: [1, 2, 3] }`
    - expect: status `200`
    - expect: body `upload_id` igual ao do pré-cadastro, `part_size = 5242880`, `expires_at` no futuro
    - expect: `parts` com 3 itens, `part_number` 1, 2 e 3, `url` distintas, todas iniciando com `S3_PUBLIC_ENDPOINT` configurado e contendo `partNumber=` e `uploadId=` na query string
  3. `POST …/upload/parts` autenticado com `{ part_numbers: [4] }` (acima de `part_count`)
    - expect: status `400` com `error = "VALIDATION_ERROR"`
  4. `POST …/upload/parts` autenticado com `{ part_numbers: [1, 1] }`
    - expect: status `400` (`ArrayUnique`)

### 2. GET /videos/{publicId}/upload

**Setup:** mesmo bootstrap da seção 1.

#### 2.1. state-lists-parts-accepted-by-storage

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(token, 12582912)`; `POST …/upload/parts` com `{ part_numbers: [1, 2, 3] }`
    - expect: `200` com 3 URLs
  2. `putPart(urls[1], buffers[0])` e `putPart(urls[2], buffers[1])` (partes 1 e 2; a parte 3 não é enviada)
    - expect: ambos `200` com header `ETag` não vazio
  3. `GET /videos/<public_id>/upload` autenticado
    - expect: status `200`
    - expect: body `state = "active"`, `part_size = 5242880`, `part_count = 3`, `expected_bytes = 12582912`
    - expect: `uploaded_parts` com exatamente 2 itens — `part_number` 1 e 2, cada um com `etag` igual ao devolvido pelo `PUT` e `size = 5242880`

### 3. POST /videos/{publicId}/upload/complete

**Setup:** mesmo bootstrap da seção 1.

#### 3.1. complete-with-all-parts-starts-processing

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(token, 12582912)`; obter URLs para `[1, 2, 3]`; `putPart` das 3 partes (5 MiB, 5 MiB, 2 MiB) guardando os ETags
    - expect: 3 × `200`
  2. `POST /videos/<public_id>/upload/complete` autenticado com `{ parts: [{ part_number: 1, etag }, { part_number: 2, etag }, { part_number: 3, etag }] }`
    - expect: status `202`
    - expect: body `public_id`, `status = "draft"`, `processing_status = "processing"`, `size_bytes = 12582912`
  3. `storageService.headObject("videos/<public_id>/source")`
    - expect: objeto existe com `ContentLength = 12582912` e `ContentType = "video/mp4"`
  4. Consultar `videos` e `video_uploads`
    - expect: `videos.processing_status = "processing"`, `videos.size_bytes = 12582912`; `video_uploads.state = "completed"` com `completed_at` preenchido
  5. Consultar `pgboss.job` por `name = 'video.process'` e `data->>'videoId'` = id do vídeo
    - expect: exatamente 1 job com `singleton_key = 'video:<videoId>'`, `retry_limit = 3`

#### 3.2. complete-with-missing-part-is-rejected

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(token, 12582912)`; obter URLs para `[1, 2, 3]`; `putPart` apenas das partes 1 e 2
    - expect: 2 × `200`
  2. `POST …/upload/complete` com `{ parts: [{ part_number: 1, etag }, { part_number: 2, etag }] }`
    - expect: status `422`
    - expect: body `error = "UPLOAD_INCOMPLETE"`
  3. `POST …/upload/complete` com 3 itens onde o `etag` da parte 2 é `"\"deadbeef\""`
    - expect: status `422` com `error = "UPLOAD_INCOMPLETE"`
  4. Consultar `videos` e `video_uploads`
    - expect: `processing_status = "uploading"`, `state = "active"`, `size_bytes` ainda o declarado
  5. Consultar `pgboss.job` por `name = 'video.process'`
    - expect: nenhum job

### 4. DELETE /videos/{publicId}/upload

**Setup:** mesmo bootstrap da seção 1.

#### 4.1. abort-removes-draft-and-multipart

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(token, 5242880)`; `POST …/upload/parts` com `[1]` e `putPart` da parte 1
    - expect: `200`
  2. `DELETE /videos/<public_id>/upload` autenticado
    - expect: status `204` com body vazio
  3. `GET /videos/<public_id>` autenticado
    - expect: status `404` com `error = "VIDEO_NOT_FOUND"`
  4. `storageService.listParts("videos/<public_id>/source", <upload_id>)`
    - expect: `null` (multipart abortado) e `ListMultipartUploads` com prefixo `videos/<public_id>/` vazio
  5. Consultar `videos` e `video_uploads`
    - expect: nenhuma linha para o `public_id`

#### 4.2. completed-session-rejects-further-upload-operations

**Covers AC:** #7
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(token, 5242880)`; URLs para `[1]`; `putPart`; `POST …/upload/complete` com a parte 1
    - expect: `202`
  2. `POST /videos/<public_id>/upload/parts` autenticado com `{ part_numbers: [1] }`
    - expect: status `409` com `error = "UPLOAD_NOT_ACTIVE"`
  3. `GET /videos/<public_id>/upload` autenticado
    - expect: status `409` com `error = "UPLOAD_NOT_ACTIVE"`
  4. `DELETE /videos/<public_id>/upload` autenticado
    - expect: status `409` com `error = "UPLOAD_NOT_ACTIVE"`
  5. `storageService.headObject("videos/<public_id>/source")`
    - expect: objeto continua existindo

### 5. Autorização nas rotas de upload

**Setup:** mesmo bootstrap da seção 1; dois usuários autenticados (`owner-auth@example.com` e `intruder@example.com`).

#### 5.1. non-owner-and-unknown-ids-are-rejected

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `createUpload(ownerToken, 5242880)` → `public_id`
    - expect: `201`
  2. Com `intruderToken`: `POST /videos/<public_id>/upload/parts` `{ part_numbers: [1] }`, `GET /videos/<public_id>/upload`, `POST /videos/<public_id>/upload/complete` `{ parts: [] }`, `DELETE /videos/<public_id>/upload`
    - expect: todos `403` com `error = "VIDEO_FORBIDDEN"`
  3. Com `ownerToken`, as mesmas quatro rotas com `publicId = "AAAAAAAAAAA"` (inexistente)
    - expect: todos `404` com `error = "VIDEO_NOT_FOUND"`
  4. Sem header `Authorization`, as mesmas quatro rotas com o `public_id` real
    - expect: todos `401`
  5. Consultar `video_uploads` do vídeo do dono
    - expect: `state = "active"` (nenhuma operação do intruso alterou a sessão)
