---
kind: phase
name: phase-03-upload-processing
sources_mtime:
  docs/project-plan.md: "2026-10-18T12:13:58-04:00"
  docs/decisions/technical-decisions-phase-03-upload-processing.md: "2026-10-18T14:40:55-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-18T12:13:58-04:00"
  docs/phases/phase-01-configuracao-base/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-10-18T12:13:58-04:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T09:27:45-04:00"
---

# phase-03-upload-processing — Context

## Scope

**Phase name:** Fase 03 — Upload e Processamento de Vídeos

> Depende de: Fase 01, Fase 02

Upload de arquivos grandes sem travar o sistema, processamento automático do vídeo e geração de URL única.

**Capabilities** (literal, `docs/project-plan.md`):

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Out of scope:** _Not specified._

**Deliverables:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

**Affected subprojects:** _Not specified._ The Phase 03 block names no subproject path (`nestjs-project` / `next-frontend`) and has no `Subprojetos:` line. (Do not treat this as a statement that no subproject is affected — the plan simply does not name them for this phase.)

**Deferred subprojects:** _None._

**Sequencing notes:** _None._ (Only the dependency line `> Depende de: Fase 01, Fase 02` is present; no "primeiro" / "passada subsequente" / "deferido" sentences in the block.)

**Neighbors (for boundary detection only):**

- **Phase 02:** Fluxo completo de criação de conta, confirmação por e-mail, login, logout e recuperação de senha. (`### Fase 02 — Cadastro, Login e Gerenciamento de Conta`; `> Depende de: Fase 01`)
- **Phase 04:** Edição das informações do vídeo, fluxo de rascunho e publicação, painel de administração do canal e página pública. (`### Fase 04 — Gerenciamento de Vídeos e Canal`; `> Depende de: Fase 02, Fase 03`)

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-03-upload-processing/TD-01 | phase | Backend | Serviço de object storage S3-compatível | decided | A (RustFS 1.0.x tag pinada; Garage 2.4.x fallback) | — |
| phase-03-upload-processing/TD-02 | phase | Backend | SDK de acesso ao storage | decided | A (AWS SDK v3 client-s3 + s3-request-presigner, forcePathStyle, checksums WHEN_REQUIRED) | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner |
| phase-03-upload-processing/TD-03 | phase | Cross-layer | Protocolo de upload de arquivos de até 10 GB com retomada | decided | A (S3 multipart pré-assinado direto no storage; API orquestra create → URLs → complete; retomada via ListParts) | — |
| phase-03-upload-processing/TD-04 | phase | Backend | Fila de processamento em segundo plano | decided | C (pg-boss 12.x sobre o PostgreSQL existente; wrapper Nest próprio) | pg-boss |
| phase-03-upload-processing/TD-05 | phase | Backend | Onde vive o worker de vídeo | decided | A (segundo entrypoint `src/worker.ts` + `WorkerModule`; serviço `video-worker` com a mesma imagem) | — |
| phase-03-upload-processing/TD-06 | phase | Backend | Integração com FFmpeg/ffprobe | decided | A (ffmpeg/ffprobe do apt na imagem + `child_process.execFile` por URL pré-assinada interna) | — |
| phase-03-upload-processing/TD-07 | phase | Backend | Modelo de dados do vídeo e eixos de estado | decided | B (`Video` com dois eixos de estado + `VideoUpload` 1:1 transitória) | — |
| phase-03-upload-processing/TD-08 | phase | Backend | Identificador público único do vídeo | decided | A (ID de 11 chars via `node:crypto` base64url, `public_id` unique + retry por SAVEPOINT; PK UUID) | — |
| phase-03-upload-processing/TD-09 | phase | Cross-layer | Entrega de streaming e download | decided | A (URLs GET pré-assinadas emitidas pela API — `streamUrl` + `downloadUrl`; só o dono autenticado na Fase 03) | — |
| phase-03-upload-processing/TD-10 | phase | Repo-wide | Topologia Docker Compose e bootstrap do bucket | decided | A (serviços `rustfs`, `storage-init`, `video-worker` no compose do backend; sem redis; ffmpeg no `Dockerfile.dev`) | — |
| phase-03-upload-processing/TD-11 | phase | Backend | Contrato do job de processamento e idempotência | decided | A (enfileirar no `complete` com singleton por vídeo, 3 tentativas + backoff, transições guardadas; `send` transacional) | — |
| phase-03-upload-processing/TD-12 | phase | Backend | Limpeza de uploads órfãos e rascunhos abandonados | decided | A (job atrasado por upload, `UPLOAD_TTL` 24 h; lifecycle `AbortIncompleteMultipartUpload` opcional) | — |
| phase-03-upload-processing/TD-13 | phase | Backend | Estratégia de testes para storage, fila e worker | decided | A (serviços reais do compose em integration/e2e + `aws-sdk-client-mock` em unit; `UPLOAD_PART_SIZE` mínimo) | aws-sdk-client-mock |
| phase-03-upload-processing/TD-14 | phase | Cross-layer | Formatos de vídeo aceitos e ponto de validação | decided | A (dupla validação: allowlist MP4/WebM no pré-cadastro + `ffprobe` autoritativo no worker; HEVC/MOV fora) | — |

