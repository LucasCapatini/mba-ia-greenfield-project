# phase-03-upload-processing — Progress

**Status:** completed
**SIs:** 12/12 completed

### SI-03.1 — Infra: storage, worker e configuração de ambiente
- **Status:** completed
- **Tests:** 20 passing (env.validation.spec.ts + env.validation.integration-spec.ts); tsc clean
- **Observations:**
  - O serviço `video-worker` sobe com `command: tail -f /dev/null` como placeholder; o SI-03.7 troca para `npm run start:worker` quando o script existir.
  - `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT` ganharam restrição de esquema `http`/`https` no Joi (não prevista no plano): o Joi aceitava `rustfs:9000` como URI válido e o SDK S3 exige esquema explícito.
  - RustFS precisou de `RUSTFS_VOLUMES=/data` no compose (o entrypoint da imagem não recebe o caminho como argumento em Compose); `storage-init` usa `amazon/aws-cli:2.38.1` com `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` pelo mesmo motivo do TD-02.
  - O `.env` local (gitignored) foi atualizado com as novas chaves para o ambiente subir; `.env.example` carrega os mesmos valores de dev.
  - As ferramentas `TaskCreate`/`TaskUpdate` não existem nesta sessão; este `progress.md` é a lista de tarefas persistente.

### SI-03.2 — StorageModule: clientes S3, presigner e smoke test contra o RustFS
- **Status:** completed
- **Tests:** 18 passing (storage.service.spec.ts, storage.service.integration-spec.ts, storage.module.spec.ts); tsc clean
- **Observations:**
  - Smoke test do RustFS 1.0.3 passou nos quatro contratos que TD-01/TD-03/TD-09 assumem: multipart pré-assinado (PUT de partes de 5 MiB sem headers extras), `Range` → 206, `response-content-disposition` e abort; o fallback para Garage não foi necessário.
  - URLs pré-assinadas são amarradas ao método HTTP: uma URL assinada para `GET` responde 403 a `HEAD` — a futura UI deve usar `GET` (ou `Range`) para sondar `download_url`.
  - Nas suítes que rodam dentro do container, `S3_PUBLIC_ENDPOINT` é sobrescrito para o host interno antes de compilar o módulo (a assinatura fixa o host; `localhost:9000` é o próprio container) — mesmo padrão previsto nos specs E2E.
  - `aws-sdk-client-mock` intercepta `send()` de todas as instâncias; `getSignedUrl` passa por `send()`, então os testes de presign usam o cliente real (sem rede) após `restore()`.
  - `StorageService.deleteObject` foi adicionado além da superfície listada no plano (necessário para limpeza de rascunhos/thumbnails nos SIs 03.6 e 03.9).

### SI-03.3 — Entidades `Video` e `VideoUpload`, migration e identificador público
- **Status:** completed
- **Tests:** 18 passing (public-id.util.spec.ts, video.entity.integration-spec.ts, video-upload.entity.integration-spec.ts, migrations.integration-spec.ts); tsc clean
- **Observations:**
  - Colunas de data usam `timestamp` (sem fuso), espelhando as entidades da Fase 02, em vez do `timestamptz` escrito no `### Data Model` — manter o schema homogêneo pesou mais que o literal do plano; `bigint`/`numeric` chegam como string do driver pg e ganharam transformers (`src/common/typeorm/column-transformers.ts`) para expor `number`.
  - O lado inverso `Channel.videos` obriga qualquer `DataSource` de teste que registre `Channel` a conhecer `Video`/`VideoUpload`: as dez suítes que montavam listas locais passaram a importar `ALL_ENTITIES` de `src/test/create-test-data-source.ts` (mudança transversal necessária, imports órfãos podados).
  - Migration gerada pela CLI: `1792352807074-CreateVideosAndVideoUploads.ts`; o teste do runner agora cobre índices e a FK `ON DELETE CASCADE` e reverte a terceira migration.
  - `VIDEO_STATUSES` contém só `draft`; `published`/visibilidade entram na Fase 04 sem reabrir a entidade.

