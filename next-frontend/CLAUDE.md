<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Environment Startup Verification

**Default behavior:** starting the environment means starting **only the `next-frontend` container** — **never** start the Next.js dev server unless the user explicitly asks to run/serve the project (e.g., "rode o projeto", "suba o servidor", "run the app").

After starting the container, always confirm it is up before proceeding:

```bash
docker compose ps   # next-frontend must show status "running"
```

The base image's command is `tail -f /dev/null`, so the container stays alive **without** booting Next. The dev server is only started on demand via `docker compose exec`.

If the dev server has been started, verify it actually serves before claiming success:

```bash
curl -I http://localhost:3001   # expect HTTP/1.1 200 OK
```

Only start `npm run dev` when the user **explicitly** asks to run the application — never as part of "start the environment".

## Development Environment

This project runs inside Docker. Always use the container for development:

```bash
# Start container (from next-frontend/)
docker compose up -d

# Install dependencies — after the first `up` and whenever package.json / package-lock.json change
# (node_modules lives in a named Docker volume, not on the bind mount; it starts empty)
docker compose exec next-frontend npm install

# Run the dev server (watch mode) — see "Long-running Processes" below
docker compose exec next-frontend npm run dev
```

Service:
- `next-frontend` — Next.js dev container, host port `3001` → container port `3000`. Browser accesses the app at **`http://localhost:3001`**.

Bind mount: the repo's `next-frontend/` directory is mounted at `/home/node/app` inside the container, so file edits on the host are reflected immediately. Two named volumes overlay it — `node_modules` (`next-frontend_node_modules`) and `.next` (`next-frontend_next_cache`) — so dependencies and the Turbopack cache never touch the slow 9p bind mount (`require("jsdom")` went from ~100 s to under 1 s, which is what lets Vitest run in parallel). Consequences: the host's `next-frontend/node_modules` is **not** what the container uses; `.next` is no longer visible on the host; `docker compose down -v` drops both volumes and the next `up` needs `npm install` again.

Teardown and inspection commands run on the **host machine**:

```bash
# Verify the dev server is responding (after it has been started)
curl -I http://localhost:3001

# Check container logs
docker compose logs next-frontend

# Tear down
docker compose down
```

## Commands

**Strict rule:** every `npm`, `npx`, `node`, `tsc`, and shadcn command runs **inside the container**, never on the host. Running on the host uses a different Node version, bypasses the container's working directory, and can leave artifacts owned by the wrong user on the bind mount. **Single documented exception:** Playwright runs on the host and needs a host-side `node_modules` — see "E2E test prerequisites" for the `npm ci` rule.

### Container-only commands (always prefix with `docker compose exec next-frontend`)

```bash
npm run dev                              # Dev server with hot-reload (run in background)
npm run build                            # Production build (.next/)
npm run start                            # Serve the production build
npm run lint                             # ESLint (eslint-config-next)

npm test                                 # Vitest — unit + integration (run mode)
npm run test:watch                       # Vitest watch mode (run in background)

npx tsc --noEmit                         # Type-check (required before declaring a task done)
npx shadcn@latest add <component>        # Add a shadcn primitive — respects components.json
```

### Host-only commands (Docker / connectivity probes)

```bash
docker compose ps
docker compose logs next-frontend
curl -I http://localhost:3001
```

**E2E tests run on the host (not inside any container).** Run them with `npx playwright test`:

```bash
# Run all E2E tests
npx playwright test

# Run a specific test file
npx playwright test tests/auth-login.e2e-spec.ts

# Open the HTML report after a run
npx playwright show-report
```

**Windows note (applies to every `npx playwright …` in this file):** the host install has no `playwright.cmd` shim, so `npx playwright` fails with "command not found". Invoke the CLI through Node instead — `node node_modules/@playwright/test/cli.js test [tests/<file>.e2e-spec.ts]` (and `… cli.js show-report`). Chromium must be installed on the host once (`node node_modules/@playwright/test/cli.js install chromium`).


