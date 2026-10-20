---
kind: task
name: task-manutencao-pos-saneamento
sources_mtime:
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T13:27:46Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T21:30:21Z"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T20:16:01Z"
  docs/phases/phase-04-video-channel-management/context.md: "2026-10-19T20:16:01Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T13:27:45Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-17T13:27:45Z"
---

# task-manutencao-pos-saneamento — Context

## Scope

> manutenção após a task de saneamento da Fase 04. (1) next-frontend: remover o console.log(error, data, response) de depuração em app/api/auth/login/route.ts, que grava access_token e refresh_token no log do servidor e polui a saída do Vitest; (2) docs: sincronizar README.md e docs/project-plan.md com a task-saneamento-fase-04 — retirar das pendências da Fase 04 a dívida de lint do backend e a validação de nicknames (resolvidas), documentar a regra de nickname reservado ou com menos de 3 caracteres recebendo sufixo aleatório, registrar na seção de testes a política de lint (backend com --max-warnings 0, frontend com 0 problemas) e, em "Processo com IA", que as transcrições são sanitizadas antes do commit (regra de confidencialidade do CLAUDE.md); manter como pendência só a reauditoria do Figma; (3) .claude/skills/testing-guide-next-frontend: atualizar as instruções de E2E para a convenção next build + next start com MSW_ENABLED=true e workers: 1 (hoje descreve next dev e lista "Playwright contra production build" como anti-pattern); (4) next-frontend: estabilizar o E2E tests/studio-videos.e2e-spec.ts › 2.2 processing-row-updates-automatically, que falha por timing (o mock mantém becomes-ready-02 em processing por 2 leituras, o polling é de 3 s e o toHaveText espera 15 s), preferencialmente sem alterar o mock compartilhado com o Vitest.

## Decisions Index

_No TDs._

## Decisions Detail

_No current-scope TDs._

## Inherited Decisions Detail

### video-channel-management/TD-01

**Recommendation:** categorias são dado de plataforma com rótulo exibido em três fases; mantê-las no banco com carga via migration faz `migration:run` continuar sendo o único passo de bootstrap (regra já seguida por testes e CLAUDE.md) e evita duplicar a lista no frontend. Option B é aceitável se o time quiser o mínimo de código — a diferença real é "rótulos no servidor + FK" contra "zero infraestrutura".
**Libraries:** —

**Revisions:**
- 2026-10-18 — Lista inicial de categorias fixada para a data migration (slug → nome, nesta ordem): music → Music, gaming → Gaming, education → Education, entertainment → Entertainment, sports → Sports, news → News, technology → Technology, travel → Travel, cooking → Cooking, other → Other. Rationale: AMB-3 do plan-validate da Fase 04 — o conteúdo da lista não existia em nenhum artefato e a migration de dados depende dele.

### video-channel-management/TD-02

**Recommendation:** é a extensão natural do eixo de publicação decidido em `phase-03-upload-processing/TD-07`, preserva a visibilidade ao despublicar e fornece a coluna de ordenação/tempo que o painel e TD-06 precisam. Regra de negócio a fixar junto: publicar exige `ready` + título; editar título/descrição/categoria/visibilidade é permitido em qualquer `processing_status`.
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

**Recommendation:** reaproveita o padrão transacional "linha + job na mesma transação" de `phase-03-upload-processing/TD-11` e garante que os bytes sejam liberados sem bloquear a resposta nem espalhar um filtro `deleted_at` por todas as fases seguintes. Option B só compensa se o produto pedir lixeira.
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
**Libraries:** —

### saneamento-fase-04/TD-01

**Recommendation:** todos os problemas são `any` vindo de `res.body` e de mocks, que a Fase 04 já resolveu tipando; manter a mesma régua em produção e teste preserva o princípio de Type Safety sem dependência nova. Os 19 `unbound-method` ficam em um único spec e somem guardando os `jest.fn()` em variáveis. C é a alternativa se esse refactor de mocks se mostrar invasivo.
**Libraries:** —

**Revisions:**
- 2026-10-19 — Meta fixada em 0 problemas (os 217 erros e também os 54 warnings `no-unsafe-argument`) e o script `lint` do `package.json` ganha `--max-warnings 0` para impedir regressão; `eslint.config.mjs` continua igual. Rationale: AMB-2 do plan-validate da task (critério de pronto indefinido entre exit 0 e 0 problemas).

### saneamento-fase-04/TD-02

