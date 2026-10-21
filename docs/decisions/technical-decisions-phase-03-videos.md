---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-10-18
scope_description: "Backend + infra da Fase 03 — object storage S3-compatível e seu SDK, protocolo de upload de até 10 GB com retomada, fila de processamento em segundo plano, onde vive o worker FFmpeg e como ele é invocado, modelo de dados do vídeo em rascunho, identificador público único, entrega de streaming/download, topologia Docker Compose, contrato e idempotência do job, limpeza de uploads órfãos, estratégia de testes e formatos de vídeo aceitos com seu ponto de validação. A UI de upload fica para uma fatia posterior; os contratos voltados ao navegador são decididos aqui uma única vez (TDs Cross-layer)."
---

# Technical Decisions — Fase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — recebe o módulo de vídeos (pré-cadastro, orquestração do upload, URLs assinadas), o módulo de storage, o módulo de fila, o segundo entrypoint do worker FFmpeg, as entidades/migrations e os serviços novos do `compose.yaml` (storage, worker e, conforme TD-04, broker). Todos os TDs abaixo o afetam.
- `next-frontend/` — **nenhuma decisão aberta nesta fatia.** Por decisão do usuário (sessão 15), a Fase 03 é uma fatia só, backend + infra: nenhum bullet da fase cita tela e não há Figma de upload/estúdio. O navegador, porém, participa de dois contratos que precisam ser fixados uma única vez — o protocolo de upload (TD-03) e a entrega de streaming/download (TD-09) — por isso esses dois TDs são `Cross-layer`; a fatia de UI que os consumir herda-os sem reabri-los. Os tipos de wire chegam ao frontend pela cadeia OpenAPI já decidida (`next-frontend-openapi-typing/TD-01..TD-05`).
- repositório (raiz) — topologia do `compose.yaml` e bootstrap do bucket (TD-10), herdando `saneamento-fase-02-e-infra/TD-01` (stacks separadas, rede `streamtube` criada pela stack do backend).

_Nota de pesquisa:_ o MCP `context7` não estava disponível nesta sessão (mesma ressalva do saneamento). As fontes primárias foram consultadas diretamente via WebFetch/WebSearch e registro npm/Docker Hub em 2026-10-18: documentação oficial do AWS SDK for JavaScript v3 (checksums), BullMQ (backend PostgreSQL), NestJS (CLI `--entryFile`, queues), Garage (tabela de compatibilidade S3), RustFS (instalação Docker), tus-node-server (`@tus/s3-store`), Debian (pacote `ffmpeg`), releases do GitHub de `nestjs/bull` e issues/PRs citados. Versões instaladas: NestJS 11, TypeORM 0.3.28, PostgreSQL 17, Node 25.6.0 no container da API (imagem `node:25.6.0-slim`, base **Debian 12 bookworm** — verificado com `docker run`). Versões disponíveis verificadas: `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` 3.1152.0; `bullmq` 6.3.16 (linha 5.x em 5.81.5); `@nestjs/bullmq` 11.0.5 (peer `bullmq ^3||^4||^5||^6`, Nest 10/11) e 12.0.0 (ESM, linha Nest 12); `pg-boss` 12.38.0 (Node ≥ 22.12); `@tus/server` 2.4.6 e `@tus/s3-store` 2.0.8; `nanoid` 6.0.2 (`engines` **exclui Node 25**); `aws-sdk-client-mock` 4.1.0; imagens `rustfs/rustfs:1.0.3`, `dxflrs/garage:v2.4.1`, `chrislusf/seaweedfs` (release 4.48), `redis:8.x`, `valkey/valkey:9.0.6`; `ffmpeg` 7:5.1.9 em bookworm e 7:7.1.5 em trixie.

_Fatos que mudam o cenário em relação ao planejamento da sessão 15:_

1. **MinIO community foi descontinuado.** Parou de publicar binários e imagens Docker em 2025-10-23, entrou em maintenance mode em 2025-12-03 e o repositório foi arquivado em 2026-04-25. `docker pull minio/minio` falha; sobra um espelho congelado em `quay.io/minio/minio` (último release de setembro de 2025, sem patches de segurança). MinIO deixa de ser a recomendação; é listado em TD-01 apenas como opção de contingência.
2. **BullMQ 6 ganhou backend PostgreSQL GA** (julho de 2026, paridade total de features com Redis), mas o `@nestjs/bullmq` ainda só aceita opções de conexão Redis — o PR `nestjs/bull#2924` (backends plugáveis) continua aberto em 2026-10-12. Isso abre a alternativa "fila sem Redis", avaliada em TD-04.
3. **`fluent-ffmpeg` foi arquivado** (2025-05-22) e marcado deprecated no npm; o autor recomenda montar a linha de comando e `spawn`/`execFile` sem wrapper. TD-06 já parte desse fato.
4. A imagem `node:25.6.0-slim` é **bookworm**, não trixie: o `apt install ffmpeg` entrega 5.1.9; a variante `node:25.6.0-trixie-slim` entrega 7.1.5. Ambas bastam para `ffprobe` + extração de frame (TD-06).

---

## TD-01: Serviço de object storage S3-compatível

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** o C4 prevê "Object Storage (S3 ou MinIO)" e todas as capacidades da fase (upload multipart, streaming por Range, download, thumbnail) dependem de um servidor que fale a API S3 em dev e, no futuro, de um S3 real em produção. Com o MinIO community arquivado, é preciso escolher o servidor de dev sem amarrar o código a ele: o contrato do backend é a **API S3** (TD-02), e o servidor é substituível. Requisitos mínimos para esta fase: `CreateMultipartUpload`/`UploadPart`/`ListParts`/`CompleteMultipartUpload`/`AbortMultipartUpload`, URLs pré-assinadas (PUT e GET), `Range` em GET, CORS de bucket (o navegador faz PUT direto — TD-03), `response-content-disposition` em GET pré-assinado (download — TD-09) e, desejável, lifecycle `AbortIncompleteMultipartUpload` (TD-12). Também fixa o contrato de variáveis de ambiente, que atravessa `env.validation.ts` (Joi), `compose.yaml` e `.env.example`.

**Options:**

### Option A: RustFS 1.0.x (`rustfs/rustfs:1.0.3`)
- Servidor S3 em Rust, Apache-2.0, GA em 2026-09-16; é o "drop-in" mais próximo do MinIO (porta 9000 para API, 9001 para console, credenciais via `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY`, volume único em `/data`, `/health`). Cobre multipart, presigned, CORS, lifecycle, notifications, versioning e console web.
- **Pros:** superfície S3 mais completa entre as alternativas livres; console web para inspecionar buckets durante o desenvolvimento; um único container e um único volume; licença permissiva; imagem oficial com tags semânticas pináveis.
- **Cons:** projeto jovem (GA há um mês; 1.0.3 em 2026-10-17) — menos runbooks e relatos de arestas em edge cases do S3; o smoke test da SI de storage precisa provar presigned multipart + CORS + `Range` + `response-content-disposition` antes de qualquer outra SI; o container roda como UID 10001 e exige `chown` quando se usa bind mount (volume nomeado evita).

### Option B: Garage 2.4.x (`dxflrs/garage:v2.4.1`)
- Servidor S3 em Rust mantido pela Deuxfleurs desde 2021, AGPL-3.0, pensado para hardware modesto e geo-distribuição. Implementa multipart completo, presigned, CORS, `Range`; lifecycle parcial (`AbortIncompleteMultipartUpload` e `Expiration`); **sem** bucket notifications e sem console web (administração via CLI `garage` ou Admin API).
- **Pros:** maduro e leve (ideal para a restrição de memória do Docker Desktop no Windows registrada na sessão 15); mantém exatamente as operações que a fase precisa; comunidade estável.
- **Cons:** bootstrap mais verboso (atribuir layout do nó, criar bucket e chave via CLI, `garage bucket allow`); `response-content-disposition` não consta na tabela de compatibilidade — risco para o download (TD-09) que teria de ser verificado ou contornado via proxy; AGPL é indiferente em dev, mas pesa se o mesmo compose virar base de produção.