## Long-running Processes

Commands that never exit (dev server, watch modes) must be run **in background** in the Bash tool — otherwise the agent blocks indefinitely waiting for the process to return.

This applies to: `npm run dev`, `npm run start`, `npm run test:watch`, and any other persistent process. After starting the dev server in background, validate with `curl -I http://localhost:3001`.

## Architecture

Next.js 16 App Router with React 19 Server Components by default. Routes, layouts, and pages live under `app/`.

- **Server Components** (default): can `fetch` from the NestJS API directly server-side. Prefer this for data loading — keeps payloads small and avoids client-side waterfalls.
- **Client Components** (`"use client"`): only when the component uses `useState`/`useEffect`/refs/browser APIs or interactive event handlers. Keep client boundaries as deep in the tree as possible.
**Data strategy (per `video-channel-management/TD-12`):** reads happen in RSC through `upstream` (with the session token when there is one); mutations go through `app/api/**` Route Handlers and, on success, the Client Component calls `router.refresh()` so the RSC re-reads. Client-side polling exists **only** for video processing — `hooks/use-processing-poll.ts` (`useProcessingPoll(ids)`) hits `/api/videos/{publicId}` every 3 s while an id is outside `ready|failed` and refreshes the route when one settles. No TanStack Query / SWR / client cache in this phase (re-evaluate in Phase 06); filters and pagination live in `searchParams`. No `cacheComponents`: `fetch` is uncached by default in Next 16 and pages that read `cookies()` are dynamic, so `router.refresh()` always re-runs the RSC.

**Studio guard:** `proxy.ts` (Next 16 Proxy, ex-middleware; matcher `/studio/:path*`) does the optimistic session check and redirects anonymous requests to `/login?returnTo=<path+query>` — layouts do not receive the pathname. The login page passes `returnTo` (sanitized by `lib/auth/return-to.ts` → same-site paths only, otherwise `/`) to `LoginForm`, which lands there after a successful login. `app/(app)/studio/layout.tsx` re-checks the session as defense in depth and mounts `<UploadProvider>` (`components/upload/upload-provider.tsx`, per `TD-11`), which keeps upload state alive across `/studio/**` navigation and warns on `beforeunload` only while an upload is in flight.

**Browser upload client (per `video-channel-management/TD-11`; `phase-03-upload-processing/TD-03`):** `lib/upload/multipart-uploader.ts` (`startUpload` / `resumeUpload` → `{ done, progress, cancel }`) slices the file by `part_size`, asks `POST /api/videos/{id}/upload/parts` for URLs in batches of ≤ 100, `PUT`s up to 4 parts at a time, retries each part 3× with exponential backoff (a 403 re-signs the pending batch first), skips `uploaded_parts` on resume and finishes with `POST …/upload/complete`; `cancel()` aborts the in-flight `PUT`s and calls `DELETE …/upload`. **The part `PUT`s are the one explicit exception to the strict BFF**: they go straight from the browser to the presigned `S3_PUBLIC_ENDPOINT` URLs — every API call still goes through `/api/**`. Components read the state via `useUpload(publicId)` from `components/upload/upload-provider.tsx`.

### Talking to the NestJS API

This project follows a **strict BFF model**: the browser never talks to the NestJS API directly. All client traffic flows through same-origin Route Handlers under `app/api/**`, which then proxy to the upstream NestJS API server-side. This eliminates CORS, keeps the backend URL out of the client bundle, and gives a single integration surface for MSW-based BFF tests.

- **From the browser (Client Components):** fetch from same-origin Route Handlers only (e.g., `fetch("/api/videos")`). Direct calls to the NestJS API from the browser are forbidden.
- **From the server (Route Handlers, RSC, Server Actions):** read the upstream URL from `env.API_URL` (see `lib/env.ts`) and fetch from there. The Route Handler is the only layer that knows the backend address.