### SI-03.4 — QueueModule: fila `pg-boss` sobre o PostgreSQL
- **Status:** completed
- **Tests:** 6 passing (queue.module.spec.ts, queue.service.integration-spec.ts); tsc clean
- **Observations:**
  - `pg-boss` 12 é ESM-only. A aplicação CommonJS o carrega pelo `require(esm)` nativo do Node 25 (tsc limpo), mas o runtime CJS do Jest não: `src/test/pg-boss.cjs` + `moduleNameMapper` nos dois configs do Jest entregam o pacote real via `process.getBuiltinModule('node:module').createRequire` (o `createRequire` obtido por `require('node:module')` dentro da sandbox é a versão patched do jest-runtime). Documentado em `nestjs-project/CLAUDE.md` → Jest Configuration.
  - Semântica do pg-boss ≥ 10 não prevista no plano: `singletonKey` só deduplica sob políticas `short`/`singleton`/`stately`/`exclusive` (na `standard` é ignorado). As filas nascem com `policy: 'exclusive'` (1 job por chave na fila OU ativo — o contrato de TD-11/TD-12); a política é imutável, então `ensureQueue` recria a fila quando encontra outra política.
  - `startAfter` é normalizado para ISO string no `send`: um `Date` criado na sandbox do Jest não é `instanceof Date` no realm onde o pg-boss roda e virava string inválida para `interval`.
  - `QueueService.offWork(queue)` adicionado (isolamento entre testes e encerramento do worker); o teste de integração desregistra os handlers em `afterEach`.
  - A opção `db` do `send` (transação compartilhada, TD-11) existe na versão instalada: `IDatabase` é só `executeSql(text, values)` → um `QueryRunner` do TypeORM adapta trivialmente no SI-03.6.

### SI-03.5 — Endpoint POST /videos: pré-cadastro do rascunho e abertura do multipart
- **Status:** completed
- **Tests:** 15 passing (9 unit/integration/module + 6 E2E de `specs/videos-create.plan.md` em `test/videos-create.e2e-spec.ts`); tsc clean
- **Observations:**
  - `content_type` é validado no serviço (não com `@IsIn` no DTO) para responder `400 VIDEO_UNSUPPORTED_MEDIA_TYPE` como manda o contrato, em vez de `VALIDATION_ERROR`; o enum vai ao OpenAPI por `@ApiProperty({ enum })`, única anotação manual no DTO de request (o plugin não infere enums).
  - `ChannelsService.findByUserId` adicionado (o módulo de vídeos precisa resolver o canal do dono sem conhecer o repositório de canais).
  - O mapper do shim `pg-boss` no `test/jest-e2e.json` precisou de `<rootDir>/../src/test/pg-boss.cjs` (o `rootDir` desse config é `test/`); corrigido junto com a nota no `CLAUDE.md`.
  - Os E2E abortam todos os multiparts sob `videos/` no bucket de dev em `beforeEach`/`afterAll` (banco e bucket de teste são os de dev, como na Fase 02).

### SI-03.6 — Endpoints de upload: URLs por parte, retomada, complete e abort
- **Status:** completed
- **Tests:** 42 passing (4 VideosOwnership unit + 17 VideosService unit + 4 integração com partes reais de 5 MiB no RustFS + 1 módulo + 13 E2E em videos-upload/videos-create; tsc limpo)
- **Observations:**
  - `video.process` é enfileirado na MESMA transação do `complete`: `QueueService.send` recebe o `EntityManager` adaptado ao `IDatabase` do pg-boss (`executeSql` → `{ rows }`), então job, sessão `completed` e `processing_status` commitam juntos — não foi preciso o fallback "send após COMMIT". Documentado no CLAUDE.md do backend.
  - `part_number > part_count` sai como `400 VALIDATION_ERROR` via `UploadPartOutOfRangeException` (DomainException com o mesmo código do ValidationPipe), porque o DTO não conhece a sessão.
  - `CompleteUploadDto.parts` não tem `ArrayMinSize`: a cardinalidade é checada no serviço depois da propriedade, para que um intruso com `{ parts: [] }` receba 403 (spec 5.1) e não 400.
  - Spec 4.1 pede `GET /videos/{id}` → 404 após o abort; essa rota só chega no SI-03.10, então a suíte prova o mesmo 404 de domínio em `GET /videos/{id}/upload` (o SI-03.11 cobre a rota de leitura).
  - As suítes E2E rodavam em paralelo (o script `test:e2e` não tinha `--runInBand` nem `maxWorkers`, apesar do CLAUDE.md dizer "serial by config"), contaminando DB/bucket entre `videos-create` e `videos-upload`. Corrigido com `maxWorkers: 1` em `test/jest-e2e.json` e documentado — fix de config mínimo, sem tocar nos testes da Fase 02.
  - Requisições concorrentes (`Promise.all`) contra `app.getHttpServer()` não ouvinte resetam a conexão no supertest; o cenário 5.1 roda as 12 chamadas em sequência.

