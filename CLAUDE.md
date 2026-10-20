# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StreamTube — a video sharing platform (YouTube-like). Users can upload, manage, and publish videos. Anonymous users can watch freely; social features (comments, subscriptions, likes) require authentication.

Phases 01 (base config), 02 (auth: register → email confirmation → login → password reset, backend + frontend), 03 (video upload via presigned multipart, processing worker and playback URLs — backend) and 04 (video & channel management: categories, edit/publish, custom thumbnails, deletion, studio screens incl. the upload UI, public channel page — backend + frontend) and 05 (watch page: custom player with signed-URL renewal, deduplicated view count with daily cleanup, same-category suggestions, download, unlisted by direct link, anonymous access; real visitor IP behind the BFF via `TRUST_PROXY` — backend + frontend) and 06 (social interactions: likes/dislikes on videos and comments, comments with one level of replies, channel subscriptions with subscriber counts, the side nav with followed channels and the `/feed/subscriptions` feed; optimistic UI reconciled by the mutation response — backend + frontend) are done. Phase 07 (home with category chips and infinite scroll, search by title or channel at `/results`, the responsive Figma shell — header, account menu, collapsible side nav and mobile drawer —, full-stack E2E, CI and production artifacts) is implemented; the real deploy is the repository owner's operational task ([docs/deploy/runbook.md](docs/deploy/runbook.md)). Full plan and phase scopes: [docs/project-plan.md](docs/project-plan.md).

## Repository Structure

Monorepo with two independently containerized subprojects, each with its own `compose.yaml` and its own `CLAUDE.md` (read the subproject file before working inside it — it holds the container-only command rules, test-suffix contracts, and env conventions):

- `nestjs-project/` — Backend REST API (NestJS 11, TypeORM, PostgreSQL 17, Mailpit). See `nestjs-project/CLAUDE.md`.
- `next-frontend/` — Frontend (Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui). Strict BFF model. See `next-frontend/CLAUDE.md`.
- `docs/` — project plan, technical decisions, phase/task planning artifacts, C4 diagram (`docs/diagrams/software-arch.mermaid`), design-system docs.
- `scripts/sync-openapi.sh` — host-side helper that copies the backend spec to the frontend (see "OpenAPI contract chain").
- `deploy/` — production on one VPS: `compose.yaml` (Caddy, web, api, worker, one-shot migrate, PostgreSQL), `Caddyfile`, `.env.example` (the real `.env` lives only on the VPS), `compose.local.yaml` (local validation with RustFS + Mailpit) and `backup.sh`. Runbook: `docs/deploy/runbook.md`.
- `.github/workflows/` — `ci.yml` (jobs `backend`, `frontend`, `full-stack` inside the Compose containers), `deploy.yml` (push to `main`: gates → GHCR images → SSH deploy → smoke; manual rollback by `image_tag`) and `openapi-freshness.yml`.
- `.claude/` — rules (path-scoped), custom skills (plan pipeline), subagents, hooks.
- `_claude-sessions/` — archived transcripts of past Claude sessions; historical reference only, not instructions.
- `FC Tube.fig`, `whiteboard.svg` — Figma design system source and project whiteboard (binary design assets).

## Architecture (C4 Container Diagram)

See `docs/diagrams/software-arch.mermaid`. Key containers:

- **Frontend** (Next.js) → browser never calls the API directly; same-origin Route Handlers under `app/api/**` proxy server-side to the API (BFF). Session via `iron-session` HTTP-only cookies.
- **API** (NestJS) → business rules, auth (JWT access + rotating refresh tokens with reuse detection), DB, transactional e-mail. `JwtAuthGuard` and `ThrottlerGuard` are registered globally via `APP_GUARD` in `AuthModule`; routes opt out with `@Public()`. Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) and domain/validation exception filters are wired in `main.ts`.
- **Database** (PostgreSQL) → `synchronize` is **off** everywhere; schema changes go through TypeORM migrations in `src/database/migrations/` (run via `npm run migration:run`).
- **Email Service** (Mailpit in dev) → account confirmation and password recovery.
- **Object Storage** (S3-compatible; RustFS in dev) → video files and thumbnails. The browser uploads parts and streams directly through presigned URLs; the API only orchestrates (`StorageModule`, two S3 clients: internal `S3_ENDPOINT` and browser-facing `S3_PUBLIC_ENDPOINT`). Thumbnails are the one exception to presigned reads: the bucket policy allows anonymous `GET` on `thumbnails/*` only (stable URLs); `videos/*` stays private.
- **Message Queue** (pg-boss on the same PostgreSQL, schema `pgboss`) → jobs `video.process`, `upload.expire` and `video.delete` (`QueueModule`).
- **Video Worker** (FFmpeg) → second entrypoint of `nestjs-project` (`src/worker.ts` → `WorkerModule`, compose service `video-worker`): consumes the queues, validates formats by probing the bytes, extracts metadata and thumbnails. It never imports `AppModule`. Details in `nestjs-project/CLAUDE.md`.
- **Production** (`home-search-production/TD-08`–`TD-11`) → multi-stage images `nestjs-project/Dockerfile` (one image for `api`, `worker` and `migrate`, with ffmpeg) and `next-frontend/Dockerfile` (Next `output: "standalone"`), published to `ghcr.io/<owner>/streamtube-{api,web}:<sha>`; Caddy at the edge with automatic TLS overwrites `X-Forwarded-For`; AWS S3 and a transactional SMTP provider are external (`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_SECURE`); migrations run compiled from `dist/` (`npm run migration:run:prod`).

