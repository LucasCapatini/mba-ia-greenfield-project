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
- `db` — PostgreSQL 17, port `5432`, database `streamtube`, user/password `streamtube`
- `mailpit` — SMTP sink for dev: SMTP on `1025` (used by the API as `MAIL_HOST=mailpit`), web UI on `http://localhost:8025`
- `node_modules` volume — named volume `nestjs-project_node_modules` mounted over `/home/node/app/node_modules`, so dependencies never touch the slow 9p bind mount (type-check went from minutes to seconds). The host's `nestjs-project/node_modules` is **not** what the container uses; `docker compose down -v` deletes the volume and the next `up` needs `npm install` again.

All three services are attached to the named Docker network `streamtube`, declared in `compose.yaml` and consumed as `external` by `next-frontend/compose.yaml`. **This stack must be started before the frontend stack** — the network only exists once `docker compose up -d` has run here.

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
npm run openapi:export                   # Regenerate openapi.json from the Swagger document (then sync to the frontend — see root CLAUDE.md)

npx tsc --noEmit                         # Type-check (required before declaring a task done)
npm run lint                             # ESLint with auto-fix
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

This applies to: `start:dev`, `start:prod`, `test:watch`, and any other persistent process.

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
- `testTimeout: 30000` (in both configs) — DB-backed suites boot a Nest module and run migrations in `beforeAll`; on the Docker Desktop bind mount a cold boot exceeds Jest's default 5 s hook timeout and fails spuriously.
- `--forceExit` on the `test` and `test:e2e` scripts (`package.json`) — Jest otherwise hangs after a green run ("Jest did not exit one second after the test run has completed") because DB-backed suites leave handles open. The flag is a symptom fix so the scripts return to the prompt; the root-cause fix (`--detectOpenHandles` to find the leaking suites and close their connections) is a separate hygiene task. `test:integration`, `test:watch` and `test:cov` do not carry the flag.

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
- **ESLint:** `no-explicit-any` allowed; `no-floating-promises` and `no-unsafe-argument` are warnings

## REST Conventions

This is a RESTful API. All endpoints must follow standard REST conventions — correct HTTP methods, proper status codes, plural resource nouns, and consistent URL structure. Details are enforced via rules on controller files.