### SI-03.7 — Worker: segundo entrypoint `src/worker.ts` e `WorkerModule`
- **Status:** completed
- **Tests:** 5 passing (WorkerModule compilação + bootstrap integration com DB/pg-boss/RustFS reais, mais os module specs de videos/queue e o E2E videos-create como sanidade do AppModule refatorado); tsc limpo; `npm run build` emite dist/main.js e dist/worker.js; serviço `video-worker` sobe, loga "Queue ready"/"Video worker started" e `docker compose stop` encerra em 1 s com "SIGTERM received" + "Queue stopped" (exit 0)
- **Observations:**
  - `start:worker` NÃO é `nest start --watch --entryFile worker` como o plano previa: com `npm run`/`nest` na frente, o SIGTERM do Docker para no `sh -c` do dash (não repassa sinais) e o `nest` CLI sai antes do filho, então o worker morria sem `app.close()` (verificado: exit 1, sem log de shutdown). O script e o `command` do compose rodam `node --watch --enable-source-maps -r ts-node/register/transpile-only src/worker.ts` diretamente, com `init: true` e `stop_grace_period: 15s`; o `node --watch` espera o filho encerrar e dá hot reload. Documentado no CLAUDE.md.
  - AC 4 (worker sem JWT_SECRET/MAIL_HOST): adotada a alternativa prevista — o schema Joi é compartilhado via `src/config/config-module.options.ts` (também usado pelo AppModule, que ficou sem duplicação), então o worker exige o mesmo `.env` da API. Registrado no CLAUDE.md.
  - `QueueService.onModuleDestroy` passou a logar "Queue stopped (pg-boss graceful stop)" para o encerramento ser observável no log do container (AC 2).
  - Nenhum `work` é registrado ainda: os handlers chegam nos SI-03.8/03.9; o boot atual prova só o contexto, as filas e o shutdown.

### SI-03.8 — Job `video.process`: ffprobe, validação de formato, thumbnail e transições guardadas
- **Status:** completed
- **Tests:** 37 passing no SI (10 validator unit + 8 FfmpegService unit com execFile mockado + 3 FfmpegService integration com ffmpeg real lendo do RustFS por URL assinada + 10 VideoProcessingWorker integration com DB/RustFS/pg-boss/ffmpeg reais, incluindo consumo pela fila real + 6 módulo/bootstrap/queue/videos de regressão); E2E videos-upload/videos-create 13 passing; tsc limpo; worker real reiniciado loga "Listening on video.process"
- **Observations:**
  - O `WorkerModule` só faz `forFeature([Video])`, mas `autoLoadEntities` não traz `Channel`/`User` (pontas das relações) e o TypeORM falhava com "Entity metadata for Video#channel was not found". Criado `src/database/entities.ts` (`ENTITIES`, reutilizado por `ALL_ENTITIES` dos testes) e `typeOrmWorkerModuleAsyncOptions` em `config-module.options.ts` com `entities` explícitas; a API segue com `autoLoadEntities`.
  - Isolamento da fila nos testes: com o serviço `video-worker` vivo, ele consumiria os jobs `video.process` que as suítes enfileiram no schema `pgboss`. `src/test/jest-env.cjs` (segundo `setupFiles`, nas duas configs) fixa `QUEUE_SCHEMA=pgboss_test`; documentado no CLAUDE.md.
  - Erros retentáveis são classificados por etapa (`StageError` interna: `PROBE_FAILED` até o probe, `THUMBNAIL_FAILED` depois); na última tentativa (`retryCount === retryLimit` = 3, de `QUEUE_SEND_DEFAULTS`) o vídeo vai a `failed` sem relançar. Falhas de storage na fase de probe caem em `PROBE_FAILED`.
  - O teste de retry por timeout real do ffprobe (3 reexecuções com backoff de 30 s) seria lento demais; a suíte prova o contrato chamando o handler com `retryCount` 0 (relança, vídeo segue `processing`) e 3 (grava `PROBE_FAILED`), com `probe` mockado, e o consumo real pela fila com o caminho feliz.
  - `node --watch` não recarregou o worker ao criar os arquivos novos (eventos de arquivo no bind mount 9p); foi preciso `docker compose restart video-worker`. Comportamento do ambiente, não do código — registrado para quem for editar o worker.
  - A fixture MKV declara `content_type: video/mp4` de propósito: prova que a validação pelos bytes recusa o que o MIME declarado deixou passar (TD-14).