_Source files:_

- phase-03-upload-processing — `docs/decisions/technical-decisions-phase-03-upload-processing.md` (scope_type: phase, related_phases: [3])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Serviço de armazenamento de arquivos (vídeos e thumbnails) | phase-03-upload-processing/TD-01, phase-03-upload-processing/TD-02, phase-03-upload-processing/TD-10, phase-03-upload-processing/TD-13 |
| Serviço de processamento em segundo plano (filas) | phase-03-upload-processing/TD-04, phase-03-upload-processing/TD-05, phase-03-upload-processing/TD-10, phase-03-upload-processing/TD-13 |
| Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance | phase-03-upload-processing/TD-03, phase-03-upload-processing/TD-12, phase-03-upload-processing/TD-13, phase-03-upload-processing/TD-14 |
| Pré-cadastro automático do vídeo como rascunho ao iniciar o upload | phase-03-upload-processing/TD-03, phase-03-upload-processing/TD-07, phase-03-upload-processing/TD-12 |
| Processamento automático do vídeo após upload (extração de duração e metadados) | phase-03-upload-processing/TD-05, phase-03-upload-processing/TD-06, phase-03-upload-processing/TD-11, phase-03-upload-processing/TD-13, phase-03-upload-processing/TD-14 |
| Geração automática de thumbnail a partir de um frame do vídeo | phase-03-upload-processing/TD-05, phase-03-upload-processing/TD-06, phase-03-upload-processing/TD-11 |
| URL única por vídeo, sem conflito com outros vídeos | phase-03-upload-processing/TD-08 |
| Reprodução via streaming (sem necessidade de download completo) | phase-03-upload-processing/TD-09, phase-03-upload-processing/TD-14 |
| Download do vídeo pelo usuário | phase-03-upload-processing/TD-09 |

## Decisions Detail

### phase-03-upload-processing/TD-01

**Recommendation:** é a única alternativa livre que cobre todas as operações exigidas pelas TDs 03/09/12 (presigned multipart, CORS, `response-content-disposition`, lifecycle) com um container, um volume e console web, mantendo o backend acoplado apenas à API S3 (TD-02) para que produção use S3 real ou outro servidor sem mudar código. O risco de maturidade é mitigado por um smoke test obrigatório na primeira SI de storage; **Garage (B) é o fallback** se o smoke test falhar. Contrato de ambiente proposto (chaves canônicas para Joi + compose + `.env.example`): `S3_ENDPOINT` (interno, `http://rustfs:9000`), `S3_PUBLIC_ENDPOINT` (voltado ao navegador, `http://localhost:9000` em dev — base das URLs pré-assinadas de upload/stream), `S3_REGION` (`us-east-1`, exigido pelo SDK), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (`streamtube-videos`), `S3_FORCE_PATH_STYLE=true`.
**Libraries:** —

### phase-03-upload-processing/TD-02

**Recommendation:** mantém o backend acoplado somente à API S3, o que é a razão de ser de TD-01, e tem o ecossistema de mocks que TD-13 usa nos unit tests. A configuração obrigatória (`forcePathStyle`, `WHEN_REQUIRED` nos dois checksums, cliente interno vs. cliente de assinatura pública) vira parte do contrato do `StorageModule`.
**Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

