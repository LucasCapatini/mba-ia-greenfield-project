---
kind: phase
name: phase-04-video-channel-management
sources_mtime:
  docs/project-plan.md: "2026-10-18T20:25:34-04:00"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-18T22:25:15-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-01-configuracao-base/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-10-18T12:13:58-04:00"
  docs/phases/phase-03-videos/context.md: "2026-10-18T20:25:34-04:00"
  docs/inventories/screen-inventory-phase-04-video-channel-management.md: "2026-10-18T22:03:22-04:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T09:27:45-04:00"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-17T09:27:45-04:00"
---

# phase-04-video-channel-management — Context

## Scope

**Phase name:** Gerenciamento de Vídeos e Canal

Opening sentence (verbatim, `docs/project-plan.md`): "Edição das informações do vídeo, fluxo de rascunho e publicação, painel de administração do canal e página pública."

**Capabilities** (literal, `docs/project-plan.md`):

- Categorias de vídeo disponíveis na plataforma
- Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada
- Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)
- Fluxo de rascunho → publicação
- Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)
- Edição de vídeos a partir do painel
- Edição das informações do canal: nickname, nome e descrição
- Página pública do canal com informações e listagem de vídeos

**Out of scope:** _Not specified._
**Deliverables:** edição completa de vídeos, rascunho/publicação, painel de gerenciamento, edição de canal, página pública do canal.
**Affected subprojects:** (inferred from the capabilities — the phase block names no subproject path explicitly)

- `nestjs-project` — implied by: categorias, edição de vídeo, visibilidade público/unlisted, fluxo rascunho → publicação, edição de canal
- `next-frontend` — implied by: painel de gerenciamento de vídeos do canal, edição a partir do painel, página pública do canal; the upload UI deferred from Phase 03 ("a UI de upload entra na Fase 04 com o painel do canal", status note of Fase 03 in `docs/project-plan.md`)

**Deferred subprojects:** _None._
**Sequencing notes:** "> Depende de: Fase 02, Fase 03". No "primeiro" / "passada subsequente" / "deferido" sentences in the phase block.

**Neighbors (for boundary detection only):**

- **Phase 03:** "Fase 03 — Upload e Processamento de Vídeos" — "> Depende de: Fase 01, Fase 02" (done, backend only).
- **Phase 05:** "Fase 05 — Página de Visualização do Vídeo" — "> Depende de: Fase 03, Fase 04".

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries | Renders in |
|-----|--------|-------|-------|--------|----------|-----------|------------|
| video-channel-management/TD-01 | phase | Cross-layer | Categorias de vídeo — modelo, carga inicial e exposição | decided | A (tabela carregada por migration + `GET /categories`) | — | — |
|     └─ Last revision: 2026-10-18 — Lista inicial de categorias fixada para a data migration (slug → nome, nesta or… | | | | | | | |
| video-channel-management/TD-02 | phase | Backend | Modelo de publicação e visibilidade do vídeo | decided | A (`status` + `visibility` + `published_at`) | — | — |
| video-channel-management/TD-03 | phase | Cross-layer | Contrato de transição rascunho ↔ publicado | decided | A (ações dedicadas + `PATCH`) | — | — |
|     └─ Last revision: 2026-10-18 — Na UI desta fase, o Route Handler de "Save Changes" (telas de edição de vídeo e… | | | | | | | |
| video-channel-management/TD-04 | phase | Cross-layer | Thumbnail customizada — upload, validação e convivência | decided | A (pela API, validada e normalizada em processo) | — | — |
| video-channel-management/TD-05 | phase | Backend | Contadores de engajamento exibidos no painel | decided | A (colunas denormalizadas em `videos`) | — | — |
| video-channel-management/TD-06 | phase | Cross-layer | Paginação das listagens de vídeos | decided | A (cursor keyset) | — | — |
| video-channel-management/TD-07 | phase | Backend | Leitura pública vs. do dono — autenticação opcional | decided | A (autenticação opcional) | — | — |
| video-channel-management/TD-08 | phase | Cross-layer | Identificador do canal na URL e política de nickname | decided | A (nickname na URL, mutável, sem redirecionamento) | — | — |
| video-channel-management/TD-09 | phase | Backend | Exclusão de vídeos e limpeza no storage | decided | A (hard delete + job `video.delete`) | — | — |
| video-channel-management/TD-10 | phase | Cross-layer | Entrega de thumbnails em páginas públicas | decided | B (prefixo `thumbnails/*` com leitura anônima e URL estável) | — | — |
| video-channel-management/TD-11 | phase | Frontend | Cliente de upload multipart no navegador | decided | A (módulo próprio) | — | — |
| video-channel-management/TD-12 | phase | Frontend | Estratégia de dados do frontend — RSC, polling e invalidação | decided | A (RSC + BFF + `router.refresh()` + polling restrito) | — | frontend-runtime |

_Source files:_

- video-channel-management — `docs/decisions/technical-decisions-video-channel-management.md` (scope_type: phase, related_phases: [4])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Categorias de vídeo disponíveis na plataforma | video-channel-management/TD-01 |
| Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada | video-channel-management/TD-04 |
| Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link) | video-channel-management/TD-02, video-channel-management/TD-07 |
| Fluxo de rascunho → publicação | video-channel-management/TD-02, video-channel-management/TD-03 |
| Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status) | video-channel-management/TD-05, video-channel-management/TD-06, video-channel-management/TD-07, video-channel-management/TD-09, video-channel-management/TD-10, video-channel-management/TD-11, video-channel-management/TD-12 |
| Edição de vídeos a partir do painel | video-channel-management/TD-03, video-channel-management/TD-12 |
| Edição das informações do canal: nickname, nome e descrição | video-channel-management/TD-08, video-channel-management/TD-12 |
| Página pública do canal com informações e listagem de vídeos | video-channel-management/TD-06, video-channel-management/TD-07, video-channel-management/TD-08, video-channel-management/TD-10, video-channel-management/TD-12 |