### SI-03.9 — Job `upload.expire`: limpeza de uploads órfãos e rascunhos abandonados
- **Status:** completed
- **Tests:** 14 passing no SI (9 unit com repos/storage/fila mockados + 5 integração com DB/RustFS/pg-boss reais, incluindo o job agendado pelo pré-cadastro consumido pela fila real); regressão src/worker + videos.service + E2E videos-create/videos-upload verdes (77 + 13); tsc limpo; worker real loga "Listening on upload.expire"
- **Observations:**
  - Ordem no handler: a transição guardada `active → expired` acontece ANTES do abort no storage (dentro da transação). Zero linhas = o complete/abort venceu → no-op sem tocar no storage; falha de storage desfaz a transição (rollback) e o pg-boss retenta. A sessão some por cascata do DELETE do vídeo.
  - `UPLOAD_TTL` tem mínimo de 60 s no Joi, então o teste de integração não usa TTL curto: faz o pré-cadastro real e adianta o `start_after` do job em `pgboss_test.job` para `now()`, provando o agendamento e o consumo pela fila real.
  - `dataSource.query` com `UPDATE … RETURNING` devolve `[rows, affected]` no driver postgres (não só as linhas) — pegadinha que derrubou o helper na primeira execução.
  - A API agora loga o prazo da sessão e o `UPLOAD_TTL` ao agendar `upload.expire` (ação 3 do plano).
  - Lifecycle `AbortIncompleteMultipartUpload` do `storage-init` conferido: 2 dias > 24 h de `UPLOAD_TTL`; documentado no CLAUDE.md como rede de segurança.

### SI-03.10 — Endpoints GET /videos/{publicId} e GET /videos/{publicId}/playback
- **Status:** completed
- **Tests:** 81 passing (63 em src/videos — inclui 11 unit do sanitizador de filename, 6 unit novos de getVideo/getPlayback e 2 integração com RustFS real: Range → 206 com 1024 bytes e Content-Disposition attachment; 18 E2E em videos-playback/videos-upload/videos-create, com os 5 cenários do spec); tsc limpo
- **Observations:**
  - O spec pede `PLAYBACK_URL_TTL = 2` via env, mas o Joi exige mínimo de 60 s (a API não subiria). A E2E sobrescreve só o provider `uploadConfig.KEY` com `overrideProvider` (`playbackUrlTtlSeconds: 2`); o RustFS recusa a assinatura expirada com 403 sem envolver a API, como previsto.
  - `Content-Disposition`: `sanitizeFilename` remove aspas, barras, CR/LF e controles, colapsa espaços, limita a 200 chars e cai em `video.<ext>` pelo MIME; nomes não-ASCII ganham `filename*=UTF-8''…` (RFC 5987) além do `filename` ASCII. O header literal vai na assinatura (`response-content-disposition`), então é o storage que o devolve.
  - `thumbnail_url` é assinada com o cliente público e o mesmo `PLAYBACK_URL_TTL`, nos dois endpoints; `null` sem `thumbnail_key` (sem chamada ao storage).
  - A E2E semeia `ready`/`failed` direto no banco (fixture MP4 + JPEG mínimo no storage), isolando a leitura do worker — o fluxo completo fica para o SI-03.11.