### phase-03-upload-processing/TD-03

**Recommendation:** é a única que cumpre literalmente "10 GB sem impacto na performance" e "retomar após falha", porque o backend só orquestra metadados e o storage recebe os bytes; o custo (CORS + endpoint público + fatiamento no cliente) é pago uma vez pela fatia de UI. A exceção ao Strict BFF fica explícita e limitada: o navegador só fala com `S3_PUBLIC_ENDPOINT` usando URLs assinadas que a API emite via BFF — nunca com `nestjs-api`. Parâmetros propostos: `UPLOAD_PART_SIZE` (default 64 MiB, mínimo 5 MiB, configurável para que TD-13 teste multipart com partes de 5 MiB), `UPLOAD_MAX_BYTES` (10 GiB), `UPLOAD_URL_TTL` (ex.: 1 h por lote de partes).
**Libraries:** —

### phase-03-upload-processing/TD-04

**Recommendation:** entrega todos os primitivos que TD-11 e TD-12 pedem (chave singleton por vídeo, retry com backoff, `startAfter` para limpeza, expiração de jobs travados) sobre o PostgreSQL já presente, sem novo container em dev/testes/produção e sem apostar em um backend de três meses (B). **A (BullMQ + Redis) é uma escolha igualmente válida** se o time preferir a integração Nest nativa e já antever dashboards/escala horizontal; o custo é um serviço a mais em cada ambiente e no `cleanAllTables` dos testes. B fica como candidato a supersede quando `nestjs/bull#2924` for lançado.
**Libraries:** pg-boss

### phase-03-upload-processing/TD-05

**Recommendation:** mantém um só código-base para entidades, config e testes (sem introduzir workspaces nesta fase) e, ao mesmo tempo, isola o processamento em um container próprio como o C4 prevê. O custo do ffmpeg na imagem compartilhada é aceitável em dev; a imagem de produção pode usar build arg/stage para omiti-lo na API, decisão que pertence à Fase 07.
**Libraries:** —

### phase-03-upload-processing/TD-06

**Recommendation:** evita qualquer cópia do vídeo, usa o binário mantido pela distro e segue a orientação do próprio autor do `fluent-ffmpeg` (chamar o processo sem wrapper). A thumbnail nasce em `/tmp` do worker e sobe para `thumbnails/{publicId}/auto.jpg` via TD-02. A versão 5.1.9 do bookworm é suficiente; migrar para `trixie-slim` (7.1.5) fica como ajuste opcional registrado na SI do Dockerfile, não como TD.
**Libraries:** —

### phase-03-upload-processing/TD-07

**Recommendation:** os dois eixos de estado são obrigatórios para não bloquear a Fase 04, e separar a sessão multipart mantém `videos` como aggregate limpo para as Fases 04/05 enquanto TD-12 e a retomada (TD-03) trabalham só na tabela transitória, em linha com o princípio de responsabilidade única do projeto. A diferença de custo para A é uma entidade e um join; se o time preferir minimalismo, A é aceitável desde que mantenha os dois eixos.
**Libraries:** —

### phase-03-upload-processing/TD-08

**Recommendation:** atende "curta e única" sem dependência, reusa o padrão de retry por SAVEPOINT já existente e evita a incompatibilidade de `engines` do `nanoid` com o Node 25 do container. A PK continua UUID (regra de entidades); `public_id` é a chave externa de URL e de storage.
**Libraries:** —

### phase-03-upload-processing/TD-09

**Recommendation:** mantém os bytes fora de Nest/Next como em TD-03, dá `Range` e download por configuração do storage e concentra a autorização no endpoint que emite a URL, o que absorve drafts privados hoje e unlisted/published na Fase 04 sem mudar o mecanismo. Verificação concreta na SI: `curl -r 0-1023 <streamUrl>` → 206 e `curl -I <downloadUrl>` → `Content-Disposition: attachment`.
**Libraries:** —

### phase-03-upload-processing/TD-10