#### OpenAPI contract — single source of truth for wire shapes

The upstream API publishes an OpenAPI 3.x spec. **Every wire shape in `next-frontend/` — Route Handler requests/responses, MSW fixtures, BFF↔component types — is derived from that spec via generated types.** No DTO is hand-duplicated on the frontend; if a shape isn't in `paths`, it doesn't exist.

Contract chain: `openapi.json` (committed local copy) → `lib/api/types.gen.ts` (generated, do not edit) → `paths` (typed surface) → consumers (BFF + components + MSW).

CI guard: `.github/workflows/openapi-freshness.yml` blocks merging stale spec/types pairs.

Source of decisions: `docs/decisions/technical-decisions-next-frontend-openapi-typing.md` (TD-01…TD-05).

**Env var convention — single key, server-only:**

- `API_URL` — the upstream NestJS base URL. **Server-only**: validated and exposed via `lib/env.ts` (`@t3-oss/env-nextjs` + Zod 4). Accessing `env.API_URL` from a Client Component throws at runtime. There is **no** client-exposed (`NEXT_PUBLIC_*`) variant for the backend URL, and there must not be one — introducing a public backend URL would defeat the BFF model.
- `lib/env.ts` is the **source of truth** for environment variable reads in `next-frontend/`.
- See `.env.example` for the canonical key set and `lib/env.ts` for the `createEnv({ server, client, shared, ... })` schema. Current keys: `API_URL` (upstream base URL, server-only), `SESSION_PASSWORD` (iron-session cookie secret, ≥ 32 chars, server-only) and the optional `MSW_ENABLED=true` (process env read by `instrumentation.ts` — only set it for the E2E server (`next start`), never in `.env.local` for normal use). Bootstrap with `cp .env.example .env.local`.

The two Compose stacks stay separate projects but share the named Docker network `streamtube`, created by `nestjs-project/compose.yaml` (fixed subnet `172.30.0.0/24`) and declared `external` in `next-frontend/compose.yaml`, where this container gets the **fixed IP `172.30.0.10`** — the only address the API trusts for `X-Forwarded-For` (`TRUST_PROXY`, `watch-page/TD-03`; see `nestjs-project/CLAUDE.md` → "IP real do visitante atrás do BFF"). Changing the subnet requires recreating the network (`docker compose down` here and in the backend, then backend `up` first). `API_URL` is therefore always `http://nestjs-api:3000` (the Compose service name — see `.env.example`). **Start the backend stack before the frontend**: without the network, `docker compose up` in `next-frontend/` fails with "network streamtube declared as external, but could not be found". Never point the upstream at the host machine's gateway alias or at `localhost` — only the Compose service name resolves across the shared network.

**Visitor IP and optional session (Phase 05, `watch-page/TD-03`).** Every browser request reaches the API through this container, so public calls carry the visitor's identity explicitly:

- `lib/api/client-headers.ts` → `clientHeaders()` reads `x-forwarded-for` (first IP only) and `user-agent` from `headers()` and returns `{ "X-Forwarded-For"?, "User-Agent"? }`; a missing header is omitted.
- `lib/api/bff.ts` → `withOptionalSession(call)` for public Route Handlers: no session → anonymous upstream call; session → `Bearer` + single-flight refresh (like `withSession`); refresh failed (session destroyed) or token still refused → the call is repeated anonymously and the public response is returned. Always merges `clientHeaders()`.
- `lib/api/public-read.ts` → `publicRead(call)` for RSC reads: session `Bearer` when there is one + `clientHeaders()`; upstream `401` → repeated anonymously (a RSC cannot write the cookie, so there is no refresh). Returns the typed `openapi-fetch` result.
- **Verified on `next start` (2026-10-20):** when the request has no `X-Forwarded-For`, Next fills it with the socket address in IPv4-mapped form — from the host through the published port it is the Docker gateway (`::ffff:172.30.0.1`), from another container on `streamtube` its own address (`::ffff:172.30.0.7`). In local dev every host browser therefore shares one IP; that is expected.
- **Limitation:** Next keeps an `X-Forwarded-For` sent by the client (`??=`), so with nothing in front of `next start` a browser can claim any IP, and the API trusts it because it trusts this container (`TRUST_PROXY`). Any deployment must put a reverse proxy in front of the frontend that **overwrites** `X-Forwarded-For` with the real client address.