### Option C: SeaweedFS 4.x (`chrislusf/seaweedfs:4.48`)
- Sistema de arquivos distribuído em Go, Apache-2.0, com gateway S3 (`weed server -s3` sobe master + volume + filer + S3 em um container). Documenta multipart, presigned, CORS, lifecycle, tagging, checksums, IAM.
- **Pros:** o mais maduro dos três (10+ anos), escala a bilhões de objetos, licença permissiva, superfície S3 ampla.
- **Cons:** arquitetura em quatro componentes mesmo no modo single-binary (mais portas, mais superfície para diagnosticar); IAM/credenciais via `s3.json`; sobredimensionado para um ambiente de dev de uma única API; menos "drop-in" para quem vem do MinIO.

### Option D: MinIO congelado (`quay.io/minio/minio`, release de 2025-09)
- Usar o último release community a partir do espelho do Quay (a imagem do Docker Hub já não existe).
- **Pros:** API e tooling (`mc`) amplamente documentados; zero curva de aprendizado.
- **Cons:** software arquivado sem patches de segurança nem correções; o espelho pode sumir a qualquer momento; o console já tinha sido removido da community em 2025-05; vai contra "planejar o armazenamento desde o início" (pontos de atenção do plano). Só faz sentido como contingência temporária se A e B falharem no smoke test.

**Recommendation:** **Option A (RustFS 1.0.x com tag pinada)** — é a única alternativa livre que cobre todas as operações exigidas pelas TDs 03/09/12 (presigned multipart, CORS, `response-content-disposition`, lifecycle) com um container, um volume e console web, mantendo o backend acoplado apenas à API S3 (TD-02) para que produção use S3 real ou outro servidor sem mudar código. O risco de maturidade é mitigado por um smoke test obrigatório na primeira SI de storage; **Garage (B) é o fallback** se o smoke test falhar. Contrato de ambiente proposto (chaves canônicas para Joi + compose + `.env.example`): `S3_ENDPOINT` (interno, `http://rustfs:9000`), `S3_PUBLIC_ENDPOINT` (voltado ao navegador, `http://localhost:9000` em dev — base das URLs pré-assinadas de upload/stream), `S3_REGION` (`us-east-1`, exigido pelo SDK), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (`streamtube-videos`), `S3_FORCE_PATH_STYLE=true`.

**Decision:** A (RustFS 1.0.x com tag pinada; Garage 2.4.x como fallback se o smoke test de presigned multipart/CORS/Range/`response-content-disposition` falhar)

---

## TD-02: SDK de acesso ao storage

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** o backend precisa criar/completar/abortar uploads multipart, assinar URLs de PUT/GET e enviar a thumbnail gerada pelo worker. A escolha do SDK define o grau de acoplamento ao servidor de dev (TD-01) e o modo como o worker e a API compartilham o cliente. Depende de TD-01 apenas quanto ao `forcePathStyle` e ao comportamento de checksums.

**Options:**

### Option A: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (v3, 3.1152.0)
- SDK oficial modular da AWS; `S3Client` configurado com `endpoint`, `region`, `forcePathStyle: true` e credenciais estáticas; `getSignedUrl(client, command, { expiresIn })` para pré-assinar qualquer comando (`UploadPartCommand`, `GetObjectCommand` com `ResponseContentDisposition`). Dois clientes: um com o endpoint interno (chamadas da API/worker) e um com o endpoint público (somente para assinar URLs que o navegador usará — o host faz parte da assinatura SigV4).
- **Pros:** neutro em relação ao fornecedor (funciona em S3 real, RustFS, Garage, SeaweedFS); tree-shaking por comando; mocks consolidados para unit tests (`aws-sdk-client-mock` 4.1.0); documentação de referência.
- **Cons:** desde a 3.729.0 o SDK calcula checksum CRC32 por padrão e anexa `x-amz-checksum-*`/trailer — serviços S3-compatíveis podem rejeitar; é preciso `requestChecksumCalculation: 'WHEN_REQUIRED'` e `responseChecksumValidation: 'WHEN_REQUIRED'` no `S3Client` (documentado pela AWS); muitos pacotes `@aws-sdk/*` no `node_modules`.

### Option B: `minio` (SDK JavaScript do MinIO)
- Cliente S3 simplificado (`presignedPutObject`, `presignedGetObject`, `initiateNewMultipartUpload`…), historicamente usado com MinIO e compatível com outros servidores S3.
- **Pros:** API mais curta para presign; sem a armadilha de checksums do SDK da AWS.
- **Cons:** mantido pela mesma empresa que arquivou o servidor community — futuro incerto; cobertura de operações multipart de baixo nível menos completa e menos tipada; menos adequado como contrato "S3 genérico" para produção.

### Option C: wrapper NestJS de terceiros (`nestjs-s3`, `nestjs-minio` etc.)
- Módulos que injetam um cliente S3/MinIO pré-configurado via `forRoot`.
- **Pros:** poupa o `StorageModule` de ~30 linhas de provider.
- **Cons:** camada extra sem valor de domínio; dependem de versões específicas do SDK subjacente; o projeto já tem o padrão `registerAs` + provider próprio para config (phase-01/TD-03), que resolve o mesmo problema sem dependência.

**Recommendation:** **Option A (AWS SDK v3 + presigner)** — mantém o backend acoplado somente à API S3, o que é a razão de ser de TD-01, e tem o ecossistema de mocks que TD-13 usa nos unit tests. A configuração obrigatória (`forcePathStyle`, `WHEN_REQUIRED` nos dois checksums, cliente interno vs. cliente de assinatura pública) vira parte do contrato do `StorageModule`.

**Decision:** A (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `forcePathStyle: true`, `requestChecksumCalculation`/`responseChecksumValidation: WHEN_REQUIRED`, cliente interno + cliente de assinatura pública)
**Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

---

## TD-03: Protocolo de upload de arquivos de até 10 GB com retomada

**Scope:** Cross-layer

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance; Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** o plano exige 10 GB "sem travar o sistema" e "retomar em caso de falha de conexão". O modelo Strict BFF (`next-frontend-config-base/TD-03`) diz que o navegador nunca fala com a API; ele fala com a origem Next, que proxia para `nestjs-api`. Fazer 10 GB atravessarem Next → Nest → storage é o pior caso. O C4 já admite que o navegador fale **diretamente com o Object Storage** ("Frontend → Storage: Streams"); a questão é se o mesmo vale para o upload. Decisão cross-layer: define o handshake que a API expõe e que a futura fatia de UI implementa.

**Options:**

### Option A: S3 Multipart direto no storage com URLs pré-assinadas (API orquestra)
- `POST /videos` pré-cadastra o rascunho (TD-07/TD-08), chama `CreateMultipartUpload` e devolve `{ videoId, uploadId, partSize }`; o cliente pede URLs pré-assinadas por parte (`UploadPart`, em lote) via BFF e faz `PUT` direto no `S3_PUBLIC_ENDPOINT`; ao final envia a lista `{ partNumber, etag }` para `POST /videos/{id}/upload/complete` → `CompleteMultipartUpload`; retomada = `GET /videos/{id}/upload` devolvendo `ListParts` para o cliente pular partes já aceitas.
- **Pros:** zero bytes de vídeo passam pela API ou pelo BFF (cumpre "sem impacto na performance" por construção); retomada nativa do S3 (`ListParts`); o servidor valida tamanho no `complete` (soma das partes/`HeadObject`) e enforce de `UPLOAD_MAX_BYTES = 10 GiB`; parte de 64 MiB → 160 partes para 10 GiB (limite S3: 10 000); funciona igual em S3 real.
- **Cons:** o navegador fala com uma segunda origem (o storage) — exige CORS no bucket e `S3_PUBLIC_ENDPOINT` distinto do interno; o cliente precisa de lógica de fatiamento/paralelismo/retry (trabalho da fatia de UI); as URLs têm TTL e o upload de 10 GB em link lento pode exigir reassinatura em lote.