**Recommendation:** segue a topologia já decidida, deixa o ambiente pronto para integração/e2e com um único `up` e mantém a API sem privilégios de administração do storage. Entregáveis concretos: `Dockerfile.dev` com `ffmpeg`, `compose.yaml` com `rustfs`, `storage-init`, `video-worker` (e `redis` só se TD-04 = A), `.env.example` com as chaves de TD-01/TD-03/TD-09 e `nestjs-project/CLAUDE.md` com os novos probes (`curl http://localhost:9000/health`, console em `:9001`).
**Libraries:** —

### phase-03-upload-processing/TD-11

**Recommendation:** é a única opção portável entre servidores de storage e filas, e a combinação chave única + guarda de estado garante que retries e entregas duplicadas não corrompam o vídeo. Com TD-04 = C ou B (fila em Postgres) o `send` entra na mesma transação do update, fechando a janela de falha apontada nos Cons.
**Libraries:** —

### phase-03-upload-processing/TD-12

**Recommendation:** resolve o caso comum com o primitivo mais simples da fila escolhida, sem cron nem varredura, e com política explícita (`UPLOAD_TTL`, default 24 h). A regra de lifecycle de B pode ser adicionada no `storage-init` (TD-10) como rede de segurança opcional, com TTL maior que `UPLOAD_TTL` para nunca abortar antes do job.
**Libraries:** —

### phase-03-upload-processing/TD-13

**Recommendation:** é a continuação direta do padrão atual (Postgres e Mailpit reais nas integrações, mocks nas unit) e a única que valida os contratos de storage e ffmpeg que TD-01 e TD-06 assumem. `UPLOAD_PART_SIZE` configurável é o que permite provar multipart com 15 MiB em vez de 10 GiB.
**Libraries:** aws-sdk-client-mock

### phase-03-upload-processing/TD-14

**Recommendation:** sem transcodificação, a única política honesta é "aceitar o que os navegadores tocam", e checar duas vezes custa uma constante compartilhada: a allowlist declarada poupa o usuário de subir 10 GB de um arquivo errado, e o `ffprobe` pega o que a declaração não revela. HEVC e MOV ficam de fora por suporte parcial (reavaliar quando houver transcodificação). Contrato de erro: `POST /videos` responde 400 com código de domínio `VIDEO_UNSUPPORTED_MEDIA_TYPE` (filtro de `phase-02-auth/TD-07`); no processamento, `processing_status = failed` com `processing_error = UNSUPPORTED_FORMAT` e o detalhe do ffprobe. Depende de TD-03 (onde o tipo declarado entra), TD-06 (ffprobe), TD-07 (coluna `processing_error`) e TD-11 (transição para `failed`).
**Libraries:** —

## Inherited Decisions Detail

### phase-01-configuracao-base/TD-01

**Recommendation:** Option A (@nestjs/config) — Official, core-team-maintained, guaranteed NestJS 11 compatibility. The `registerAs()` factory pattern solves the TypeORM CLI sharing problem: the factory function can be imported as a plain function by `data-source.ts` while also serving as a DI injection token inside NestJS. Building a custom module recreates solved functionality; third-party packages carry maintenance risk.

**Libraries:** `@nestjs/config@^4.x`

### phase-01-configuracao-base/TD-02

**Recommendation:** Option A (Joi) — First-class integration with `@nestjs/config` via `validationSchema`, requiring zero custom wiring. Handles string-to-number coercion natively. Using a different tool for env validation vs. request validation is reasonable — env config is validated once at startup, DTOs are validated per-request. Zod is elegant but adds a third validation paradigm to the project.

**Libraries:** `joi@^17.x`

### phase-01-configuracao-base/TD-03

**Recommendation:** Option B (Namespaced/grouped with registerAs) — The project roadmap explicitly calls for auth, email, and storage in upcoming phases. Namespaced configs provide clear file boundaries per domain, typed injection via `ConfigType<typeof databaseConfig>`, and natural scalability. The `registerAs()` factory is dual-purpose: DI token inside NestJS and plain importable function for `data-source.ts`. Initial files for Phase 01: `src/config/database.config.ts`, `src/config/app.config.ts`.

**Libraries:** —

### phase-01-configuracao-base/TD-04

**Recommendation:** Option A (Shared registerAs factory) — Natural outcome of choosing `@nestjs/config` with `registerAs`. The factory is already callable by design. `data-source.ts` imports it, calls `dotenv.config()`, then calls the factory. Zero duplication, minimal code, no extra abstraction.