_Built from the `Capability:` field of each TD (TD-12 is `Transversal — covers:` four bullets; TD-09 and TD-11 cite the painel bullet as implicit — TD-09 via the Phase 03 deferral "deletion of ready videos is Phase 04 scope", TD-11 via the Fase 03 status note on the upload UI)._

## Decisions Detail

### video-channel-management/TD-01

**Recommendation:** categorias são dado de plataforma com rótulo exibido em três fases; mantê-las no banco com carga via migration faz `migration:run` continuar sendo o único passo de bootstrap (regra já seguida por testes e CLAUDE.md) e evita duplicar a lista no frontend. Option B é aceitável se o time quiser o mínimo de código — a diferença real é "rótulos no servidor + FK" contra "zero infraestrutura".
**Libraries:** —

**Revisions:**
- 2026-10-18 — Lista inicial de categorias fixada para a data migration (slug → nome, nesta ordem): music → Music, gaming → Gaming, education → Education, entertainment → Entertainment, sports → Sports, news → News, technology → Technology, travel → Travel, cooking → Cooking, other → Other. Rationale: AMB-3 do plan-validate da Fase 04 — o conteúdo da lista não existia em nenhum artefato e a migration de dados depende dele.

### video-channel-management/TD-02

**Recommendation:** é a extensão natural do eixo de publicação decidido em `phase-03-videos/TD-07`, preserva a visibilidade ao despublicar e fornece a coluna de ordenação/tempo que o painel e TD-06 precisam. Regra de negócio a fixar junto: publicar exige `ready` + título; editar título/descrição/categoria/visibilidade é permitido em qualquer `processing_status`.
**Libraries:** —

### video-channel-management/TD-03

**Recommendation:** torna as pré-condições de publicação um contrato visível (OpenAPI → `types.gen.ts` → MSW), mantém `PATCH` previsível para o `react-hook-form` da tela de edição e replica o padrão de ação já existente no `VideosController`. O custo é um `fetch` a mais no fluxo "salvar e publicar", irrelevante aqui.
**Libraries:** —

**Revisions:**
- 2026-10-18 — Na UI desta fase, o Route Handler de "Save Changes" (telas de edição de vídeo e de upload em processamento) encadeia o `PATCH` de campos com a ação dedicada `publish` quando `status = draft`, `processing_status = ready` e o título está preenchido; se o vídeo ainda não está `ready`, apenas salva e avisa que continua rascunho (publicação ocorre num novo "Save" após o processamento). `unpublish` só pelo kebab do painel. A API mantém as ações dedicadas da Option A. Rationale: decisão de UI registrada no inventário da Fase 04 (IC-1/OQ-2 do plan-validate); o Figma não tem botão "Publish".

### video-channel-management/TD-04

**Recommendation:** para um arquivo de poucos MB o custo de atravessar Nest/Next é nulo, e é o único caminho que valida pelos bytes sem criar um job dedicado nem alargar a exceção ao Strict BFF. Modelo: segunda coluna `custom_thumbnail_key` (a automática fica intacta para reverter); `thumbnail_url` resolve `custom ?? auto`. Sub-escolha para o `/plan-build`: `sharp` (dedicado, API síncrona simples) salvo objeção a dependência nativa — nesse caso, `ffmpeg` por `execFile` com o serviço movido para um módulo compartilhado.
**Libraries:** —

### video-channel-management/TD-05

**Recommendation:** a listagem do painel, a home e a watch leem os mesmos números em lote, e a Fase 06 já terá de escrever em transação; manter os contadores na própria linha evita `COUNT` por item em páginas paginadas sem introduzir uma tabela a mais. O contrato (`view_count`, `like_count`, `dislike_count`, `comment_count` na resposta de listagem) nasce agora e não muda depois.
**Libraries:** —

### video-channel-management/TD-06

**Recommendation:** no volume deste projeto A e B custam o mesmo; a diferença decisiva é que A permanece correta se a Fase 07 escolher scroll infinito e não precisa ser reaberta, enquanto B obriga a aceitar drift ou migrar o contrato. O `total` do painel é uma consulta `COUNT` separada, só nesse endpoint.
**Libraries:** —

### video-channel-management/TD-07

**Recommendation:** é a única que entrega "mesma URL para dono e público" sem duplicar rotas nas Fases 05/06, e o custo é um ramo bem delimitado no `JwtAuthGuard` (ou um decorator `@OptionalAuth()` equivalente) mais testes de matriz. As rotas de escrita continuam exigindo JWT e `VideosOwnership`.
**Libraries:** —

### video-channel-management/TD-08

**Recommendation:** satisfaz os dois bullets com o modelo já existente e a mesma allowlist da Fase 02; o custo (links antigos quebram) é o comportamento padrão de handles e pode ser endurecido depois com a Option C como extensão aditiva. Forma da rota: `/channel/{nickname}` (um segmento `@handle` na raiz colidiria com a convenção de parallel routes `@slot` do App Router e com as demais rotas de topo).
**Libraries:** —

### video-channel-management/TD-09

**Recommendation:** reaproveita o padrão transacional "linha + job na mesma transação" de `phase-03-videos/TD-11` e garante que os bytes sejam liberados sem bloquear a resposta nem espalhar um filtro `deleted_at` por todas as fases seguintes. Option B só compensa se o produto pedir lixeira.
**Libraries:** —

### video-channel-management/TD-10