### Option B: tus (`@tus/server` 2.4.6 + `@tus/s3-store` 2.0.8) hospedado na API
- A API monta o handler tus em uma rota (`/uploads`), que recebe PATCHes do cliente (`tus-js-client`/Uppy) e os encaminha para o S3 como multipart; o tus calcula tamanho de parte, suporta retomada via `Upload-Offset` e expiração.
- **Pros:** protocolo padronizado de retomada com clientes maduros; a UI faz quase nada além de instanciar o cliente; os bytes não ficam no disco da API (streaming para S3).
- **Cons:** **todos os 10 GB atravessam a API** e, no modelo Strict BFF, também o Route Handler do Next (ou se abre exceção para o navegador falar com a API) — exatamente o que a capability proíbe; `@tus/s3-store` bufferiza partes abaixo de 5 MiB em memória/disco; integração com guards/`ValidationPipe` globais do Nest exige rota "crua" (bypass de body parser); duas convenções de API coexistindo (REST + tus).

### Option C: Streaming multipart/form-data pela API (`busboy` + `@aws-sdk/lib-storage`)
- Rota Nest recebe o arquivo em stream e o repassa ao S3 via `Upload` (multipart gerenciado pelo SDK).
- **Pros:** implementação mais curta; um único endpoint; sem CORS extra.
- **Cons:** sem retomada (falha de conexão = recomeçar 10 GB); ocupa o event loop e a banda da API/BFF; timeouts de proxy e do Next em uploads longos; viola a capability e o ponto de atenção do plano.

**Recommendation:** **Option A (multipart pré-assinado direto no storage)** — é a única que cumpre literalmente "10 GB sem impacto na performance" e "retomar após falha", porque o backend só orquestra metadados e o storage recebe os bytes; o custo (CORS + endpoint público + fatiamento no cliente) é pago uma vez pela fatia de UI. A exceção ao Strict BFF fica explícita e limitada: o navegador só fala com `S3_PUBLIC_ENDPOINT` usando URLs assinadas que a API emite via BFF — nunca com `nestjs-api`. Parâmetros propostos: `UPLOAD_PART_SIZE` (default 64 MiB, mínimo 5 MiB, configurável para que TD-13 teste multipart com partes de 5 MiB), `UPLOAD_MAX_BYTES` (10 GiB), `UPLOAD_URL_TTL` (ex.: 1 h por lote de partes).

**Decision:** A (S3 multipart pré-assinado direto no storage; API orquestra create → URLs por parte → complete; retomada via `ListParts`; exceção explícita e limitada ao Strict BFF: navegador → `S3_PUBLIC_ENDPOINT` apenas)

---

## TD-04: Fila de processamento em segundo plano

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** o `complete` do upload (TD-03) enfileira o processamento (TD-11), executado pelo worker (TD-05). Precisa de: entrega pelo menos uma vez, retry com backoff, chave idempotente por vídeo, jobs atrasados (TD-12) e consumo por um processo separado. O C4 deixa "Message Queue: TBD". O projeto já tem PostgreSQL 17 e evita adicionar infraestrutura sem necessidade (precedente: refresh tokens em Postgres em vez de Redis, `phase-02-auth/TD-03`); a sessão 15 registrou a pressão de memória do Docker Desktop no Windows como restrição.

**Options:**

### Option A: BullMQ 6 + Redis/Valkey via `@nestjs/bullmq` 11.0.5
- `BullModule.forRoot({ connection })`, `@Processor` + `WorkerHost` no worker, `Queue.add(name, data, { jobId, attempts, backoff, delay })`; broker `redis:8` ou `valkey/valkey:9` como serviço novo no compose.
- **Pros:** integração Nest oficial e documentada (DI nos processors, `@OnWorkerEvent`); ecossistema (Bull Board, métricas); throughput e escala horizontal comprovados; `jobId` idempotente, `delay`, job schedulers, stalled detection.
- **Cons:** mais um container (Redis) em dev, nos testes de integração e em produção; Redis 8 é tri-licenciado (RSALv2/SSPLv1/AGPLv3 — Valkey 9 é BSD); duas fontes de verdade de estado (job no Redis, vídeo no Postgres) exigem o cuidado de TD-11 nas transições.

### Option B: BullMQ 6 com backend PostgreSQL (`createPostgresBackend`), sem `@nestjs/bullmq`
- BullMQ 6.3.x suporta Postgres 13+ como backend com paridade total (queues, workers, flows, schedulers, rate limit, delayed, dedup, eventos via `LISTEN/NOTIFY`); schema `bullmq` criado por `runMigrations()`. Como o `@nestjs/bullmq` ainda não aceita `BackendFactory` (PR `nestjs/bull#2924` aberto), `Queue`/`Worker` seriam instanciados em providers próprios.
- **Pros:** API BullMQ sem Redis; jobs no mesmo banco que o domínio; migração futura para Redis é trocar o factory; PR do Nest pode chegar e simplificar.
- **Cons:** backend com três meses de GA (o anúncio admite "a change of this size will have bugs"); perde o módulo Nest (decorators, DI nos processors) até o PR ser mesclado; segundo mecanismo de migração de schema no mesmo banco (ao lado do TypeORM); throughput ~1,5–2× menor que Redis (irrelevante para esta carga).

### Option C: pg-boss 12.x (fila nativa em PostgreSQL)
- Biblioteca madura (v12, Node ≥ 22.12) que usa `SKIP LOCKED` + `LISTEN/NOTIFY`; `boss.send(queue, data, { singletonKey, retryLimit, retryBackoff, startAfter, expireInSeconds })` e `boss.work(queue, { batchSize }, handler)`; schema `pgboss` próprio; archive e cron (`schedule`) embutidos. Integração Nest = um provider com `onModuleInit`/`onModuleDestroy`.
- **Pros:** sem container novo e sem infra de teste nova (o DB de integração já existe); maturidade de anos em Postgres; tem exatamente os primitivos desta fase (singleton por vídeo, retry/backoff, delayed job para TD-12, expiração para jobs travados); jobs e estado do vídeo na mesma transação quando necessário.
- **Cons:** sem módulo Nest oficial (wrapper de ~50 linhas, sem decorators); segundo mecanismo de migração no mesmo banco (idem B); ecossistema de dashboards menor; se um dia a carga exigir Redis, a troca é de biblioteca, não de configuração.

### Option D: RabbitMQ via `@nestjs/microservices`
- Broker AMQP dedicado; a API publica e o worker consome como microservice Nest.
- **Pros:** semântica de filas robusta, roteamento, DLQ nativos; integração Nest oficial.
- **Cons:** container pesado (Erlang) e operação própria; retry/backoff/delayed exigem plugins ou exchanges auxiliares; sobredimensionado para um único tipo de job.

**Recommendation:** **Option C (pg-boss)** — entrega todos os primitivos que TD-11 e TD-12 pedem (chave singleton por vídeo, retry com backoff, `startAfter` para limpeza, expiração de jobs travados) sobre o PostgreSQL já presente, sem novo container em dev/testes/produção e sem apostar em um backend de três meses (B). **A (BullMQ + Redis) é uma escolha igualmente válida** se o time preferir a integração Nest nativa e já antever dashboards/escala horizontal; o custo é um serviço a mais em cada ambiente e no `cleanAllTables` dos testes. B fica como candidato a supersede quando `nestjs/bull#2924` for lançado.

