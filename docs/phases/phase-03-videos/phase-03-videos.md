---
kind: phase
name: phase-03-videos
test_specs_aware: true
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-10-18T14:44:17-04:00"
  docs/phases/phase-03-videos/library-refs.md: "2026-10-18T14:42:41-04:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-18T14:40:55-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-18T12:13:58-04:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Entregar, no `nestjs-project` e na sua stack Docker, o upload de vídeos de até 10 GB sem impacto na performance (multipart pré-assinado direto no object storage, com retomada), o pré-cadastro automático do vídeo como rascunho ao iniciar o upload, o processamento automático em segundo plano após o upload (extração de duração e metadados e geração de thumbnail a partir de um frame, via fila e worker FFmpeg), a URL única por vídeo sem conflito, e a reprodução via streaming e o download do vídeo por URLs pré-assinadas — cumprindo os entregáveis "upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas".

---

## Step Implementations

### SI-03.1 — Infra: storage, worker e configuração de ambiente

**Description:** Preparar a stack Docker e a configuração do `nestjs-project` para os três containers novos do C4 (object storage, worker e, pela escolha de TD-04, nenhum broker): `ffmpeg` na imagem, serviços `rustfs`/`storage-init`/`video-worker` no compose, chaves de ambiente validadas por Joi e namespaces de config no padrão `registerAs` herdado da Fase 01.

**Technical actions:**

1. Atualizar `nestjs-project/Dockerfile.dev` — `apt install -y ffmpeg` junto de `procps curl` (imagem `node:25.6.0-slim`, bookworm → ffmpeg 5.1.9), mantendo o `chown` do volume `node_modules` (per `phase-03-videos/TD-06`, `TD-10`)
2. Adicionar a `nestjs-project/compose.yaml` os serviços `rustfs` (imagem `rustfs/rustfs:1.0.3`, portas `9000:9000`/`9001:9001`, volume nomeado `rustfs_data:/data`, env `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY` lidas do `.env`, healthcheck `curl -f http://localhost:9000/health`, rede `streamtube`), `storage-init` (imagem `amazon/aws-cli`, one-shot idempotente: `s3api create-bucket` + `s3api put-bucket-cors` liberando `PUT`/`GET`/`HEAD` de `http://localhost:3001` com `ETag` exposto + regra de lifecycle `AbortIncompleteMultipartUpload` de 2 dias; `depends_on: rustfs: service_healthy`) e `video-worker` (mesmo `build` da API, mesmos volumes, `command: npm run start:worker`, `depends_on` `db` healthy + `storage-init` `service_completed_successfully`); `nestjs-api` passa a depender de `storage-init` do mesmo modo (per `TD-01`, `TD-05`, `TD-10`, `TD-12`)
3. Criar `src/config/storage.config.ts` (`registerAs('storage', …)`: `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`), `src/config/upload.config.ts` (`UPLOAD_PART_SIZE`, `UPLOAD_MAX_BYTES`, `UPLOAD_URL_TTL`, `UPLOAD_TTL`, `PLAYBACK_URL_TTL`) e `src/config/queue.config.ts` (`QUEUE_SCHEMA` default `pgboss`, `QUEUE_SUPERVISE`), registrados em `ConfigModule.forRoot({ load })` do `AppModule` (per `TD-01`, `TD-03`, `TD-04`, `TD-09`, `TD-12`; padrão de `phase-01-configuracao-base/TD-03`)
4. Estender `src/config/env.validation.ts` com as chaves acima (`S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT` `uri().required()`, `S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` `required()`, `S3_REGION` default `us-east-1`, `S3_FORCE_PATH_STYLE` default `true`, `UPLOAD_PART_SIZE` number default 67108864 min 5242880, `UPLOAD_MAX_BYTES` default 10737418240, `UPLOAD_URL_TTL` default 3600, `UPLOAD_TTL` default 86400, `PLAYBACK_URL_TTL` default 43200) e atualizar `.env.example` com valores de dev (`S3_ENDPOINT=http://rustfs:9000`, `S3_PUBLIC_ENDPOINT=http://localhost:9000`, bucket `streamtube-videos`) — nomes de serviço Compose, nunca `localhost`, nas chaves internas (per `phase-01-configuracao-base/TD-02`)
5. Documentar em `nestjs-project/CLAUDE.md` os serviços novos e seus probes (`curl -f http://localhost:9000/health`, console em `http://localhost:9001`, `docker compose logs video-worker`), o volume `rustfs_data`, o script `start:worker` e o schema `pgboss` como segundo mecanismo de migração (per `TD-04`, `TD-10`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `env.validation.ts` | Unit: schema rejeita `S3_ENDPOINT` ausente/inválido e `UPLOAD_PART_SIZE` < 5 MiB; aplica defaults | `src/config/env.validation.spec.ts` (estender) |
| `storage.config.ts` / `upload.config.ts` / `queue.config.ts` | Integration: factories lidos via `ConfigModule` com `.env` real do container | `src/config/env.validation.integration-spec.ts` (estender) |

**Dependencies:** none

**Acceptance criteria:**

- `docker compose up -d` na stack do backend sobe `rustfs` com status `healthy`, `storage-init` termina com código 0 e `nestjs-api`/`video-worker` ficam `running`
- `docker compose exec nestjs-api ffmpeg -version` e `ffprobe -version` respondem com versão 5.1.x
- `curl -f http://localhost:9000/health` retorna 200 e o bucket `streamtube-videos` existe com regra CORS que permite `PUT` de origem `http://localhost:3001`
- A API não inicia (erro Joi no bootstrap) quando `S3_ENDPOINT` ou `S3_SECRET_KEY` estão ausentes do `.env`
- `UPLOAD_PART_SIZE=1048576` (1 MiB) é rejeitado no bootstrap por ser menor que o mínimo S3 de 5 MiB

---

### SI-03.2 — StorageModule: clientes S3, presigner e smoke test contra o RustFS

**Description:** Encapsular toda a conversa com o object storage em um `StorageModule` acoplado apenas à API S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), com um cliente interno para chamadas da API/worker e um cliente de assinatura pública para as URLs que o navegador consome; a suíte de integração é o smoke test que valida o RustFS (presigned multipart, CORS, `Range`, `response-content-disposition`) antes de qualquer outra SI de comportamento.

**Technical actions:**