**Recommendation:** thumbnails são conteúdo público por natureza nas Fases 04/05/07 e a URL estável é o que torna cache e `next/image` possíveis; a policy fica restrita ao prefixo, então a decisão de `phase-03/TD-09` para vídeos permanece intacta. Verificação na SI: `curl -sI $S3_PUBLIC_ENDPOINT/$BUCKET/thumbnails/x/auto.jpg` → 200 sem credenciais e `…/videos/x/source` → 403. Se a policy falhar no RustFS, A é o fallback sem mudança de contrato além do cache.
**Libraries:** —

### video-channel-management/TD-11

**Recommendation:** o contrato da Fase 03 é pequeno e já está fechado; a única biblioteca que o espelha (Uppy 5) acaba de ser descontinuada pela própria Uppy 6, cujo modelo conflita com a orquestração pela API. Um módulo de ~200 linhas com pool, retry e retomada é menor que a adaptação de qualquer uma das duas e fica coberto pelos testes de MSW já padronizados. Estado no layout do estúdio (Provider) para a navegação interna não cancelar o envio.
**Libraries:** —

### video-channel-management/TD-12

**Recommendation:** as necessidades desta fase são estreitas (um polling condicional e invalidação por recarga de rota), o padrão já existe desde a Fase 02 e a documentação do TanStack recomenda não adotá-lo em apps RSC sem necessidade concreta. Reavaliar na Fase 06 (likes/comentários otimistas), quando a Option B passa a pagar seu custo; a migração é aditiva (Provider + hooks), não substitui os Route Handlers.
**Renders in:** frontend-runtime
**Libraries:** —

## Inherited Decisions Detail

_(inherited TDs from prior phases — from phases-reader; plus the two correlator-confirmed ad-hoc docs `next-frontend-msw-foundation` and `next-frontend-openapi-typing`; dedupe applied — no overlap with current-scope refs)_

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

### phase-03-videos/TD-01

**Recommendation:** é a única alternativa livre que cobre todas as operações exigidas pelas TDs 03/09/12 (presigned multipart, CORS, `response-content-disposition`, lifecycle) com um container, um volume e console web, mantendo o backend acoplado apenas à API S3 (TD-02) para que produção use S3 real ou outro servidor sem mudar código. O risco de maturidade é mitigado por um smoke test obrigatório na primeira SI de storage; **Garage (B) é o fallback** se o smoke test falhar. Contrato de ambiente proposto (chaves canônicas para Joi + compose + `.env.example`): `S3_ENDPOINT` (interno, `http://rustfs:9000`), `S3_PUBLIC_ENDPOINT` (voltado ao navegador, `http://localhost:9000` em dev — base das URLs pré-assinadas de upload/stream), `S3_REGION` (`us-east-1`, exigido pelo SDK), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (`streamtube-videos`), `S3_FORCE_PATH_STYLE=true`.
**Libraries:** —

### phase-03-videos/TD-02

**Recommendation:** mantém o backend acoplado somente à API S3, o que é a razão de ser de TD-01, e tem o ecossistema de mocks que TD-13 usa nos unit tests. A configuração obrigatória (`forcePathStyle`, `WHEN_REQUIRED` nos dois checksums, cliente interno vs. cliente de assinatura pública) vira parte do contrato do `StorageModule`.
**Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

### phase-03-videos/TD-03

**Recommendation:** é a única que cumpre literalmente "10 GB sem impacto na performance" e "retomar após falha", porque o backend só orquestra metadados e o storage recebe os bytes; o custo (CORS + endpoint público + fatiamento no cliente) é pago uma vez pela fatia de UI. A exceção ao Strict BFF fica explícita e limitada: o navegador só fala com `S3_PUBLIC_ENDPOINT` usando URLs assinadas que a API emite via BFF — nunca com `nestjs-api`. Parâmetros propostos: `UPLOAD_PART_SIZE` (default 64 MiB, mínimo 5 MiB, configurável para que TD-13 teste multipart com partes de 5 MiB), `UPLOAD_MAX_BYTES` (10 GiB), `UPLOAD_URL_TTL` (ex.: 1 h por lote de partes).
**Libraries:** —

### phase-03-videos/TD-04

**Recommendation:** entrega todos os primitivos que TD-11 e TD-12 pedem (chave singleton por vídeo, retry com backoff, `startAfter` para limpeza, expiração de jobs travados) sobre o PostgreSQL já presente, sem novo container em dev/testes/produção e sem apostar em um backend de três meses (B). **A (BullMQ + Redis) é uma escolha igualmente válida** se o time preferir a integração Nest nativa e já antever dashboards/escala horizontal; o custo é um serviço a mais em cada ambiente e no `cleanAllTables` dos testes. B fica como candidato a supersede quando `nestjs/bull#2924` for lançado.
**Libraries:** pg-boss

### phase-03-videos/TD-05

**Recommendation:** mantém um só código-base para entidades, config e testes (sem introduzir workspaces nesta fase) e, ao mesmo tempo, isola o processamento em um container próprio como o C4 prevê. O custo do ffmpeg na imagem compartilhada é aceitável em dev; a imagem de produção pode usar build arg/stage para omiti-lo na API, decisão que pertence à Fase 07.
**Libraries:** —

### phase-03-videos/TD-06

**Recommendation:** evita qualquer cópia do vídeo, usa o binário mantido pela distro e segue a orientação do próprio autor do `fluent-ffmpeg` (chamar o processo sem wrapper). A thumbnail nasce em `/tmp` do worker e sobe para `thumbnails/{publicId}/auto.jpg` via TD-02. A versão 5.1.9 do bookworm é suficiente; migrar para `trixie-slim` (7.1.5) fica como ajuste opcional registrado na SI do Dockerfile, não como TD.
**Libraries:** —

