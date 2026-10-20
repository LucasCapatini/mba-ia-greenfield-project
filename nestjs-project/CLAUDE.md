# CLAUDE.md

## Environment Startup Verification

**Default behavior:** starting the environment means starting **only infrastructure services** (database, mail, etc.) — **never** start the NestJS application server unless the user explicitly asks to run/serve the project (e.g., "rode o projeto", "suba o servidor", "run the app").

After starting infrastructure, always confirm the containers are up before proceeding:

```bash
docker compose ps   # all services must show status "running"
```

Then verify each infrastructure service is actually ready to accept connections — not just running:

- **PostgreSQL:** `docker compose exec db pg_isready -U streamtube` — expect `accepting connections`
- **Mailpit:** `curl -I http://localhost:8025` — expect `HTTP/1.1 200 OK` (the web UI on `8025`; the API sends SMTP to `mailpit:1025`)
- **RustFS (object storage):** `curl -f http://localhost:9000/health` — expect `200`; console web em `http://localhost:9001` (login = `S3_ACCESS_KEY`/`S3_SECRET_KEY` do `.env`)
- **storage-init:** `docker compose ps storage-init` deve mostrar `Exited (0)` — é um one-shot que cria o bucket `S3_BUCKET` com CORS e lifecycle; `docker compose logs storage-init` mostra o que foi aplicado

Only start the NestJS dev server (`npm run start:dev`) when the user **explicitly** asks to run the application — never as part of "start the environment".

## Development Environment

This project runs inside Docker. Always use the container for development:

```bash
# Start containers
docker compose up -d

# Install dependencies — after the first `up` and whenever package.json / package-lock.json change
# (node_modules lives in a named Docker volume, not on the bind mount; it starts empty)
docker compose exec nestjs-api npm install

# Run the dev server (watch mode)
docker compose exec nestjs-api npm run start:dev
```