**Decision:** C (pg-boss 12.x sobre o PostgreSQL existente; wrapper Nest próprio com `onModuleInit`/`onModuleDestroy`)
**Libraries:** pg-boss

---

## TD-05: Onde vive o worker de vídeo

**Scope:** Backend

**Capability:** Transversal — covers: Serviço de processamento em segundo plano (filas); Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** o C4 mostra "Video Worker (FFmpeg)" como container separado da API. O worker precisa das entidades, da config (`registerAs` + Joi) e do `StorageModule`; não precisa de HTTP, `AuthModule` nem Swagger. O usuário pediu que esta decisão fosse tomada no pipeline, não antecipada.

**Options:**

### Option A: Segundo entrypoint no mesmo subprojeto (`src/worker.ts` + `WorkerModule`)
- `NestFactory.createApplicationContext(WorkerModule)` importando `ConfigModule`, `TypeOrmModule`, `StorageModule`, `QueueModule` e o processador; o Nest CLI suporta `nest start --entryFile worker` (documentado) e `nest build` compila `dist/worker.js`; serviço `video-worker` no compose usando a **mesma imagem** da API (TD-10), comando diferente.
- **Pros:** reuso total de entidades, migrations, config e módulos sem monorepo tooling; um `package.json`, um `tsc`, um Jest; a mesma suíte de integração testa o processador; separação de processo preserva "sem impacto na performance".
- **Cons:** a imagem da API passa a carregar o `ffmpeg` (~300 MB a mais) mesmo sem usá-lo; disciplina para o `WorkerModule` não importar `AppModule` (evitar subir guards/throttler/mailer por engano); dois processos com `--watch` sobre o mesmo bind mount em dev.

### Option B: Subprojeto `video-worker/` separado
- Novo diretório com `package.json`, Dockerfile e compose próprios; entidades e config compartilhadas via pacote `packages/shared` (exige workspaces) ou duplicadas.
- **Pros:** isolamento máximo de dependências e imagem (só o worker tem ffmpeg); escala/deploy independentes.
- **Cons:** o monorepo não tem workspaces (decisão Repo-wide ainda inexistente) — duplicar entidades/migrations viola DRY e cria deriva de schema; triplica o custo de DX (`npm install`, volumes, CI) que a sessão 15 acabou de sanear.

### Option C: Worker dentro do processo da API
- O mesmo processo `nestjs-api` consome a fila (processor registrado no `AppModule`).
- **Pros:** zero infra nova; DI compartilhada trivialmente.
- **Cons:** `ffmpeg` compete por CPU/IO com as requisições HTTP no mesmo container — contradiz "sem impactar a performance"; não dá para escalar processamento separadamente; falha do ffmpeg pode derrubar a API; diverge do C4.

**Recommendation:** **Option A (segundo entrypoint no `nestjs-project`)** — mantém um só código-base para entidades, config e testes (sem introduzir workspaces nesta fase) e, ao mesmo tempo, isola o processamento em um container próprio como o C4 prevê. O custo do ffmpeg na imagem compartilhada é aceitável em dev; a imagem de produção pode usar build arg/stage para omiti-lo na API, decisão que pertence à Fase 07.

**Decision:** A (segundo entrypoint `src/worker.ts` + `WorkerModule` no `nestjs-project`, serviço `video-worker` no compose com a mesma imagem)

---

## TD-06: Integração com FFmpeg/ffprobe

**Scope:** Backend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** o worker precisa de `ffprobe` (duração, dimensões, codecs, container) e de `ffmpeg` (um frame → JPEG). O arquivo tem até 10 GB e está no storage, não no disco do worker. `fluent-ffmpeg` está arquivado/deprecated, então não há wrapper mantido — a decisão é sobre **de onde vem o binário** e **como ele lê o vídeo**.

**Options:**

### Option A: `apt install ffmpeg` na imagem + `node:child_process.execFile` lendo por URL pré-assinada
- Dockerfile instala `ffmpeg` do Debian (5.1.9 em bookworm; 7.1.5 se a base mudar para `node:25.6.0-trixie-slim`); o worker chama `ffprobe -print_format json -show_format -show_streams <url>` e `ffmpeg -ss <t> -i <url> -frames:v 1 -vf scale=... /tmp/<id>.jpg`, com `<url>` pré-assinada pelo cliente **interno** (TD-02); o demuxer HTTP do ffmpeg usa `Range` para seeks (inclusive `moov` no fim do MP4), então lê só o necessário.
- **Pros:** nenhum download de 10 GB; binário com patches de segurança do Debian; sem dependência npm; comandos explícitos e testáveis (TD-13 gera fixture com `ffmpeg -f lavfi`).
- **Cons:** versão atrelada à distro (5.1 em bookworm; trocar a tag da imagem é a alavanca); `execFile` sem wrapper exige parsing do JSON do ffprobe e tratamento de timeout/kill próprios; depende da URL interna ser alcançável do container do worker (rede `streamtube`).

### Option B: Binário estático via npm (`ffmpeg-static` / `@ffmpeg-installer/ffmpeg` + `@ffprobe-installer/ffprobe`) + `execFile`
- O binário é baixado no `npm install` para o volume `node_modules`; invocação igual à de A.
- **Pros:** versão do ffmpeg independente da imagem base; funciona em qualquer host.
- **Cons:** ~80 MB baixados a cada `npm install` do volume (recém-saneado na sessão 15); sem patches de segurança automáticos; download pode falhar atrás de proxy; mistura artefato binário com dependências JS.

### Option C: Baixar o objeto para disco local e processar o arquivo
- O worker faz `GetObject` para `/tmp`, roda ffprobe/ffmpeg no arquivo e apaga.
- **Pros:** semântica mais simples e previsível; independe de suporte a `Range`.
- **Cons:** 10 GB de disco efêmero e de tempo de cópia por job; dobra o tráfego interno; o container precisa de limite de disco; incompatível com "processamento leve".

**Recommendation:** **Option A (ffmpeg do apt + `execFile` sobre URL pré-assinada interna)** — evita qualquer cópia do vídeo, usa o binário mantido pela distro e segue a orientação do próprio autor do `fluent-ffmpeg` (chamar o processo sem wrapper). A thumbnail nasce em `/tmp` do worker e sobe para `thumbnails/{publicId}/auto.jpg` via TD-02. A versão 5.1.9 do bookworm é suficiente; migrar para `trixie-slim` (7.1.5) fica como ajuste opcional registrado na SI do Dockerfile, não como TD.

**Decision:** A (ffmpeg/ffprobe do apt na imagem + `node:child_process.execFile` lendo por URL pré-assinada interna; thumbnail em `/tmp` → storage)

---

## TD-07: Modelo de dados do vídeo e eixos de estado

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** ao iniciar o upload, o vídeo nasce como rascunho ligado ao canal do usuário; depois passa por uploading → processing → ready/failed; a Fase 04 acrescenta publicação (draft → published) e visibilidade (public/unlisted). A sessão de upload multipart (`uploadId`, tamanho esperado, expiração) é transitória e tem seu próprio ciclo de vida (TD-12). A modelagem escolhida aqui condiciona as Fases 04 e 05, por isso é estratégica; tipos de coluna, nomes de enum e transformers são detalhes do `implement` (skill `typeorm` + regras de entidade).

**Options:**

### Option A: Entidade única `Video` com dois eixos de estado e colunas de upload
- `videos` carrega `public_id` (TD-08), `channel_id` (ManyToOne `Channel` — lado inverso `OneToMany` em `Channel`), eixo **processamento** (`uploading | processing | ready | failed` + `processing_error`), eixo **publicação** (`draft` agora; `published` e visibilidade na Fase 04), metadados (`duration_seconds`, `width`, `height`, `size_bytes`, `storage_key`, `thumbnail_key`) e bookkeeping do multipart (`upload_id`, `upload_expires_at`) anulado ao completar.
- **Pros:** uma entidade, uma migration, um repositório; consultas da Fase 04 (painel) e 05 (watch) sem join.
- **Cons:** colunas "às vezes nulas" (`upload_id`) na tabela de longa vida; a varredura de órfãos (TD-12) roda sobre `videos`; mistura o aggregate editorial com estado de transporte.