**Recommendation:** mantém o vínculo com o prefixo do e-mail exigido pelo project-plan, reusa `appendRandomSuffix` e reduz a correção a uma condição a mais na derivação, com a validação apoiada nas mesmas constantes do `PATCH` (`NICKNAME_PATTERN` e `RESERVED_NICKNAMES`), o que fecha a divergência entre cadastro e edição.
**Libraries:** —

### saneamento-fase-04/TD-03

**Recommendation:** o claro já coincide com `muted` e no escuro o DS usa `#3d3d3d` para `muted`/`border`/`accent`, então o valor inferido é o mais coerente com a paleta existente; fica registrado como inferência a confirmar na reauditoria do Figma (ajuste via `/decide` como Revision se o Figma divergir).
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

**Revisions:**
- 2026-10-18 — A confirmação deixa de depender de token single-use estrito: `GET /auth/confirm-email` passou a ser idempotente para tokens já usados de contas confirmadas (`saneamento-fase-02-e-infra/TD-03`), então o prefetch do cliente de e-mail não produz mais a tela "already confirmed" no clique real — o RSC renderiza `success` nas duas visitas. Rotas efetivamente entregues: `/confirm-email` e `/reset-password` (não `/confirm`), com links de e-mail gerados a partir de `FRONTEND_URL` (`saneamento-fase-02-e-infra/TD-02`). Rationale: a mitigação prevista nos Cons da Option A ("endpoint idempotente — comportamento de backend a verificar") foi formalizada e implementada pela task de saneamento; o padrão RSC-dono-do-token permanece.

### phase-02-auth/TD-01

**Recommendation:** **Argon2id** — For a greenfield project in 2026, Argon2id is the OWASP-recommended choice. The native build dependency is a one-time Docker setup cost. The project has no legacy constraints favoring bcrypt. OWASP minimum: 19MiB memory, 2 iterations.
**Libraries:** —

### phase-02-auth/TD-02

**Recommendation:** The project plan includes only email/password auth for now, but the plugin architecture costs little and future phases may add social login. Aligns with official NestJS docs, making onboarding and maintenance easier.
**Libraries:** —

### phase-02-auth/TD-03

**Recommendation:** Provides the strongest security model with automatic theft detection. The DB write overhead is acceptable for a video platform (auth refresh is infrequent vs. video operations). PostgreSQL is already in the stack, so no new infrastructure needed. Race conditions can be mitigated with a short grace period for the old token.
**Libraries:** —

### phase-02-auth/TD-04

**Recommendation:** Revocability is important: when a user requests a new password reset, previous tokens should be invalidated. The DB table is trivial to implement, and the tokens table can also serve future needs (e.g., API keys). Keeps email tokens decoupled from the JWT auth system.
**Libraries:** —

**Revisions:**
- 2026-10-18 — Para `EMAIL_CONFIRMATION`, `used_at` passa a registrar o primeiro uso e um token já usado cuja conta está confirmada responde `204` em vez de `InvalidToken` (`saneamento-fase-02-e-infra/TD-03`, implementado em `AuthService.confirm`); `PASSWORD_RESET` segue single-use estrito. Rationale: prefetchers de e-mail consumiam o token antes do clique do usuário, que via "link inválido" na primeira visita; a revogabilidade e o rastreamento por token da Option B são preservados — só a semântica de reuso do tipo de confirmação muda.

### phase-02-auth/TD-05

**Recommendation:** Best NestJS integration with minimal boilerplate. Supports SMTP (matching the architecture diagram), works with MailHog/Mailpit for local development without external dependencies, and scales to any SMTP provider in production. Template engine support (Handlebars) simplifies email formatting. No vendor lock-in.
**Libraries:** —

### phase-02-auth/TD-06

**Recommendation:** This is a backend-only project (no shared schemas with frontend), so Zod's single-source-of-truth advantage is less impactful. class-validator is the documented NestJS approach, and the project already uses decorators extensively (TypeORM entities, NestJS DI). Fewer integration surprises with NestJS 11.
**Libraries:** —

### phase-02-auth/TD-07

**Recommendation:** Provides machine-readable error codes that the Next.js frontend can switch on, without the overhead of RFC 9457's URI-based type system. The project is single-consumer (first-party frontend), so a simple `{ statusCode, error, message }` format with domain codes balances clarity and simplicity. The custom filter cost is low — two small files.
**Libraries:** —

### phase-02-auth/TD-08