**Libraries:** `dotenv` (transitive via `@nestjs/config`)

### phase-02-auth/TD-01

**Recommendation:** Argon2id — For a greenfield project in 2026, Argon2id is the OWASP-recommended choice. The native build dependency is a one-time Docker setup cost. The project has no legacy constraints favoring bcrypt. OWASP minimum: 19MiB memory, 2 iterations.

**Libraries:** `argon2@^0.41.x`

### phase-02-auth/TD-02

**Recommendation:** Option A (@nestjs/passport) — The project plan includes only email/password auth for now, but the plugin architecture costs little and future phases may add social login. Aligns with official NestJS docs, making onboarding and maintenance easier.

**Note:** Decision deliberately diverged from the Recommendation during implementation — custom guards were preferred over `@nestjs/passport` to keep the dependency surface smaller; social login is not on the near-term roadmap, so the plugin-architecture benefit did not justify the extra abstraction layer.

**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-03

**Recommendation:** Option A (Refresh Token Rotation) — Provides the strongest security model with automatic theft detection. The DB write overhead is acceptable for a video platform (auth refresh is infrequent vs. video operations). PostgreSQL is already in the stack, so no new infrastructure needed. Race conditions can be mitigated with a short grace period for the old token.

**Libraries:** —

### phase-02-auth/TD-04

**Recommendation:** Option B (Random Opaque Tokens in DB) — Revocability is important: when a user requests a new password reset, previous tokens should be invalidated. The DB table is trivial to implement, and the tokens table can also serve future needs (e.g., API keys). Keeps email tokens decoupled from the JWT auth system.

**Libraries:** —

### phase-02-auth/TD-05

**Recommendation:** Option A (@nestjs-modules/mailer) — Best NestJS integration with minimal boilerplate. Supports SMTP (matching the architecture diagram), works with MailHog/Mailpit for local development without external dependencies, and scales to any SMTP provider in production. Template engine support (Handlebars) simplifies email formatting. No vendor lock-in.

**Libraries:** `@nestjs-modules/mailer@^2.x`, `handlebars@^4.x`

### phase-02-auth/TD-06

**Recommendation:** Option A (class-validator + class-transformer) — This is a backend-only project (no shared schemas with frontend), so Zod's single-source-of-truth advantage is less impactful. class-validator is the documented NestJS approach, and the project already uses decorators extensively (TypeORM entities, NestJS DI). Fewer integration surprises with NestJS 11.

**Libraries:** `class-validator@^0.14.x`, `class-transformer@^0.5.x`

### phase-02-auth/TD-07

**Recommendation:** Option A (Custom Domain Exception Filter) — Provides machine-readable error codes that the Next.js frontend can switch on, without the overhead of RFC 9457's URI-based type system. The project is single-consumer (first-party frontend), so a simple `{ statusCode, error, message }` format with domain codes balances clarity and simplicity. The custom filter cost is low — two small files.

**Libraries:** —

### phase-02-auth/TD-08

**Recommendation:** Option A (@nestjs/throttler) — Native NestJS integration is decisive: the guard system allows scoping rate limiting to `AuthModule` only via module-level `APP_GUARD`, with `@SkipThrottle()` for exemptions. The project is single-instance with no distributed requirements, so in-memory storage is sufficient. Using express-rate-limit would bypass NestJS's DI and guard lifecycle for no clear benefit.

**Libraries:** `@nestjs/throttler@^6.x`

### phase-02-auth/TD-09

**Recommendation:** Option B (Opaque) — Since DB lookup is mandatory (TD-03), JWT signature adds no security value. Opaque tokens are shorter, leak no data, and are simpler to generate.

**Note:** Decision deliberately diverged from the Recommendation — JWT was kept to reuse the access-token signing/verification infrastructure (`@nestjs/jwt`), trading token size and base64-readability for a single token format across the codebase.

**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-10

**Recommendation:** Option A — The platform is a video sharing service with URL-based channel handles. A strict `[a-z0-9_]` allowlist is the simplest and most portable choice: no extra dependencies, no edge cases around hyphen positioning, and the `user_<random>` fallback provides a valid handle even for extreme email prefixes. Hyphens can always be added in a future iteration if user feedback justifies it.