### Option B: `Video` (aggregate editorial) + `VideoUpload` (sessão multipart 1:1, transitória)
- `videos` fica com os dois eixos de estado e metadados; `video_uploads` guarda `video_id`, `upload_id`, `part_size`, `expected_bytes`, `expires_at`, `state`; é criada no pré-cadastro e removida (ou marcada) no `complete`/abort. Retomada (`ListParts`) e limpeza (TD-12) operam sobre `video_uploads`.
- **Pros:** `videos` só tem colunas sempre válidas; o ciclo de vida transitório fica isolado (SRP, princípio explícito do `CLAUDE.md`); Fases 04/05 nunca enxergam bookkeeping de upload; permite no futuro reenviar o arquivo de um vídeo existente sem tocar no aggregate.
- **Cons:** uma entidade, uma migration e um join a mais na fase; dois pontos de escrita no fluxo de upload (dentro de uma transação).

### Option C: Enum linear único (`uploading → processing → draft → published → …`)
- Um só campo `status` com a máquina de estados completa.
- **Pros:** o mais simples de ler e filtrar.
- **Cons:** conflita os eixos: um vídeo publicado cujo reprocessamento falhou, ou um rascunho pronto, não têm representação; a Fase 04 teria de reabrir a modelagem; viola o ponto de atenção sobre fluxo rascunho/publicação.

**Recommendation:** **Option B (`Video` + `VideoUpload`)** — os dois eixos de estado são obrigatórios para não bloquear a Fase 04, e separar a sessão multipart mantém `videos` como aggregate limpo para as Fases 04/05 enquanto TD-12 e a retomada (TD-03) trabalham só na tabela transitória, em linha com o princípio de responsabilidade única do projeto. A diferença de custo para A é uma entidade e um join; se o time preferir minimalismo, A é aceitável desde que mantenha os dois eixos.

**Decision:** B (`Video` com dois eixos de estado + `VideoUpload` 1:1 transitória para a sessão multipart)

---

## TD-08: Identificador público único do vídeo

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** o plano pede "URL curta e única que nunca conflite". A chave primária das entidades é UUID (regra de entidades), mas um UUID de 36 caracteres não é "curto". O identificador é gerado no pré-cadastro (TD-07), aparece na URL de watch (Fase 05) e serve de prefixo das chaves no storage (`videos/{publicId}/source`, `thumbnails/{publicId}/auto.jpg`), por isso precisa existir antes do upload começar.

**Options:**

### Option A: ID curto aleatório de 11 caracteres via `node:crypto` (`randomBytes(8)` → base64url)
- 64 bits de entropia no alfabeto `[A-Za-z0-9_-]` (mesmo formato dos IDs do YouTube); coluna `public_id` `unique`; colisão (probabilidade ~1e-19 por inserção) tratada com retry por SAVEPOINT, padrão já documentado em `typeorm-queries.md` e usado no nickname (`phase-02-auth/TD-10`).
- **Pros:** zero dependências; URL curta e opaca (não revela ordem nem volume); gerado antes de qualquer I/O; mesmo padrão de colisão já existente no código.
- **Cons:** função própria de ~10 linhas a testar; `-` e `_` no ID exigem cuidado em regex de rota (trivial).

### Option B: `nanoid` 6.x
- Biblioteca popular de IDs curtos (`nanoid(11)` com alfabeto URL-safe, ou `customAlphabet`).
- **Pros:** nome conhecido; alfabeto configurável.
- **Cons:** `engines` da 6.0.2 declara `^22 || ^24 || >=26` — **exclui o Node 25** do container (warn no `npm install`, risco de `engine-strict`); dependência para uma função que `node:crypto` cobre; versões ≥ 4 são ESM-only, exigindo cuidado no projeto CommonJS (`nodenext`).

### Option C: Expor o próprio UUID da PK na URL
- `/watch/3f9a…-…` sem coluna adicional.
- **Pros:** nada a gerar nem a indexar; unicidade garantida pelo banco.
- **Cons:** 36 caracteres — não é "URL curta"; difícil de compartilhar/digitar; a chave de storage fica longa; diverge da expectativa do produto.

### Option D: Slug derivado do título + sufixo aleatório
- `meu-video-4f2a` gerado a partir do título.
- **Pros:** URL legível/SEO.
- **Cons:** no pré-cadastro ainda não há título (a edição é Fase 04); título muda → URL instável ou precisa de redirects; vaza conteúdo do vídeo pela URL de um unlisted.

**Recommendation:** **Option A (ID curto próprio de 11 caracteres com `node:crypto`)** — atende "curta e única" sem dependência, reusa o padrão de retry por SAVEPOINT já existente e evita a incompatibilidade de `engines` do `nanoid` com o Node 25 do container. A PK continua UUID (regra de entidades); `public_id` é a chave externa de URL e de storage.

**Decision:** A (ID de 11 caracteres via `node:crypto` em base64url, coluna `public_id` unique + retry por SAVEPOINT; PK continua UUID)

---

## TD-09: Entrega de streaming e download

**Scope:** Cross-layer

**Capability:** Reprodução via streaming (sem necessidade de download completo); Download do vídeo pelo usuário

**Context:** o player (Fase 05) precisa de uma URL que aceite `Range` para começar a tocar sem baixar tudo; o download precisa de `Content-Disposition: attachment`. Vídeos em rascunho são privados, e a Fase 04 trará unlisted (acessível só via link) — a forma de entrega precisa comportar esse controle sem reabrir a decisão. Cross-layer: define o que a API devolve e o que o `<video src>` e o botão de download do frontend consomem.

**Options:**

### Option A: URL GET pré-assinada emitida pela API (storage serve os bytes)
- `GET /videos/{publicId}/playback` devolve `{ streamUrl, downloadUrl, expiresAt }`; ambas assinadas com o cliente público (TD-02), a segunda com `ResponseContentDisposition: attachment; filename="…"`; TTL longo o bastante para uma sessão de reprodução (ex.: `PLAYBACK_URL_TTL` 12 h). O storage atende `Range` (206) nativamente.
- **Pros:** nenhum byte de vídeo passa por Nest ou Next; `Range`, cache e paralelismo vêm do storage; o controle de acesso fica na API (quem pode pedir a URL), preparando drafts privados e unlisted; igual em S3 real/CDN.
- **Cons:** o navegador fala com o endpoint público do storage (já aceito em TD-03); URLs expiram (o player precisa refazer o pedido em sessões longas); `response-content-disposition` depende do servidor (RustFS: sim; Garage: não documentado — smoke test de TD-01).

### Option B: Proxy de streaming pela API (`StreamableFile` com `Range`)
- A API faz `GetObject` com o `Range` recebido e repassa 206/`Content-Range`; o download é a mesma rota com `Content-Disposition`.
- **Pros:** uma única origem (sem CORS nem endpoint público); autorização por request; funciona com qualquer storage.
- **Cons:** todo o tráfego de vídeo atravessa Nest e, no Strict BFF, o Route Handler do Next — exatamente o gargalo que a fase quer evitar; implementação de `Range`/`If-Range`/HEAD própria; sem cache de borda.

### Option C: Bucket público com URL estável (`/videos/{publicId}/source`)
- Objetos publicados com leitura pública; a API devolve a URL fixa.
- **Pros:** o mais simples; cacheável; sem expiração.
- **Cons:** impossível proteger rascunhos e, na Fase 04, vídeos unlisted/despublicados (a URL continua acessível); exige mover/recolocar ACL por objeto ao mudar visibilidade; viola o ponto de atenção sobre unlisted.