### phase-03-videos/TD-07

**Recommendation:** os dois eixos de estado são obrigatórios para não bloquear a Fase 04, e separar a sessão multipart mantém `videos` como aggregate limpo para as Fases 04/05 enquanto TD-12 e a retomada (TD-03) trabalham só na tabela transitória, em linha com o princípio de responsabilidade única do projeto. A diferença de custo para A é uma entidade e um join; se o time preferir minimalismo, A é aceitável desde que mantenha os dois eixos.
**Libraries:** —

### phase-03-videos/TD-08

**Recommendation:** atende "curta e única" sem dependência, reusa o padrão de retry por SAVEPOINT já existente e evita a incompatibilidade de `engines` do `nanoid` com o Node 25 do container. A PK continua UUID (regra de entidades); `public_id` é a chave externa de URL e de storage.
**Libraries:** —

### phase-03-videos/TD-09

**Recommendation:** mantém os bytes fora de Nest/Next como em TD-03, dá `Range` e download por configuração do storage e concentra a autorização no endpoint que emite a URL, o que absorve drafts privados hoje e unlisted/published na Fase 04 sem mudar o mecanismo. Verificação concreta na SI: `curl -r 0-1023 <streamUrl>` → 206 e `curl -I <downloadUrl>` → `Content-Disposition: attachment`.
**Libraries:** —

### phase-03-videos/TD-10

**Recommendation:** segue a topologia já decidida, deixa o ambiente pronto para integração/e2e com um único `up` e mantém a API sem privilégios de administração do storage. Entregáveis concretos: `Dockerfile.dev` com `ffmpeg`, `compose.yaml` com `rustfs`, `storage-init`, `video-worker` (e `redis` só se TD-04 = A), `.env.example` com as chaves de TD-01/TD-03/TD-09 e `nestjs-project/CLAUDE.md` com os novos probes (`curl http://localhost:9000/health`, console em `:9001`).
**Libraries:** —

### phase-03-videos/TD-11

**Recommendation:** é a única opção portável entre servidores de storage e filas, e a combinação chave única + guarda de estado garante que retries e entregas duplicadas não corrompam o vídeo. Com TD-04 = C ou B (fila em Postgres) o `send` entra na mesma transação do update, fechando a janela de falha apontada nos Cons.
**Libraries:** —

### phase-03-videos/TD-12

**Recommendation:** resolve o caso comum com o primitivo mais simples da fila escolhida, sem cron nem varredura, e com política explícita (`UPLOAD_TTL`, default 24 h). A regra de lifecycle de B pode ser adicionada no `storage-init` (TD-10) como rede de segurança opcional, com TTL maior que `UPLOAD_TTL` para nunca abortar antes do job.
**Libraries:** —

### phase-03-videos/TD-13

**Recommendation:** é a continuação direta do padrão atual (Postgres e Mailpit reais nas integrações, mocks nas unit) e a única que valida os contratos de storage e ffmpeg que TD-01 e TD-06 assumem. `UPLOAD_PART_SIZE` configurável é o que permite provar multipart com 15 MiB em vez de 10 GiB.
**Libraries:** aws-sdk-client-mock

### phase-03-videos/TD-14

**Recommendation:** sem transcodificação, a única política honesta é "aceitar o que os navegadores tocam", e checar duas vezes custa uma constante compartilhada: a allowlist declarada poupa o usuário de subir 10 GB de um arquivo errado, e o `ffprobe` pega o que a declaração não revela. HEVC e MOV ficam de fora por suporte parcial (reavaliar quando houver transcodificação). Contrato de erro: `POST /videos` responde 400 com código de domínio `VIDEO_UNSUPPORTED_MEDIA_TYPE` (filtro de `phase-02-auth/TD-07`); no processamento, `processing_status = failed` com `processing_error = UNSUPPORTED_FORMAT` e o detalhe do ffprobe. Depende de TD-03 (onde o tipo declarado entra), TD-06 (ffprobe), TD-07 (coluna `processing_error`) e TD-11 (transição para `failed`).
**Libraries:** —

##### next-frontend-msw-foundation
**Libraries:** —

### next-frontend-msw-foundation/TD-01
**Recommendation:** Three reasons. (1) **MSW's own best-practice recommends it** — the project should not invent its own scheme when the official one is documented and matches the codebase's domain orientation. (2) **Domain ownership tracks the codebase**, not the project plan — `components/`, `app/api/`, and any future feature folders will be organized by domain (auth, videos, channels), so handler files mirror that vocabulary and remain stable as phases come and go. (3) **Append-only growth with minimal merge conflicts** — each phase touches a new file plus one line in the barrel, which is the smallest practical concurrent-PR footprint. Option A is acceptable through Phase 02 alone (~5–7 endpoints) but accumulates costs that B avoids from day one; bootstrapping directly into B costs one extra file and one barrel and pays off by Phase 03. Option C's phase coupling is rejected outright — domain-by-phase is a category error.
**Libraries:** —

### next-frontend-msw-foundation/TD-02
**Recommendation:** The browser worker is a future capability with no documented current consumer; wiring it now (Option B) is speculative investment, and wiring it incoherently (Option C) actively misleads developers into thinking interception works when it doesn't under strict BFF. Option A keeps the foundation minimal, aligns 1:1 with everything CLAUDE.md and the existing rules currently document, and is non-breaking to extend.
**Libraries:** —