1. Instalar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` (^3.1152.0) no `nestjs-project` (dentro do container) e `aws-sdk-client-mock` + `aws-sdk-client-mock-jest` (^4.1.0) como devDependencies (per `phase-03-videos/TD-02`, `TD-13`; `library-refs.md` → `@aws-sdk/client-s3`, `aws-sdk-client-mock`)
2. Criar `src/storage/storage.module.ts` com dois providers `S3Client` (tokens `S3_INTERNAL_CLIENT` e `S3_PUBLIC_CLIENT`), ambos com `region`, `credentials`, `forcePathStyle: true`, `requestChecksumCalculation: 'WHEN_REQUIRED'` e `responseChecksumValidation: 'WHEN_REQUIRED'`; o interno usa `S3_ENDPOINT`, o público `S3_PUBLIC_ENDPOINT` e serve **somente** para `getSignedUrl` (per `TD-02`; config de SI-03.1)
3. Criar `src/storage/storage.service.ts` com a superfície usada pela fase: `createMultipartUpload(key, contentType)` → `uploadId`; `presignUploadPart(key, uploadId, partNumber, expiresIn)` (cliente público); `listParts(key, uploadId)` (paginando até 1 000+); `completeMultipartUpload(key, uploadId, parts)`; `abortMultipartUpload(key, uploadId)`; `headObject(key)`; `putObject(key, body, contentType)` (thumbnail); `presignGetObject(key, expiresIn, { responseContentDisposition? }, { public: boolean })` — assinando com o cliente público para o navegador e com o interno para o worker (per `TD-02`, `TD-03`, `TD-06`, `TD-09`; `library-refs.md` → `@aws-sdk/s3-request-presigner`)
4. Mapear falhas do SDK em `StorageUnavailableException` (`STORAGE_UNAVAILABLE`, 503) e `NoSuchUpload`/`NoSuchKey` em resultados tipados (`null`) para que os serviços de domínio decidam o erro (per `phase-02-auth/TD-07`; Error Catalog)
5. Criar `src/test/storage.ts` com helpers de teste (prefixo de chave por suíte `test/<uuid>/`, `cleanPrefix()` via `ListObjectsV2` + `DeleteObjects`, `abortAllMultipart(prefix)`) usados pelas suítes de integração desta e das próximas SIs (per `TD-13`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `StorageService` | Unit: montagem dos comandos e mapeamento de erros com `aws-sdk-client-mock` (`CreateMultipartUploadCommand`, `ListPartsCommand` paginado, `CompleteMultipartUploadCommand`, erro genérico → `STORAGE_UNAVAILABLE`) | `src/storage/storage.service.spec.ts` |
| `StorageService` | Integration (RustFS real do compose): multipart de 2 partes de 5 MiB via URLs pré-assinadas → `complete` → `headObject` com tamanho correto; `presignGetObject` + `Range: bytes=0-1023` → 206; `responseContentDisposition` → header `Content-Disposition: attachment`; `abortMultipartUpload` → `listParts` retorna `null` | `src/storage/storage.service.integration-spec.ts` |
| `StorageModule` | Unit: compilação do módulo com `ConfigModule` de teste (ambos os clientes resolvem) | `src/storage/storage.module.spec.ts` |

**Dependencies:** SI-03.1 — chaves `S3_*` validadas e serviços `rustfs`/`storage-init` disponíveis para a suíte de integração

**Acceptance criteria:**

- Um `PUT` com corpo de 5 MiB em uma URL devolvida por `presignUploadPart` é aceito pelo storage (200 com `ETag`) sem nenhum header além de `Content-Length`
- Após `completeMultipartUpload` com as duas partes, `headObject` devolve `ContentLength` igual à soma das partes e `ContentType` igual ao declarado no `createMultipartUpload`
- `GET` com `Range: bytes=0-1023` em uma URL de `presignGetObject` responde 206 com `Content-Range` e 1 024 bytes
- `GET` em uma URL assinada com `responseContentDisposition: attachment; filename="x.mp4"` responde com `Content-Disposition: attachment; filename="x.mp4"`
- URLs assinadas pelo cliente público apontam para `S3_PUBLIC_ENDPOINT` e as do cliente interno para `S3_ENDPOINT`; a mesma URL não valida contra o outro host
- Falha de rede/credencial no storage resulta em `StorageUnavailableException` (`errorCode: "STORAGE_UNAVAILABLE"`), nunca em erro genérico 500

---

### SI-03.3 — Entidades `Video` e `VideoUpload`, migration e identificador público

**Description:** Materializar o modelo de dados da fase — o aggregate editorial `Video` com os dois eixos de estado e a sessão multipart transitória `VideoUpload` — com a migration TypeORM correspondente, o gerador do `public_id` de 11 caracteres e a constante única de formatos aceitos que DTO e worker compartilham.

**Technical actions:**

1. Criar `src/videos/entities/video.entity.ts` (`@Entity('videos')`) e `src/videos/entities/video-upload.entity.ts` (`@Entity('video_uploads')`) com os campos, constraints e índices de `### Data Model` (`public_id` unique, `channel_id` FK `ManyToOne` → `Channel` com `OneToMany` inverso em `Channel`, `VideoUpload` `OneToOne` com `video_id` unique e `onDelete: 'CASCADE'`, defaults `status = draft` / `processing_status = uploading` / `state = active`) e os tipos union TypeScript dos estados (`VideoProcessingStatus`, `VideoUploadState`) (per `phase-03-videos/TD-07`; regras `nestjs-entities.md`)
2. Criar `src/videos/public-id.util.ts` — `generatePublicId()` com `randomBytes(8)` → `base64url` cortado em 11 chars, alfabeto `[A-Za-z0-9_-]`; e `storageKeys(publicId)` → `{ source: 'videos/<id>/source', thumbnail: 'thumbnails/<id>/auto.jpg' }` (per `TD-08`)
3. Criar `src/videos/video-formats.ts` — `ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm']`, `ALLOWED_CONTAINERS` (`mp4` ← `mov,mp4,m4a,3gp,3g2,mj2`; `webm` ← `matroska,webm`), `ALLOWED_VIDEO_CODECS = ['h264','vp8','vp9','av1']`, `ALLOWED_AUDIO_CODECS = ['aac','opus','vorbis','mp3']` — constante única consumida pelo DTO (SI-03.5) e pelo worker (SI-03.8) (per `TD-14`)
4. Gerar a migration via CLI dentro do container (`npm run migration:generate -- src/database/migrations/CreateVideosAndVideoUploads`), conferir o SQL gerado (índices `videos.public_id` unique, `videos.channel_id`, `videos.processing_status`, `video_uploads.video_id` unique, `video_uploads(state, expires_at)`) e aplicar com `npm run migration:run`; registrar a classe nova no array de migrations do `src/test/create-test-data-source.ts` e do teste de migrations (per `typeorm-migrations.md`)
5. Atualizar `src/test/create-test-data-source.ts` — incluir `Video` e `VideoUpload` em `ALL_ENTITIES` e a ordem de limpeza em `cleanAllTables` (`video_uploads` → `videos` antes de `channels`/`users`) (per `TD-13`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Video` | Integration: unique em `public_id`; FK `channel_id` obrigatória; defaults `draft`/`uploading`; `OneToMany` carregável a partir de `Channel` | `src/videos/entities/video.entity.integration-spec.ts` |
| `VideoUpload` | Integration: unique em `video_id`; cascade delete ao remover o `Video`; default `state = active`; `expires_at` obrigatório | `src/videos/entities/video-upload.entity.integration-spec.ts` |
| `public-id.util.ts` | Unit: 11 chars no alfabeto `[A-Za-z0-9_-]`; 10 000 gerações sem colisão; `storageKeys` monta os prefixos esperados | `src/videos/public-id.util.spec.ts` |
| Migration `CreateVideosAndVideoUploads` | Integration: apply + revert deixam o schema consistente (estender o runner existente) | `src/database/migrations.integration-spec.ts` (estender) |

**Dependencies:** none _(independe de SI-03.1/03.2 — só banco; executar após SI-03.1 por conveniência de ambiente)_

**Acceptance criteria:**

- Inserir dois `videos` com o mesmo `public_id` falha com violação de unicidade; inserir sem `channel_id` falha com violação de FK
- Um `Video` recém-criado persiste com `status = 'draft'` e `processing_status = 'uploading'` sem que o chamador informe os valores
- Remover um `Video` remove em cascata o seu `VideoUpload`; inserir um segundo `VideoUpload` para o mesmo `video_id` falha
- `npm run migration:run` em banco limpo cria `videos` e `video_uploads` com os índices listados em `### Data Model`; `migration:revert` os remove sem erro
- `generatePublicId()` devolve sempre 11 caracteres válidos para URL sem `+`, `/` ou `=`

---

### SI-03.4 — QueueModule: fila `pg-boss` sobre o PostgreSQL

**Description:** Introduzir a fila de processamento em segundo plano como um módulo Nest fino sobre o `pg-boss`, reutilizando o PostgreSQL existente (schema `pgboss`), com as duas filas da fase criadas no bootstrap e uma API de `send`/`work` tipada que a API e o worker compartilham.

**Technical actions:**

1. Instalar `pg-boss` (^12.38.0) no `nestjs-project` (per `phase-03-videos/TD-04`; `library-refs.md` → `pg-boss`)
2. Criar `src/queue/queue.constants.ts` — nomes das filas (`VIDEO_PROCESS_QUEUE = 'video.process'`, `UPLOAD_EXPIRE_QUEUE = 'upload.expire'`), tipos de payload (`{ videoId: string }`) e os defaults de envio por fila (`video.process`: `retryLimit: 3`, `retryDelay: 30`, `retryBackoff: true`, `expireInSeconds: 1800`; `upload.expire`: `retryLimit: 3`) (per `TD-11`, `TD-12`; `### Events/Messages`)
3. Criar `src/queue/queue.service.ts` — provider que instancia `PgBoss` com a `connectionString` derivada de `databaseConfig` + `schema`/`supervise` de `queueConfig`, faz `start()` + `createQueue()` das duas filas em `onModuleInit`, `stop()` em `onModuleDestroy`, e expõe `send(queue, data, options)` (com `singletonKey` obrigatório) e `work(queue, options, handler)`; registrar o `Logger` do Nest nos eventos `error` do boss (per `TD-04`, `TD-05`)
4. Criar `src/queue/queue.module.ts` — `@Global()` não; módulo importado explicitamente por `VideosModule` (API, só `send`) e por `WorkerModule` (SI-03.7, `send` + `work`), com `QueueService` exportado (per `nestjs-modules.md`)
5. Estender `cleanAllTables` em `src/test/create-test-data-source.ts` para truncar as tabelas de job do schema `pgboss` quando o schema existir (`TRUNCATE pgboss.job, pgboss.archive`), e documentar no `nestjs-project/CLAUDE.md` que `--runInBand` continua obrigatório (per `TD-13`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `QueueService` | Integration (DB real): `start` cria o schema `pgboss` e as filas; `send` com `singletonKey` duplicado não cria segundo job ativo; `send` com `startAfter` futuro não é entregue a `work` antes do prazo; handler que lança registra `retry` até `retryLimit` e termina `failed` | `src/queue/queue.service.integration-spec.ts` |
| `QueueModule` | Unit: compilação com `ConfigModule` de teste e `QueueService` resolvido | `src/queue/queue.module.spec.ts` |

**Dependencies:** SI-03.1 — namespace `queue` e `databaseConfig` disponíveis

**Acceptance criteria:**

- Após o bootstrap da API, o banco `streamtube` contém o schema `pgboss` com as filas `video.process` e `upload.expire` registradas
- Dois `send('video.process', …, { singletonKey: 'video:X' })` consecutivos resultam em um único job ativo para `video:X`
- Um `send('upload.expire', …, { startAfter: <+60s> })` não é consumido por `work` dentro dos primeiros segundos e é consumido após o prazo
- Um handler que lança exceção três vezes seguidas deixa o job em estado `failed` sem derrubar o processo
- `onModuleDestroy` encerra o `pg-boss` sem handles abertos (Jest termina sem `--forceExit` na suíte desta SI)

---

### SI-03.5 — Endpoint POST /videos: pré-cadastro do rascunho e abertura do multipart

**Route:** POST /videos
**Test Specs:** see `nestjs-project/specs/videos-create.plan.md`
**Authorization:** Authenticated (cria no próprio canal) — per `### Authorization Matrix`

**Description:** Criar o `VideosModule` com o primeiro endpoint da fase: validar a declaração do cliente (allowlist de formatos e limite de tamanho), pré-cadastrar o `Video` como rascunho com `public_id` único, abrir a sessão multipart no storage, persistir a `VideoUpload` e agendar o job de expiração — tudo em uma transação.

**Technical actions:**

1. Criar `src/videos/videos.module.ts` importando `TypeOrmModule.forFeature([Video, VideoUpload])`, `StorageModule`, `QueueModule` e `ChannelsModule` (para resolver o canal do usuário autenticado), registrado no `AppModule`; criar `src/videos/dto/create-video.dto.ts` com `original_filename` (`@IsString`, `@Length(1,255)`), `content_type` (`@IsIn(ALLOWED_VIDEO_MIME_TYPES)`) e `size_bytes` (`@IsInt`, `@Min(1)`, `@Max(UPLOAD_MAX_BYTES)` via config) + decorators Swagger (per `phase-03-videos/TD-14`, `TD-03`; `### API Contracts → POST /videos`; `phase-02-auth/TD-06`)
2. Criar as exceções de domínio da fase em `src/videos/videos.exceptions.ts` (`VideoUnsupportedMediaTypeException` 400, `VideoTooLargeException` 413, `VideoNotFoundException` 404, `VideoForbiddenException` 403, `UploadNotActiveException` 409, `UploadIncompleteException` 422, `VideoNotReadyException` 409) estendendo `DomainException` com os `errorCode`s do `### Error Catalog` (per `phase-02-auth/TD-07`)
3. Criar `src/videos/videos.service.ts` com `createUpload(userId, dto)`: dentro de `dataSource.transaction` — gerar `public_id` com retry por SAVEPOINT em colisão (padrão de `typeorm-queries.md`, per `TD-08`), inserir `Video` (`storage_key = videos/<id>/source`, `content_type`, `original_filename`, `size_bytes` declarado), chamar `storage.createMultipartUpload(storage_key, content_type)`, inserir `VideoUpload` (`part_size = UPLOAD_PART_SIZE`, `part_count = ceil(size_bytes / part_size)` ≤ 10 000, `expected_bytes`, `expires_at = now + UPLOAD_TTL`) e `queue.send('upload.expire', { videoId }, { singletonKey: 'upload:<videoId>', startAfter: expires_at })`; se o `send`/insert falhar após o `createMultipartUpload`, abortar o multipart antes de propagar (per `TD-03`, `TD-07`, `TD-12`)
4. Criar `src/videos/videos.controller.ts` (`@Controller('videos')`) com `@Post()` → 201 e o corpo de resposta de `### API Contracts → POST /videos` (`public_id`, `status`, `processing_status`, `upload: { upload_id, part_size, part_count, expires_at }`); o usuário vem do `request.user` populado pelo `JwtAuthGuard` global (per `nestjs-controllers.md`)
5. Criar `src/videos/dto/video-response.dto.ts` com os shapes de resposta (`VideoCreatedResponse`, e os demais reaproveitados em SI-03.6/SI-03.10) anotados para o Swagger, mantendo o `openapi.json` como fonte dos tipos do frontend (per `openapi-docs-nestjs/TD-01`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.createUpload` | Unit (repos e `StorageService`/`QueueService` mockados): rejeita MIME fora da allowlist antes de tocar o storage; calcula `part_count`; aborta o multipart quando o insert da sessão falha; retry de `public_id` em colisão | `src/videos/videos.service.spec.ts` |
| `VideosService.createUpload` | Integration (DB + RustFS reais): cria `Video` + `VideoUpload` consistentes, `upload_id` existe no storage (`listParts` vazio mas válido), job `upload.expire` agendado com `startAfter = expires_at` | `src/videos/videos.service.integration-spec.ts` |
| `VideosModule` | Unit: compilação com dependências reais de módulo | `src/videos/videos.module.spec.ts` |

_(E2E do endpoint é autorado externamente via `/plan-test-specs` — ver `**Test Specs:**`.)_

**Dependencies:** SI-03.2 (StorageService) + SI-03.3 (entidades, `public_id`, allowlist) + SI-03.4 (QueueService)

**Acceptance criteria:**

- `POST /videos` autenticado com `{ original_filename: "a.mp4", content_type: "video/mp4", size_bytes: 15728640 }` retorna `201` com `public_id` de 11 chars, `status: "draft"`, `processing_status: "uploading"` e `upload.part_count` igual a `ceil(size_bytes / part_size)`
- `POST /videos` com `content_type: "video/x-matroska"` retorna `400` com `error: "VIDEO_UNSUPPORTED_MEDIA_TYPE"` e nenhum multipart é aberto no storage
- `POST /videos` com `size_bytes` acima de `UPLOAD_MAX_BYTES` retorna `413` com `error: "VIDEO_TOO_LARGE"`
- `POST /videos` sem `Authorization` retorna `401`; com corpo sem `size_bytes` retorna `400` com `error: "VALIDATION_ERROR"`
- Após um `201`, existe um job `upload.expire` para o vídeo com `startAfter` igual a `upload.expires_at` e a sessão `VideoUpload` está `active`
- Dois `POST /videos` do mesmo usuário geram `public_id` distintos e dois multiparts independentes

---

### SI-03.6 — Endpoints de upload: URLs por parte, retomada, complete e abort

**Route:** POST /videos/{publicId}/upload/parts, GET /videos/{publicId}/upload, POST /videos/{publicId}/upload/complete, DELETE /videos/{publicId}/upload
**Test Specs:** see `nestjs-project/specs/videos-upload.plan.md`
**Authorization:** Owner — per `### Authorization Matrix` (401 anônimo; 403 `VIDEO_FORBIDDEN` autenticado não-dono)

**Description:** Completar a orquestração do multipart pré-assinado: emitir URLs de `UploadPart` em lote, expor o estado da sessão para retomada via `ListParts`, fechar o upload validando as partes e enfileirando o processamento na mesma transação, e abortar a sessão removendo o rascunho — sem que nenhum byte de vídeo passe pela API.

**Technical actions:**

1. Criar `src/videos/videos-ownership.ts` (helper/guard de propriedade) — carrega `Video` + `VideoUpload` por `public_id`, lança `VideoNotFoundException` (404) se inexistente e `VideoForbiddenException` (403) se `video.channel_id` ≠ canal do `request.user`; reutilizado por todos os endpoints `/videos/{publicId}/**` (per `### Authorization Matrix`; AMB-1 → `phase-03-videos/TD-09`)
2. Criar os DTOs `src/videos/dto/presign-parts.dto.ts` (`part_numbers`: `@IsArray`, `@ArrayMinSize(1)`, `@ArrayMaxSize(100)`, `@ArrayUnique`, inteiros ≥ 1) e `src/videos/dto/complete-upload.dto.ts` (`parts[]` de `{ part_number, etag }` com `@ValidateNested`, `@ArrayUnique` por `part_number`) + respostas Swagger (per `### API Contracts → Validation Rules — upload`; `phase-02-auth/TD-06`)
3. Estender `VideosService` com `presignParts(video, upload, partNumbers)` (sessão `active` senão `UploadNotActiveException`; cada número ≤ `part_count` senão 400; URLs via `storage.presignUploadPart` com `expiresIn = UPLOAD_URL_TTL`), `getUploadState(video, upload)` (`ListParts` → `uploaded_parts`), `completeUpload(video, upload, parts)` (valida `parts.length === part_count`, sem duplicatas, cada `etag` igual ao de `ListParts` senão `UploadIncompleteException`; soma dos tamanhos ≤ `UPLOAD_MAX_BYTES` senão `VideoTooLargeException`; `storage.completeMultipartUpload`; em `dataSource.transaction`: `size_bytes` = soma, sessão `completed` + `completed_at`, `UPDATE videos SET processing_status='processing' WHERE id=$1 AND processing_status='uploading'`, `queue.send('video.process', { videoId }, { singletonKey: 'video:<videoId>', …defaults })` participando da transação — se a opção `db` do `send` não existir na versão instalada, enviar imediatamente após o `COMMIT` e registrar a janela como risco conhecido no `CLAUDE.md`) e `abortUpload(video, upload)` (`storage.abortMultipartUpload`, sessão `aborted`, `DELETE` do `Video` em transação) (per `TD-03`, `TD-11`, `TD-12`; `### Events/Messages → video.process`)
4. Adicionar ao `VideosController` as quatro rotas com os códigos de `### API Contracts` (`POST …/upload/parts` → 200, `GET …/upload` → 200, `POST …/upload/complete` → 202, `DELETE …/upload` → 204 via `@HttpCode`), mapeando as respostas para os DTOs de SI-03.5 (per `nestjs-controllers.md`)
5. Registrar em `nestjs-project/CLAUDE.md` o roteiro de verificação manual do fluxo (`curl` do `POST /videos`, `PUT` de uma parte de 5 MiB gerada com `head -c`, `complete`) e a nota de que o navegador fala com `S3_PUBLIC_ENDPOINT`, nunca com `nestjs-api` (per `TD-03`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService` (parts/state/complete/abort) | Unit (storage e fila mockados): rejeita sessão não ativa; rejeita `part_number > part_count`; `complete` com ETag divergente → `UPLOAD_INCOMPLETE`; soma acima do limite → `VIDEO_TOO_LARGE`; transição guardada não reenfileira se `processing_status` já ≠ `uploading` | `src/videos/videos.service.spec.ts` (estender) |
| `VideosService.completeUpload` | Integration (DB + RustFS + pg-boss reais, `UPLOAD_PART_SIZE = 5 MiB`): 3 partes enviadas por `PUT` nas URLs assinadas → `complete` grava `size_bytes`, sessão `completed`, `processing_status = processing` e um job `video.process` com `singletonKey video:<id>`; `abort` remove o rascunho e `listParts` passa a devolver `null` | `src/videos/videos.service.integration-spec.ts` (estender) |
| `videos-ownership.ts` | Unit: 404 para `public_id` inexistente; 403 para canal diferente; retorna o par `Video`/`VideoUpload` para o dono | `src/videos/videos-ownership.spec.ts` |

_(E2E dos endpoints é autorado externamente via `/plan-test-specs` — ver `**Test Specs:**`.)_

**Dependencies:** SI-03.5 — `VideosModule`, exceções e `createUpload` existentes

**Acceptance criteria:**

- `POST /videos/{publicId}/upload/parts` do dono com `{ part_numbers: [1, 2, 3] }` retorna `200` com três `parts[].url` distintas apontando para `S3_PUBLIC_ENDPOINT` e `expires_at` futuro
- `GET /videos/{publicId}/upload` após dois `PUT` bem-sucedidos retorna `200` com `uploaded_parts` contendo exatamente `part_number` 1 e 2 com seus `etag`
- `POST /videos/{publicId}/upload/complete` com todas as partes e ETags corretos retorna `202` com `processing_status: "processing"` e o objeto `videos/{publicId}/source` passa a existir no storage com o tamanho somado
- `POST …/upload/complete` com uma parte faltando retorna `422` com `error: "UPLOAD_INCOMPLETE"` e o vídeo permanece `uploading`
- Qualquer rota `/videos/{publicId}/upload*` por um usuário autenticado que não é dono retorna `403` com `error: "VIDEO_FORBIDDEN"`; com `publicId` inexistente retorna `404` com `error: "VIDEO_NOT_FOUND"`
- `DELETE /videos/{publicId}/upload` em sessão ativa retorna `204`, `GET /videos/{publicId}` passa a responder `404` e o multipart deixa de existir no storage
- Após `complete`, repetir `POST …/upload/parts` retorna `409` com `error: "UPLOAD_NOT_ACTIVE"`

---

### SI-03.7 — Worker: segundo entrypoint `src/worker.ts` e `WorkerModule`

**Description:** Dar ao processamento um processo próprio no mesmo subprojeto: um `WorkerModule` sem HTTP, guards, throttler ou mailer, iniciado por `NestFactory.createApplicationContext` a partir de `src/worker.ts`, executado pelo serviço `video-worker` do compose e com encerramento gracioso da fila.

**Technical actions:**

1. Criar `src/worker/worker.module.ts` importando `ConfigModule.forRoot` (mesmo `load`/`validationSchema` do `AppModule`, extraídos para `src/config/config-module.options.ts` para não duplicar), `TypeOrmModule.forRootAsync` (mesma factory de `databaseConfig`), `StorageModule`, `QueueModule` e os providers dos handlers (SI-03.8 e SI-03.9 registram os seus) — **sem** `AuthModule`, `MailModule` ou controllers (per `phase-03-videos/TD-05`; `phase-01-configuracao-base/TD-03`, `TD-04`)
2. Criar `src/worker.ts` — `NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true })`, `app.enableShutdownHooks()`, log de boot (`Logger('Worker')`) e tratamento de `SIGTERM`/`SIGINT` que chama `app.close()` (o `QueueService.onModuleDestroy` faz `boss.stop()`), (per `TD-05`)
3. Adicionar ao `package.json` os scripts `start:worker` (`nest start --watch --entryFile worker`) e `start:worker:prod` (`node dist/worker`), e conferir que `nest build` emite `dist/worker.js` (per `TD-05`; Nest CLI `--entryFile`)
4. Ajustar o serviço `video-worker` do `compose.yaml` (SI-03.1) para `command: npm run start:worker`, `restart: unless-stopped` e `depends_on` `storage-init` completo, e documentar em `nestjs-project/CLAUDE.md` que o worker é um processo de longa duração (rodar em background no Bash tool) e que o `WorkerModule` nunca importa o `AppModule` (per `TD-05`, `TD-10`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `WorkerModule` | Unit: compilação — resolve `QueueService`, `StorageService` e o `DataSource`; não contém `AuthModule`/`MailModule` (asserção por `moduleRef.get` lançando `NotFound`) | `src/worker/worker.module.spec.ts` |
| `src/worker.ts` | Integration: `createApplicationContext(WorkerModule)` sobe e fecha sem handles abertos com DB e RustFS reais | `src/worker/worker.bootstrap.integration-spec.ts` |

**Dependencies:** SI-03.2 (StorageModule) + SI-03.4 (QueueModule)

**Acceptance criteria:**

- `docker compose exec -d nestjs-api npm run start:worker` (ou o serviço `video-worker`) loga o boot do worker e registra `work` nas filas `video.process` e `upload.expire` sem abrir porta HTTP
- `docker compose stop video-worker` encerra o processo em menos de 10 s com `boss.stop()` logado (sem `SIGKILL`)
- `npm run build` gera `dist/main.js` e `dist/worker.js`; `node dist/worker` inicia com o mesmo `.env` da API
- O worker inicia sem `JWT_SECRET`/`MAIL_HOST` definidos quando as demais chaves estão presentes _(ou documenta explicitamente que o schema Joi compartilhado os exige — decisão registrada no `CLAUDE.md`)_

---

### SI-03.8 — Job `video.process`: ffprobe, validação de formato, thumbnail e transições guardadas

**Description:** Implementar o consumidor de `video.process` no worker: ler o vídeo por URL pré-assinada interna com `ffprobe`/`ffmpeg` do apt (sem download), recusar formatos fora da allowlist, extrair duração/dimensões/codecs, gerar e subir a thumbnail e concluir o vídeo em `ready` — ou `failed` com código — por transições guardadas e idempotentes.

**Technical actions:**

1. Criar `src/worker/ffmpeg.service.ts` — `probe(url)` executa `execFile('ffprobe', ['-v','error','-print_format','json','-show_format','-show_streams', url], { timeout })` e devolve `{ formatName, durationSeconds, videoStream?: { codec, width, height }, audioStream?: { codec } }`; `extractFrame(url, atSeconds, outPath)` executa `execFile('ffmpeg', ['-y','-ss', at, '-i', url, '-frames:v','1','-vf','scale=640:-2','-q:v','3', outPath], { timeout })`; erros de processo viram `ProbeFailedError`/`ThumbnailFailedError` com a saída resumida (per `phase-03-videos/TD-06`)
2. Criar `src/worker/video-format.validator.ts` — `validateProbe(result)` usando `ALLOWED_CONTAINERS`/`ALLOWED_VIDEO_CODECS`/`ALLOWED_AUDIO_CODECS` de `video-formats.ts` (SI-03.3): normaliza `format_name` (`mov,mp4,…` → `mp4`; `matroska,webm` → `webm`), exige um stream de vídeo com codec permitido e áudio ausente ou permitido; retorna `{ container, videoCodec, audioCodec }` ou lança `UnsupportedFormatError` com detalhe (per `TD-14`)
3. Criar `src/worker/video-processing.worker.ts` — provider que em `onModuleInit` registra `queue.work('video.process', { batchSize: 1, pollingIntervalSeconds: 2 }, handler)`; o handler: carrega o `Video` (se inexistente ou `processing_status` ∉ {`processing`} → no-op logado), confere `storage.headObject(storage_key)` (ausente → `failed` + `OBJECT_MISSING`, sem retry), assina URL interna (`presignGetObject(..., { public: false })`), `probe` → `validateProbe` (falha de formato → `failed` + `UNSUPPORTED_FORMAT` + detalhe, **sem** relançar para não haver retry), `extractFrame` em `os.tmpdir()` no instante `min(1, duration/10)` → `storage.putObject(thumbnails/<id>/auto.jpg, image/jpeg)` → `UPDATE videos SET processing_status='ready', duration_seconds, width, height, container, video_codec, audio_codec, thumbnail_key, processed_at WHERE id=$1 AND processing_status='processing'`; erros de probe/thumbnail relançam para o retry do `pg-boss` e, na última tentativa (`job.retryCount === retryLimit`), gravam `failed` + `PROBE_FAILED`/`THUMBNAIL_FAILED` (per `TD-06`, `TD-11`, `TD-14`; `### Events/Messages → video.process`; `### Data Model → Video`)
4. Registrar `FfmpegService` e `VideoProcessingWorker` no `WorkerModule` (SI-03.7) e garantir que o arquivo temporário é removido em `finally` (per `nestjs-services.md` — handlers de job logam e não derrubam o processo)
5. Criar `src/test/video-fixtures.ts` — gera fixtures por `ffmpeg -f lavfi -i testsrc=duration=2:size=320x240:rate=25 -f lavfi -i sine -c:v libx264 -c:a aac` (MP4 válido), um WebM VP9/Opus válido e um arquivo MKV/HEVC inválido, cacheados em `os.tmpdir()` para as suítes de integração (per `TD-13`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-format.validator.ts` | Unit: aceita mp4/h264/aac, webm/vp9/opus, vídeo sem áudio; recusa matroska, hevc, mp4 sem stream de vídeo, áudio `ac3`; normaliza `format_name` composto | `src/worker/video-format.validator.spec.ts` |
| `FfmpegService` | Unit (`execFile` mockado): monta os argumentos exatos; parse do JSON do ffprobe; timeout e exit code ≠ 0 viram `ProbeFailedError`/`ThumbnailFailedError` com detalhe truncado | `src/worker/ffmpeg.service.spec.ts` |
| `FfmpegService` | Integration (ffmpeg real + RustFS real): fixture MP4 enviada ao storage → `probe` via URL interna devolve duração ≈ 2 s e `h264`/`aac`; `extractFrame` produz JPEG > 1 KB | `src/worker/ffmpeg.service.integration-spec.ts` |
| `VideoProcessingWorker` | Integration (DB + RustFS + fila reais): vídeo `processing` com MP4 válido → `ready` com metadados e `thumbnail_key` existente no storage; fixture MKV → `failed` + `UNSUPPORTED_FORMAT` em uma única tentativa; objeto ausente → `failed` + `OBJECT_MISSING`; vídeo já `ready` → no-op | `src/worker/video-processing.worker.integration-spec.ts` |

**Dependencies:** SI-03.7 (WorkerModule) + SI-03.6 (vídeos chegam em `processing` com objeto completo)

**Acceptance criteria:**

- Um vídeo MP4 (H.264/AAC) completado passa a `processing_status = "ready"` com `duration_seconds`, `width`, `height`, `container = "mp4"`, `video_codec = "h264"`, `audio_codec = "aac"`, `processed_at` preenchidos e `thumbnails/{publicId}/auto.jpg` existente no storage
- Um WebM (VP9/Opus) completado passa a `ready` com `container = "webm"`; um vídeo sem trilha de áudio passa a `ready` com `audio_codec = null`
- Um arquivo MKV ou MP4 com HEVC completado passa a `failed` com `processing_error = "UNSUPPORTED_FORMAT"` na primeira tentativa, sem novas execuções do job
- Um job cujo objeto não existe no storage termina `failed` com `processing_error = "OBJECT_MISSING"` sem retry
- Um `ffprobe` que falha por timeout é reexecutado até 3 vezes e então o vídeo fica `failed` com `processing_error = "PROBE_FAILED"` e `processing_error_detail` preenchido
- Entregar o mesmo job duas vezes para um vídeo já `ready` não altera nenhuma coluna de `videos`
- O worker nunca grava o vídeo no disco: durante o processamento, `os.tmpdir()` contém apenas o JPEG da thumbnail, removido ao final

---

### SI-03.9 — Job `upload.expire`: limpeza de uploads órfãos e rascunhos abandonados

**Description:** Fechar o ciclo de vida da sessão multipart: o job atrasado agendado no pré-cadastro aborta no storage os uploads que não foram concluídos dentro de `UPLOAD_TTL`, marca a sessão como `expired` e remove o rascunho — de forma idempotente, sem cron nem varredura.

**Technical actions:**

1. Criar `src/worker/upload-expiration.worker.ts` — provider que em `onModuleInit` registra `queue.work('upload.expire', { batchSize: 5 }, handler)`; o handler carrega `VideoUpload` + `Video` por `videoId` e: se inexistente ou `state ≠ active` → no-op logado; se `active` → `storage.abortMultipartUpload(storage_key, upload_id)` (tolerando `NoSuchUpload`), e em `dataSource.transaction` marca a sessão `expired` e remove o `Video` (cascata remove a sessão; manter a ordem que preserve o log) (per `phase-03-videos/TD-12`; `### Events/Messages → upload.expire`)
2. Tratar a corrida com `complete`: a transição é guardada (`UPDATE video_uploads SET state='expired' WHERE id=$1 AND state='active'`); se zero linhas afetadas, o job termina como no-op e **não** aborta o multipart (o `complete` venceu) (per `TD-11`, `TD-12`)
3. Registrar `UploadExpirationWorker` no `WorkerModule` (SI-03.7) e expor `UPLOAD_TTL` nos logs de agendamento (per `TD-05`)
4. Confirmar no `storage-init` (SI-03.1) que a regra de lifecycle `AbortIncompleteMultipartUpload` usa `DaysAfterInitiation` maior que `UPLOAD_TTL` em dias (2 dias para 24 h) e documentar no `CLAUDE.md` que ela é rede de segurança, não o mecanismo principal (per `TD-12`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `UploadExpirationWorker` | Unit (repos, storage e fila mockados): sessão `active` → abort + expired + delete; sessão `completed` → no-op sem chamar o storage; `NoSuchUpload` do storage não falha o job; zero linhas no `UPDATE` guardado → no-op | `src/worker/upload-expiration.worker.spec.ts` |
| `UploadExpirationWorker` | Integration (DB + RustFS + fila reais, `UPLOAD_TTL` curto): pré-cadastro sem partes → após o prazo o job roda, `listParts` passa a `null` e o `Video` não existe mais; pré-cadastro completado antes do prazo → job no-op e vídeo intacto | `src/worker/upload-expiration.worker.integration-spec.ts` |

**Dependencies:** SI-03.7 (WorkerModule) + SI-03.5 (agendamento no pré-cadastro)

**Acceptance criteria:**

- Um rascunho cujo upload nunca foi concluído deixa de existir após `UPLOAD_TTL`: `GET /videos/{publicId}` retorna `404` e o multipart não aparece mais em `ListMultipartUploads` do bucket
- Um rascunho cujo `complete` ocorreu antes do prazo permanece intacto após o job rodar (`processing_status` inalterado, objeto presente)
- Um job `upload.expire` para `videoId` inexistente termina com sucesso (no-op) e não gera retry
- Executar o mesmo job duas vezes produz o mesmo estado final sem erro

---

### SI-03.10 — Endpoints GET /videos/{publicId} e GET /videos/{publicId}/playback

**Route:** GET /videos/{publicId}, GET /videos/{publicId}/playback
**Test Specs:** see `nestjs-project/specs/videos-playback.plan.md`
**Authorization:** Owner — per `### Authorization Matrix` (na Fase 03 todo vídeo é rascunho privado ao dono; AMB-1 → `TD-09`)

**Description:** Entregar a leitura do estado do vídeo (polling do processamento e metadados) e a reprodução/download por URLs GET pré-assinadas emitidas pela API — `Range` e `Content-Disposition` atendidos pelo storage, nenhum byte pela API.

**Technical actions:**

1. Estender `VideosService` com `getVideo(video)` (monta `VideoResponse` de `### API Contracts → GET /videos/{publicId}`, incluindo `thumbnail_url` pré-assinada pública quando `thumbnail_key` existe) e `getPlayback(video)` (exige `processing_status = ready` senão `VideoNotReadyException`; `stream_url = presignGetObject(storage_key, PLAYBACK_URL_TTL, {}, { public: true })`; `download_url` idem com `responseContentDisposition: attachment; filename="<original_filename sanitizado>"`; `expires_at = now + PLAYBACK_URL_TTL`) (per `phase-03-videos/TD-09`, `TD-02`)
2. Adicionar ao `VideosController` `@Get(':publicId')` e `@Get(':publicId/playback')` reutilizando o helper de propriedade de SI-03.6 e os DTOs de resposta (`VideoResponse`, `PlaybackResponse`) com decorators Swagger (per `### API Contracts`; `nestjs-controllers.md`)
3. Sanitizar `original_filename` para o `Content-Disposition` (remover aspas, CR/LF e caracteres de controle; fallback `video.<ext>`) e cobrir com unit test (per `TD-09`)
4. Documentar no `nestjs-project/CLAUDE.md` a verificação manual: `curl -r 0-1023 "<stream_url>"` → 206 e `curl -I "<download_url>"` → `Content-Disposition: attachment` (per `TD-09`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.getPlayback` / `getVideo` | Unit (storage mockado): `VIDEO_NOT_READY` fora de `ready`; URLs assinadas com o cliente público e `expiresIn = PLAYBACK_URL_TTL`; `thumbnail_url` null quando sem thumbnail; sanitização do filename | `src/videos/videos.service.spec.ts` (estender) |
| `VideosService.getPlayback` | Integration (RustFS real): `stream_url` responde 206 a `Range: bytes=0-1023`; `download_url` responde com `Content-Disposition: attachment; filename="…"` | `src/videos/videos.service.integration-spec.ts` (estender) |

_(E2E dos endpoints é autorado externamente via `/plan-test-specs` — ver `**Test Specs:**`.)_

**Dependencies:** SI-03.8 — vídeos chegam a `ready` com `thumbnail_key`; SI-03.6 — helper de propriedade

**Acceptance criteria:**

- `GET /videos/{publicId}` do dono retorna `200` com `processing_status` atual, metadados (`duration_seconds`, `width`, `height`, `container`, `video_codec`, `audio_codec`) preenchidos quando `ready` e `processing_error` preenchido quando `failed`
- `GET /videos/{publicId}/playback` de um vídeo `ready` retorna `200` com `stream_url`, `download_url` e `expires_at` futuro; `GET <stream_url>` com `Range: bytes=0-1023` responde `206`
- `GET <download_url>` responde com `Content-Disposition: attachment; filename="<original_filename>"`
- `GET /videos/{publicId}/playback` de um vídeo `processing` ou `failed` retorna `409` com `error: "VIDEO_NOT_READY"`
- Ambos os endpoints retornam `401` sem token, `403` com `error: "VIDEO_FORBIDDEN"` para não-dono e `404` com `error: "VIDEO_NOT_FOUND"` para `publicId` inexistente
- Uma URL de playback expirada (após `PLAYBACK_URL_TTL`) é recusada pelo storage com `403`, sem envolver a API

---

### SI-03.11 — Fluxo completo: upload multipart → processamento → playback em E2E

**Description:** Provar de ponta a ponta, com serviços reais e "10 GB sem 10 GB", que o conjunto entrega a fase: pré-cadastro, `PUT` direto de partes de 5 MiB nas URLs assinadas, `complete`, consumo do job pelo worker, `ready` com thumbnail e reprodução por `Range` — mais o limite de 10 GiB verificado como política.

**Technical actions:**

1. Criar `test/videos-upload-flow.e2e-spec.ts` (supertest sobre `AppModule` com `UPLOAD_PART_SIZE = 5 MiB` via env de teste) que, para a fixture MP4 de SI-03.8 (≈ 12 MiB para gerar 3 partes), faz: `POST /auth/register` + confirmação + login (helpers existentes da Fase 02) → `POST /videos` → `POST …/upload/parts` → `PUT` de cada parte com `fetch` nativo nas URLs assinadas → `GET …/upload` confere `uploaded_parts` → `POST …/upload/complete` → `202` (per `phase-03-videos/TD-13`, `TD-03`)
2. No mesmo spec, subir `createApplicationContext(WorkerModule)` em `beforeAll` (mesmo processo Jest, filas reais) e aguardar com polling `GET /videos/{publicId}` até `processing_status = ready` (timeout 60 s), então `GET …/playback` e `fetch` de `stream_url` com `Range: bytes=0-1023` → 206 e `download_url` → `Content-Disposition` (per `TD-05`, `TD-09`, `TD-13`)
3. Cobrir no mesmo arquivo os caminhos de política: `POST /videos` com `size_bytes = 10 GiB + 1` → `413 VIDEO_TOO_LARGE`; `complete` com uma parte omitida → `422 UPLOAD_INCOMPLETE`; usuário B tentando `GET /videos/{publicId}` do usuário A → `403 VIDEO_FORBIDDEN`; fixture MKV completada → `failed` + `UNSUPPORTED_FORMAT` (per `TD-14`)
4. Adicionar limpeza em `afterAll` (prefixo de storage da suíte via helpers de SI-03.2, `cleanAllTables` incluindo `pgboss`) e ajustar `test/jest-e2e.json` (`testTimeout` ≥ 90 000 para esta suíte, `setupFiles` com `dotenv/config`) (per `nestjs-project/CLAUDE.md` → Jest Configuration)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Fluxo upload → processamento → playback | E2E (supertest + fetch + worker in-process + RustFS + pg-boss reais) | `test/videos-upload-flow.e2e-spec.ts` |

**Dependencies:** SI-03.10 — todos os endpoints e o worker existentes

**Acceptance criteria:**

- `docker compose exec nestjs-api npm run test:e2e` executa o fluxo completo com 3 partes de 5 MiB e termina verde em menos de 90 s
- Ao final do fluxo, `GET /videos/{publicId}` retorna `processing_status: "ready"`, `duration_seconds` ≈ 2 e `thumbnail_url` acessível (200, `image/jpeg`)
- `GET <stream_url>` com `Range: bytes=0-1023` responde `206` com exatamente 1 024 bytes e `GET <download_url>` responde com `Content-Disposition: attachment`
- Nenhuma requisição à API durante o fluxo carrega bytes do vídeo: o corpo das chamadas a `nestjs-api` é apenas JSON (asserção sobre `Content-Length` das requisições do spec)
- `POST /videos` com `size_bytes` de 10 GiB + 1 byte retorna `413` com `error: "VIDEO_TOO_LARGE"`

---

### SI-03.12 — Cadeia OpenAPI, lint/tsc e documentação de encerramento

**Description:** Fechar a Definition of Done da fase: regenerar o contrato OpenAPI com os novos endpoints e sincronizá-lo com o frontend (sem tocar na UI), garantir `tsc`/`lint` limpos nos dois processos e consolidar a documentação do backend com a arquitetura de upload/processamento.

**Technical actions:**

1. Rodar dentro do container `npm run openapi:export` (regenera `nestjs-project/openapi.json` com `/videos/**`, DTOs de request/response e códigos de erro documentados via `@ApiResponse`), no host `bash scripts/sync-openapi.sh` e no container do frontend `npm run openapi:types`; commitar `next-frontend/openapi.json` e `lib/api/types.gen.ts` sem outras mudanças no frontend (per `openapi-docs-nestjs/TD-02`, `next-frontend-openapi-typing/TD-02`, `TD-03`; CI `openapi-freshness` de `saneamento-fase-02-e-infra/TD-06`)
2. Conferir que `ProcessingStatus`/`UploadState` e os `errorCode`s novos aparecem no `openapi.json` como enums/exemplos (ajustando `@ApiProperty({ enum })` nos DTOs) para que a futura fatia de UI consuma os tipos sem transcrição manual (per `openapi-docs-nestjs/TD-01`)
3. Rodar `npx tsc --noEmit` e `npm run lint` no `nestjs-project` e corrigir o que a fase introduziu (a dívida pré-existente de lint do backend permanece fora de escopo e registrada) (per CLAUDE.md → Definition of Done)
4. Atualizar `README.md` da raiz e `docs/diagrams/software-arch.mermaid` — substituir "S3 or MinIO" por "S3-compatível (RustFS em dev)", "Message Queue: TBD" por "pg-boss (PostgreSQL)" e descrever o Video Worker como segundo entrypoint do `nestjs-project` (per `phase-03-videos/TD-01`, `TD-04`, `TD-05`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `openapi.json` | Integration: o export inclui os paths `/videos`, `/videos/{publicId}/upload/parts`, `/videos/{publicId}/upload/complete`, `/videos/{publicId}/playback` com os status codes do `### API Contracts` | `src/openapi-export.integration-spec.ts` (estender) |

**Dependencies:** SI-03.11 — todos os endpoints estáveis antes de congelar o contrato

**Acceptance criteria:**

- `git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` passa após `sync` + `openapi:types` (o gate `openapi-freshness` fica verde no PR)
- `types.gen.ts` exporta os tipos de `paths['/videos']['post']` e `paths['/videos/{publicId}/playback']['get']` com os campos de `### API Contracts`
- `docker compose exec nestjs-api npx tsc --noEmit` sai com código 0 e `npm run lint` não reporta erros em `src/videos/**`, `src/storage/**`, `src/queue/**`, `src/worker/**`
- `docker compose exec nestjs-api npm test -- --runInBand` e `npm run test:e2e` terminam verdes com a suíte completa (Fases 01–03)
- O diagrama C4 e o README refletem RustFS, pg-boss e o worker como entrypoint do `nestjs-project`

---

## Technical Specifications

### Data Model

_Entidades novas desta fase (per `phase-03-videos/TD-07` — Option B: `Video` como aggregate editorial + `VideoUpload` 1:1 transitória). Chave primária UUID por regra de entidades; `public_id` é a chave externa de URL e de storage (per `phase-03-videos/TD-08`). Tipos de coluna, enums e transformers são detalhe do `implement` (skill `typeorm` + `nestjs-entities.md`); os valores de estado abaixo são o contrato._

#### Video

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| public_id | varchar(11) | unique, not null — 11 chars base64url `[A-Za-z0-9_-]` gerados via `node:crypto` no pré-cadastro; retry por SAVEPOINT em colisão (TD-08) |
| channel_id | uuid | FK → `channels.id`, not null — canal do usuário que iniciou o upload |
| status | varchar(16) | not null, default `draft` — eixo de publicação; nesta fase só `draft` (`published`/visibilidade são Fase 04) (TD-07) |
| processing_status | varchar(16) | not null, default `uploading` — eixo de processamento: `uploading` \| `processing` \| `ready` \| `failed` (TD-07, TD-11) |
| processing_error | varchar(64) | null — código de falha do processamento: `UNSUPPORTED_FORMAT` \| `PROBE_FAILED` \| `THUMBNAIL_FAILED` \| `OBJECT_MISSING` (TD-11, TD-14) |
| processing_error_detail | text | null — saída resumida do `ffprobe`/`ffmpeg` que motivou a falha (TD-14) |
| original_filename | varchar(255) | not null — nome declarado pelo cliente no pré-cadastro |
| content_type | varchar(64) | not null — MIME declarado no pré-cadastro, ∈ allowlist (`video/mp4`, `video/webm`) (TD-14) |
| size_bytes | bigint | null — declarado no pré-cadastro como esperado; confirmado no `complete` pela soma das partes (TD-03) |
| storage_key | varchar(255) | not null — `videos/{public_id}/source` (TD-08) |
| thumbnail_key | varchar(255) | null — `thumbnails/{public_id}/auto.jpg`, preenchido pelo worker (TD-06) |
| duration_seconds | numeric(10,3) | null — extraído por `ffprobe` (TD-06) |
| width | integer | null — extraído por `ffprobe` (TD-06) |
| height | integer | null — extraído por `ffprobe` (TD-06) |
| container | varchar(32) | null — `format_name` normalizado: `mp4` \| `webm` (TD-14) |
| video_codec | varchar(32) | null — `h264` \| `vp8` \| `vp9` \| `av1` (TD-14) |
| audio_codec | varchar(32) | null — `aac` \| `opus` \| `vorbis` \| `mp3`; null quando sem áudio (TD-14) |
| processed_at | timestamptz | null — momento da transição para `ready` (TD-11) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-updated |

**Relations:** `Channel` has many `Video` (one-to-many, `videos.channel_id`); `Video` has one `VideoUpload` (one-to-one, `video_uploads.video_id`)
**Indexes:** unique on `public_id`; index on `channel_id`; index on `(processing_status)`
**State machine (`processing_status`):** `uploading` → `processing` (no `complete` bem-sucedido, SI-03.6) → `ready` (worker, SI-03.8) ou `failed` (worker, retries esgotados ou formato recusado, SI-03.8). Transições são guardadas: `UPDATE … WHERE id = $1 AND processing_status = '<estado esperado>'` (TD-11). Reprocessar = reenfileirar com a mesma chave; no-op se já `ready`.

#### VideoUpload

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| video_id | uuid | FK → `videos.id`, unique, not null, on delete cascade — sessão 1:1 com o vídeo (TD-07) |
| upload_id | varchar(255) | not null — `UploadId` devolvido por `CreateMultipartUpload` (TD-03) |
| part_size | integer | not null — bytes por parte, = `UPLOAD_PART_SIZE` no momento do pré-cadastro (TD-03) |
| part_count | integer | not null — `ceil(expected_bytes / part_size)`, ≤ 10 000 (TD-03) |
| expected_bytes | bigint | not null — `size_bytes` declarado no pré-cadastro, ≤ `UPLOAD_MAX_BYTES` (TD-03) |
| state | varchar(16) | not null, default `active` — `active` \| `completed` \| `aborted` \| `expired` (TD-12) |
| expires_at | timestamptz | not null — `created_at + UPLOAD_TTL` (TD-12) |
| completed_at | timestamptz | null — momento do `CompleteMultipartUpload` (TD-03) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-updated |

**Relations:** `VideoUpload` belongs to `Video` (one-to-one inverse)
**Indexes:** unique on `video_id`; index on `(state, expires_at)`
**State machine (`state`):** `active` → `completed` (SI-03.6 `complete`) \| `aborted` (SI-03.6 `DELETE …/upload`) \| `expired` (job `upload.expire`, SI-03.9). Retomada (`ListParts`) e limpeza operam somente sobre sessões `active`.

#### Schema `pgboss` (fora do TypeORM)

O `pg-boss` cria e migra o schema `pgboss` no mesmo banco em `boss.start()` (per `phase-03-videos/TD-04`). Não há entidade TypeORM nem migration gerada para ele; `cleanAllTables` dos testes de integração deve limpar também as tabelas de job desse schema (TD-13). Documentar no `nestjs-project/CLAUDE.md` como segundo mecanismo de migração.

### API Contracts

_Tier backend (NestJS). Todos os endpoints exigem `Authorization: Bearer <access_token>` (guard global `JwtAuthGuard`, herdado de `phase-02-auth`) e verificam propriedade do vídeo pelo canal do usuário autenticado (ver Authorization Matrix). Nenhum byte de vídeo passa por estes endpoints: o navegador faz `PUT` direto nas URLs pré-assinadas de `UploadPart` apontando para `S3_PUBLIC_ENDPOINT` (per `phase-03-videos/TD-03`) e reproduz/baixa pelas URLs GET pré-assinadas (per `TD-09`). Formato de erro herdado de `phase-02-auth/TD-07` (`{ statusCode, error, message }` com `error` = código de domínio). Identificadores públicos: `{publicId}` = `videos.public_id` (11 chars, `TD-08`)._

#### POST /videos (SI-03.5)

Pré-cadastro do rascunho + abertura da sessão multipart. Cria `Video` (`status = draft`, `processing_status = uploading`), chama `CreateMultipartUpload` com `ContentType = content_type`, cria `VideoUpload` e agenda o job `upload.expire` (per `TD-03`, `TD-07`, `TD-12`, `TD-14`).

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: application/json

**Request body:**
- original_filename: string, required — 1..255 chars
- content_type: string, required — ∈ `video/mp4` | `video/webm` (allowlist de `TD-14`)
- size_bytes: integer, required — 1 ≤ n ≤ `UPLOAD_MAX_BYTES` (10 GiB)

**Response 201:**
- public_id: string (11 chars)
- status: `"draft"`
- processing_status: `"uploading"`
- upload: object
  - upload_id: string
  - part_size: integer (bytes)
  - part_count: integer
  - expires_at: string (ISO-8601) — `created_at + UPLOAD_TTL`

**Error responses:**
- 400 VIDEO_UNSUPPORTED_MEDIA_TYPE: when `content_type` is not in the allowlist (TD-14)
- 413 VIDEO_TOO_LARGE: when `size_bytes` exceeds `UPLOAD_MAX_BYTES` (TD-03)
- 503 STORAGE_UNAVAILABLE: when `CreateMultipartUpload` fails against the storage
- 400 validation error: when the request body fails schema validation
- 401 (guard): when the access token is missing or invalid

---

#### POST /videos/{publicId}/upload/parts (SI-03.6)

Emite URLs pré-assinadas de `UploadPart` (cliente público, `expiresIn = UPLOAD_URL_TTL`) para um lote de partes. O cliente faz `PUT <url>` com o corpo bruto da parte e guarda o `ETag` da resposta (per `TD-02`, `TD-03`).

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: application/json

**Request body:**
- part_numbers: integer[], required — 1..100 itens, únicos, cada um em `[1, part_count]`

**Response 200:**
- upload_id: string
- part_size: integer
- expires_at: string (ISO-8601) — validade das URLs deste lote
- parts: array of `{ part_number: integer, url: string }`

**Error responses:**
- 404 VIDEO_NOT_FOUND: when no video with `publicId` exists
- 403 VIDEO_FORBIDDEN: when the authenticated user does not own the video's channel
- 409 UPLOAD_NOT_ACTIVE: when the upload session is not `active` (completed, aborted or expired)
- 503 STORAGE_UNAVAILABLE: when presigning fails
- 400 validation error: when `part_numbers` fails schema validation
- 401 (guard)

---

#### GET /videos/{publicId}/upload (SI-03.6)

Estado da sessão para retomada: devolve as partes já aceitas pelo storage via `ListParts` (per `TD-03`). O cliente pula essas partes e pede novas URLs só para as faltantes.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:**
- upload_id: string
- state: `"active"`
- part_size: integer
- part_count: integer
- expected_bytes: integer
- expires_at: string (ISO-8601)
- uploaded_parts: array of `{ part_number: integer, etag: string, size: integer }`

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_FORBIDDEN
- 409 UPLOAD_NOT_ACTIVE: when the session is not `active`
- 503 STORAGE_UNAVAILABLE: when `ListParts` fails
- 401 (guard)

---

#### POST /videos/{publicId}/upload/complete (SI-03.6)

Fecha o multipart: valida a lista de partes contra `ListParts` (todas as `part_count` partes presentes, soma dos tamanhos ≤ `UPLOAD_MAX_BYTES`), chama `CompleteMultipartUpload`, grava `size_bytes`, marca a sessão `completed`, transita `processing_status` `uploading → processing` e enfileira `video.process` (chave singleton `video:{id}`) na mesma transação (per `TD-03`, `TD-11`).

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: application/json

**Request body:**
- parts: array, required — `part_count` itens de `{ part_number: integer, etag: string }` (a lista mantida pelo cliente, não a de `ListParts`)

**Response 202:**
- public_id: string
- status: `"draft"`
- processing_status: `"processing"`
- size_bytes: integer

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_FORBIDDEN
- 409 UPLOAD_NOT_ACTIVE: when the session is not `active`
- 422 UPLOAD_INCOMPLETE: when parts are missing, duplicated, out of range or their ETags do not match the storage's `ListParts`
- 413 VIDEO_TOO_LARGE: when the summed part sizes exceed `UPLOAD_MAX_BYTES`
- 503 STORAGE_UNAVAILABLE: when `ListParts`/`CompleteMultipartUpload` fails
- 400 validation error
- 401 (guard)

---

#### DELETE /videos/{publicId}/upload (SI-03.6)

Aborta a sessão: `AbortMultipartUpload`, sessão `aborted`, rascunho removido (per `TD-03`, `TD-12`). Idempotente para sessões já não ativas quando o rascunho não existe mais.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 204:** No content.

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_FORBIDDEN
- 409 UPLOAD_NOT_ACTIVE: when the session already completed (the object exists; deletion of ready videos is Phase 04 scope)
- 503 STORAGE_UNAVAILABLE
- 401 (guard)

---

#### GET /videos/{publicId} (SI-03.10)

Estado do vídeo para o dono acompanhar o processamento (polling) e ler os metadados extraídos (per `TD-06`, `TD-07`, `TD-11`).

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:**
- public_id: string
- status: `"draft"`
- processing_status: `"uploading"` | `"processing"` | `"ready"` | `"failed"`
- processing_error: string | null — código (ver Error Catalog → processing_error)
- original_filename: string
- content_type: string
- size_bytes: integer | null
- duration_seconds: number | null
- width: integer | null
- height: integer | null
- container: string | null
- video_codec: string | null
- audio_codec: string | null
- thumbnail_url: string | null — URL GET pré-assinada da thumbnail quando `ready` (TD-09)
- created_at: string (ISO-8601)
- processed_at: string (ISO-8601) | null

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_FORBIDDEN
- 401 (guard)

---

#### GET /videos/{publicId}/playback (SI-03.10)

URLs de reprodução e download emitidas pela API (cliente público, `expiresIn = PLAYBACK_URL_TTL`): `stream_url` = `GetObject` pré-assinado (o storage atende `Range` → 206); `download_url` = idem com `ResponseContentDisposition: attachment; filename="<original_filename>"` (per `TD-09`). Nesta fase somente o dono do canal autenticado obtém as URLs enquanto o vídeo é rascunho (AMB-1 → `TD-09`).

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:**
- stream_url: string
- download_url: string
- thumbnail_url: string | null
- expires_at: string (ISO-8601)

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_FORBIDDEN
- 409 VIDEO_NOT_READY: when `processing_status` ≠ `ready`
- 503 STORAGE_UNAVAILABLE: when presigning fails
- 401 (guard)

---

#### Validation Rules — upload

- `original_filename`: required, string, 1..255 chars (trim)
- `content_type`: required, string, ∈ `ALLOWED_VIDEO_MIME_TYPES` = [`video/mp4`, `video/webm`] — constante única do módulo de vídeos, também consumida pelo worker (`TD-14`)
- `size_bytes`: required, integer, 1 ≤ n ≤ `UPLOAD_MAX_BYTES` (default 10 GiB = 10 737 418 240)
- `part_numbers`: required, integer[], 1..100 itens, únicos, cada um em `[1, part_count]` da sessão
- `parts[*].part_number`: integer em `[1, part_count]`, sem duplicatas, exatamente `part_count` itens
- `parts[*].etag`: required, non-empty string
- `UPLOAD_PART_SIZE`: 5 MiB ≤ valor ≤ 5 GiB (default 64 MiB; os testes usam 5 MiB, `TD-13`); `part_count = ceil(size_bytes / UPLOAD_PART_SIZE)` deve ser ≤ 10 000 (limite S3)
- Chaves de ambiente desta fase (Joi + `compose.yaml` + `.env.example`, per `TD-01`/`TD-03`/`TD-09`/`TD-12`): `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `UPLOAD_PART_SIZE`, `UPLOAD_MAX_BYTES`, `UPLOAD_URL_TTL`, `UPLOAD_TTL`, `PLAYBACK_URL_TTL`

### Authorization Matrix

_"Owner" = usuário autenticado cujo `Channel` (`channels.user_id`) é o `channel_id` do vídeo. Nenhum endpoint desta fase é `@Public()`: o guard global `JwtAuthGuard` (herdado de `phase-02-auth`) responde 401 ao anônimo; a verificação de propriedade responde 403 `VIDEO_FORBIDDEN` ao autenticado não-dono (AMB-1 → `TD-09`: na Fase 03 todo vídeo é rascunho e privado ao dono; público/unlisted e acesso anônimo chegam nas Fases 04/05 sem mudar o mecanismo). O worker (`video-worker`) não expõe HTTP e usa credenciais de storage próprias (`S3_ACCESS_KEY`/`S3_SECRET_KEY`), não tokens de usuário._

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| POST /videos | ✗ (401) | ✓ (cria no próprio canal) | ✓ |
| POST /videos/{publicId}/upload/parts | ✗ (401) | ✗ (403) | ✓ |
| GET /videos/{publicId}/upload | ✗ (401) | ✗ (403) | ✓ |
| POST /videos/{publicId}/upload/complete | ✗ (401) | ✗ (403) | ✓ |
| DELETE /videos/{publicId}/upload | ✗ (401) | ✗ (403) | ✓ |
| GET /videos/{publicId} | ✗ (401) | ✗ (403) | ✓ |
| GET /videos/{publicId}/playback | ✗ (401) | ✗ (403) | ✓ |
| PUT <url pré-assinada de UploadPart> (storage) | portador da URL assinada, até `expires_at` | — | — |
| GET <stream_url / download_url> (storage) | portador da URL assinada, até `expires_at` | — | — |

Rate limiting: `ThrottlerGuard` global herdado de `phase-02-auth/TD-08` aplica-se a todos os endpoints acima com os limites padrão; nenhum limite específico de upload é decidido nesta fase.

### Error Catalog

_Formato de resposta herdado de `phase-02-auth/TD-07` (`DomainException` → `DomainExceptionFilter` → `{ statusCode, error, message }`; erros de validação do `ValidationPipe` → `ValidationExceptionFilter`, 400). Novas exceções de domínio desta fase:_

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| VIDEO_UNSUPPORTED_MEDIA_TYPE | 400 | `POST /videos` com `content_type` fora da allowlist MP4/WebM (TD-14) |
| VIDEO_TOO_LARGE | 413 | `size_bytes` declarado, ou soma das partes no `complete`, acima de `UPLOAD_MAX_BYTES` (TD-03) |
| VIDEO_NOT_FOUND | 404 | `publicId` inexistente (inclui rascunho já removido por abort/expiração) |
| VIDEO_FORBIDDEN | 403 | Usuário autenticado não é dono do canal do vídeo (AMB-1 / TD-09) |
| UPLOAD_NOT_ACTIVE | 409 | Operação de upload sobre sessão `completed` / `aborted` / `expired` (TD-03, TD-12) |
| UPLOAD_INCOMPLETE | 422 | `complete` com partes faltantes, duplicadas, fora do intervalo ou ETag divergente de `ListParts` (TD-03) |
| VIDEO_NOT_READY | 409 | `playback` solicitado com `processing_status` ≠ `ready` (TD-09) |
| STORAGE_UNAVAILABLE | 503 | Falha de chamada ao storage (`CreateMultipartUpload`, `ListParts`, `CompleteMultipartUpload`, `AbortMultipartUpload`, presign) (TD-02) |

_Códigos de `processing_error` (não são respostas HTTP; gravados em `videos.processing_error` pelo worker e expostos em `GET /videos/{publicId}`):_

| processing_error | Trigger |
|------------------|---------|
| UNSUPPORTED_FORMAT | `ffprobe` encontrou container fora de {mp4, webm}, codec de vídeo fora de {h264, vp8, vp9, av1}, áudio fora de {aac, opus, vorbis, mp3} ou nenhum stream de vídeo (TD-14) |
| PROBE_FAILED | `ffprobe` falhou (saída inválida, timeout) após esgotar as 3 tentativas (TD-06, TD-11) |
| THUMBNAIL_FAILED | `ffmpeg` não conseguiu extrair o frame ou o upload da thumbnail falhou após as tentativas (TD-06) |
| OBJECT_MISSING | Objeto `storage_key` ausente no storage ao processar (abort/limpeza concorrente) (TD-12) |

### Events/Messages

_Fila: `pg-boss` 12.x sobre o PostgreSQL existente, schema `pgboss` (per `phase-03-videos/TD-04`). Produtor = API (`VideosService`); consumidor = processo `video-worker` (segundo entrypoint `src/worker.ts`, per `TD-05`). Filas criadas com `createQueue` no bootstrap de ambos os processos. Nenhum evento é visível ao frontend nesta fase (Scope: Backend)._

#### video.process

**Payload:**

```json
{ "videoId": "uuid" }
```

**Producer:** `VideosService` (per `phase-03-videos/TD-11`) — `boss.send('video.process', { videoId }, { singletonKey: 'video:<videoId>', retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 })`, executado na mesma transação que grava `processing_status = processing` no `complete` (SI-03.6).
**Consumer:** `VideoProcessingWorker` no processo `video-worker` (per `phase-03-videos/TD-05`, `TD-06`) — `boss.work('video.process', { batchSize: 1 }, handler)` (SI-03.8).
**Trigger:** `CompleteMultipartUpload` bem-sucedido em `POST /videos/{publicId}/upload/complete`.
**Delivery semantics:** at-least-once (per `TD-11`) — `singletonKey` impede dois jobs ativos para o mesmo vídeo; o handler é idempotente por guarda de estado (`UPDATE … WHERE processing_status = 'processing'`): sucesso → `ready` + metadados + `thumbnail_key` + `processed_at`; exceção → retry (3 tentativas, backoff) e, esgotadas, `failed` + `processing_error` (`PROBE_FAILED`/`THUMBNAIL_FAILED`/`OBJECT_MISSING`); formato recusado pelo `ffprobe` → `failed` + `UNSUPPORTED_FORMAT` **sem** retry (falha determinística, `TD-14`). Job sobre vídeo já `ready`/`failed` → no-op.

#### upload.expire

**Payload:**

```json
{ "videoId": "uuid" }
```

**Producer:** `VideosService` (per `phase-03-videos/TD-12`) — `boss.send('upload.expire', { videoId }, { singletonKey: 'upload:<videoId>', startAfter: <created_at + UPLOAD_TTL> })`, enfileirado no pré-cadastro (SI-03.5) junto com a criação da `VideoUpload`.
**Consumer:** `UploadExpirationWorker` no processo `video-worker` (per `TD-05`, `TD-12`) — SI-03.9.
**Trigger:** decorrido `UPLOAD_TTL` (default 24 h) desde o pré-cadastro.
**Delivery semantics:** at-least-once, idempotente — se a sessão ainda estiver `active`: `AbortMultipartUpload` + sessão `expired` + rascunho removido; se já `completed`/`aborted`/`expired` ou vídeo inexistente: no-op. Regra de lifecycle `AbortIncompleteMultipartUpload` no bucket é rede de segurança opcional (criada pelo `storage-init`, `TD-10`) com TTL maior que `UPLOAD_TTL`.

#### Operação da fila

- **Schema e migrações:** `boss.start()` com `migrate: true` cria/migra `pgboss` em ambos os processos; o worker usa `supervise: true` (manutenção e expiração de jobs); a API pode usar `supervise: false` para não duplicar a supervisão (per `TD-04`).
- **Ciclo de vida Nest:** provider `QueueService` com `onModuleInit` (`start` + `createQueue` das duas filas) e `onModuleDestroy` (`stop`) — no `AppModule` só `send`; no `WorkerModule` `send` + `work` (per `TD-04`, `TD-05`).
- **Transação compartilhada (TD-11):** o `send` de `video.process` deve participar da transação TypeORM do `complete`; o `library-refs.md` registra que a opção `db` do `send` precisa ter a assinatura confirmada na versão instalada — se não for viável, enfileirar imediatamente após o `COMMIT` e aceitar a janela mínima (coberta por `upload.expire` não, pois a sessão já está `completed`; registrar como risco conhecido na SI-03.6).
- **Observabilidade mínima:** logs estruturados por job (`videoId`, tentativa, duração) via `Logger` do Nest; sem dashboard nesta fase.

---

## Dependency Map

```
SI-03.1 (root — infra, config, env)
├── SI-03.2 — StorageModule (depende das chaves S3_* e do rustfs do compose)
└── SI-03.4 — QueueModule (depende do namespace queue + databaseConfig)

SI-03.3 (root — entidades, migration, public_id, allowlist; só banco)

SI-03.2 + SI-03.3 + SI-03.4
└── SI-03.5 — POST /videos (pré-cadastro)
    └── SI-03.6 — endpoints de upload (parts / state / complete / abort)

SI-03.2 + SI-03.4
└── SI-03.7 — worker entrypoint + WorkerModule
    ├── SI-03.8 — job video.process (também depende de SI-03.6: vídeos em processing)
    └── SI-03.9 — job upload.expire (também depende de SI-03.5: agendamento)

SI-03.8 + SI-03.6
└── SI-03.10 — GET /videos/{publicId} + playback
    └── SI-03.11 — fluxo completo E2E
        └── SI-03.12 — cadeia OpenAPI, tsc/lint, docs
```

Ordem linear sugerida: SI-03.1 → SI-03.3, SI-03.2, SI-03.4 (paralelos) → SI-03.5 → SI-03.6 → SI-03.7 → SI-03.8, SI-03.9 (paralelos) → SI-03.10 → SI-03.11 → SI-03.12

---

## Deliverables

- [ ] SI-03.1 — Infra: storage, worker e configuração de ambiente
- [ ] SI-03.2 — StorageModule: clientes S3, presigner e smoke test contra o RustFS
- [ ] SI-03.3 — Entidades `Video` e `VideoUpload`, migration e identificador público
- [ ] SI-03.4 — QueueModule: fila `pg-boss` sobre o PostgreSQL
- [ ] SI-03.5 — Endpoint POST /videos: pré-cadastro do rascunho e abertura do multipart
- [ ] SI-03.6 — Endpoints de upload: URLs por parte, retomada, complete e abort
- [ ] SI-03.7 — Worker: segundo entrypoint `src/worker.ts` e `WorkerModule`
- [ ] SI-03.8 — Job `video.process`: ffprobe, validação de formato, thumbnail e transições guardadas
- [ ] SI-03.9 — Job `upload.expire`: limpeza de uploads órfãos e rascunhos abandonados
- [ ] SI-03.10 — Endpoints GET /videos/{publicId} e GET /videos/{publicId}/playback
- [ ] SI-03.11 — Fluxo completo: upload multipart → processamento → playback em E2E
- [ ] SI-03.12 — Cadeia OpenAPI, lint/tsc e documentação de encerramento

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Type/compilation checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] OpenAPI chain in sync (`cd nestjs-project && docker compose exec nestjs-api npm run openapi:export && cd .. && bash scripts/sync-openapi.sh && cd next-frontend && docker compose exec next-frontend npm run openapi:types && git diff --exit-code -- openapi.json lib/api/types.gen.ts`)