**Recommendation:** **Option A (URLs GET pré-assinadas pela API)** — mantém os bytes fora de Nest/Next como em TD-03, dá `Range` e download por configuração do storage e concentra a autorização no endpoint que emite a URL, o que absorve drafts privados hoje e unlisted/published na Fase 04 sem mudar o mecanismo. Verificação concreta na SI: `curl -r 0-1023 <streamUrl>` → 206 e `curl -I <downloadUrl>` → `Content-Disposition: attachment`.

**Decision:** A (URLs GET pré-assinadas emitidas pela API — `streamUrl` + `downloadUrl` com `ResponseContentDisposition`; na Fase 03 somente o dono do canal autenticado obtém as URLs enquanto o vídeo é rascunho — AMB-1; regras de público/unlisted e acesso anônimo ficam para as Fases 04/05)

---

## TD-10: Topologia Docker Compose e bootstrap do bucket

**Scope:** Repo-wide

**Capability:** Transversal — covers: Serviço de armazenamento de arquivos (vídeos e thumbnails); Serviço de processamento em segundo plano (filas)

**Context:** `saneamento-fase-02-e-infra/TD-01` fixou stacks separadas unidas pela rede `streamtube` criada por `nestjs-project/compose.yaml`. A fase adiciona storage (TD-01), worker (TD-05) e, se TD-04 escolher A, um broker; o bucket precisa existir com CORS antes da primeira requisição (upload direto do navegador, TD-03) — inclusive nos testes de integração. A decisão é cross-component (compose + Dockerfile + `.env.example` + Joi + testes).

**Options:**

### Option A: Serviços novos no `nestjs-project/compose.yaml` + serviço de init do bucket
- Adicionar `rustfs` (volume nomeado, healthcheck em `/health`, portas 9000/9001), `video-worker` (mesmo `Dockerfile.dev` com `ffmpeg`, comando `npm run start:worker`, `depends_on` db/rustfs) e, opcionalmente, `redis`; um serviço one-shot `storage-init` (`amazon/aws-cli`) que faz `s3api create-bucket` + `put-bucket-cors` idempotentes e sai; `nestjs-api` e `video-worker` dependem dele com `condition: service_completed_successfully`.
- **Pros:** coerente com TD-01 do saneamento (a stack do backend é dona da infra e da rede); a API não carrega código de administração de bucket; `docker compose up` deixa o ambiente pronto para testes de integração; sem mudança para o frontend.
- **Cons:** o compose do backend cresce (5–6 serviços); a imagem única carrega ffmpeg também para a API (aceito em TD-05); `storage-init` precisa das mesmas credenciais do `.env`.

### Option B: Bucket garantido pela própria API no bootstrap (`HeadBucket`/`CreateBucket`/`PutBucketCors` no `onModuleInit`, atrás de `S3_BOOTSTRAP=true`)
- Sem serviço de init; a API cria o que falta ao subir.
- **Pros:** um serviço a menos; funciona em qualquer ambiente onde a API tenha permissão.
- **Cons:** a API passa a precisar de permissão administrativa de bucket (desnecessária em produção); lógica de infra dentro do código de domínio; testes de integração dependem de a API ter subido antes.

### Option C: Compose único na raiz com `include:` dos dois subprojetos + arquivo de infra
- `compose.yaml` raiz inclui `nestjs-project/compose.yaml`, `next-frontend/compose.yaml` e `infra/compose.yaml` (storage, broker).
- **Pros:** um só `docker compose up` para tudo; infra desacoplada dos subprojetos.
- **Cons:** reabre a decisão Repo-wide tomada há um dia (`saneamento/TD-01`, Option A) e todos os `CLAUDE.md` com comandos `docker compose exec` por subprojeto; nenhum ganho específico desta fase. Candidata natural para a Fase 07 (produção), não para agora.

**Recommendation:** **Option A (serviços no compose do backend + `storage-init` one-shot)** — segue a topologia já decidida, deixa o ambiente pronto para integração/e2e com um único `up` e mantém a API sem privilégios de administração do storage. Entregáveis concretos: `Dockerfile.dev` com `ffmpeg`, `compose.yaml` com `rustfs`, `storage-init`, `video-worker` (e `redis` só se TD-04 = A), `.env.example` com as chaves de TD-01/TD-03/TD-09 e `nestjs-project/CLAUDE.md` com os novos probes (`curl http://localhost:9000/health`, console em `:9001`).

**Decision:** A (serviços `rustfs`, `storage-init` e `video-worker` no `nestjs-project/compose.yaml`, sem `redis` pois TD-04 = pg-boss; ffmpeg no `Dockerfile.dev` único)

---

## TD-11: Contrato do job de processamento e idempotência

**Scope:** Backend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** entre o `complete` do upload (API) e o `ready` (worker) há dois processos e dois armazenamentos (fila + Postgres). É preciso decidir **quem dispara** o job, **qual é sua chave** e **como as transições de estado resistem a retries e entregas duplicadas**, independentemente da fila escolhida em TD-04.

**Options:**

### Option A: Enfileirar no `complete` com chave = id do vídeo e transições guardadas
- Após `CompleteMultipartUpload` bem-sucedido, a API grava `processing_status = processing` e enfileira `video.process` com chave singleton `video:{id}` (pg-boss `singletonKey` / BullMQ `jobId`), `attempts = 3`, backoff exponencial; o worker roda ffprobe + thumbnail (TD-06), faz `UPDATE … WHERE id = $1 AND processing_status = 'processing'` (guarda otimista) para `ready` com metadados ou, esgotados os retries, `failed` + `processing_error`. Reprocessar = reenfileirar com a mesma chave (no-op se já `ready`).
- **Pros:** idempotente por construção (chave única + guarda de estado); falha visível ao usuário (`failed` + motivo) sem job preso; independe do servidor de storage; simples de testar (TD-13).
- **Cons:** se a API cair entre o `complete` e o `send`, o vídeo fica em `processing` sem job — mitigado por TD-12 (varredura) ou por enfileirar na mesma transação do update (possível com pg-boss/BullMQ-PG, não com Redis).

### Option B: Notificação de evento do bucket → fila
- O storage emite `s3:ObjectCreated:CompleteMultipartUpload` (webhook/AMQP) e a API/worker consome.
- **Pros:** desacopla o enfileiramento da requisição HTTP; cobre uploads feitos por outros caminhos.
- **Cons:** depende de notifications do servidor (RustFS/SeaweedFS têm; Garage não; S3 real exige SNS/SQS/Lambda) — acopla ao fornecedor; configuração de infra extra; dois caminhos de disparo para manter idempotentes.

### Option C: Processar sincronamente dentro do `complete`
- A rota espera ffprobe/thumbnail e responde `ready`.
- **Pros:** sem fila nem worker para esse caso.
- **Cons:** bloqueia a requisição por segundos/minutos em arquivos grandes; viola "em segundo plano, sem bloquear o usuário" e torna TD-04/TD-05 inúteis.

**Recommendation:** **Option A (enfileirar no `complete`, chave singleton por vídeo, transições guardadas)** — é a única opção portável entre servidores de storage e filas, e a combinação chave única + guarda de estado garante que retries e entregas duplicadas não corrompam o vídeo. Com TD-04 = C ou B (fila em Postgres) o `send` entra na mesma transação do update, fechando a janela de falha apontada nos Cons.

**Decision:** A (enfileirar no `complete` com chave singleton por vídeo, 3 tentativas com backoff, transições guardadas para `ready`/`failed`; `send` na mesma transação do update via pg-boss)

---

## TD-12: Limpeza de uploads órfãos e rascunhos abandonados

**Scope:** Backend