Media streaming will eventually come from Object Storage (S3/MinIO) — TBD.

Refer to the C4 container diagram at `docs/diagrams/software-arch.mermaid` for the full system view.

## Testing

Stack decisions for this project:

- **Vitest** for unit and integration tests of pages, components, hooks, utils, and BFF route handlers.
- **Playwright** for end-to-end tests (full browser flow).
- **MSW (`msw` + `msw/node`)** as the fake API for BFF tests: route handlers are tested **as functions** — they are imported and called directly, while `msw/node` intercepts the `fetch` calls they make to the NestJS API and returns fixtures. BFF tests **never** point to the real NestJS API.
- **MSW (`msw/node` via `instrumentation.ts`)** as the fake API for E2E tests: the E2E server (production build) boots server-side MSW so the **real** `/api/**` Route Handlers run; only their upstream NestJS `fetch` is faked, reusing the `mocks/` handler set (no browser-level/BFF handler set). See "E2E architecture" below.

## Test type selection — apply mechanically

The suffix is a contract. It drives the runner (Vitest vs. Playwright), where the file lives, and what is allowed inside it.

| Suffix | When | Runner | External I/O | Location |
|---|---|---|---|---|
| `*.test.ts` / `*.test.tsx` | **Unit** — pure logic, collaborators mocked (utils, hooks, a single component in isolation). | Vitest | Forbidden. | `__tests__/` next to the artifact. |
| `*.integration.test.ts` / `*.integration.test.tsx` | **Integration** — multiple artifacts wired together; route handlers called as functions with `msw/node` intercepting `fetch` to the upstream API. | Vitest | MSW only (no real network). | `__tests__/` next to the artifact. |
| `*.e2e-spec.ts` | **End-to-end** — full browser flow; real `/api/**` run server-side, upstream faked (see "E2E architecture"). | Playwright | server-side MSW via instrumentation — no real network. | `tests/` at root. |

Routing decision tree (apply in order; first match wins):

- Renders a component or invokes a hook/util in isolation with mocks for collaborators → **`*.test.ts`** (or `.tsx` if rendering JSX).
- Imports a route handler (`import { GET } from "@/app/api/.../route"`), builds a `Request`/`NextRequest`, calls the handler, and asserts on its `Response`, with MSW intercepting fetches to the upstream API → **`*.integration.test.ts`**.
- Drives the full app in a real browser (navigation, forms, assertions on rendered DOM) → **`*.e2e-spec.ts`** under `tests/`.

### Running tests during development

Run only what is relevant to the change in progress:

```bash
# Vitest (single file or pattern) — inside the container
docker compose exec next-frontend npm test -- path/to/file.test.ts

# Playwright (single spec) — on the HOST
npx playwright test tests/foo.e2e-spec.ts
```

### E2E test prerequisites — start the environment before running Playwright

Playwright runs on the **host** and targets the **containerized** app served by a **production build** (`next build` + `next start`) with `MSW_ENABLED=true`. The dev server is not used for E2E: on the Windows/Docker Desktop bind mount, `next dev` (16.2.6, Turbopack and webpack) intermittently fails to serve deep route handlers — `/api/videos/{publicId}/upload*` answered 404 depending on the `.next` state, while `next build` serves every route deterministically. Follow these steps in order:

```bash
# 1. Ensure the container is up and no dev server is running (a restart stops it)
docker compose up -d
docker compose restart next-frontend

# 2. Build — rerun after every app/, components/, lib/ or mocks/ change you want the suite to see
docker compose exec next-frontend npm run build

# 3. Serve the build with MSW enabled — runs in background (never exits)
docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"

# 4. Wait until the server is ready (retries up to ~30 s)
curl --retry 15 --retry-delay 2 --retry-connrefused -I http://localhost:3001

# 5. Run the E2E suite on the host (Windows: node node_modules/@playwright/test/cli.js test)
npx playwright test

# Or a single spec
npx playwright test tests/auth-login.e2e-spec.ts
```

**Important rules:**
- Step 3 must use `MSW_ENABLED=true` — without it `instrumentation.ts` skips MSW and upstream calls will fail or hit the real NestJS API (`instrumentation.ts` runs in `next start` too).
- Never add `webServer` to `playwright.config.ts` — Playwright must not manage the server process (it runs inside Docker, not on the host). `workers: 1`: the server-side MSW store is one in-memory state per server and the login handler resets it, so spec files must not run in parallel.
- If a production server built from the current code is already running, skip steps 1–4. Never run `npm run build` while `next dev` is running: both write to `.next`.
- **Playwright uses the host's `node_modules`**, not the container's volume — the container's `npm install` never refreshes it. This is the only sanctioned host-side install: when `@playwright/test` changes in `package.json`, run `npm ci` once on the host (and `node node_modules/@playwright/test/cli.js install chromium` if the Playwright version changed). Vitest, `tsc` and lint still run only inside the container.
- **`next dev` on this bind mount (manual development only).** Turbopack's watcher misses newly created `app/**` folders (404 until restart) and sometimes stale `mocks/` handler edits; deep route handlers can also 404 intermittently (see above). Restart with `docker compose restart next-frontend` — do not try to kill the old `next dev` from inside the container.
- The `node:22-slim` image has no `ps`/`pkill`/`wget`. To inspect processes use `/proc` (`ls /proc | grep -E '^[0-9]+$'` + `cat /proc/<pid>/cmdline`); for HTTP probes from inside the container use `node -e "fetch('http://localhost:3000').then(r=>console.log(r.status))"`. Restarting the container is the reliable way to stop a dev server.

### MSW + Vitest — wired

Vitest roda em `environment: "node"` (default) e carrega `mocks/setup.ts` via `setupFiles`; MSW sobe com `onUnhandledRequest: "error"` — qualquer `fetch` não interceptado falha o teste com `"request unhandled"`. Layout de `mocks/` (handlers por domínio + barrel, factories, server).

### E2E architecture

Real browser → real Next.js (RSC, layouts, real `/api/**` Route Handlers server-side) → upstream NestJS **faked at the server**. Only the NestJS API is fake; real `iron-session` cookies are set, so auth/session flows are genuinely testable.

**Mechanism.**