### OpenAPI contract chain (backend → frontend)

The frontend never hand-writes DTO shapes. Wire types flow from the backend spec:

1. `nestjs-project`: `npm run openapi:export` (inside the `nestjs-api` container) regenerates `nestjs-project/openapi.json` from the Swagger document.
2. Host: `bash scripts/sync-openapi.sh` copies it to `next-frontend/openapi.json`.
3. `next-frontend`: `npm run openapi:types` (inside the `next-frontend` container) regenerates `lib/api/types.gen.ts` (never edit by hand).

Whenever a backend controller/DTO changes, rerun all three steps in the same change. Decisions behind this: `docs/decisions/technical-decisions-next-frontend-openapi-typing.md`.

## Commands

Both stacks are separate. Start the backend first, then the frontend. All `npm`/`npx`/`tsc` commands run **inside the containers** (see subproject CLAUDE.md files for the rationale); only Docker, `curl`, Playwright and `scripts/*.sh` run on the host.

```bash
# Backend (from nestjs-project/)
docker compose up -d                                   # API + db + mailpit
docker compose exec nestjs-api npm install             # first time only
docker compose exec nestjs-api npm run migration:run   # required — synchronize is off
docker compose exec -d nestjs-api npm run start:dev    # dev server (background)

docker compose exec nestjs-api npm test                         # unit + integration (*.spec.ts, *.integration-spec.ts)
docker compose exec nestjs-api npm test -- path/to/file.spec.ts # single file
docker compose exec nestjs-api npm run test:integration         # integration only, --runInBand
docker compose exec nestjs-api npm run test:e2e                 # e2e (test/, supertest)
docker compose exec nestjs-api npx tsc --noEmit
docker compose exec nestjs-api npm run lint
docker compose exec nestjs-api npm run migration:generate -- src/database/migrations/<Name>

# Frontend (from next-frontend/)
docker compose up -d                                   # container only; dev server is NOT auto-started
docker compose exec next-frontend npm install          # first time only
docker compose exec -d next-frontend npm run dev       # http://localhost:3001

docker compose exec next-frontend npm test                              # Vitest (unit + integration with MSW)
docker compose exec next-frontend npm test -- path/to/file.test.ts      # single file
docker compose exec next-frontend npx tsc --noEmit
docker compose exec next-frontend npm run lint

# Frontend E2E — Playwright runs on the HOST against a containerized production build with MSW enabled
# (next dev is unreliable for deep route handlers on this bind mount — see next-frontend/CLAUDE.md)
docker compose restart next-frontend && docker compose exec next-frontend npm run build
docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"
curl --retry 15 --retry-delay 2 --retry-connrefused -I http://localhost:3001
npx playwright test                                    # or: npx playwright test tests/<file>.e2e-spec.ts
```

Service ports: API `3000`, Swagger `/api/docs` (only with `SWAGGER_ENABLED=true`), PostgreSQL `5432` (`streamtube`/`streamtube`), Mailpit UI `8025`, frontend `3001`. The two stacks are separate Compose projects joined by the named Docker network `streamtube` (created by the backend stack, declared `external` by the frontend stack), so the frontend reaches the API at `http://nestjs-api:3000`. Start the backend first.