Services:
- `nestjs-api` — NestJS API, port `3000`
- `db` — PostgreSQL 17, port `5432`, database `streamtube`, user/password `streamtube`. Os dados ficam no volume nomeado `pg_data` (`nestjs-project_pg_data`, montado em `/var/lib/postgresql/data`): o banco sobrevive a `docker compose down`/`up` e à recriação do container ou da rede `streamtube`; só `docker compose down -v` o apaga, junto com os demais volumes nomeados — depois disso rode `npm run migration:run` de novo. Ao adotar o volume pela primeira vez (task `manutencao-pos-fase-05`), o banco nasce vazio uma única vez: rode `npm run migration:run`; os dados de desenvolvimento anteriores não são migrados.
- `mailpit` — SMTP sink for dev: SMTP on `1025` (used by the API as `MAIL_HOST=mailpit`), web UI on `http://localhost:8025`
- `node_modules` volume — named volume `nestjs-project_node_modules` mounted over `/home/node/app/node_modules`, so dependencies never touch the slow 9p bind mount (type-check went from minutes to seconds). The host's `nestjs-project/node_modules` is **not** what the container uses; `docker compose down -v` deletes the volume and the next `up` needs `npm install` again.
- `rustfs` — object storage S3-compatível para dev (`rustfs/rustfs:1.0.3`, `phase-03-upload-processing/TD-01`): API S3 em `9000` (a API/worker usam `S3_ENDPOINT=http://rustfs:9000`; o navegador usa `S3_PUBLIC_ENDPOINT=http://localhost:9000` só para URLs pré-assinadas), console em `9001`. Dados no volume nomeado `rustfs_data` (`docker compose down -v` apaga os vídeos enviados).
- `storage-init` — one-shot (`amazon/aws-cli`) que cria o bucket `S3_BUCKET`, aplica CORS para `FRONTEND_URL` e a regra de lifecycle `AbortIncompleteMultipartUpload`; `nestjs-api` e `video-worker` só sobem depois que ele termina com código 0. Idempotente: rodar `docker compose up` de novo não recria nada.
- `video-worker` — processo do worker de vídeo (`phase-03-upload-processing/TD-05`): mesma imagem e volumes da API, sem porta HTTP; consome as filas do pg-boss e roda `ffmpeg`/`ffprobe` (instalados na imagem — `docker compose exec nestjs-api ffmpeg -version`). Processo de longa duração: logs via `docker compose logs -f video-worker`.
  - **Entrypoint próprio.** `src/worker.ts` sobe `WorkerModule` (`src/worker/worker.module.ts`) com `NestFactory.createApplicationContext` — sem servidor HTTP, guards, throttler ou mailer. O `WorkerModule` **nunca importa o `AppModule`**; ele reaproveita `src/config/config-module.options.ts` (mesmo `load`, mesmo schema Joi, mesma factory do TypeORM) e importa só `StorageModule`, `QueueModule` e os handlers das filas. Novas dependências do worker entram ali, não no `AppModule`.
  - **Mesmo `.env`.** O schema Joi é compartilhado de propósito, então o worker também exige `JWT_SECRET` e as chaves de mail mesmo sem usá-las: um `.env` válido para a API é válido para o worker (decisão registrada aqui em vez de manter dois schemas).
  - **Pipeline de `video.process`** (`src/worker/video-processing.worker.ts`, TD-06/TD-11/TD-14): carrega o vídeo (não existe ou não está `processing` → no-op) → `headObject` (ausente → `failed`/`OBJECT_MISSING`, sem retry) → URL interna assinada → `ffprobe` por URL (nada é baixado) → allowlist pelos bytes (`video-format.validator.ts`; recusa → `failed`/`UNSUPPORTED_FORMAT`, sem retry) → `ffmpeg` extrai um JPEG de 640 px em `os.tmpdir()`, sobe para `thumbnails/{publicId}/auto.jpg` e remove o arquivo em `finally` → `UPDATE … WHERE processing_status = 'processing'` para `ready` com metadados. Erros de probe/thumbnail relançam para o retry do pg-boss (3 tentativas, backoff); na última (`retryCount === retryLimit`) gravam `failed` + `PROBE_FAILED`/`THUMBNAIL_FAILED` + detalhe truncado a 500 chars. `ffprobe`/`ffmpeg` são chamados por `execFile` (sem shell, sem wrapper npm) em `ffmpeg.service.ts`, com timeouts em `worker.constants.ts`.
  - **Pipeline de `upload.expire`** (`src/worker/upload-expiration.worker.ts`, TD-12): job atrasado agendado no pré-cadastro para `created_at + UPLOAD_TTL` (a API loga o prazo). Carrega a sessão; se não existe ou não está `active` → no-op. Senão, em transação: `UPDATE video_uploads SET state='expired' WHERE id=$1 AND state='active'` (zero linhas = o `complete`/`abort` venceu a corrida → no-op, sem tocar no storage) → `AbortMultipartUpload` (tolera `NoSuchUpload`; outro erro desfaz a transição e o pg-boss retenta) → `DELETE` do rascunho (a sessão cai em cascata). A regra de lifecycle `AbortIncompleteMultipartUpload` do bucket (`storage-init`, 2 dias > `UPLOAD_TTL` de 24 h) é **rede de segurança**, não o mecanismo principal — ela só cobre o que o job não conseguiu abortar.
  - **Pipeline de `video.delete`** (`src/worker/video-deletion.worker.ts`, `video-channel-management/TD-09`, Fase 04): `DELETE /videos/{id}` faz hard delete. Se há sessão multipart `active`, a API a aborta no storage **antes** (falha → 503 e nada muda). Depois, numa transação, apaga a linha (a `video_uploads` cai em cascata) e enfileira `video.delete` na MESMA conexão (opção `db`, como no `complete`), com `singletonKey video-delete:<videoId>` e 3 tentativas com backoff. O payload carrega `storageKey` e `thumbnailKeys` (só as não nulas), porque a linha já não existe quando o job roda. O handler chama `DeleteObject` em cada chave — chave ausente não é erro, então reentregas são seguras —, tenta todas mesmo se uma falhar e relança para o retry; na última tentativa loga `video.delete failed` com as chaves que sobraram.
  - **Pendência operacional (TD-09).** A regra de lifecycle do bucket só cobre multiparts incompletos: um objeto **completo** que o `video.delete` não conseguiu remover após as 3 tentativas fica órfão. Procure `video.delete failed` nos logs do `video-worker` e remova as chaves listadas à mão (`aws s3api delete-object`). Corrida conhecida e aceita: se o vídeo é excluído enquanto o `video.process` roda, o worker de processamento faz no-op ao não achar a linha, mas pode já ter gravado `auto.jpg` depois do `video.delete` — mesma limpeza manual.
  - **Pipeline de `video-views.cleanup`** (`src/worker/video-views-cleanup.worker.ts`, `watch-page/TD-02`, Fase 05): job **agendado** — na subida o worker chama `QueueService.schedule('video-views.cleanup', '0 3 * * *')` (fuso UTC; reagendar sobrescreve, então reiniciar o worker é seguro) e consome a fila. O handler roda `DELETE FROM video_views WHERE window_start < (now() AT TIME ZONE 'UTC')::date - 2` (constantes em `worker.constants.ts`): só o balde do dia corrente deduplica visualizações novas, os vencidos são lixo. Idempotente; falha relança para o retry do pg-boss e o que sobrar sai no dia seguinte. O agendamento fica em `pgboss.schedule` (`SELECT * FROM pgboss.schedule`).
  - **Fixtures de vídeo.** `src/test/video-fixtures.ts` gera com o próprio ffmpeg (2 s de `testsrc`) um MP4 h264/aac, um MP4 sem áudio, um WebM vp9/opus e um MKV hevc, cacheados em `os.tmpdir()`; nada binário no repositório. Só suítes de integração/E2E os usam.
  - **Build.** `npm run build` emite `dist/main.js` e `dist/worker.js`; em produção, `npm run start:worker:prod` (`node dist/worker`).
  - **Dev e sinais.** O serviço executa `node --watch -r ts-node/register/transpile-only src/worker.ts` **diretamente** (mesmo comando de `npm run start:worker`), com `init: true`, `restart: unless-stopped` e `stop_grace_period: 15s`. Não use `npm run`/`nest start --watch` como comando do container: o `sh -c` do dash não repassa SIGTERM e o `nest` CLI sai antes de o filho terminar, então o worker morreria sem `app.close()`. Com o Node na frente, `docker compose stop video-worker` envia SIGTERM, `enableShutdownHooks` chama `app.close()`, o `QueueService` faz `boss.stop({ graceful: true })` (logado como "Queue stopped") e o processo sai em ~1 s. O `node --watch` reinicia o worker ao salvar um arquivo (transpile-only: a checagem de tipos continua sendo `npx tsc --noEmit`).