1. `instrumentation.ts` `register()` — when `NEXT_RUNTIME === "nodejs"` **and** `MSW_ENABLED=true`, dynamically imports `mocks/server.ts`, calls `server.listen({ onUnhandledRequest: "bypass" })`, then stores the MSW-intercepted fetch as `globalThis.__mswFetch` and logs `[msw] server-side mocking enabled (upstream NestJS is faked)`.
2. `lib/api/upstream.ts` resolves `fetch` **at call time** — `fetch: (input) => (globalThis.__mswFetch ?? globalThis.fetch)(input)`. Next.js patches `globalThis.fetch` after `register()` runs, so any module that captures `fetch` at load time (or lets `openapi-fetch` default to it) silently bypasses MSW and hits the real API (`ECONNREFUSED` in E2E). Never capture `fetch` at module evaluation in server code; in production `__mswFetch` is `undefined` and the native fetch is used.
3. Reuses the `mocks/` upstream handlers (same set as Vitest) for both Route Handlers and RSC pages (e.g. `/confirm-email` calls `upstream.GET` during render); no browser-level handler set, no `tests/handlers/`.
4. Per-scenario outcomes via **reserved trigger fixtures** in the shared handlers (`mocks/handlers/auth.ts`): e-mails `conflict@example.com` → 409, `badrequest@example.com` → 400; tokens `expired-token` → 401 `TOKEN_EXPIRED`, `invalid-token` → 401 `INVALID_TOKEN`, `badrequest-token` → 400 `VALIDATION_ERROR`; anything else → success. No per-test `server.use()`. Keep the trigger table small.
   - **Studio/canal (Fase 04)** — `mocks/handlers/{videos,channels,categories}.ts` leem um store mutável (`mocks/store.ts`, seed em `mocks/factories/videos.ts`) que o handler de `POST /auth/login` reseta (e `mocks/setup.ts` reseta após cada teste do Vitest). Seed: canal `studio_canal` + 22 vídeos (`ready-draft-01` "Aula pronta", `published-01`, `becomes-ready-02` — `processing` nas 2 primeiras leituras de `GET /videos/{id}` e `ready` depois —, `failed-01`, `processing-01`, "Aula 2", "aula 3" e 15 "Video NN" publicados); `PATCH`/`publish`/`unpublish`/`DELETE`/thumbnail atualizam o store.
   - Triggers de vídeo: `notfound-id` → 404 `VIDEO_NOT_FOUND`; `forbidden-id` → 403 `VIDEO_FORBIDDEN`; `processing-id` → sempre `processing` (fora da listagem); `other-channel-01` → 404 na leitura e 403 na mutação. `POST /videos` sempre cria `new-upload-id` (`part_size` 5 MiB, URLs de parte em `http://localhost:9000`, `processing` por 2 leituras após o `complete`).
   - **Watch page (Fase 05)** — toda `VideoResponse` traz `channel` com o canal atual do store. Leitura pública como no backend: com `Bearer` (qualquer token = dono do store) lê qualquer status; anônimo só `published` (rascunho → 404). `published-01` é `music`, com descrição de 5 linhas; `published-v01..v03` também são `music` (os demais alternam `education`/`gaming`). `GET /videos/{id}/related` devolve `{ items }` (`limit` 1..24, padrão 12; fora disso 400 `VALIDATION_ERROR`) só com `published` + `public` + `ready` fora da listagem oculta, mesma categoria primeiro e mais recentes depois. `POST /videos/{id}/views` responde 204 e soma 1 a `view_count` por `publicId` + `X-Forwarded-For` anônimo em vídeo publicado (com `Bearer` não conta).
   - Triggers da watch page: `unlisted-01` → publicado `unlisted` (`music`), abre por link e nunca aparece nas sugestões; `storage-down-id` → publicado cujo `GET /videos/{id}/playback` responde 503 `STORAGE_UNAVAILABLE`. Ambos ficam fora do painel e da página do canal.
   - Triggers de canal: `PATCH /channels/me` com nickname `taken_nick` → 409 `NICKNAME_TAKEN` (o nickname antigo passa a 404); `tech_mastery` é o canal público fixo (24 vídeos, página de 20); qualquer outro nickname → 404 `CHANNEL_NOT_FOUND`.
   - Bytes do storage (`PUT` de partes, imagens de thumbnail em `http://localhost:9000/**`) não passam pelo BFF: o spec os atende com `page.route("http://localhost:9000/**")` — nunca `/api/**`.
5. Playwright runs on the **host** (`npx playwright test`, `http://localhost:3001`); the containerized `next start` (production build) must run with `MSW_ENABLED=true`. No `webServer` in `playwright.config.ts` (the server is containerized); `workers: 1` because the MSW store is shared.

**Hard rules.**