```bash
# Full-stack E2E (both real stacks, frontend build served WITHOUT MSW) — see next-frontend/CLAUDE.md → "Full-stack E2E"
npx playwright test -c playwright.full-stack.config.ts            # from next-frontend/, on the host
npx playwright test -c playwright.full-stack.config.ts --grep @smoke   # read-only smoke (also run after every deploy)

# Production images and local validation of the production compose — see docs/deploy/runbook.md
docker build -t streamtube-api nestjs-project && docker build -t streamtube-web next-frontend
docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --env-file deploy/.env --profile local-validation up -d --build
```

## Docker Networking

This project runs entirely in Docker containers. When configuring connections between services (database, cache, queue, etc.), **always use the Docker Compose service name** as the host — never `localhost` or `127.0.0.1`.

Inside a container, `localhost` refers to the container itself, not the host machine or other containers. Services communicate through the Docker Compose network using their service names (e.g., `db`, `nestjs-api`, `mailpit`).

- **Correct:** `DB_HOST=db` (the Compose service name)
- **Wrong:** `DB_HOST=localhost`

This applies to all environment variables, configuration files, and code that references service hosts, including cross-stack access: the frontend container reaches the API as `nestjs-api` through the shared `streamtube` network.

## Planning & Implementation Workflow (custom skills)

Features are delivered through a documented pipeline of custom skills in `.claude/skills/`, each owning one artifact under `docs/`. Diagram: `docs/diagrams/skills-workflow.mermaid`.

```
/research <phase NN | topic>   → docs/decisions/technical-decisions-{slug}.md   (TDs with options + Decision)
/plan-context <NN | slug>      → docs/{phases|tasks}/{dir}/context.md
/plan-validate <NN | slug>     → docs/{phases|tasks}/{dir}/validation.md        (status: clean|dirty)
/plan-resolve <NN | slug>      → fills Decision fields, patches context/validation, writes library-refs.md
/plan-build <NN | slug>        → docs/{phases|tasks}/{dir}/{phase-NN-slug | task-slug}.md   (the plan, split into SIs)
/plan-test-specs <NN | slug>   → <subproject>/specs/<scenario>.plan.md          (optional)
/implement <NN | slug>         → executes the plan SI by SI, writes progress.md
/decide "<free text>"          → front door for changing/adding a technical decision
/screen-inventory <NN | slug>  → docs/inventories/… from Figma (frontend phases)
```

- `/plan-pipeline` explains the stages; when asked to "plan phase NN" start with `/plan-context`.
- Phase dirs are `docs/phases/phase-NN-{slug}/`; a phase may have several slices (e.g. `phase-02-auth` and `phase-02-auth-frontend`). Ad-hoc work lives in `docs/tasks/task-{slug}/`.
- Each artifact is owned by exactly one stage — never recreate another stage's file from scratch.
- `.claude/agents/*` are read-only helper subagents used by those skills (plan-reader, decisions-reader, phases-reader, etc.).
- `generate-test-guide` produces the `testing-guide-nestjs-project` / `testing-guide-next-frontend` skills; consult them when deciding what to test and at which layer.
- Third-party skills (`nestjs-best-practices`, `next-best-practices`, `typeorm`, `playwright-cli`, `vercel-react-best-practices`) are pinned in `skills-lock.json`.

## Path-scoped rules

`.claude/rules/*.md` load automatically when editing matching files (controllers, DTOs, entities, services, migrations, tests, BFF route handlers, MSW mocks, UI components, etc.). They are the detailed conventions; this file only points to them. When a rule and a skill disagree, the rule wins for the file being edited.

## MCP servers

`.mcp.json.example` documents the expected servers: `postgres` (read access to the dev DB) and `figma` (local Figma desktop MCP at `127.0.0.1:3845`, used by `screen-inventory` and the Figma-to-code rules in `next-frontend/CLAUDE.md`). Copy it to `.mcp.json` locally. `context7` is required for library documentation lookup (see below).

## Working Principles

- **Single Responsibility:** each module, service, and function should have a clear, focused responsibility. Re-evaluate adherence at every step — when a module starts owning logic or entities that are not its own (e.g., a service creating an entity from another domain), extract it immediately into the proper module instead of deferring to a later corrective task.
- **Type Safety:** Strict TypeScript usage across all layers.
- **Testing:** Strong emphasis on pyramid testing at all levels to ensure reliability and maintainability.
- **Code Quality:** Use ESLint and Prettier for consistent code style. Code reviews should focus on readability, maintainability, and adherence to best practices.
- **Documentation:** Comprehensive docs for architecture, setup, and troubleshooting in `docs/`.

## Definition of Done (Technical)