**Libraries:** —

### phase-02-auth-frontend/TD-01

**Recommendation:** Three reasons. (1) **Architectural fit.** The strict-BFF model in `next-frontend-config-base/TD-03` already nominates the Route Handler as the only NestJS caller; cookie-based sessions are the natural match, and Auth.js's framework adds layers between the BFF and the cookie that buy nothing because the backend is the auth authority — Auth.js's value (DB adapters, OAuth providers, magic-link, `getServerSession` helpers) is mostly unused in this configuration. (2) **Smaller blast radius.** A ~50-LOC session helper is grep-friendly, debuggable, and test-friendly via the existing MSW+BFF integration test pattern; a misconfigured Auth.js callback is a longer fault-isolation loop. (3) **Compatibility with Next.js 16 / React 19.** Built-in `next/headers` `cookies()` is the canonical primitive both runtimes already use; Auth.js v5 versions track Next.js majors with a lag, adding compatibility risk that Option A does not have. Option C is rejected as unsafe (`localStorage` for refresh tokens) and architecturally regressive (loses RSC personalization).
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Three reasons. (1) **Defense in depth on the cookie content** — `httpOnly` blocks JS, encryption blocks accidental log/proxy inspection; the marginal cost is one ~3KB dep. (2) **Single cookie to manage** simplifies logout (one `session.destroy()` call) and avoids the orphan-cookie failure mode of Option A. (3) **Room to carry minimal user metadata** (`userId`, `email`, `channelSlug`) lets `app/layout.tsx` RSC render the authenticated chrome (avatar, channel name) without a per-render `/auth/me` round-trip — Phase 04+ gains compound here. Option A is a viable downgrade if the team rejects `iron-session` for any reason; the migration A→B (or B→A) is a one-Route-Handler refactor with no test changes downstream because the BFF interface is unchanged. Option C is rejected: it solves a problem (server-side revocation) the project does not have at the cost of infrastructure the project does not own.
**Libraries:** iron-session

### phase-02-auth-frontend/TD-03

**Recommendation:** The single-flight detail is non-trivial and goes in the helper from day one — tested by MSW with a "two concurrent intercepted upstream calls; one refresh expected" assertion. Option B's client-driven pattern is rejected because it doesn't replace Option A (RSC still needs server-side refresh) — adopting B means doing both. Option C's pre-emptive timer is rejected because the failure modes (multiple tabs, sleep/wake) outweigh the latency saving and force a `"use client"` shell near the root.
**Libraries:** —

### phase-02-auth-frontend/TD-04

**Recommendation:** Three reasons. (1) **Decoupled from TD-05** — works with Route Handlers OR Server Actions; the form code does not change if TD-05 is revisited later. (2) **Aligned with shadcn's canonical form primitive** — the project already commits to `radix-nova` shadcn (`components.json`); `npx shadcn@latest add form` produces react-hook-form wrappers; choosing react-hook-form means using the supported primitive instead of hand-rolling around it. (3) **Zod-first developer ergonomics match the rest of the FE foundation** — `next-frontend-config-base/TD-01` chose Zod 4 for env; the same schemas-as-source-of-truth pattern carries to forms with zero new validator paradigm. Option B is rejected for impedance with shadcn's primitive and for over-investing in progressive-enhancement that the strict-BFF model does not require. Option C is rejected for the per-field boilerplate and the loss of client-side feedback on a project that values quick, type-safe form iteration.
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Three reasons. (1) **Strict-BFF alignment.** `next-frontend-config-base/TD-03` named Route Handlers as the BFF surface; Option A keeps every mutation visible under `app/api/**`. (2) **Test scaffold already exists** — `next-frontend/CLAUDE.md` § Testing and `next-frontend-msw-foundation` were authored for Route-Handlers-as-functions; Option A reuses them with zero invention. (3) **Single mutation surface** — Phase 02 sets the precedent for Phases 03–07; uniformity beats per-mutation idiom-picking when the cost of inconsistency compounds (Option C). Option B has real ergonomic appeal for the simplest forms but fragments the BFF surface and forces test-pattern reinvention; if the team later wants progressive enhancement for specific forms, the migration A→B is per-form and doesn't require touching unrelated routes — A is the safer default and the cheaper baseline.
**Libraries:** —