### SI-03.11 — Fluxo completo: upload multipart → processamento → playback em E2E
- **Status:** completed
- **Tests:** 5 passing em test/videos-upload-flow.e2e-spec.ts (fluxo completo 3 × 5 MiB → worker in-process → ready → Range 206 / download attachment em ~3 s de teste, 23 s de suíte isolada com boot; 413 política; 422 parte faltando; 403 não-dono; MKV → failed/UNSUPPORTED_FORMAT); `npm run test:e2e` completo: 8 suítes, 80 testes, 47 s; tsc limpo
- **Observations:**
  - A fixture de 2 s do SI-03.8 tem poucos KB; criada `mp4-h264-aac-large` (720p, 10 s, CBR 9 Mb/s via `nal-hrd=cbr`, ~10,8 MiB, 2 s para gerar) para produzir exatamente 3 partes com `UPLOAD_PART_SIZE = 5 MiB`.
  - AC "nenhum byte de vídeo pela API": middleware Express só na suíte registra o maior `Content-Length` recebido pela API durante o fluxo e a asserção exige < 16 KiB; os PUTs das partes vão por `fetch` direto ao RustFS.
  - Worker via `NestFactory.createApplicationContext(WorkerModule)` no mesmo processo Jest, consumindo o schema `pgboss_test` (isolado do serviço `video-worker` do compose, que segue no schema `pgboss`).
  - `testTimeout` do `test/jest-e2e.json` subiu para 90 000 (plano, ação 4); documentado no CLAUDE.md. O `setupFiles` já tinha `dotenv/config` + `jest-env.cjs`.
  - O primeiro byte do `Range` é comparado com a fixture original (não só o tamanho), provando que o objeto montado pelo `CompleteMultipartUpload` é o arquivo enviado.

### SI-03.12 — Cadeia OpenAPI, lint/tsc e documentação de encerramento
- **Status:** completed
- **Tests:** openapi-export.integration-spec estendido (7 rotas de vídeo com status codes/segurança/summary + enums + shapes de resposta); suíte completa: 45 suites / 319 testes unit+integração (91 s), 8 suites / 80 testes E2E (119 s); tsc limpo; eslint sem problemas em src/videos, src/storage, src/queue, src/worker; cadeia OpenAPI idempotente (hashes de openapi.json e types.gen.ts inalterados após export → sync → types)
- **Observations:**
  - Cadeia OpenAPI rodada (export no container da API, `scripts/sync-openapi.sh` no host, `openapi:types` no container do frontend): `next-frontend/openapi.json` (+1028) e `lib/api/types.gen.ts` (+767) mudaram só por isso; nenhuma outra alteração no frontend. Os enums `processing_status`, `processing_error`, `state` da sessão e `content_type` saem como `enum` no contrato.
  - Lint: Prettier aplicado (`eslint --fix`) apenas nos arquivos que a fase criou/tocou; a migration gerada pelo TypeORM também foi formatada. Nos specs da Fase 02 editados no SI-03.3, removidos os imports de entidades que ficaram sem uso após `ALL_ENTITIES` e normalizadas as linhas LF inseridas em arquivos CRLF (diff real pequeno; sem reformatação de código antigo).
  - Dívida de lint pré-existente (fora de escopo, registrada): ~290 problemas concentrados em `test/auth.e2e-spec.ts`, `src/auth/auth.service.spec.ts`, `channels.service.ts` (catch sem tipo), `create-test-data-source.ts` (`Function`) e nos acessos a `res.body`/mocks `any` em specs. Os quatro `test/videos-*.e2e-spec.ts` da fase seguem o mesmo padrão de `res.body` não tipado das E2E da Fase 02 (~75 `no-unsafe-*`), deixado consistente com a suíte existente e contado nessa dívida — vale uma task de "tipar res.body nas E2E" para o conjunto.
  - `npm run lint` carrega `--fix` e reformataria arquivos da Fase 02 com dívida; a verificação usou `npx eslint` sem `--fix`.
  - Documentação: README (API orquestra multipart; storage S3-compatível/RustFS; fila pg-boss; worker como segundo entrypoint), `docs/diagrams/software-arch.mermaid` (tecnologias e relações atualizadas, sem "TBD"/"MinIO") e o CLAUDE.md da raiz (Fase 03 concluída; containers descritos).