- E2E specs **MUST NOT** browser-intercept `/api/**` (`page.route()` or any browser-level mock) — it short-circuits the Route Handlers.
- E2E specs **MUST NOT** reach a real NestJS API — upstream is always the server-side `mocks/` MSW.
- Upstream handlers are **shared** with Vitest — no E2E-only fork; per-scenario deviation is a reserved trigger fixture branch, not a runtime override. Trigger values must not collide with Vitest fixture values.
- `onUnhandledRequest`: `"error"` in Vitest, **`"bypass"`** in instrumentation — never copy `"error"` into `instrumentation.ts`.

## Stack Summary

Next.js App Router with React Server Components, TypeScript strict, React 19, Tailwind CSS v4 (CSS-first config via `@theme inline` in `app/globals.css` — there is NO `tailwind.config.js`), shadcn/ui (style `radix-nova`, baseColor `neutral`, `cssVariables: true`) on top of `radix-ui` primitives, `class-variance-authority` (`cva`) with extended `tailwind-merge`, custom SVG icon components in `components/icons/` (no external icon library), `Inter` + `Geist_Mono` fonts loaded via `next/font/google` in `app/layout.tsx`. Exact versions in `package.json`.

## Project Structure & Path Aliases

```
next-frontend/
├── app/                              # Next.js App Router (routes, layouts, pages)
│   ├── globals.css                   # Tokens + @theme inline + base layer
│   ├── layout.tsx                    # Root layout (fonts, SessionProvider hydrated from the iron-session cookie)
│   ├── (auth)/                       # Anonymous screens, no app chrome: login, signup, forgot-password,
│   │                                 #   confirm-email (RSC consumes the token), reset-password, resend-confirmation
│   ├── (app)/                        # Application routes — layout.tsx renders <AppHeader /> (session-aware, logout)
│   │   └── page.tsx                  # Home placeholder
│   ├── api/auth/<route>/route.ts     # BFF Route Handlers: signup, login, logout, forgot-password, reset-password, resend-confirmation
│   │   └── __tests__/                # Route handler integration tests — same layout under api/videos/** and api/channel (*.integration.test.ts)
│   ├── api/videos/**                 # BFF de vídeo (Fase 04): POST /api/videos; [publicId]: GET (polling), PATCH (encadeia publish → { video, published }), DELETE,
│   │                                 #   publish, unpublish, thumbnail (PUT multipart / DELETE), upload (GET/DELETE), upload/parts, upload/complete;
│   │                                 #   públicas com sessão opcional (Fase 05, withOptionalSession): playback (GET — o player renova as URLs) e views (POST)
│   └── api/channel/route.ts          # PATCH → /channels/me; reescreve session.channelSlug quando o nickname muda
├── components/
│   ├── ui/                           # shadcn primitives — ONLY add via shadcn CLI
│   ├── icons/                        # Custom SVG icon components
│   ├── auth/                         # Auth forms/cards (react-hook-form + Zod) + session-provider
│   ├── layout/app-header.tsx         # Minimal session-aware header (Entrar / Criar conta / Sair)
│   └── <feature>/__tests__/          # Component unit/integration tests (*.test.ts | *.integration.test.ts)
├── hooks/                            # Client hooks (use-session) + __tests__/
├── lib/
│   ├── api/                          # upstream.ts (typed openapi-fetch client), contracts.ts (aliases), types.gen.ts (generated),
│   │                                 #   bff.ts (withSession: Bearer da sessão + refresh single-flight + pass-through do upstream)
│   ├── auth/                         # Session helpers + error mapping (upstream envelope → form errors)
│   ├── env.ts                        # Validated server env (API_URL, SESSION_PASSWORD)
│   ├── utils.ts                      # `cn(...)` helper (clsx + extended tailwind-merge)
│   └── __tests__/                    # Utils tests (*.test.ts)
├── mocks/                            # MSW handlers + factories + store + server (msw/node) — loaded by Vitest setupFiles AND instrumentation.ts
├── specs/                            # *.plan.md test specs emitted by /plan-test-specs (one per E2E file in tests/)
├── tests/                            # Playwright e2e (*.e2e-spec.ts) — real /api/** run; upstream NestJS faked server-side
├── instrumentation.ts                # Boots server-side MSW when MSW_ENABLED=true (E2E only)
├── proxy.ts                          # Next 16 Proxy — optimistic session check for /studio/** (redirect with returnTo)
├── openapi.json                      # Committed copy of the backend spec (refreshed by scripts/sync-openapi.sh)
├── .env.example                      # Canonical env keys (copy to .env.local)
└── components.json                   # shadcn config (do not edit by hand)
```