### next-frontend-msw-foundation/TD-03
**Recommendation:** Reasons: (1) **Option B's determinism + readability is the right baseline** — every fixture in Phase 02 (5–7 endpoints, single-record-mostly) is naturally hand-written, and the diff-revealing override pattern is the highest-value benefit. (2) **Bulk-collection cases will arrive (Phase 07 home page grid, Phase 06 comment threads) and inline hand-written lists of 20+ items are genuinely tedious** — keeping faker available as a scoped tool is pragmatic. (3) **Per-fixture local seeding eliminates the global-cursor pitfall** that makes Option C structurally fragile — using `faker.seed(N)` immediately before a collection-builder run scopes the determinism to that fixture and isolates it from upstream changes to other factories.
**Libraries:** —

### next-frontend-msw-foundation/TD-04
**Recommendation:** The user's "import only what it needs" requirement is satisfied at the *authoring* layer by TD-01 (per-domain files; each phase adds one file). At the *runtime* layer, loading all handlers is the canonical MSW v2 model and imposes no cost on tests that don't fetch the extra URLs. `onUnhandledRequest: "error"` enforces that a phase's test cannot accidentally invoke a route outside its scope (the fetch fails loudly with "no handler matched"), which is the strongest version of "stays inside its phase" available. Option B's per-suite composition pays real boilerplate cost for an explicitness gain that TD-01 already provides at a different layer. Option C invents a Vitest-projects-shaped problem for a phase-shaped concern.
##### next-frontend-openapi-typing
**Libraries:** —

