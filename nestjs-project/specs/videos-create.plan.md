---
subproject: backend
runner: jest+supertest
scope: phase-03-upload-processing
si: SI-03.5
target_file: nestjs-project/test/videos-create.e2e-spec.ts
---

# POST /videos Test Plan

## Application Overview

`POST /videos` é o pré-cadastro do vídeo: valida a declaração do cliente (`original_filename`, `content_type` na allowlist MP4/WebM, `size_bytes` ≤ `UPLOAD_MAX_BYTES`), cria o `Video` como rascunho (`status = draft`, `processing_status = uploading`) com `public_id` único de 11 caracteres, abre a sessão multipart no object storage (`CreateMultipartUpload`), persiste a `VideoUpload` (`part_size`, `part_count`, `expected_bytes`, `expires_at = now + UPLOAD_TTL`) e agenda o job `upload.expire` no `pg-boss` — tudo em uma transação (`phase-03-upload-processing/TD-03`, `TD-07`, `TD-08`, `TD-12`, `TD-14`). Nenhum byte de vídeo passa por este endpoint. Este plano cobre o contrato HTTP do SI-03.5 em um arquivo E2E próprio (`test/videos-create.e2e-spec.ts`), com `describe` único e um `it` por cenário.

**Atenção para o implementador:** a suíte roda **dentro** do container `nestjs-api`, onde `localhost:9000` é o próprio container. Como a assinatura SigV4 fixa o host, a suíte deve sobrescrever `S3_PUBLIC_ENDPOINT` para o host interno alcançável (`http://rustfs:9000`) antes de compilar o módulo, e as asserções sobre URLs comparam com o valor configurado, nunca com o literal `localhost`.

## Test Scenarios

### 1. POST /videos

**Setup:** `beforeAll` — `process.env.UPLOAD_PART_SIZE = '5242880'` e `process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT` antes de `Test.createTestingModule({ imports: [AppModule] }).compile()`; `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` e `app.useGlobalFilters(new DomainExceptionFilter(), new ValidationExceptionFilter())` (reproduz `main.ts`); obter `DataSource`, `StorageService` e o cliente da fila via `app.get`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `pgboss.job`/`pgboss.archive`), `throttlerStorage.storage.clear()` e `abortAllMultipart('videos/')` nos helpers de `src/test/storage.ts`. Helper `authenticate(email)` — registra, confirma (token capturado via spy do `MailService`, padrão de `test/auth.e2e-spec.ts`) e faz login, devolvendo `access_token`. Suíte roda com `--runInBand` (banco e bucket compartilhados).

#### 1.1. valid-declaration-creates-draft-and-multipart

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `authenticate('owner-create@example.com')` e `POST /videos` com `Authorization: Bearer <token>` e body `{ original_filename: "a.mp4", content_type: "video/mp4", size_bytes: 15728640 }`
    - expect: status `201`
    - expect: body `public_id` com 11 caracteres casando `^[A-Za-z0-9_-]{11}$`
    - expect: body `status = "draft"` e `processing_status = "uploading"`
    - expect: body `upload.upload_id` string não vazia, `upload.part_size = 5242880`, `upload.part_count = 3` (`ceil(15728640 / 5242880)`), `upload.expires_at` ISO-8601 no futuro
  2. Consultar `videos` por `public_id`
    - expect: 1 linha com `channel_id` = canal do usuário autenticado, `storage_key = "videos/<public_id>/source"`, `content_type = "video/mp4"`, `size_bytes = 15728640`
  3. Consultar `video_uploads` por `video_id`
    - expect: 1 linha com `state = "active"`, `upload_id` igual ao da resposta, `part_count = 3`, `expected_bytes = 15728640`
  4. `storageService.listParts("videos/<public_id>/source", <upload_id>)`
    - expect: resultado não nulo (sessão multipart existe no storage) com zero partes

#### 1.2. unsupported-media-type-is-rejected-before-storage

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `POST /videos` autenticado com `{ original_filename: "a.mkv", content_type: "video/x-matroska", size_bytes: 1048576 }`
    - expect: status `400`
    - expect: body `{ statusCode: 400, error: "VIDEO_UNSUPPORTED_MEDIA_TYPE", message: <string> }`
  2. Consultar `videos`
    - expect: tabela vazia (nenhum rascunho criado)
  3. `ListMultipartUploads` no bucket com prefixo `videos/` (helper de `src/test/storage.ts`)
    - expect: nenhum multipart em andamento

#### 1.3. size-above-limit-returns-too-large

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `POST /videos` autenticado com `{ original_filename: "big.mp4", content_type: "video/mp4", size_bytes: 10737418241 }` (`UPLOAD_MAX_BYTES` + 1)
    - expect: status `413`
    - expect: body `error = "VIDEO_TOO_LARGE"`
  2. Consultar `videos` e `video_uploads`
    - expect: ambas vazias

#### 1.4. unauthenticated-or-invalid-body-is-rejected

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `POST /videos` sem header `Authorization` com body válido
    - expect: status `401`
  2. `POST /videos` autenticado com `{ original_filename: "a.mp4", content_type: "video/mp4" }` (sem `size_bytes`)
    - expect: status `400`
    - expect: body `error = "VALIDATION_ERROR"` e `message` contendo referência a `size_bytes`
  3. `POST /videos` autenticado com `{ original_filename: "a.mp4", content_type: "video/mp4", size_bytes: 1024, extra: true }`
    - expect: status `400` (propriedade desconhecida rejeitada pelo `whitelist` + `forbidNonWhitelisted`)
  4. Consultar `videos`
    - expect: tabela vazia

#### 1.5. expiration-job-is-scheduled-with-session

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `POST /videos` autenticado com `{ original_filename: "a.webm", content_type: "video/webm", size_bytes: 6291456 }`
    - expect: status `201`; guardar `public_id` e `upload.expires_at`
  2. Consultar `pgboss.job` por `name = 'upload.expire'` e `data->>'videoId'` = id interno do vídeo
    - expect: exatamente 1 job, `state = 'created'`, `singleton_key = 'upload:<videoId>'`
    - expect: `start_after` igual a `upload.expires_at` (tolerância de 1 s)
  3. Consultar `video_uploads` por `video_id`
    - expect: `state = "active"` e `expires_at` igual a `upload.expires_at`

#### 1.6. two-uploads-get-distinct-ids-and-sessions

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-18T19:15:00Z

**Steps:**
  1. `POST /videos` autenticado (mesmo usuário) duas vezes com `{ original_filename: "a.mp4", content_type: "video/mp4", size_bytes: 5242880 }`
    - expect: ambos `201`
    - expect: `public_id` diferentes entre as respostas
    - expect: `upload.upload_id` diferentes entre as respostas
  2. Consultar `videos` e `video_uploads`
    - expect: 2 linhas em cada, com `storage_key` distintos (`videos/<id1>/source` e `videos/<id2>/source`)
  3. `storageService.listParts` para cada par (`storage_key`, `upload_id`)
    - expect: ambos não nulos (duas sessões independentes no storage)