Path aliases live in `tsconfig.json` and `components.json` — `@/components`, `@/components/ui`, `@/components/icons`, `@/lib`, `@/lib/utils`, `@/hooks`.

## Design Tokens — Source of Truth

All design tokens live in **`app/globals.css`**, organized in three regions: `:root { … }` (light mode semantic + theme values), `@theme inline { … }` (Tailwind v4 token mapping exposing them as utility classes), and `@media (prefers-color-scheme: dark) :root { … }` (dark mode overrides).

## Static Assets & Images

- Static assets that ship with the app go in `public/` and are referenced as `/file.svg` (or via `<Image src="/file.svg" … />` from `next/image` when raster).

## Build Gates

Before declaring any task done in this subproject:

- `docker compose exec next-frontend npm run lint` exit 0.
- `docker compose exec next-frontend npx tsc --noEmit` exit 0.

## When in Doubt

- Compare against `components/ui/button.tsx` (canonical primitive) and `app/globals.css` (canonical token registry).
- If a Figma value has no matching token, ADD the token to `app/globals.css` first, then consume it — do not inline a hex/px value.
- If the design implies a missing shadcn primitive, install it via `npx shadcn@latest add <name>` rather than hand-rolling it.

# Figma MCP Integration Rules — next-frontend

These rules tell AI coding agents how to translate Figma designs into code for this project. They MUST be followed for every Figma-driven change.

## Figma Assets

- The Figma MCP server serves images and SVGs from a localhost endpoint embedded in the design payload.
- IMPORTANT: If the Figma MCP server returns a `localhost` source for an image or SVG, use that source directly.
- IMPORTANT: DO NOT install new icon packages — icons are custom SVG components under `@/components/icons/` (see the Icons section). Convert Figma SVG payloads into components there.
- IMPORTANT: DO NOT invent or insert placeholder images when a `localhost` source is provided.

## Required Figma-to-Code Flow

Follow this order for EVERY Figma-driven change. Do not skip steps.

1. **`get_design_context`** for the exact node(s). Primary input — returns React + Tailwind code, screenshots, and context hints.
2. If the response is too large or truncated, call **`get_metadata`** for a high-level node map, then re-fetch only the required node(s) with `get_design_context`.
3. **`get_screenshot`** for the node variant you are implementing. You MUST have both `get_design_context` and `get_screenshot` before writing code.
4. Download / inline any assets referenced in the payload (use the localhost sources).
5. **Translate**, do not transcribe. The MCP output is a REFERENCE — convert it to this project's conventions:
   - Replace raw hex colors with semantic tokens (`bg-primary`, `text-foreground`, …) or palette tokens.
   - Replace arbitrary spacing (`p-[17px]`) with the project's spacing scale.
   - Replace ad-hoc text classes (`text-base font-medium`) with the project's typography utilities (`text-label-md`, etc.).
   - Replace inline radii with `rounded-[var(--radius-*)]` tokens.
   - Swap absolute-positioned layouts for flex/grid where the design intent is a flow layout.
   - Reuse `@/components/ui/*` primitives (Button, etc.) instead of re-implementing them.
   - Server Components by default; add `"use client"` ONLY when the component uses state, effects, refs, or browser APIs.
6. **Validate** the rendered output against the Figma screenshot — pixel-level visual parity AND interactive states (hover, focus-visible, disabled, dark mode).