**Recommendation:** Native NestJS integration is decisive: the guard system allows scoping rate limiting to `AuthModule` only via module-level `APP_GUARD`, with `@SkipThrottle()` for exemptions. The project is single-instance with no distributed requirements, so in-memory storage is sufficient. Using express-rate-limit would bypass NestJS's DI and guard lifecycle for no clear benefit.
**Libraries:** —

### phase-02-auth/TD-09

**Recommendation:** Since DB lookup is mandatory (TD-03), JWT signature adds no security value. Opaque tokens are shorter, leak no data, and are simpler to generate.
**Libraries:** —

### phase-02-auth/TD-10

**Recommendation:** The platform is a video sharing service with URL-based channel handles. A strict `[a-z0-9_]` allowlist is the simplest and most portable choice: no extra dependencies, no edge cases around hyphen positioning, and the `user_<random>` fallback provides a valid handle even for extreme email prefixes. Hyphens can always be added in a future iteration if user feedback justifies it.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-01

**Recommendation:** resolve o `host.docker.internal` com duas declarações de rede, mantém intactos todos os comandos documentados e a premissa de `openapi-typing/TD-02`, e deixa a consolidação em compose único (Option C) como candidata natural para a entrada da Fase 03, quando o número de serviços justificar a reescrita da documentação.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-02

**Recommendation:** é a única que executa TD-07 como decidido, com custo de uma variável de ambiente e sem alterar contratos já publicados no `openapi.json`.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-03

**Recommendation:** preserva TD-07 e elimina a falha mais provável do fluxo com uma mudança de poucas linhas, sem reduzir segurança porque o token de confirmação não concede sessão.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-04

**Recommendation:** as primitivas e os tokens já cobrem o visual, e a lista de estados fechada aqui é o que `/plan-build` precisa para gerar os SIs sem inventário.
**Libraries:** —

**Revisions:**
- 2026-10-18 — A lista fechada de estados ganha a tela standalone `/resend-confirmation` (`app/(auth)/resend-confirmation/page.tsx`): mesma composição `Card` + `BrandLogo` + `AuthFooter` e reuso do `ResendConfirmationForm` já entregue no SI-8, servindo de destino ao link que `login-form.tsx` exibe em `403 EMAIL_NOT_CONFIRMED`. Entregue como SI-11 (append-mode manual). Rationale: a revisão de alinhamento com a documentação (README/MBA) encontrou o link apontando para uma rota inexistente (404) desde a Fase 02; a Option A permanece — nenhuma fonte visual nova, só mais um estado derivado do padrão de `/forgot-password`.

### saneamento-fase-02-e-infra/TD-05

**Recommendation:** é o único host que sobrevive às fases seguintes e fecha a capability "Logout" da Fase 02 usando exclusivamente mecanismos já decididos (TD-06 do frontend).
**Libraries:** —

### saneamento-fase-02-e-infra/TD-06

**Recommendation:** entrega a dívida documentada sem ampliar o escopo; registrar as Options B e C como tasks futuras (`ci-backend-openapi-export` e `ci-quality-gates`) a planejar antes da Fase 03, quando o número de endpoints crescer.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-07

**Recommendation:** é o mínimo que torna o Git Flow verificável no histórico; a Option B pode ser aplicada manualmente depois do primeiro PR, quando o status check de TD-06 existir.
**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions... _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function... _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and... _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning options... _(from phase 01)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory manutencao-pos-saneamento if a UI surface is added in a future revision._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| _None._ | | | |

## Testing Requirements

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

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, static, no logic | None at component level; cover only if part of a critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test client children directly; cover rendered page via `*.e2e-spec.ts` |
| Page — async RSC | `*.e2e-spec.ts` only — Vitest cannot render it |
| Layout (`layout.tsx`) | None unless it adds logic; else via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.tsx` — RTL + `jsdom` docblock, mock `next/navigation`, MSW for fetch |
| Feature component (server, composes primitives) | Skip unit; cover via the page's E2E |
| shadcn UI primitive (`components/ui/*`) | None — trust the library; cover via consumers |
| Icon (`components/icons/*`) | None |
| `lib/` utility / boundary module with branching or shape assumptions | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts(x)` with `renderHook`, `jsdom` docblock |
| Route handler (`app/api/**/route.ts`) — proxy or with branching | `*.integration.test.ts` with MSW (+ `*.test.ts` for extracted pure logic) |
| Server action / middleware / error-loading-not-found / metadata | See guide — depends on type |