All services are attached to the named Docker network `streamtube`, declared in `compose.yaml` and consumed as `external` by `next-frontend/compose.yaml`. **This stack must be started before the frontend stack** — the network only exists once `docker compose up -d` has run here.

### IP real do visitante atrás do BFF (Fase 05, `watch-page/TD-03`)

Toda requisição do navegador chega à API pelo container `next-frontend` (strict BFF), então sem ajuste o throttler global (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])`) daria a **todos os visitantes um único orçamento**. Por isso:

- A rede `streamtube` tem **sub-rede fixa** (`172.30.0.0/24`, `ipam` no `compose.yaml`) e o `next-frontend` recebe o **IP fixo** `172.30.0.10` (`next-frontend/compose.yaml`). A alocação dinâmica fica restrita a `ip_range: 172.30.0.128/25` (`.128`–`.254`, gateway `172.30.0.1`), então nenhum container do backend pode ocupar o IP em que a API confia, por maior que a stack fique.
- `TRUST_PROXY` (opcional, IPs/CIDRs separados por vírgula, validado no Joi; `.env.example` = `172.30.0.10`) liga o `trust proxy` do Express só para esse endereço (`src/main.ts`). Ausente → `trust proxy` desligado e o tracker é o IP do socket. Nunca use o nome do serviço Compose: o Express só aceita IP/sub-rede.
- `ThrottlerBehindProxyGuard` (`src/auth/guards/throttler-behind-proxy.guard.ts`, registrado como `APP_GUARD` no `AuthModule`) rastreia `req.ips[0]` — o primeiro IP de `X-Forwarded-For` — e cai em `req.ip` quando nenhum proxy é confiável. O gateway do host (requisições do host na porta 3000) **não** é confiável, então um `X-Forwarded-For` enviado por `curl` do host é ignorado.
- **Recriar a rede depois de mudar a sub-rede:** `docker compose down` no `next-frontend/` e aqui, depois `docker compose up -d` aqui primeiro e no frontend em seguida. O banco sobrevive à recriação, porque o `db` usa o volume nomeado `pg_data`.

### Variáveis de ambiente da Fase 03

Todas validadas por Joi em `src/config/env.validation.ts` (a API não sobe sem as obrigatórias) e lidas pelos namespaces `storage` (`src/config/storage.config.ts`), `upload` (`upload.config.ts`) e `queue` (`queue.config.ts`):

- `S3_ENDPOINT` (obrigatória, URI interna — nome do serviço Compose, nunca `localhost`), `S3_PUBLIC_ENDPOINT` (obrigatória, URI alcançável pelo navegador), `S3_ACCESS_KEY`/`S3_SECRET_KEY` (obrigatórias; também configuram o RustFS via `compose.yaml`), `S3_BUCKET` (obrigatória), `S3_REGION` (default `us-east-1`), `S3_FORCE_PATH_STYLE` (default `true`).
- `UPLOAD_PART_SIZE` (bytes, default 64 MiB, mínimo 5 MiB — limite S3; os testes usam 5 MiB para provar multipart sem 10 GiB), `UPLOAD_MAX_BYTES` (default 10 GiB), `UPLOAD_URL_TTL` / `UPLOAD_TTL` / `PLAYBACK_URL_TTL` (segundos; defaults 1 h / 24 h / 12 h).
- `QUEUE_SCHEMA` (default `pgboss`) e `QUEUE_SUPERVISE` (default `true`): o `pg-boss` cria e migra o schema `pgboss` no mesmo banco em `boss.start()` — é um **segundo mecanismo de migração**, fora do TypeORM; nunca gere migrations TypeORM para essas tabelas, e os testes de integração limpam `pgboss.job`/`pgboss.archive` em `cleanAllTables`.

### Thumbnails públicas (Fase 04)

As thumbnails são servidas por URL **pública e estável**, não assinada (`video-channel-management/TD-10`). O `storage-init` aplica uma bucket policy (`put-bucket-policy`, idempotente; log `storage-init: policy pública de thumbnails aplicada`) que libera `s3:GetObject` anônimo **só** em `thumbnails/*`; `videos/*` continua privado e só sai por URL pré-assinada (`GET /videos/{id}/playback`). A API devolve `thumbnail_url = ${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/{custom_thumbnail_key ?? thumbnail_key}?v=<updated_at em ms>` (`StorageService.publicUrl` + `VideosService.thumbnailUrl`); o `?v=` muda a cada escrita do vídeo e invalida o cache do navegador.

A thumbnail **customizada** (`PUT /videos/{id}/thumbnail`, multipart campo `file`) passa pela API (TD-04): `ThumbnailUploadInterceptor` lê o arquivo em memória com o multer (teto `THUMBNAIL_MAX_BYTES`, default 5 MiB, no namespace `upload` + schema Joi; estouro → 413 `THUMBNAIL_TOO_LARGE`), e o `ThumbnailProcessor` (`sharp`) confirma pelos bytes JPEG/PNG/WebP ≥ 640×360 e grava sempre JPEG 1280×720 em `thumbnails/{id}/custom.jpg`. O `sharp` traz binários nativos por plataforma: rode `npm install` dentro do container (nunca no host) para que o volume `node_modules` receba o binário linux certo.

Smoke test sem credenciais, no host (o mesmo que a suíte `storage.service.integration-spec.ts` faz contra o RustFS):

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$S3_PUBLIC_ENDPOINT/$S3_BUCKET/thumbnails/<publicId>/auto.jpg"   # 200 (404 se não existe)
curl -s -o /dev/null -w '%{http_code}\n' "$S3_PUBLIC_ENDPOINT/$S3_BUCKET/videos/<publicId>/source"        # 403
```

Plano B (TD-10): se um storage S3-compatível recusar a bucket policy, o `storage-init` falha (`set -eu`) e a API não sobe. Nesse caso volte `VideosService.thumbnailUrl` para `StorageService.presignGetObject(key, PLAYBACK_URL_TTL, { public: true })` — a assinatura com o cliente público funciona sem policy, ao custo de URLs que expiram e não servem para cache/`next/image`. O RustFS 1.0.3 do compose aplica a policy (verificado em 2026-10-19).

### Interações sociais (Fase 06)

Módulos `ReactionsModule` (`src/reactions/`), `CommentsModule` (`src/comments/`) e `SubscriptionsModule` (`src/subscriptions/`); tabelas `video_reactions`, `comments`, `comment_reactions`, `subscriptions` e a coluna `channels.subscriber_count` (migration `CreateSocialInteractions1792472801299`). Decisões em `docs/decisions/technical-decisions-social-interactions.md`.

- **Contadores** (`videos.like_count`/`dislike_count`/`comment_count`, `comments.like_count`/`dislike_count`/`reply_count`, `channels.subscriber_count`) mudam na **mesma transação** da linha que os origina e **por SQL direto** (`UPDATE … SET x = x + $1`). Não use `repository.increment`/`update` do TypeORM neles: o `@UpdateDateColumn` atualizaria `updated_at`, que versiona a URL pública da thumbnail (`?v=`) — um like invalidaria o cache da imagem.
- **Escrita set-state idempotente:** reações via `writeReaction` (`src/reactions/reaction-writer.ts`: `SELECT … FOR UPDATE` + `INSERT … ON CONFLICT DO NOTHING` com nova tentativa) e o delta de `reactionDelta`; inscrições por `INSERT … ON CONFLICT DO NOTHING RETURNING` / `DELETE … RETURNING`. O contador só se move quando a linha de fato entra ou sai, então chamadas repetidas e paralelas terminam com contador == `COUNT(*)`.
- **Direção das dependências:** `ReactionsModule` e `SubscriptionsModule` leem `Video`/`Channel`/`Comment` pelos próprios `forFeature` em vez de importar `VideosModule`/`ChannelsModule`/`CommentsModule` — são estes que importam aqueles para o estado do espectador (`viewer_reaction`, `viewer_subscribed`). Manter esse sentido evita ciclos.
- **Visibilidade:** reagir, comentar e listar comentários exigem vídeo `published` (público ou unlisted) — rascunho responde 404 inclusive para o dono. `commentId` fora do formato uuid → 404 `COMMENT_NOT_FOUND` (não 400). As rotas de reação têm throttle próprio de 60 req/min (`REACTION_THROTTLE`).
- **Testes:** `src/test/social-fixtures.ts` (`seedUserWithChannel`, `seedVideo`, `seedComment`) e `test/support/social-app.ts` (`bootstrapSocialApp`, `bearerFor`). Os e2e que fazem muitas requisições à mesma rota variam o `X-Forwarded-For` para não esbarrar no throttler global (10/min por rota e IP).
- **`src/database/migrations.integration-spec.ts` precisa conhecer toda migration nova** (`MIGRATIONS`, `MANAGED_TABLES` e os enums do `DROP TYPE`): a suíte derruba e reaplica o schema do banco compartilhado, e uma migration fora da lista deixa o banco sem as tabelas/FKs dela para todas as suítes seguintes — o sintoma é uma cascata de `QueryFailedError` no `synchronize` dos testes de integração e 500 nos e2e.

### Roteiro manual do upload multipart (Fase 03)

Nenhum byte de vídeo passa pela API: ela só emite URLs pré-assinadas e o cliente faz `PUT` direto no storage. O navegador fala com `S3_PUBLIC_ENDPOINT` (`http://localhost:9000`), **nunca** com `nestjs-api`; a API e o worker usam `S3_ENDPOINT` (`http://rustfs:9000`). As URLs são assinadas para o host público — por isso os testes dentro do container sobrescrevem `S3_PUBLIC_ENDPOINT = S3_ENDPOINT`.

```bash
TOKEN=...   # access_token de POST /auth/login
API=http://localhost:3000

# 1. Pré-cadastro (abre o multipart; part_count = ceil(size_bytes / UPLOAD_PART_SIZE))
curl -s $API/videos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"original_filename":"a.mp4","content_type":"video/mp4","size_bytes":12582912}'
# → { public_id, status: "draft", processing_status: "uploading", upload: { upload_id, part_size, part_count, expires_at } }

# 2. URLs pré-assinadas para um lote de partes (até 100 por chamada, válidas por UPLOAD_URL_TTL)
curl -s $API/videos/$ID/upload/parts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"part_numbers":[1,2,3]}'
# → { upload_id, part_size, expires_at, parts: [{ part_number, url }] }

# 3. PUT de cada parte direto no storage (fatias de part_size; a última pode ser menor). Guarde o ETag.
split -b 67108864 a.mp4 part_
curl -s -i -X PUT --data-binary @part_aa "$URL_1" | grep -i etag

# 4. Retomada: partes já aceitas pelo storage (ListParts)
curl -s $API/videos/$ID/upload -H "Authorization: Bearer $TOKEN"
# → { state: "active", part_count, uploaded_parts: [{ part_number, etag, size }] }

# 5. Conclusão (lista do cliente conferida contra o storage; enfileira video.process) → 202
curl -s $API/videos/$ID/upload/complete -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"parts":[{"part_number":1,"etag":"\"…\""},{"part_number":2,"etag":"\"…\""}]}'

# 6. Estado/polling (processing_status, metadados, thumbnail_url) e URLs de reprodução (só quando ready)
curl -s $API/videos/$ID -H "Authorization: Bearer $TOKEN"
curl -s $API/videos/$ID/playback -H "Authorization: Bearer $TOKEN"
# → { stream_url, download_url, thumbnail_url, expires_at }   (válidas por PLAYBACK_URL_TTL)
curl -s -o /dev/null -w '%{http_code}\n' -r 0-1023 "$STREAM_URL"   # 206 — Range atendido pelo storage
curl -sI "$DOWNLOAD_URL" | grep -i content-disposition           # attachment; filename="<original_filename>"

# Desistir (aborta o multipart e remove o rascunho) → 204
curl -s -X DELETE $API/videos/$ID/upload -H "Authorization: Bearer $TOKEN"
```

Erros: `404 VIDEO_NOT_FOUND`, `403 VIDEO_FORBIDDEN` (só o dono do canal), `409 VIDEO_NOT_READY` (playback antes de `ready`), `409 UPLOAD_NOT_ACTIVE` (sessão concluída/abortada/expirada), `422 UPLOAD_INCOMPLETE` (parte faltando ou etag divergente), `413 VIDEO_TOO_LARGE`, `503 STORAGE_UNAVAILABLE`. No `complete`, a sessão, o vídeo e o job `video.process` são gravados na **mesma transação**: o `QueueService.send` recebe o `EntityManager` adaptado a `executeSql` (opção `db` do pg-boss), então o job só existe se o COMMIT acontecer.

All verification and teardown commands run on the **host machine**:

```bash
# Verify NestJS is running (expect 200 + "Hello World!")
curl http://localhost:3000

# Verify PostgreSQL is ready (runs inside the db container)
docker compose exec db pg_isready -U streamtube

# Verify Mailpit is up (web UI)
curl -I http://localhost:8025

# Check container logs
docker compose logs nestjs-api
docker compose logs db
docker compose logs mailpit

# Tear down the entire environment (add -v to also drop the node_modules volume — the next up needs npm install again)
docker compose down
```

## Commands

**Strict rule:** every `npm`, `npx`, `node`, `tsc`, and test command runs **inside the container**, never on the host. Running on the host causes env-var divergence (`DB_HOST` resolves to `localhost` instead of the Compose service), uses a different Node version, and produces results that do not reflect what runs in CI/prod.

### Container-only commands (always prefix with `docker compose exec nestjs-api`)

```bash
npm run start:dev                        # Dev server with hot-reload
npm run build                            # Compile to dist/
npm run start:prod                       # Run compiled build

npm test                                 # Unit + integration (*.spec.ts + *.integration-spec.ts) — pass -- --runInBand (see "Test execution")
npm run test:integration                 # Integration only (*.integration-spec.ts), already --runInBand
npm run test:watch                       # Watch mode
npm run test:cov                         # Coverage report
npm run test:e2e                         # End-to-end tests (test/, supertest; serial by config)

npm run migration:run                    # Apply TypeORM migrations (synchronize is off — required after a fresh db)
npm run migration:generate -- src/database/migrations/<Name>   # Diff entities → new migration
npm run openapi:export                   # nest build + node dist/openapi-export.js — the build applies the @nestjs/swagger CLI plugin (ts-node does not, so DTOs came out empty); then sync to the frontend — see root CLAUDE.md

npx tsc --noEmit                         # Type-check (required before declaring a task done)
npm run lint                             # ESLint with auto-fix; fails on any error or warning (--max-warnings 0)
npm run format                           # Prettier formatting
```

### Host-only commands (Docker / connectivity probes)

```bash
docker compose ps
docker compose logs nestjs-api
docker compose logs mailpit
docker compose exec db pg_isready -U streamtube
curl http://localhost:3000
curl -I http://localhost:8025
```

### Test execution

Integration and e2e suites share a single test database. They **must** be run with `--runInBand`:

```bash
docker compose exec nestjs-api npm test -- --runInBand
docker compose exec nestjs-api npm run test:e2e   # already configured
```

Parallel execution causes FK violations, deadlocks, and cross-suite contamination because suites truncate or seed shared tables concurrently.

During active development, run only the tests related to the file being changed (`npm test -- path/to/file.spec.ts`). Before declaring a task done, run the full suite — see the global `CLAUDE.md` → "Definition of Done (Technical)".

## Long-running Processes

Commands that never exit (dev server, watch modes) must be run in background in the Bash tool — otherwise the agent blocks indefinitely waiting for the process to return.

This applies to: `start:dev`, `start:prod`, `start:worker`, `test:watch`, and any other persistent process.

## Test Type Selection

Choose the suffix by what the test really does, not by where the code under test lives. The suffix is a contract that drives Jest config (`testRegex`, parallelism), CI steps, and reader expectations.

| Suffix                  | Purpose                                                              | DB / external I/O | Location                     |
|-------------------------|----------------------------------------------------------------------|-------------------|------------------------------|
| `*.spec.ts`             | **Unit** — pure logic, all collaborators mocked                      | Forbidden         | Next to the source file      |
| `*.integration-spec.ts` | **Integration** — exercises real DB, real repositories, real modules | Required          | Next to the source file      |
| `*.e2e-spec.ts`         | **End-to-end** — full HTTP cycle via `supertest`                     | Required          | `nestjs-project/test/`       |

A test that constructs a `TypeOrmModule.forRoot`, opens a connection, or hits the `db` service **must** be `*.integration-spec.ts`, never `*.spec.ts`. A test that boots the full Nest application and makes HTTP calls **must** be `*.e2e-spec.ts`.

Conventions for **how to write** each kind of test (mocking patterns, AAA structure, override strategies for global guards, etc.) live in `.claude/rules/nestjs-testing.md` and load when you edit a test file.

## Jest Configuration

These settings are required in `package.json` (jest config) and `test/jest-e2e.json` for the project's tests to work correctly:

- `setupFiles: ["dotenv/config"]` — without this, `.env` is not loaded inside the Jest process. `DB_HOST`, `JWT_SECRET`, etc. fall back to undefined or to the host's `localhost`, breaking container-to-container DNS.
- `testRegex: '.*\\.(spec|integration-spec)\\.ts$'` — covers both unit (`*.spec.ts`) and integration (`*.integration-spec.ts`) suffixes.
- `setupFiles: ["dotenv/config", "<rootDir>/test/jest-env.cjs"]` (`<rootDir>/../src/test/jest-env.cjs` in the e2e config) — the shim sets `QUEUE_SCHEMA=pgboss_test` after `.env` is loaded, so every suite talks to its own pg-boss schema. Without it the `video-worker` service, which keeps running during development, would consume the `video.process` jobs the suites enqueue in `pgboss` and flip `processing_status` mid-assertion. The schema is created by pg-boss on first `start()`; `cleanAllTables` already cleans it.
- `maxWorkers: 1` in `test/jest-e2e.json` — the e2e suites share one database and one bucket; with Jest's default workers two suites truncate each other's tables mid-test (FK violations, 409/500 out of nowhere). The unit/integration config relies on `-- --runInBand` instead (see "Test execution").
- `testTimeout: 30000` in `package.json` and `90000` in `test/jest-e2e.json` — DB-backed suites boot a Nest module and run migrations in `beforeAll`; on the Docker Desktop bind mount a cold boot exceeds Jest's default 5 s hook timeout and fails spuriously. The e2e value is higher because `test/videos-upload-flow.e2e-spec.ts` uploads 3 × 5 MiB parts, waits for the in-process worker (ffprobe/ffmpeg over the signed URL, 2 s polling) and then plays the result in a single test.
- `--forceExit` on the `test` and `test:e2e` scripts (`package.json`) — Jest otherwise hangs after a green run ("Jest did not exit one second after the test run has completed") because DB-backed suites leave handles open. The flag is a symptom fix so the scripts return to the prompt; the root-cause fix (`--detectOpenHandles` to find the leaking suites and close their connections) is a separate hygiene task. `test:integration`, `test:watch` and `test:cov` do not carry the flag.

- `moduleNameMapper: { "^pg-boss$": "<rootDir>/test/pg-boss.cjs" }` (and `<rootDir>/../src/test/pg-boss.cjs` in `test/jest-e2e.json`, whose `rootDir` is `test/`) + `cjs` in `moduleFileExtensions` — `pg-boss` 12 is ESM-only. Node ≥ 22.12 loads it in the CommonJS app through native `require(esm)`, but Jest's CJS module runtime cannot evaluate `import` inside `node_modules`. The shim asks Node's native `require` for the real package, outside Jest's registry — through `process.getBuiltinModule('node:module').createRequire`, because `require('node:module').createRequire` inside the Jest sandbox is jest-runtime's patched version and would loop back into Jest. Production code is untouched; never import `src/test/pg-boss.cjs` from `src/`.

Do not add new test-file suffixes; if a new test type is needed, update the regex deliberately.

## Environment File Conventions

`.env` is parsed by both Docker Compose and `dotenv` — values containing shell-special characters (`<`, `>`, `|`, `&`, spaces) **must be quoted** or rewritten:

```dotenv
# Wrong — the unquoted angle brackets are shell redirection syntax and break parsing
MAIL_FROM=StreamTube <noreply@streamtube.com>

# Also wrong — quoting only the display name leaves `<...>` outside the quotes; Docker Compose refuses to start the stack
MAIL_FROM="StreamTube" <noreply@streamtube.com>

# Right — one quoted string wrapping the whole value (this is the form in .env.example)
MAIL_FROM="StreamTube <noreply@streamtube.com>"
```

The in-code defaults (`mail.config.ts`, `env.validation.ts`) still use the display-name-quoted form — that is fine in TypeScript, but never copy it into `.env`. If the display name ever becomes configurable, prefer keeping only the bare address in `.env` and composing the display name in code so the file stays shell-safe.

### URL variables

- `FRONTEND_URL` — **required** (`Joi.string().uri()`); the API fails to boot without it. It is the base of the links embedded in e-mails: `${FRONTEND_URL}/confirm-email?token=…` and `${FRONTEND_URL}/reset-password?token=…` — both are Next.js routes, not API routes (`saneamento-fase-02-e-infra/TD-02`). For local dev use the browser-facing frontend address (`http://localhost:3001`), not the Compose service name: the link is opened by a human browser, not by a container.
- `APP_URL` — the API's own public base URL (e.g., Swagger/server metadata). Not used to build e-mail links.

Start from `cp .env.example .env` — the example carries both keys with working local values.

### Produção: SMTP autenticado e migrations compiladas (Fase 07)

- **SMTP** (`home-search-production/TD-09`): `MAIL_USER` + `MAIL_PASSWORD` (opcionais, mas **juntos** — o Joi recusa só um deles e nomeia a chave faltante) e `MAIL_SECURE` (`true`/`false`, default `false`; `true` = TLS implícito na porta 465, `false` com STARTTLS na 587). Sem `MAIL_USER`, `mailTransport()` (`src/mail/mail.module.ts`) monta o transporte do Mailpit (só `host`/`port`, sem `auth`).
- **Migrations sem ts-node:** `src/database/data-source.ts` resolve `migrations`/`entities` pela extensão do próprio arquivo (`dataSourcePaths`): rodando como `.ts` (ts-node, `npm run migration:run`) usa `src/**`; compilado (`dist/database/data-source.js`) usa `dist/**`. Em produção: `npm run build` e depois `npm run migration:run:prod` (`typeorm migration:run -d dist/database/data-source.js`) — é o que o serviço one-shot `migrate` executa (`home-search-production/TD-11`).
- **Ao verificar o `dist/` em dev**, pare o `start:dev` antes (`docker compose restart nestjs-api`): o `nest start --watch` usa `deleteOutDir` e apaga o `dist/` enquanto você o inspeciona. O `npm run openapi:export` também roda `nest build` e derruba o `start:dev` — suba-o de novo depois.
- **`SWAGGER_ENABLED`** consta do `.env.example` (`false`); mantenha `false` em produção.
- **Throttle de leitura (Fase 07):** além do global (10 req/min por rota e visitante), as listagens públicas têm `LISTING_THROTTLE` e `GET /categories` tem `CATEGORIES_THROTTLE` (60/min), e as leituras de alta frequência — `GET /videos/{publicId}`, `/playback`, `/related`, `/comments` e `GET /me/subscriptions` — usam `READ_THROTTLE` (60/min, `src/common/throttling/read-throttle.ts`): o polling de processamento (3 s) e o layout com sessão estouravam o global.

## Build Assets

`tsc` (and therefore `nest build`) only emits compiled `.ts` files to `dist/`. Any non-TypeScript runtime asset — Handlebars templates (`.hbs`), JSON fixtures, static config files, etc. — must be declared in `nest-cli.json` under `compilerOptions.assets` (with `watchAssets: true` for dev). Without that, the file exists in `src/` but is missing in `dist/` and runtime fails only after build.

## Architecture

NestJS with standard module structure. Source lives in `src/`, compiled output in `dist/`.

- Each domain feature gets its own module (e.g., `UsersModule`, `VideosModule`) registered in `AppModule`
- Controllers handle HTTP routing; Services hold business logic; both are scoped to their module

## Code Conventions

- **TypeScript:** `nodenext` module resolution, `ES2023` target, `strictNullChecks` on, `noImplicitAny` off
- **Decorators:** `emitDecoratorMetadata` + `experimentalDecorators` enabled — required for NestJS DI
- **Prettier:** single quotes, trailing commas everywhere
- **ESLint:** `no-explicit-any` allowed; `no-floating-promises` and `no-unsafe-argument` are configured as warnings, but the `lint` script runs with `--max-warnings 0`, so any warning fails it (policy: 0 errors and 0 warnings across `src/` and `test/`, including specs and e2e — type `res.body` and mocks instead of relying on `any`; per `saneamento-fase-04/TD-01`). To check without rewriting files, run `npx eslint "{src,apps,libs,test}/**/*.ts"` (no `--fix`).

## REST Conventions

This is a RESTful API. All endpoints must follow standard REST conventions — correct HTTP methods, proper status codes, plural resource nouns, and consistent URL structure. Details are enforced via rules on controller files.