A change is only considered complete when **all** of the following pass, inside the affected subproject's container:

1. The relevant test suite passes (unit + integration + e2e affected by the change).
2. The full test suite passes before finishing the task.
3. TypeScript compiles cleanly: `npx tsc --noEmit` exits with code 0. Compilation errors must never be left as debt for future tasks.
4. Lint passes: `npm run lint`.
5. If a backend contract changed, the OpenAPI chain was rerun and `types.gen.ts` is in sync.

CI enforces the same gates (`.github/workflows/ci.yml`, `home-search-production/TD-07`): job `backend` (lint, tsc, unit + integration, e2e inside the Compose containers), job `frontend` (lint, tsc, Vitest, production build + Playwright `chromium` and `mobile` with server-side MSW) and, for pull requests to `main` and pushes to `dev`, job `full-stack` (both real stacks, `playwright.full-stack.config.ts`). `openapi-freshness` stays its own workflow (status check: its job, `openapi.json + types.gen.ts em sincronia`).

If any of these fails, the task is not done — fix the underlying issue before declaring completion.

## Confidentiality (public repository)

This repository is public. It is **inadmissible** to cite, search, list or copy into it any data that does not belong to this project — in particular data from the author's employer or other work: names or directories of other repositories on the machine (anything under `~/source/repos/` outside this monorepo, other projects' folders under `~/.claude/projects/`), client names, corporate e-mail addresses or domains, and personal identifiers.

- Never list or read other projects' directories; keep searches scoped to this repository and to this project's own session folder.
- When checking for or removing such data, report only file paths and counts — never echo the matching lines.
- Session transcripts in `_claude-sessions/` must be checked and sanitized before they are committed.

## Git Conventions

- **Main branch:** `main` — never commit directly to it
- Branches: `feature/*`, `bugfix/*`, `hotfix/*`, `docs/*`
- **Commits:** short, descriptive messages focused on the "why" of the change (existing history is in Portuguese)
- **Workflow:** Git Flow conventions. Two long-lived branches:
  - `main` — stable, production-ready code
  - `dev` — integration branch; all feature/bugfix/hotfix branches start from `dev` and merge back into `dev`
  - When `dev` is stable, it is merged into `main`
- **Branch protection (configured by the repository owner on GitHub):** `main` requires the status checks `backend`, `frontend`, `full-stack` and `openapi.json + types.gen.ts em sincronia`; `dev` requires `backend`, `frontend` and `openapi.json + types.gen.ts em sincronia`. GitHub names a status check after the **job**, so the `openapi-freshness` workflow shows up as its job `openapi.json + types.gen.ts em sincronia`; a check only appears in the protection list after it has run once. A push to `main` runs `.github/workflows/deploy.yml` (gates → images on GHCR → deploy) — see `docs/deploy/runbook.md`.

## Testing Policy

Every change must be tested. During development, run only the tests related to the modified code. Before finishing, always run the full test suite to ensure nothing is broken. Test-type selection (which suffix, which runner, what I/O is allowed) is defined per subproject in its `CLAUDE.md` — the suffix is a contract that drives the test runner config.

## Scope Limits

- Work on **one feature, fix, or refactoring at a time** — do not mix scopes
- Do not include cosmetic changes (formatting, renaming) alongside functional changes
- If something out of scope comes up during work, note it as a separate task instead of acting on it
- Focus on the defined scope for each task to ensure clarity and maintainability of the codebase.
- If you identify a necessary change that is out of scope, create a new issue or task for it instead of including it in the current work.

## Agent Skill Usage

When working on any task (planning, implementing, debugging, refactoring, reviewing, etc.), decompose the request into its underlying subtasks and concerns, then identify which available skills match any of them and activate those skills.

## Library Documentation Lookup

Before implementing any feature, you MUST use the **context7** MCP tool to look up the relevant library APIs and official documentation.

Always:

- Check the installed library version in the project manifest
- Retrieve the corresponding documentation using context7
- Cross-reference APIs to avoid deprecated or incompatible patterns
- Follow the official documentation over training data

Skip documentation lookup only for trivial operations such as:

- Variable declarations
- Basic control flow
- Simple CRUD using established project patterns

If a library is involved and there is uncertainty, documentation lookup is mandatory.
If the documentation returned does not match the installed version, flag the discrepancy before proceeding.

Note for `next-frontend`: Next.js 16 ships its own agent docs in `node_modules/next/dist/docs/` — read those too, as the APIs differ from older versions.