**Capability:** Transversal — covers: Pré-cadastro automático do vídeo como rascunho ao iniciar o upload; Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** cada `POST /videos` abre um multipart no storage e cria um rascunho (TD-07). Uploads abandonados deixam partes cobradas/ocupando disco e rascunhos sem arquivo — o plano lista "armazenamento: planejar crescimento e custos desde o início" como ponto de atenção. É preciso decidir a política de expiração e o mecanismo que a aplica, usando os primitivos de TD-04.

**Options:**

### Option A: Job atrasado por upload (`startAfter`/`delay` = `UPLOAD_TTL`)
- No pré-cadastro, além do multipart, a API agenda `upload.expire` com chave `upload:{id}` para daqui a 24 h; ao rodar, se a sessão ainda não completou, faz `AbortMultipartUpload` e remove a sessão e o rascunho; se completou, no-op.
- **Pros:** usa a fila já escolhida, sem cron nem varredura; um job por upload, fácil de testar com TTL curto; política explícita e previsível para o usuário ("você tem 24 h para concluir").
- **Cons:** depende de a fila preservar jobs atrasados (ambas as opções de TD-04 preservam); não cobre rascunhos cujo job de expiração se perdeu (caso raro; a opção B cobre).

### Option B: Varredura periódica (`schedule`/job scheduler horário) + lifecycle do bucket como rede de segurança
- Um job recorrente lista sessões com `expires_at < now()` e aborta/remove; uma regra `AbortIncompleteMultipartUpload` (1 dia) no bucket limpa partes mesmo se o banco falhar.
- **Pros:** cobre todos os casos, inclusive inconsistências entre banco e storage; a lifecycle rule é padrão S3.
- **Cons:** varredura e cron são mais código e mais estado; a lifecycle rule depende do servidor (RustFS/Garage/SeaweedFS suportam `AbortIncompleteMultipartUpload`) e pode abortar um upload que o banco ainda considera vivo se os TTLs divergirem.

### Option C: Só a regra de lifecycle do bucket
- Nenhum código; o storage aborta multiparts incompletos após N dias.
- **Pros:** zero implementação.
- **Cons:** rascunhos e sessões ficam órfãos no banco; `ListParts` passa a falhar para sessões abortadas sem que a API saiba; não cobre vídeos cujo `complete` nunca veio.

### Option D: Adiar (nada nesta fase)
- Registrar como dívida para a Fase 04/07.
- **Pros:** menos escopo agora.
- **Cons:** contradiz o ponto de atenção do plano; o custo cresce em silêncio desde o primeiro upload abandonado.

**Recommendation:** **Option A (job atrasado por upload)** — resolve o caso comum com o primitivo mais simples da fila escolhida, sem cron nem varredura, e com política explícita (`UPLOAD_TTL`, default 24 h). A regra de lifecycle de B pode ser adicionada no `storage-init` (TD-10) como rede de segurança opcional, com TTL maior que `UPLOAD_TTL` para nunca abortar antes do job.

**Decision:** A (job atrasado por upload, `UPLOAD_TTL` default 24 h; lifecycle `AbortIncompleteMultipartUpload` opcional como rede de segurança)

---

## TD-13: Estratégia de testes para storage, fila e worker

**Scope:** Backend

**Capability:** Transversal — covers: Serviço de armazenamento de arquivos (vídeos e thumbnails); Serviço de processamento em segundo plano (filas); Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance; Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** o contrato de sufixos (`*.spec.ts` sem I/O; `*.integration-spec.ts` com DB real; `*.e2e-spec.ts` com supertest) está fixado em `nestjs-project/CLAUDE.md`. A fase introduz três I/Os novos (storage, fila, ffmpeg) e um requisito não-funcional (10 GB) que não dá para exercitar literalmente em teste. Os testes rodam **dentro** do container `nestjs-api`, sem socket Docker. É cross-component: compose (TD-10), config (`UPLOAD_PART_SIZE`), Jest e CI.

**Options:**

### Option A: Serviços reais do compose em integration/e2e + mocks de SDK em unit + "10 GB sem 10 GB"
- Unit: `aws-sdk-client-mock` 4.1.0 para o `S3Client`, fila mockada por interface, `execFile` mockado. Integration: storage real (`S3_ENDPOINT` do compose) com bucket de teste/prefixo por suíte, fila real sobre o DB de teste (pg-boss/BullMQ-PG) ou Redis do compose (BullMQ-Redis), ffmpeg real contra fixture de 2 s gerada por `ffmpeg -f lavfi -i testsrc` no `beforeAll`. E2E: fluxo create → PUT em URLs pré-assinadas (3 partes de 5 MiB via `UPLOAD_PART_SIZE` mínimo) → complete → job → `ready` → `curl`-equivalente com `Range` → 206. O limite de 10 GiB é testado como **política** (`UPLOAD_MAX_BYTES` rejeita `expected_bytes` acima; `complete` rejeita soma de partes acima).
- **Pros:** exercita os contratos reais (presign, CORS, Range, ffprobe) onde eles quebram; sem infra de teste nova além do que o compose já sobe; respeita o contrato de sufixos; cabe no `--runInBand` existente.
- **Cons:** suítes de integração precisam de limpeza do bucket (prefixo por teste + `DeleteObjects`) e do schema da fila no `cleanAllTables`; o worker de integração roda ffmpeg de verdade (segundos a mais por suíte); CI do backend ainda não existe (só `openapi-freshness`) — ponto a registrar como dívida, não resolver aqui.

### Option B: Testcontainers
- Cada suíte sobe seu próprio storage/broker efêmero.
- **Pros:** isolamento total entre suítes; paralelismo possível.
- **Cons:** os testes rodam dentro do container `nestjs-api` sem acesso ao daemon Docker — bloqueio prático; mais lento no Docker Desktop/Windows; duplicaria a infra que o compose já fornece.

### Option C: Só mocks (nenhum I/O real de storage/fila/ffmpeg)
- Tudo via `aws-sdk-client-mock` e stubs.
- **Pros:** suítes rápidas e determinísticas.
- **Cons:** não prova presign/CORS/Range/ffprobe contra o servidor escolhido — justamente os riscos de TD-01/TD-06; contradiz a política "forte ênfase em pirâmide de testes" e o uso já estabelecido de DB/Mailpit reais nas integrações.

**Recommendation:** **Option A (serviços reais do compose + mocks de SDK em unit + limite de 10 GiB como política)** — é a continuação direta do padrão atual (Postgres e Mailpit reais nas integrações, mocks nas unit) e a única que valida os contratos de storage e ffmpeg que TD-01 e TD-06 assumem. `UPLOAD_PART_SIZE` configurável é o que permite provar multipart com 15 MiB em vez de 10 GiB.

**Decision:** A (serviços reais do compose em integration/e2e + `aws-sdk-client-mock` em unit; `UPLOAD_PART_SIZE` mínimo para provar multipart; limite de 10 GiB testado como política)
**Libraries:** aws-sdk-client-mock

---

## TD-14: Formatos de vídeo aceitos e ponto de validação

**Scope:** Cross-layer

**Capability:** Transversal — covers: Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance; Processamento automático do vídeo após upload (extração de duração e metadados); Reprodução via streaming (sem necessidade de download completo)

**Context:** a fase não tem transcodificação (nenhum bullet a prevê): os bytes enviados são exatamente os que o navegador reproduz pela URL pré-assinada (TD-09). Logo "formato aceito" significa "formato que o `<video>` toca nativamente". Segundo a MDN (2026-10-18): MP4 com H.264/AAC toca em todos os navegadores; WebM com VP8/VP9/AV1/Opus toca em Chrome, Firefox, Safari e Edge (AV1 só em Safari 17+ com hardware recente); Ogg não toca no Safari; QuickTime/MOV só no Safari; MKV não é suportado; HEVC depende de hardware (Chrome 107+, Edge 18+, Firefox 120+/136+). Com o upload direto no storage (TD-03) a API nunca vê os bytes — no pré-cadastro só pode validar o que o cliente declara (extensão, MIME, tamanho) e, opcionalmente, fixar o `Content-Type` no `CreateMultipartUpload`; a verificação autoritativa só é possível no worker via `ffprobe` (TD-06), que expõe `format_name` e `codec_name`. É cross-layer porque a allowlist alimenta o DTO de `POST /videos`, o `accept` do seletor de arquivos e as mensagens de erro da futura UI, e o worker usa a mesma lista. Origem: `validation.md` MD-1. Transcodificar (aceitar qualquer formato e converter para MP4/H.264) seria uma capacidade nova fora desta fase e não entra como opção.