### phase-02-auth-frontend/TD-06

**Recommendation:** Two reinforcing reasons. (1) **No first-render flicker, no round-trip** — the session is delivered in the same response as the page HTML; the Client Provider hydrates with the correct initial state; users never see "Login" briefly turn into their avatar. (2) **No new BFF endpoint** — the cookie is the source of truth, RSC reads it, the Provider broadcasts it; the BFF surface stays minimal. The `router.refresh()` requirement after mid-session mutations is a small price (one line in the relevant mutation handler) for the structural benefits. Option B is rejected for the double-read-and-flicker; Option C is dominated by Option B and rejected.
**Libraries:** —

### phase-02-auth-frontend/TD-07

**Recommendation:** Three reasons. (1) **First-paint-correct** — the user sees the right outcome on the first paint, no skeleton, no flicker. (2) **Single integration pattern across both flows** — confirmation is RSC-only; reset is RSC + Client form (TD-04, TD-05 patterns reused) — both share the "RSC owns the token, Client Component owns the input" split. (3) **Email-prefetch behavior** is solved at the backend's idempotent-confirmation level (a small note for `/plan-build` to confirm; not a separate TD). Option B's Route-Handler-as-link-target adds redirects for no clean gain. Option C is dominated.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-01

**Recommendation:** Option A — resolve o `host.docker.internal` com duas declarações de rede, mantém intactos todos os comandos documentados e a premissa de `openapi-typing/TD-02`, e deixa a consolidação em compose único (Option C) como candidata natural para a entrada da Fase 03, quando o número de serviços justificar a reescrita da documentação.

**Libraries:** —

### saneamento-fase-02-e-infra/TD-02

**Recommendation:** Option A — é a única que executa TD-07 como decidido, com custo de uma variável de ambiente e sem alterar contratos já publicados no `openapi.json`.

**Libraries:** —

### saneamento-fase-02-e-infra/TD-03

**Recommendation:** Option A — preserva TD-07 e elimina a falha mais provável do fluxo com uma mudança de poucas linhas, sem reduzir segurança porque o token de confirmação não concede sessão.

**Libraries:** —

### saneamento-fase-02-e-infra/TD-04

**Recommendation:** Option A — as primitivas e os tokens já cobrem o visual, e a lista de estados fechada aqui é o que `/plan-build` precisa para gerar os SIs sem inventário.

**Libraries:** —

**Revisions:**
- 2026-10-18 — A lista fechada de estados ganha a tela standalone `/resend-confirmation` (`app/(auth)/resend-confirmation/page.tsx`): mesma composição `Card` + `BrandLogo` + `AuthFooter` e reuso do `ResendConfirmationForm` já entregue no SI-8, servindo de destino ao link que `login-form.tsx` exibe em `403 EMAIL_NOT_CONFIRMED`. Entregue como SI-11 (append-mode manual). Rationale: a revisão de alinhamento com a documentação (README/MBA) encontrou o link apontando para uma rota inexistente (404) desde a Fase 02; a Option A permanece — nenhuma fonte visual nova, só mais um estado derivado do padrão de `/forgot-password`.

### saneamento-fase-02-e-infra/TD-05

**Recommendation:** Option A — é o único host que sobrevive às fases seguintes e fecha a capability "Logout" da Fase 02 usando exclusivamente mecanismos já decididos (TD-06 do frontend).

**Libraries:** —

### saneamento-fase-02-e-infra/TD-06

**Recommendation:** Option A — entrega a dívida documentada sem ampliar o escopo; registrar as Options B e C como tasks futuras (`ci-backend-openapi-export` e `ci-quality-gates`) a planejar antes da Fase 03, quando o número de endpoints crescer.

**Libraries:** —

### saneamento-fase-02-e-infra/TD-07

**Recommendation:** Option A — é o mínimo que torna o Git Flow verificável no histórico; a Option B pode ser aplicada manualmente depois do primeiro PR, quando o status check de TD-06 existir.

**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions... _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function... _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and... _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning options... _(from phase 01)_