### next-frontend-openapi-typing/TD-01
**Recommendation:** Three reinforcing reasons. (1) **Strict BFF makes the SDK surface valueless on the client.** Only Route Handlers ever call the upstream Nest; they already use `fetch` (Next 16's caching extensions sit on top of native `fetch`); a generated SDK adds a third client style to learn for zero functional gain. (2) **Types-first matches the rest of the FE foundation.** Env validation is Zod-derived types; component variants are `cva` types; both are TS-first with zero generated runtime. `paths` is the natural extension — one `.d.ts` file imported wherever the contract is touched. (3) **MSW typing is solved by the same `paths` symbol.** Hand-written handlers in `mocks/handlers.ts` type their resolver returns off `paths["/videos"]["get"]["responses"][200]`, giving the contract guarantee without orval/kubb's verbose generated handlers (which would be overridden per-test anyway). The marginal cost of adding `openapi-fetch` (~6KB, server-side only) is small enough that we recommend the **types + thin-client** pair, not types alone — `openapi-fetch` removes the `fetch(API_URL + path, { method, headers, body })` boilerplate in each Route Handler while staying within the BFF model. Options B/C/D may be revisited if (a) client-side data-fetching enters the stack with TanStack Query and per-endpoint hooks are wanted, or (b) the API grows beyond ~20 operations and per-call boilerplate becomes painful.
**Libraries:** openapi-typescript, openapi-fetch

### next-frontend-openapi-typing/TD-02
**Recommendation:** Three reasons. (1) **Preserves the compose-stack independence** that `next-frontend-config-base/TD-03` Context calls out as the current architecture — neither subproject's compose file references the other. (2) **Drift is eliminated structurally when paired with TD-03's CI freshness check** — the check runs the sync script and asserts no diff on either `openapi.json` or `types.gen.ts`, so a backend PR that forgets to re-sync fails CI with a clear message. (3) **The committed local file is a real artifact in PR review** — reviewers see the contract change in `next-frontend/openapi.json`'s diff at the same time as the backend change, doubling the visibility (an `openapi.json`-only diff in a feature PR is a red flag for accidental drift). Option A is acceptable as a pre-CI fallback; Option C is rejected because the cross-stack file dependency in `docker-compose.yaml` introduces coupling that the current architecture explicitly avoids, and the "no drift" gain over B is small once TD-03 lands.
**Libraries:** —

### next-frontend-openapi-typing/TD-03
**Recommendation:** It is the only option that makes contract drift _both_ visible (in PR diffs) _and_ impossible to merge accidentally (CI fail). The complexity premium over Option A is one CI step. Option B's "no committed artifacts" purity is poorly paid for in a monorepo where the cross-subproject build coupling becomes a real ergonomic cost, and it wastes the PR visibility that TD-02 Option B's committed `openapi.json` is specifically designed to deliver. Option A is acceptable as a temporary state until the CI pipeline lands; downgrading from C to A is reversible (just remove the CI step) but upgrading to C later requires explaining `types.gen.ts` history in a separate commit. Start at C. Apply the same script-and-check pattern to any future generated artifact (e.g., if `openapi-fetch` is wrapped, the wrapper file is hand-written; the only generated artifact remains `types.gen.ts`).
**Libraries:** —

### next-frontend-openapi-typing/TD-04
**Recommendation:** It is the only option that (i) handles pass-through and reshape with the same mechanism, (ii) gives a single grep target for "what shape does the BFF expose", and (iii) decouples Component imports from App Router file paths (Components import `from "@/lib/api/contracts"`, not `from "@/app/api/videos/route"`). Option B is theoretically minimal but fragile against Next's actual RSC/Client/Route-Handler typing; Option C scatters the contract surface and creates drift opportunities. The "long file" concern is bounded — for the scope of StreamTube, the BFF will likely have <30 contract aliases at peak; sectioning by feature header comments is sufficient. Make `lib/api/contracts.ts` the only file that imports `paths` from `types.gen.ts` (lintable later); every other consumer imports from `contracts.ts`.
**Libraries:** —

### next-frontend-openapi-typing/TD-05
**Recommendation:** Reasons: (1) **Determinism over auto-generation** — BFF integration tests assert on specific values; randomized fixtures are anti-helpful. (2) **Coherence with TD-01 recommendation** — `openapi-typescript`'s `paths` type is the single contract anchor; reusing it in MSW handlers means "spec ↔ handler ↔ assertion" is one type chain. (3) **Scale fit** — Phase 02 introduces few endpoints; the manual cost is negligible at this stage. If the API grows to dozens of endpoints and authoring overhead becomes real, this TD can be superseded with a Kubb-or-hey-api MSW plugin without touching TD-01's `paths` import sites (the generator just produces additional handler files; the existing manual handlers stay valid). Option B locks the project into a heavier TD-01 choice for marginal mock-authoring savings; Option C is Option A with an unnecessary detour.
**Libraries:** —

## Inherited Conventions

_(from phases-reader — compact list; sourced from prior phases. No prior phase doc has a `## Conventions to Match` section of its own; the Phase 01 bullets below are the `_(from phase 01)_`-tagged entries carried by `docs/phases/phase-02-auth/context.md` and `docs/phases/phase-03-videos/context.md`. Phase 02 slices and Phase 03 carry no conventions of their own.)_

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions... _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function... _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and... _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning options... _(from phase 01)_

## Inherited Deferred Capabilities

_(from phases-reader — informational-only; plan-validate does NOT fire issues based on unaddressed entries)_

| Capability | Status | Origin phase | Rationale |
|-----------|--------|--------------|-----------|
| Telas de frontend | deferred | phase-01-configuracao-base | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | phase-02-auth | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| "Confirmação de conta via e-mail com link de ativação" | deferred | phase-02-auth-frontend | deferred_to_next_phase — UI landing screen de-scoped 2026-05-14; FE confirmation flow (TD-07) picked up by a future phase. BE side unchanged in `phase-02-auth`. |
| "Logout" | deferred | phase-02-auth-frontend | deferred_to_next_phase — logout button lives inside authenticated chrome (typically Phase 04). Phase 02 still implements POST `/api/auth/logout` (BFF route handler + `session.destroy()`) so the contract is ready when the chrome lands. |
| "Recuperação de senha (destination screen / set-new-password)" | deferred | phase-02-auth-frontend | deferred_to_next_phase — `/forgot-password` ships this phase sending the e-mail; the reset-password destination screen is absent from Figma → link destination remains a 404 until a later phase delivers the screen via `/screen-inventory` extension run. Documented as a known gap. |
| "Telas de cadastro, login, confirmação de conta e recuperação de senha" | deferred | phase-02-auth-frontend | a tela de confirmação da conta não será implementada nesta fase corrente, será adiada — the umbrella bullet's full coverage requires the confirmação and reset-password destination screens; both are deferred per Non-UI rows above. The 3 ship-this-phase telas (signup, login, forgot-password) are inventoried and covered by their own verbs; the umbrella bullet itself is deferred to the phase that lands the missing screens. |

_Source note carried from `docs/phases/phase-02-auth-frontend/context.md` (historical note, 2026-10-18): all four `phase-02-auth-frontend` rows above were delivered by `task-saneamento-fase-02-e-infra` (2026-10) — `/confirm-email` (SI-8), logout via the session-aware `AppHeader` in `app/(app)/layout.tsx` (SI-10), `/reset-password` (SI-9) and `/resend-confirmation` (SI-11), closing the umbrella "Telas…" bullet. The source table keeps `Status: deferred` for the audit trail, so the rows are reproduced here verbatim; see `docs/tasks/task-saneamento-fase-02-e-infra/` and `docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md` (TD-03/TD-04/TD-05). `phase-03-videos` has `_None._` in its `## Non-UI / Deferred Capabilities` section._

## UI Inventory

_(from inventory-digest-reader)_

**Source:** `docs/inventories/screen-inventory-phase-04-video-channel-management.md`
**Screens in scope:** 5

### UI ↔ Capability Join

| Screen | Route | Verb | Capability | Covering Component |
|--------|-------|------|------------|-------------------|
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Exibir lista paginada de vídeos do canal com thumbnail, título, métricas, tempo de publicação e status | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Lista de vídeos / VideoList |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Iniciar upload de vídeo novo | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Button "Upload video" |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Filtrar vídeos do canal por visibilidade | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Button "Public" em Filters |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Filtrar vídeos do canal por data | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Button "Date" em Filters |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Buscar vídeos do próprio canal por texto | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Search "Search your videos" |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Ordenar a lista de vídeos do canal | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Sort actions |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Acessar a edição de um vídeo a partir do painel | "Edição de vídeos a partir do painel" | VideoList — linha/título ou menu kebab |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Publicar ou despublicar um vídeo a partir do painel | "Fluxo de rascunho → publicação" | button kebab em VideoList |
| Painel de gerenciamento de vídeos (My videos list) | /studio/videos | Excluir um vídeo do canal (com confirmação) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | button kebab em VideoList |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Carregar dados atuais do vídeo para edição (título, descrição, categoria, thumbnail, visibilidade, status) | "Edição de vídeos a partir do painel" | Edit/Publish video |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Editar título e descrição do vídeo | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Channel card › video-edit-form |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Salvar alterações das informações do vídeo | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Button "Save Changes" |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Alterar visibilidade do vídeo entre público e unlisted | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" | Button "Save Changes" (valor escolhido em PrivacyOption) |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Publicar vídeo ao salvar um rascunho pronto (sair do estado de rascunho) | "Fluxo de rascunho → publicação" | Button "Save Changes" |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Listar categorias disponíveis para escolha | "Categorias de vídeo disponíveis na plataforma" | Category select |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Escolher categoria do vídeo | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Category select + Button "Save Changes" |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Exibir thumbnail atual do vídeo | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | ThumbUpload |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Enviar thumbnail customizada | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Button "Change Thumbnail" |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Exibir preview do vídeo a partir da playback URL | "Edição de vídeos a partir do painel" | CardVideoConfig › Video preview |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Exibir metadados do arquivo (link público, nome do arquivo, qualidade) | "Edição de vídeos a partir do painel" | CardVideoConfig |
| Edição de vídeo (Edit/Publish video) | /studio/videos/{publicId}/edit | Exibir status de processamento do vídeo que condiciona a publicação | "Fluxo de rascunho → publicação" | Status |
| Edição do canal (Channel Settings) | /studio/channel | Exibir as informações atuais do canal (nome, nickname) no cabeçalho | "Edição das informações do canal: nickname, nome e descrição" | Channel card |
| Edição do canal (Channel Settings) | /studio/channel | Exibir contador de vídeos do canal | "Página pública do canal com informações e listagem de vídeos" | Channel card › videos meta |
| Edição do canal (Channel Settings) | /studio/channel | Carregar os valores atuais do canal (nickname, nome, descrição e data da última atualização) no formulário | "Edição das informações do canal: nickname, nome e descrição" | Canal |
| Edição do canal (Channel Settings) | /studio/channel | Salvar alterações das informações do canal (nickname, nome e descrição) | "Edição das informações do canal: nickname, nome e descrição" | Button "Save Changes" em Canal |
| Página pública do canal (Channel Show) | /channel/{nickname} | Exibir informações públicas do canal (nome, nickname e descrição) a partir do nickname da rota | "Página pública do canal com informações e listagem de vídeos" | channel info |
| Página pública do canal (Channel Show) | /channel/{nickname} | Exibir total de vídeos públicos do canal | "Página pública do canal com informações e listagem de vídeos" | Videos count em channel info |
| Página pública do canal (Channel Show) | /channel/{nickname} | Exibir listagem de vídeos públicos do canal | "Página pública do canal com informações e listagem de vídeos" | Video grid + VideoCard |
| Página pública do canal (Channel Show) | /channel/{nickname} | Exibir thumbnail, título, visualizações e tempo de publicação de cada vídeo | "Página pública do canal com informações e listagem de vídeos" | VideoCard |
| Página pública do canal (Channel Show) | /channel/{nickname} | Reordenar a listagem de vídeos do canal (mais recentes / populares / mais antigos) | "Página pública do canal com informações e listagem de vídeos" | Filter chips |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Acompanhar progresso do envio e do processamento do vídeo | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | ProgressLinear + upload info row |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Exibir status do processamento do vídeo (uploading → processing → ready / failed) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Status label "Uploading" |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Exibir resultado das verificações do arquivo enviado (formato, probe, thumbnail) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Status "Checks complete. No issues found." |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Exibir metadados extraídos do vídeo (nome do arquivo, qualidade, duração) e pré-visualização | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | CardVideoConfig (Video preview, Duration badge) |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Exibir a thumbnail atual do vídeo (gerada no processamento ou customizada) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | ThumbUpload |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Substituir a thumbnail por uma imagem customizada | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Button "Change Thumbnail" |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Preencher título e descrição enquanto o vídeo processa e salvar as alterações | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | Channel card (TextField Title, Textarea Description) via Button "Save Changes" |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Listar as categorias disponíveis e selecionar a categoria do vídeo | "Categorias de vídeo disponíveis na plataforma" | Category select |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Definir a visibilidade do vídeo como público ou unlisted | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" | PrivacyOption (Public / Unlisted) via Channel card |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Exibir o link público do vídeo para compartilhamento | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" | CardVideoConfig (Video link) |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Salvar o rascunho enquanto processa e publicá-lo ao salvar quando estiver pronto | "Fluxo de rascunho → publicação" | Button "Save Changes" |
| Upload em processamento (Upload video processing) | /studio/upload/{publicId} | Cancelar o upload em andamento (abortar o envio e descartar o rascunho) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | Button "Cancel" |

### Server-connected Components

- `Button "Upload video"` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: components/ui/button.tsx`
- `videos filter row / Filters` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `Button "Public"` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: components/ui/button.tsx`
- `Button "Date"` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: components/ui/button.tsx`
- `Search "Search your videos"` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `Sort actions / "Sort by: Latest" + ícone Filter list` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `Lista de vídeos — container das linhas` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `VideoList` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `button kebab` (Painel de gerenciamento de vídeos (My videos list)) — `Reuse?: new`
- `Edit/Publish video` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `Channel card` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `CardVideoConfig` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `CardVideoConfig › Video preview` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `ThumbUpload` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `Button "Change Thumbnail"` (Edição de vídeo (Edit/Publish video)) — `Reuse?: components/ui/button.tsx`
- `Category select` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `Status` (Edição de vídeo (Edit/Publish video)) — `Reuse?: new`
- `Button "Save Changes"` (Edição de vídeo (Edit/Publish video)) — `Reuse?: components/ui/button.tsx`
- `Channel card` (Edição do canal (Channel Settings)) — `Reuse?: new`
- `Canal` (Edição do canal (Channel Settings)) — `Reuse?: new`
- `Button "Save Changes"` (Edição do canal (Channel Settings)) — `Reuse?: components/ui/button.tsx`
- `channel banner` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `Avatar` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `channel info` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `Button Subscribe` (Página pública do canal (Channel Show)) — `Reuse?: components/ui/button.tsx`
- `IconButton notifications` (Página pública do canal (Channel Show)) — `Reuse?: components/ui/icon-button.tsx`
- `Filter chips` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `Video grid` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `VideoCard` (Página pública do canal (Channel Show)) — `Reuse?: new`
- `Channel card` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `upload info row` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Status label "Uploading"` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `ProgressLinear` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `CardVideoConfig` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Video preview` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `ThumbUpload` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Duration badge` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Button "Change Thumbnail"` (Upload em processamento (Upload video processing)) — `Reuse?: components/ui/button.tsx`
- `Category select` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Status "Checks complete. No issues found."` (Upload em processamento (Upload video processing)) — `Reuse?: new`
- `Button "Cancel"` (Upload em processamento (Upload video processing)) — `Reuse?: components/ui/button.tsx`
- `Button "Save Changes"` (Upload em processamento (Upload video processing)) — `Reuse?: components/ui/button.tsx`

### Open Questions from Inventory

- **Tela "Upload Video" (154:1724) não inventariada:** extração rejeitada pela cota mensal do Figma MCP (plano Starter). O inventário foi validado com 5 telas por decisão do usuário (2026-10-18); a tela de escolha do arquivo (dropzone/seletor, validação de formato MP4/WebM e limite de 10 GB) deve ser derivada da capability e da tela de processamento até um rerun de extensão de `/screen-inventory 4` quando a cota for restabelecida.
- **Publicação implícita no "Save Changes" vs. TD-03:** o usuário decidiu que "Save Changes" (156:2799 / 156:2771) publica o rascunho quando `processing_status = ready`; a API mantém as ações dedicadas `publish`/`unpublish` de TD-03 e o BFF as compõe com o `PATCH`. Conferir coerência com TD-02 (título obrigatório para publicar) e definir o feedback quando o vídeo ainda não está pronto (salvar sem publicar).
- **Ponto de entrada do estúdio e da edição do canal:** a página pública não tem variante "dono logado" e o header atual é mínimo; a navegação para `/studio/videos` e `/studio/channel` precisa de um gatilho nesta fase (menu do usuário / SideNav "Your videos" são Fase 07). Decidir a entrada mínima (ex.: links no header existente para a sessão autenticada).
- **Rotas do estúdio:** `/studio/videos`, `/studio/videos/{publicId}/edit`, `/studio/channel` e `/studio/upload/{publicId}` são propostas deste inventário; confirmar no plan-build. A página pública segue TD-08 (`/channel/{nickname}`).
- **Link público do vídeo (`streamtube.com/v/{publicId}`):** o path da watch page (`/v/` vs. `/watch/`) só se decide na Fase 05; o CardVideoConfig exibe/copia esse link já nesta fase.
- **Avatar e banner do canal:** placeholder estático nesta fase (decisão do usuário); campos persistidos e upload ficam para uma fase futura, sem bullet no plano.
- **Estados não desenhados no Figma:** status do painel além de "Public" (`draft`, `unlisted`, `processing`, `failed`), estados `processing`/`ready`/`failed` da tela de upload, erros de validação dos formulários (inclusive 409 `NICKNAME_TAKEN`), estados vazio/carregando/404 da página pública e do painel, conteúdo dos menus "Filter"/"Date"/"Sort by" e do kebab, diálogo de confirmação de exclusão/cancelamento, conteúdo da aba "About" do canal. O plan-build deve defini-los a partir dos primitivos shadcn.
- **Filtros, ordenação e busca do painel:** os parâmetros (visibilidade, data, texto, ordenação) não constam de TD-06 (que fixa só `limit`/`cursor`/`total`); definir no contrato da listagem do dono.
- **Títulos divergentes no Figma:** as telas de edição de vídeo (156:2794) e de upload (156:2114) exibem "Channel Settings"; a tela de Channel Settings mostra o handle no campo "Display name". Tratar como erros de conteúdo do design.

## Non-UI / Deferred Capabilities

_(always emitted; placeholder when empty. Read by plan-context/plan-build; write-append by plan-resolve.)_

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| _None._ | | | |

## Testing Requirements

_(from the `testing-guide-nestjs-project` and `testing-guide-next-frontend` skills — Feature Implementation Checklists)_

### nestjs-project

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

_Suffix contract (`nestjs-project/CLAUDE.md`): `*.spec.ts` unit (no I/O), `*.integration-spec.ts` integration (real DB/storage/queue, `--runInBand`), `*.e2e-spec.ts` under `test/` (supertest, `maxWorkers: 1`). Worker handlers (pg-boss) follow the service rows: unit with mocked SDK + integration with the real compose services (`phase-03-videos/TD-13`)._

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, static, no logic | None at component level; cover only if part of a critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test client children directly; cover rendered page via `*.e2e-spec.ts` |
| Page — async RSC (`async function Page()` with `await`) | `*.e2e-spec.ts` only — Vitest cannot render it |
| Layout (`layout.tsx`) | None unless it adds logic (auth gate, conditional render); else via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.tsx` — RTL + `jsdom` docblock, mock `next/navigation`, MSW for fetch |
| Feature component (server, composes primitives) | Skip unit; cover via the page's E2E |
| shadcn UI primitive (`components/ui/*`) | None — trust the library; cover via consumers |
| Icon (`components/icons/*`) | None |
| `lib/` utility / boundary module with branching or shape assumptions | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts(x)` with `renderHook`, `jsdom` docblock |
| Route handler (`app/api/**/route.ts`) — proxy or with branching | `*.integration.test.ts` with MSW (+ `*.test.ts` for extracted pure logic) |
| Server action / middleware / error-loading-not-found / metadata | See guide — depends on type |

_Suffix contract (`next-frontend/CLAUDE.md`): `*.test.ts(x)` unit, `*.integration.test.ts(x)` integration (Route Handlers as functions + `msw/node`, `onUnhandledRequest: "error"`), `*.e2e-spec.ts` under `tests/` (Playwright on the host against the containerized dev server with `MSW_ENABLED=true`; real `/api/**` Route Handlers, upstream faked server-side; no browser-level `page.route()`)._