**Options:**

### Option A: Dupla validação — allowlist declarada no pré-cadastro + verificação autoritativa por `ffprobe` no worker
- O DTO de `POST /videos` aceita apenas `content_type ∈ {video/mp4, video/webm}` com extensão coerente, e o `CreateMultipartUpload` grava esse `ContentType` no objeto; o worker confere `format_name` (`mov,mp4,m4a,3gp,3g2,mj2` → MP4; `matroska,webm` → WebM), exige um stream de vídeo com codec em `{h264, vp8, vp9, av1}` e áudio ausente ou em `{aac, opus, vorbis, mp3}`; fora disso marca `failed` com `processing_error = UNSUPPORTED_FORMAT` + detalhe do ffprobe. A lista vive em uma única constante do módulo de vídeos, importada pelo DTO e pelo worker.
- **Pros:** falha rápido antes de subir 10 GB de um arquivo obviamente errado; pega arquivo renomeado ou codec não reproduzível que a declaração do cliente não revela; a UI reutiliza a mesma lista no `accept`; política honesta com a capability de streaming.
- **Cons:** dois pontos de checagem a manter coerentes (mitigado pela constante única); um MP4 com HEVC (comum em iPhone) é recusado no worker embora o Safari o toque — custo da política "toca em todo navegador"; a recusa no worker acontece depois do upload completo.

### Option B: Só o worker decide (`ffprobe`), pré-cadastro aceita qualquer arquivo
- `POST /videos` não valida tipo; o worker aplica a mesma regra de container/codecs de A e marca `failed` quando não passa.
- **Pros:** API mínima; um único ponto de verdade; nenhuma dependência do tipo declarado pelo cliente.
- **Cons:** o usuário pode enviar 10 GB para só então descobrir que o formato não serve; a UI não tem como pré-filtrar; o objeto inválido ocupa storage até a limpeza (TD-12).

### Option C: Só a allowlist declarada (MIME/extensão + `Content-Type` assinado), sem checagem de codec
- Validação apenas no pré-cadastro; o worker extrai metadados e aceita qualquer container/codec que o `ffprobe` consiga ler.
- **Pros:** o mais simples; não recusa codecs exóticos que alguns navegadores tocam.
- **Cons:** confia no cliente — um `.mkv` renomeado para `.mp4`, ou um MP4 com HEVC/MPEG-4 Part 2, passa e falha silenciosamente no player de parte dos navegadores; o dono nunca recebe um erro acionável.

### Option D: Allowlist ampla + flag de compatibilidade
- Aceita MP4, WebM, MOV e MKV com qualquer codec; o worker grava `container`/`codecs` e um indicador `playable_in_browser`; a UI apenas avisa.
- **Pros:** nunca recusa o arquivo do usuário; acumula dados para uma futura fase de transcodificação.
- **Cons:** a página de visualização (Fase 05) exibiria vídeos que não tocam; mais colunas e estados de UI; adia o problema em vez de resolvê-lo.

**Recommendation:** **Option A (dupla validação com allowlist única: containers MP4 e WebM; vídeo H.264/VP8/VP9/AV1; áudio AAC/Opus/Vorbis/MP3 ou ausente)** — sem transcodificação, a única política honesta é "aceitar o que os navegadores tocam", e checar duas vezes custa uma constante compartilhada: a allowlist declarada poupa o usuário de subir 10 GB de um arquivo errado, e o `ffprobe` pega o que a declaração não revela. HEVC e MOV ficam de fora por suporte parcial (reavaliar quando houver transcodificação). Contrato de erro: `POST /videos` responde 400 com código de domínio `VIDEO_UNSUPPORTED_MEDIA_TYPE` (filtro de `phase-02-auth/TD-07`); no processamento, `processing_status = failed` com `processing_error = UNSUPPORTED_FORMAT` e o detalhe do ffprobe. Depende de TD-03 (onde o tipo declarado entra), TD-06 (ffprobe), TD-07 (coluna `processing_error`) e TD-11 (transição para `failed`).

**Decision:** A (dupla validação: allowlist MP4/WebM declarada no pré-cadastro + `ffprobe` autoritativo no worker — vídeo H.264/VP8/VP9/AV1, áudio AAC/Opus/Vorbis/MP3 ou ausente; constante única compartilhada; HEVC e MOV fora até existir transcodificação)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Serviço de object storage S3-compatível | A — RustFS 1.0.x (tag pinada), Garage como fallback; MinIO só contingência | A |
| TD-02 | Backend | SDK de acesso ao storage | A — `@aws-sdk/client-s3` + `s3-request-presigner` (checksums `WHEN_REQUIRED`, `forcePathStyle`) | A |
| TD-03 | Cross-layer | Protocolo de upload de até 10 GB com retomada | A — S3 multipart pré-assinado direto no storage, API orquestra | A |
| TD-04 | Backend | Fila de processamento em segundo plano | C — pg-boss sobre PostgreSQL (A BullMQ+Redis igualmente válida) | C |
| TD-05 | Backend | Onde vive o worker de vídeo | A — segundo entrypoint `src/worker.ts` no `nestjs-project`, container próprio | A |
| TD-06 | Backend | Integração com FFmpeg/ffprobe | A — ffmpeg do apt + `execFile` sobre URL pré-assinada interna | A |
| TD-07 | Backend | Modelo de dados do vídeo e eixos de estado | B — `Video` (dois eixos) + `VideoUpload` (sessão transitória) | B |
| TD-08 | Backend | Identificador público único do vídeo | A — ID de 11 chars via `node:crypto`, `unique` + retry por SAVEPOINT | A |
| TD-09 | Cross-layer | Entrega de streaming e download | A — URLs GET pré-assinadas pela API (`Range` e `Content-Disposition` no storage) | A |
| TD-10 | Repo-wide | Topologia Docker Compose e bootstrap do bucket | A — serviços no compose do backend + `storage-init` one-shot | A |
| TD-11 | Backend | Contrato do job de processamento e idempotência | A — enfileirar no `complete`, chave singleton por vídeo, transições guardadas | A |
| TD-12 | Backend | Limpeza de uploads órfãos | A — job atrasado por upload (`UPLOAD_TTL` 24 h), lifecycle opcional | A |
| TD-13 | Backend | Estratégia de testes | A — serviços reais do compose + mocks de SDK em unit + 10 GiB como política | A |
| TD-14 | Cross-layer | Formatos de vídeo aceitos e ponto de validação | A — allowlist declarada no pré-cadastro (MP4/WebM) + `ffprobe` autoritativo no worker | A |

_Dependências entre TDs:_ TD-02 → TD-01 (`forcePathStyle`/checksums); TD-03 e TD-09 → TD-01/TD-02 (presign, CORS, `response-content-disposition`); TD-05, TD-11 e TD-12 → TD-04 (primitivos da fila); TD-10 → TD-01, TD-04, TD-05 (quais serviços entram no compose); TD-08 → TD-07 (`public_id` nasce no pré-cadastro); TD-13 → TD-03 (`UPLOAD_PART_SIZE`) e TD-10 (serviços disponíveis nos testes); TD-14 → TD-03, TD-06, TD-07 e TD-11 (tipo declarado, ffprobe, `processing_error`, transição para `failed`).