_Source note: no prior phase doc has a `## Conventions to Match` section; the Phase 01 bullets above are the `_(from phase 01)_`-tagged entries recorded in `docs/phases/phase-02-auth/context.md` `## Inherited Conventions`. Phase 02 slices (`phase-02-auth`, `phase-02-auth-frontend`) carry no conventions of their own and are therefore omitted from this block._

## Inherited Deferred Capabilities

| Capability | Status | Origin phase | Rationale |
|-----------|--------|--------------|-----------|
| Telas de frontend | deferred | phase-01-configuracao-base | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | phase-02-auth | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| "Confirmação de conta via e-mail com link de ativação" | deferred | phase-02-auth-frontend | deferred_to_next_phase — UI landing screen de-scoped 2026-05-14; FE confirmation flow (TD-07) picked up by a future phase. BE side unchanged in `phase-02-auth`. |
| "Logout" | deferred | phase-02-auth-frontend | deferred_to_next_phase — logout button lives inside authenticated chrome (typically Phase 04). Phase 02 still implements POST `/api/auth/logout` (BFF route handler + `session.destroy()`) so the contract is ready when the chrome lands. |
| "Recuperação de senha (destination screen / set-new-password)" | deferred | phase-02-auth-frontend | deferred_to_next_phase — `/forgot-password` ships this phase sending the e-mail; the reset-password destination screen is absent from Figma → link destination remains a 404 until a later phase delivers the screen via `/screen-inventory` extension run. Documented as a known gap. |
| "Telas de cadastro, login, confirmação de conta e recuperação de senha" | deferred | phase-02-auth-frontend | a tela de confirmação da conta não será implementada nesta fase corrente, será adiada — the umbrella bullet's full coverage requires the confirmação and reset-password destination screens; both are deferred per Non-UI rows above. The 3 ship-this-phase telas (signup, login, forgot-password) are inventoried and covered by their own verbs; the umbrella bullet itself is deferred to the phase that lands the missing screens. |

_Source note (verbatim from `phase-02-auth-frontend/context.md`, kept for the audit trail): "Historical note (2026-10-18): all four rows above were delivered by `task-saneamento-fase-02-e-infra` (2026-10) — `/confirm-email` (SI-8, `app/(auth)/confirm-email/page.tsx`), logout via the session-aware `AppHeader` in `app/(app)/layout.tsx` (SI-10), `/reset-password` (SI-9, `app/(auth)/reset-password/page.tsx`) and `/resend-confirmation` (SI-11), closing the umbrella "Telas…" bullet. See `docs/tasks/task-saneamento-fase-02-e-infra/` and `docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md` (TD-03/TD-04/TD-05). The table is kept as written for the audit trail." The Phase 01 / phase-02-auth "Telas…" rows are likewise historically satisfied by `phase-02-auth-frontend` + that task; rows are informational only._

## Non-UI / Deferred Capabilities

_None._

## Testing Requirements

### nestjs-project

_(from `testing-guide-nestjs-project` § 3 Feature Implementation Checklist)_

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Service with DB only (no branching) | Integration: DB contract |
| Service with configured lib (JWT, cache) | Unit: real lib with test config |
| Service with side-effect dep (email, storage) | Integration: real capture service (Mailpit) or local adapter |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only — do NOT write unit tests |
| DTO | E2E: one validation wiring test per endpoint |
| Guard (delegates to service for business logic) | E2E + Unit if complex internal logic |
| Guard (simple, delegates to Passport) | E2E only |
| Strategy (Passport) | E2E via guard |
| Pipe (custom transformation/validation) | Unit |
| Interceptor (response transform, logging) | Unit and/or E2E |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

Test-suffix contract (from `nestjs-project/CLAUDE.md`): `*.spec.ts` = unit (no I/O); `*.integration-spec.ts` = integration (real DB / external service, `--runInBand`); `*.e2e-spec.ts` = HTTP cycle via supertest in `nestjs-project/test/`. Artifact types new to this phase (queue producer/consumer, storage adapter, worker entrypoint, child-process wrapper) are not yet in the checklist — see `artifacts/future-types.md` and `references/external-systems.md` (storage, queue strategies) of the same skill.

### next-frontend

_Deferred subproject — no frontend work in this slice (backend + infra only, per the decisions doc). `testing-guide-next-frontend` applies when the UI slice that consumes TD-03 / TD-09 is planned._
