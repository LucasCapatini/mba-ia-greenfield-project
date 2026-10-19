---
kind: task
name: task-saneamento-fase-02-e-infra
test_specs_aware: true
sources_mtime:
  docs/tasks/task-saneamento-fase-02-e-infra/context.md: "2026-10-17T10:22:25-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-18T10:01:06-04:00"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-phase-01-configuracao-base.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-10-17T09:27:46-04:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T09:27:45-04:00"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-17T09:27:45-04:00"
---

# Task — Saneamento da Fase 02 e Infraestrutura

## Objective

> Saneamento das pendências da Fase 02 (telas de confirmação de conta, reset de senha e logout) e da infraestrutura do monorepo (topologia Docker, CI de frescura do OpenAPI, Git Flow) antes da Fase 03; inclui a correção da referência whiteboard.png → whiteboard.svg no README

---

## Step Implementations

### SI-1 — Adotar o Git Flow e sanear o README

**Description:** Materializa o fluxo de branches descrito no `CLAUDE.md` (que até aqui só existia no papel) e corrige a referência quebrada do quadro branco, para que todos os SIs seguintes nasçam em `feature/*` a partir de `dev`.

**Technical actions:**

1. Criar `dev` a partir de `main` e publicar: `git branch dev main && git push -u origin dev` (per `saneamento-fase-02-e-infra/TD-07`)
2. Criar `feature/saneamento-fase-02-e-infra` a partir de `dev` e executar todos os SIs seguintes nela; o merge final acontece via PR em `dev` (per `saneamento-fase-02-e-infra/TD-07`)
3. Adicionar ao `README.md` a seção "Fluxo de branches" espelhando `CLAUDE.md` § Git Conventions — `main` estável, `dev` integração, `feature/*` / `bugfix/*` / `hotfix/*` / `docs/*` a partir de `dev`, merge por PR (per `saneamento-fase-02-e-infra/TD-07`)
4. Corrigir no `README.md` as referências `whiteboard.png` → `whiteboard.svg` (seção "Quadro Branco" e árvore "Estrutura do Projeto") (per `## Scope`, item README)

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `git branch -r` lista `origin/dev` e `git log origin/dev -1` aponta para o mesmo commit de `main` no momento da criação
- `git rev-parse --abbrev-ref HEAD` retorna `feature/saneamento-fase-02-e-infra` e `git merge-base --is-ancestor dev HEAD` sai com 0
- `README.md` contém a seção "Fluxo de branches" citando `main`, `dev` e os quatro prefixos de branch
- `grep -c 'whiteboard.png' README.md` retorna 0 e o link do quadro branco resolve para `./whiteboard.svg`, arquivo existente na raiz

---

### SI-2 — Compartilhar a rede Docker entre as stacks

**Description:** Substitui o `host.docker.internal` por resolução de nome de serviço, colocando `nestjs-api`, `db`, `mailpit` e `next-frontend` na mesma rede nomeada sem fundir os dois projetos Compose nem alterar os comandos documentados.

**Technical actions:**

1. `nestjs-project/compose.yaml`: declarar `networks: streamtube: { name: streamtube }` (criada pelo Compose, não externa) e anexar `nestjs-api`, `db` e `mailpit` a `streamtube` (per `saneamento-fase-02-e-infra/TD-01`)
2. `next-frontend/compose.yaml`: declarar `networks: streamtube: { external: true, name: streamtube }`, anexar `next-frontend` a ela e remover o bloco `extra_hosts` (per `saneamento-fase-02-e-infra/TD-01`)
3. Criar `next-frontend/.env.example` com `API_URL=http://nestjs-api:3000`, `SESSION_PASSWORD=<32+ chars>` e `MSW_ENABLED=` documentado; ajustar o `.env.local` local para o mesmo `API_URL` (per `saneamento-fase-02-e-infra/TD-01`; `next-frontend-config-base/TD-03` — `API_URL` server-only via `lib/env.ts`)
4. Atualizar `README.md` § "Como rodar" e `next-frontend/CLAUDE.md` § "Talking to the NestJS API": remover as menções a `host.docker.internal`, registrar que o backend deve subir antes do frontend (a rede externa precisa existir) (per `saneamento-fase-02-e-infra/TD-01`)

**Tests:** _(empty — Infra)_

**Dependencies:** SI-1 — trabalho na branch `feature/saneamento-fase-02-e-infra`

**Acceptance criteria:**

- Após `docker compose up -d` em `nestjs-project/` e depois em `next-frontend/`, `docker network inspect streamtube` lista os containers `nestjs-api`, `db`, `mailpit` e `next-frontend`
- `docker compose exec next-frontend sh -c 'wget -qO- http://nestjs-api:3000'` retorna `Hello World!`
- `grep -c 'host.docker.internal' next-frontend/compose.yaml next-frontend/CLAUDE.md README.md` retorna 0 em todos
- Subir `next-frontend` com a stack do backend parada falha com erro explícito de rede `streamtube` inexistente, em vez de falhar silenciosamente em runtime
- A suíte Playwright existente passa (`npx playwright test` no host) com o dev server em `MSW_ENABLED=true`, provando que o E2E não dependia do `host.docker.internal`

---

### SI-3 — Criar o workflow de CI `openapi-freshness`

**Description:** Entrega o gate de frescura do contrato OpenAPI que três documentos já citam mas nunca foi criado: um job GitHub Actions que reproduz sync → gen → diff e falha o PR quando `openapi.json` ou `types.gen.ts` do frontend estão defasados.

**Technical actions:**

1. Criar `.github/workflows/openapi-freshness.yml` com triggers `pull_request` (qualquer base) e `push` para `dev` e `main` (per `saneamento-fase-02-e-infra/TD-06`)
2. Job único `openapi-freshness` em `ubuntu-latest`: `actions/checkout@v7`; `actions/setup-node@v7` com `node-version: 22` e `cache: npm`, `cache-dependency-path` listando `nestjs-project/package-lock.json` e `next-frontend/package-lock.json` (per `saneamento-fase-02-e-infra/TD-06`)
3. Steps: `bash scripts/sync-openapi.sh`; `npm ci` e `npm run openapi:types` em `next-frontend/`; `git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` (per `next-frontend-openapi-typing/TD-03`)

**Tests:** _(empty — Infra)_

**Dependencies:** SI-1 — a branch `dev` precisa existir no remoto para o trigger de `push`

**Acceptance criteria:**

- Rodar os três steps localmente no host com os arquivos sincronizados termina com exit 0; após `echo '{}' >> next-frontend/openapi.json` o último step termina com exit 1
- Após o push da branch, `gh workflow list` exibe `openapi-freshness`
- O PR desta task exibe o check `openapi-freshness` com status verde
- O workflow não declara serviços de banco nem variáveis de ambiente do backend (escopo restrito ao gate de TD-03)

---

### SI-4 — Apontar os links de e-mail para o frontend

**Description:** Introduz `FRONTEND_URL` no backend e faz os e-mails de confirmação e de reset apontarem para as rotas do Next.js, pré-requisito para que as telas de SI-8 e SI-9 recebam o token.

**Technical actions:**

1. `src/config/app.config.ts`: adicionar `frontendUrl: process.env.FRONTEND_URL` ao namespace `app`; `src/config/env.validation.ts`: `FRONTEND_URL: Joi.string().uri().required()` (per `saneamento-fase-02-e-infra/TD-02`; convenção herdada `phase-01-configuracao-base/TD-02`, `TD-03`)
2. `.env.example` e `.env` locais: `FRONTEND_URL=http://localhost:3001` (URL que o navegador do host abre), com comentário de que `APP_URL` permanece como URL da própria API (per `saneamento-fase-02-e-infra/TD-02`)
3. `src/mail/mail.service.ts`: injetar `frontendUrl` via `appConfig.KEY`; montar `${frontendUrl}/confirm-email?token=${token}` em `sendConfirmationEmail` e `${frontendUrl}/reset-password?token=${token}` em `sendPasswordResetEmail` (per `### API Contracts` → "Link de e-mail" de `GET /auth/confirm-email` e `POST /auth/reset-password`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `MailService.sendConfirmationEmail` | Integration (Mailpit): corpo capturado contém `http://localhost:3001/confirm-email?token=` | `src/mail/mail.service.integration-spec.ts` (estender) |
| `MailService.sendPasswordResetEmail` | Integration (Mailpit): corpo capturado contém `http://localhost:3001/reset-password?token=` | `src/mail/mail.service.integration-spec.ts` (estender) |
| `envValidationSchema` | Unit: rejeita ausência de `FRONTEND_URL` e valor não-URI; aceita URI válida | `src/config/env.validation.spec.ts` (criar) |

**Dependencies:** SI-1

**Acceptance criteria:**

- `POST /auth/register` com e-mail novo gera no Mailpit uma mensagem cujo corpo contém `http://localhost:3001/confirm-email?token=` e nenhuma ocorrência de `:3000/auth/confirm-email`
- `POST /auth/forgot-password` com e-mail cadastrado gera mensagem cujo corpo contém `http://localhost:3001/reset-password?token=`
- Iniciar a API sem `FRONTEND_URL` falha no bootstrap com erro de validação Joi citando `FRONTEND_URL`
- Iniciar a API com `FRONTEND_URL=nao-e-url` falha no bootstrap pelo mesmo motivo
- `GET /auth/confirm-email` e `POST /auth/reset-password` continuam respondendo conforme o contrato (nenhuma rota do backend muda)

---

### SI-5 — Tornar a confirmação de e-mail idempotente

**Route:** GET /auth/confirm-email
**Test Specs:** see `nestjs-project/specs/auth-confirm-email.plan.md`
**Authorization:** Anonymous (`@Public()`)

**Description:** Faz um token de confirmação já consumido por um usuário confirmado responder sucesso em vez de `INVALID_TOKEN`, neutralizando o prefetch de links por clientes de e-mail sem alterar o fluxo single-use do reset de senha.

**Technical actions:**

1. `src/auth/auth.service.ts` → `confirm(token)`: buscar por `token_hash` + `type = EMAIL_CONFIRMATION` **sem** o filtro `used_at IS NULL`; ausente → `InvalidTokenException`; `used_at` preenchido e `user.is_confirmed` verdadeiro → retornar sem alterar nada; `used_at` preenchido e usuário não confirmado → `InvalidTokenException`; `expires_at < now()` e não usado → `TokenExpiredException`; caso normal → marcar `used_at`, `is_confirmed = true`, salvar (per `saneamento-fase-02-e-infra/TD-03`; `### API Contracts` → `GET /auth/confirm-email` → semântica idempotente)
2. Manter `consumeVerificationToken` intacto para `PASSWORD_RESET`; se extrair um helper de lookup compartilhado, preservar o comportamento single-use de `resetPassword` byte a byte (per `saneamento-fase-02-e-infra/TD-03`)
3. `src/auth/auth.controller.ts`: atualizar `description` do `@ApiOperation` de `confirm-email` registrando que chamadas repetidas com token já usado por conta confirmada retornam 204 (per `saneamento-fase-02-e-infra/TD-03`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `AuthService.confirm` | Unit: cinco ramos (inexistente / usado + confirmado / usado + não confirmado / expirado / normal) com repositórios mockados | `src/auth/auth.service.spec.ts` (estender) |
| `AuthService.confirm` | Integration (DB real): segunda chamada com o mesmo token não lança e não altera `used_at` nem `is_confirmed` | `src/auth/auth.service.integration-spec.ts` (estender) |
| `AuthService.resetPassword` | Integration (DB real): token de reset reutilizado continua lançando `InvalidTokenException` | `src/auth/auth.service.integration-spec.ts` (estender) |

**Dependencies:** SI-1

**Acceptance criteria:**

- `GET /auth/confirm-email?token=<válido>` retorna `204` e o usuário passa a ter `is_confirmed = true`
- Segunda chamada `GET /auth/confirm-email` com o mesmo token retorna `204` e o registro em `verification_tokens` mantém o `used_at` da primeira chamada
- `GET /auth/confirm-email?token=<inexistente>` retorna `401` com `error: "INVALID_TOKEN"`
- `GET /auth/confirm-email?token=<expirado e não usado>` retorna `401` com `error: "TOKEN_EXPIRED"`
- `POST /auth/reset-password` reutilizando um token de reset já consumido retorna `401` com `error: "INVALID_TOKEN"` (comportamento inalterado)

---

### SI-6 — Enriquecer o contrato OpenAPI e sincronizar os tipos

**Description:** Fecha a lacuna do `openapi.json` atual (DTOs serializados como `{}` e query param ausente) e percorre a cadeia export → sync → types para que o BFF de SI-7 tipe os bodies pelo contrato em vez de à mão.

**Technical actions:**

1. `src/auth/auth.controller.ts`: adicionar `@ApiQuery({ name: 'token', required: true, type: String })` em `confirm-email`; nos DTOs, `@ApiProperty` em `ConfirmEmailDto.token`, `ResetPasswordDto.token`, `ResetPasswordDto.new_password` (`minLength: 8`, `maxLength: 128`) e `ResendConfirmationDto.email` (`format: 'email'`) (per `openapi-docs-nestjs/TD-01` → Revisions 2026-05-12; `### API Contracts` backend tier)
2. `docker compose exec nestjs-api npm run openapi:export` → regenerar `nestjs-project/openapi.json` (per `openapi-docs-nestjs/TD-02`)
3. No host: `bash scripts/sync-openapi.sh` → `next-frontend/openapi.json` (per `next-frontend-openapi-typing/TD-02`)
4. `docker compose exec next-frontend npm run openapi:types` → regenerar `lib/api/types.gen.ts`; commitar os três artefatos no mesmo commit (per `next-frontend-openapi-typing/TD-03`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `exportSpec` | Integration: spec exportado declara `paths["/auth/confirm-email"].get.parameters[0].name === "token"` e `components.schemas.ResetPasswordDto.required` contém `token` e `new_password` | `src/openapi-export.integration-spec.ts` (estender) |

**Dependencies:** SI-4, SI-5 — o spec exportado deve refletir a descrição idempotente e o código final dos DTOs

**Acceptance criteria:**

- `diff -q nestjs-project/openapi.json next-frontend/openapi.json` termina com exit 0
- `next-frontend/lib/api/types.gen.ts` expõe `components["schemas"]["ResetPasswordDto"]` com as propriedades `token: string` e `new_password: string`, e `ResendConfirmationDto` com `email: string`
- No spec, `GET /auth/confirm-email` declara o parâmetro de query `token` como `required: true`
- `docker compose exec next-frontend npx tsc --noEmit` termina com exit 0 após a regeneração
- Repetir sync + `openapi:types` e rodar `git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` termina com exit 0 (gate de SI-3 verde)

---

### SI-7 — Expor os Route Handlers BFF de reset e reenvio

**Route:** POST /api/auth/reset-password; POST /api/auth/resend-confirmation
**Authorization:** Anonymous

**Description:** Cria as duas rotas same-origin que as telas de SI-8 e SI-9 chamam a partir do navegador, com proxy pass-through para o upstream e handlers MSW compartilhados entre Vitest e E2E.

**Technical actions:**

1. Criar `app/api/auth/reset-password/route.ts` — `POST`: lê o body JSON, encaminha `upstream.POST("/auth/reset-password", { body })`, repassa `204` sem body ou o `ApiErrorEnvelope` upstream com o mesmo status; não toca no cookie de sessão (per `### API Contracts` → BFF tier → `POST /api/auth/reset-password`; `phase-02-auth-frontend/TD-05`)
2. Criar `app/api/auth/resend-confirmation/route.ts` — `POST` com o mesmo padrão para `/auth/resend-confirmation` (per `### API Contracts` → BFF tier → `POST /api/auth/resend-confirmation`)
3. `lib/api/contracts.ts`: exportar os aliases `ResetPasswordDto` e `ResendConfirmationDto` derivados de `paths` (único arquivo que importa `paths`) (per `next-frontend-openapi-typing/TD-04`)
4. `mocks/handlers/auth.ts`: adicionar `http.post(\`${env.API_URL}/auth/reset-password\`)` e `http.post(\`${env.API_URL}/auth/resend-confirmation\`)` tipados por `paths`, com trigger fixtures reservadas — `token: "expired-token"` → `401 TOKEN_EXPIRED`, `token: "invalid-token"` → `401 INVALID_TOKEN`, demais → `204`; reenvio sempre `204` salvo `email` inválido → `400` — sem colidir com os triggers já existentes (per `next-frontend-msw-foundation/TD-01`, `TD-03`; `next-frontend-openapi-typing/TD-05`; `next-frontend/CLAUDE.md` § E2E architecture)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/auth/reset-password/route.ts` | Integration (Vitest + MSW): `204` pass-through; `401 INVALID_TOKEN` e `401 TOKEN_EXPIRED` pass-through com envelope intacto; `400` pass-through | `app/api/auth/reset-password/__tests__/route.integration.test.ts` |
| `app/api/auth/resend-confirmation/route.ts` | Integration (Vitest + MSW): `204` pass-through; `400` pass-through | `app/api/auth/resend-confirmation/__tests__/route.integration.test.ts` |

**Dependencies:** SI-6 — os aliases dependem de `ResetPasswordDto` e `ResendConfirmationDto` deixarem de ser `{}` em `types.gen.ts`

**Acceptance criteria:**

- `POST /api/auth/reset-password` com `{ token: "<válido>", new_password: "<8..128>" }` retorna `204` sem body
- `POST /api/auth/reset-password` com `token: "expired-token"` retorna `401` e body `{ statusCode: 401, error: "TOKEN_EXPIRED", message }`
- `POST /api/auth/resend-confirmation` com `{ email: "<válido>" }` retorna `204` sem body
- Nenhuma das duas rotas lê ou grava o cookie `streamtube_session` (resposta sem `Set-Cookie`)
- A suíte Vitest termina sem nenhuma ocorrência de `request unhandled`

---

### SI-8 — Criar a tela de confirmação de conta

**Test Specs:** see `next-frontend/specs/confirm-email.plan.md`

**Description:** Entrega o destino do link de confirmação: um RSC que consome o token no primeiro paint e renderiza sucesso, inválido ou expirado no padrão visual das telas de auth, com reenvio inline nos dois estados de falha.

**Technical actions:**

1. Criar `app/(auth)/confirm-email/page.tsx` (async RSC): ler `searchParams.token`; ausente → estado `invalid` sem chamar o upstream; presente → `upstream.GET("/auth/confirm-email", { params: { query: { token } } })` e mapear `204` → `success`, `401 INVALID_TOKEN` → `invalid`, `401 TOKEN_EXPIRED` → `expired` (per `### Error Catalog` → Mapeamento erro → estado de tela; `phase-02-auth-frontend/TD-07`; `saneamento-fase-02-e-infra/TD-03`)
2. Criar `components/auth/confirm-email-result.tsx` (server component) compondo `Card` + `BrandLogo` + `AuthFooter` no mesmo arranjo de `/forgot-password`, com variantes `success` (título, mensagem, CTA para `/login`), `invalid` e `expired` (título, mensagem, slot para o formulário de reenvio), usando apenas tokens de `app/globals.css` (per `saneamento-fase-02-e-infra/TD-04`)
3. Criar `components/auth/resend-confirmation-form.tsx` (`"use client"`): `react-hook-form` + Zod com campo `email`; submit `fetch("/api/auth/resend-confirmation", { method: "POST" })`; estado de sucesso inline substituindo o formulário; renderizado nos estados `invalid` e `expired` (per `phase-02-auth-frontend/TD-04`, `TD-05`)
4. `mocks/handlers/auth.ts`: adicionar `http.get(\`${env.API_URL}/auth/confirm-email\`)` com triggers por query `token` — `expired-token` → `401 TOKEN_EXPIRED`, `invalid-token` → `401 INVALID_TOKEN`, demais → `204` (per `next-frontend-msw-foundation/TD-03`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `resend-confirmation-form.tsx` | Unit (jsdom, RTL, `next/navigation` mock, MSW): e-mail inválido bloqueia submit; submit válido troca o formulário pelo estado de sucesso | `components/auth/__tests__/resend-confirmation-form.wiring.test.tsx` |
| `confirm-email-result.tsx` | Unit (jsdom): as três variantes renderizam título, mensagem e CTA/slot corretos por role e nome acessível | `components/auth/__tests__/confirm-email-result.test.tsx` |
| `/confirm-email` | E2E (Playwright, MSW server-side): `?token=ok` → sucesso com link para `/login`; `?token=expired-token` → expirado com formulário de reenvio; sem token → inválido | `tests/confirm-email.e2e-spec.ts` |

**Dependencies:** SI-7 — rota de reenvio; SI-5 — semântica idempotente no backend real; SI-4 — links do e-mail apontam para esta rota

**Acceptance criteria:**

- `/confirm-email?token=<válido>` renderiza no primeiro paint a mensagem de conta confirmada e um link para `/login`, sem estado de carregamento intermediário
- `/confirm-email?token=expired-token` renderiza o estado expirado com o formulário de reenvio visível
- Submeter o reenvio com e-mail válido exibe a confirmação inline no lugar do formulário
- `/confirm-email` sem `token` renderiza o estado inválido e nenhuma requisição ao upstream é feita
- A página não emite `Set-Cookie` nem altera a sessão existente
- Abrir o link do e-mail duas vezes (simulando prefetch) resulta em sucesso nas duas visitas

---

### SI-9 — Criar a tela de redefinição de senha

**Test Specs:** see `next-frontend/specs/reset-password.plan.md`

**Description:** Entrega o destino do link de reset: um RSC que extrai o token da URL e um formulário cliente que define a nova senha via BFF, reutilizando as primitivas de força e visibilidade de senha do signup.

**Technical actions:**

1. Criar `app/(auth)/reset-password/page.tsx` (RSC): ler `searchParams.token`; ausente → estado `error` com mensagem e link para `/forgot-password`, sem formulário; presente → renderizar `ResetPasswordForm` com `token` como prop (per `saneamento-fase-02-e-infra/TD-04`; `phase-02-auth-frontend/TD-07` — RSC dono do token, Client form dono do input)
2. Criar `components/auth/reset-password-form.tsx` (`"use client"`): campos `new_password` e confirmação, reutilizando `PasswordStrengthMeter` e `PasswordVisibilityToggle`; Zod `min(8).max(128)` + igualdade das senhas; submit `fetch("/api/auth/reset-password", { method: "POST", body: { token, new_password } })`; estados `form` / `success` (CTA para `/login`) / `error` (per `saneamento-fase-02-e-infra/TD-04`; `phase-02-auth-frontend/TD-04`, `TD-05`; `### API Contracts` → BFF tier → `POST /api/auth/reset-password`)
3. `lib/auth/error-mapping.ts`: adicionar `mapResetPasswordErrorToForm` — `401` (`INVALID_TOKEN` ou `TOKEN_EXPIRED`) → `root.serverError` com mensagem de link inválido ou expirado e link para `/forgot-password`; `400` → `root.serverError` com a `message` do envelope (per `### Error Catalog` → Mapeamento erro → estado de tela)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `reset-password-form.tsx` | Unit (jsdom, RTL, `next/navigation` mock, MSW): senha curta e senhas divergentes bloqueiam submit; `204` → estado sucesso; `401` → erro root com link; `400` → erro root com mensagem | `components/auth/__tests__/reset-password-form.wiring.test.tsx` |
| `mapResetPasswordErrorToForm` | Unit: mapeamento por `statusCode` e `error` | `lib/auth/__tests__/error-mapping.test.ts` (estender) |
| `/reset-password` | E2E (Playwright, MSW server-side): fluxo feliz → sucesso com link para `/login`; `?token=expired-token` → erro com link para `/forgot-password`; sem token → erro sem formulário | `tests/reset-password.e2e-spec.ts` |

**Dependencies:** SI-7 — rota BFF de reset; SI-4 — links do e-mail apontam para esta rota

**Acceptance criteria:**

- `/reset-password?token=<válido>` renderiza o formulário com os campos de nova senha e confirmação
- Submeter senha com 7 caracteres mantém a página no formulário e exibe mensagem inline no campo
- Submeter senhas divergentes mantém a página no formulário e exibe mensagem inline na confirmação
- Submeter `new_password` válida exibe o estado de sucesso com link para `/login`
- Com `token=expired-token`, o submit exibe mensagem de link inválido ou expirado contendo link para `/forgot-password`
- `/reset-password` sem `token` não renderiza o formulário e exibe link para `/forgot-password`

---

### SI-10 — Adicionar o header session-aware com logout

**Test Specs:** see `next-frontend/specs/logout.plan.md`

**Description:** Dá à capability "Logout" da Fase 02 uma superfície de UI que sobrevive às fases seguintes: um header mínimo nas rotas de aplicação que lê a sessão já entregue pelo `SessionProvider` e chama a rota BFF de logout existente, substituindo a home boilerplate por um placeholder.

**Technical actions:**

1. Criar o grupo de rotas `app/(app)/layout.tsx` renderizando `<AppHeader />` + `{children}`; mover `app/page.tsx` para `app/(app)/page.tsx` trocando o boilerplate do `create-next-app` por um placeholder mínimo (`BrandLogo` + uma frase) com tokens de `app/globals.css` (per `saneamento-fase-02-e-infra/TD-05`)
2. Criar `components/layout/app-header.tsx` (`"use client"`): consome `useSession()` do `SessionProvider`; anônimo → links `Entrar` (`/login`) e `Criar conta` (`/signup`); logado → e-mail ou `channelSlug` + botão `Sair` (per `saneamento-fase-02-e-infra/TD-05`; `phase-02-auth-frontend/TD-06` — sessão servida pelo RSC e hidratada pelo Provider)
3. Botão `Sair`: `fetch("/api/auth/logout", { method: "POST" })` com `disabled` durante a requisição; após a resposta, `router.push("/")` + `router.refresh()` para o RSC re-renderizar sem sessão (per `### API Contracts` → BFF tier → `POST /api/auth/logout`; `phase-02-auth-frontend/TD-02`, `TD-06`)
4. Garantir que o grupo `(auth)` continua sem header (layout próprio ou ausência de `AppHeader`) e que `login-form.tsx` redireciona para `/` após sucesso, de modo que o header logado seja a primeira tela pós-login (per `saneamento-fase-02-e-infra/TD-05`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app-header.tsx` | Unit (jsdom, RTL, `next/navigation` mock, `SessionProvider` com `initialSession`): variante anônima vs logada; clique em `Sair` dispara `POST /api/auth/logout` (MSW) e chama `router.refresh` | `components/layout/__tests__/app-header.test.tsx` |
| `/` + logout | E2E (Playwright, MSW server-side): login em `/login` → `/` mostra e-mail e `Sair` → clicar `Sair` → header volta a `Entrar` / `Criar conta` e o cookie `streamtube_session` deixa de existir | `tests/logout.e2e-spec.ts` |

**Dependencies:** SI-1

**Acceptance criteria:**

- `/` anônima renderiza o header com os links `Entrar` e `Criar conta` e nenhum botão `Sair`
- Após login válido, `/` renderiza o header com o e-mail do usuário e o botão `Sair`
- Clicar em `Sair` leva à home anônima e a resposta do navegador não contém mais o cookie `streamtube_session`
- `/login`, `/signup` e `/forgot-password` não renderizam o header
- A home não contém mais textos ou links do template `create-next-app` (`next.svg`, "Templates", "Learning")

---

## Technical Specifications

### API Contracts

_Backend tier — endpoints já existentes em `nestjs-project` cujo contrato ou semântica esta task toca (TDs Cross-layer). Shapes derivados do código fonte dos DTOs/controllers; o `openapi.json` atual serializa `ResetPasswordDto` e `ResendConfirmationDto` como `{}` e omite o query param de `GET /auth/confirm-email`, lacuna fechada em SI-6 (enriquecimento com `@ApiQuery`/`@ApiProperty` + cadeia openapi:export → sync → openapi:types)._

#### GET /auth/confirm-email (SI-5)

**Request query parameters:**
- token: string, required — token bruto recebido no link do e-mail (`ConfirmEmailDto.token`, `@IsString() @IsNotEmpty()`)

**Response 204:** No content. **Semântica idempotente** *(per saneamento-fase-02-e-infra/TD-03)*: token encontrado e ainda não usado → marca `used_at`, seta `user.is_confirmed = true`, 204; token encontrado, já usado e `user.is_confirmed` verdadeiro → 204 sem alteração (prefetch de link por cliente de e-mail deixa de consumir o token).

**Error responses:**
- 401 INVALID_TOKEN: token inexistente (hash não encontrado para o tipo `EMAIL_CONFIRMATION`), ou já usado sem que o usuário esteja confirmado
- 401 TOKEN_EXPIRED: token encontrado, não usado, com `expires_at` no passado
- 400 validation error: `token` ausente ou vazio

**Link de e-mail** *(per saneamento-fase-02-e-infra/TD-02)*: `${FRONTEND_URL}/confirm-email?token=<raw token>`, montado em `MailService.sendConfirmationEmail` a partir da nova variável `FRONTEND_URL` (namespace `app`, Joi `uri` obrigatória, documentada em `.env.example`). `APP_URL` permanece para usos próprios da API.

**Consumidor:** RSC `app/(auth)/confirm-email/page.tsx` lê `searchParams.token` e chama este endpoint server-side via `upstream` no primeiro paint *(per phase-02-auth-frontend/TD-07)*. Não há Route Handler BFF para a confirmação.

---

#### POST /auth/reset-password (SI-6)

_Contrato inalterado; esta task só enriquece a documentação OpenAPI do DTO para que o BFF tipe o body._

**Request headers:**
- Content-Type: application/json

**Request body:**
- token: string, required — token bruto do link de e-mail (`ResetPasswordDto.token`, `@IsString() @IsNotEmpty()`)
- new_password: string, required — min 8, max 128 characters (`ResetPasswordDto.new_password`)

**Response 204:** No content. Efeito colateral upstream: senha re-hasheada (Argon2id) e todos os refresh tokens do usuário revogados (`logout(userId)`).

**Error responses:**
- 401 INVALID_TOKEN: token inexistente ou já usado (tipo `PASSWORD_RESET`; consumo single-use mantido, sem idempotência)
- 401 TOKEN_EXPIRED: token expirado
- 400 validation error: `token` ausente/vazio ou `new_password` fora de 8..128

**Link de e-mail** *(per saneamento-fase-02-e-infra/TD-02)*: `${FRONTEND_URL}/reset-password?token=<raw token>`, montado em `MailService.sendPasswordResetEmail`.

---

#### POST /auth/resend-confirmation (SI-6)

_Contrato inalterado; enriquecimento OpenAPI do DTO em SI-6._

**Request headers:**
- Content-Type: application/json

**Request body:**
- email: string, required — valid email format (`ResendConfirmationDto.email`)

**Response 204:** No content (enviado, ou silenciosamente ignorado se o e-mail não existe ou já está confirmado).

**Error responses:**
- 400 validation error: `email` ausente ou inválido

---

#### POST /auth/logout (SI-10)

_Contrato inalterado; passa a ter consumidor de UI._

**Request headers:**
- Authorization: Bearer <access_token>

**Response 204:** No content. Revoga (`revoked_at`) todos os refresh tokens ativos do usuário.

**Error responses:**
- 401: access token ausente ou inválido (`JwtAuthGuard` global)

---

> _BFF tier — frontend-exposed contract. The browser calls the FE-facing route; the route proxies the upstream per the project's documented BFF architecture (`next-frontend/CLAUDE.md` § "Talking to the NestJS API"). Emitido por decisão das TDs Cross-layer saneamento-fase-02-e-infra/TD-04 e TD-05 (inventário de telas deferido; sem join de UI)._

#### POST /api/auth/reset-password (SI-7)

**forwards-to:** `POST /auth/reset-password` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `ResetPasswordDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication; requer SI-6 para o alias deixar de ser `{}` em `types.gen.ts`)*

**Response 204 (FE-facing):** No content — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 401 INVALID_TOKEN: pass-through do `ApiErrorEnvelope` *(derived: project contract source)*
- 401 TOKEN_EXPIRED: pass-through *(derived: project contract source)*
- 400 validation error: pass-through *(derived: project contract source)*

---

#### POST /api/auth/resend-confirmation (SI-7)

**forwards-to:** `POST /auth/resend-confirmation` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `ResendConfirmationDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 204 (FE-facing):** No content — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 validation error: pass-through *(derived: project contract source)*

---

#### POST /api/auth/logout (SI-10)

_Route Handler já existente (`app/api/auth/logout/route.ts`); ganha o consumidor `AppHeader`._

**forwards-to:** `POST /auth/logout` com `Authorization: Bearer <session.accessToken>` *(derived: project contract source)*

**Request headers:** nenhum obrigatório — a credencial vem do cookie `streamtube_session` *(per phase-02-auth-frontend/TD-02)*

**Request body:** none

**Response 204 (FE-facing):** No content *(per phase-02-auth-frontend/TD-02 — single cookie, `session.destroy()`)*

**Set-Cookie / session side-effect:** destrói o cookie iron-session `streamtube_session` incondicionalmente, mesmo quando o upstream falha *(per phase-02-auth-frontend/TD-02)*. O consumidor chama `router.push("/")` + `router.refresh()` após o 204 *(per phase-02-auth-frontend/TD-06; saneamento-fase-02-e-infra/TD-05)*

**Error responses (FE-facing):** nenhum — erros do upstream são engolidos; o logout é idempotente localmente *(per phase-02-auth-frontend/TD-02)*

### Authorization Matrix

| Endpoint / Surface | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| GET /auth/confirm-email | ✓ (`@Public()`) | ✓ | ✓ |
| POST /auth/reset-password | ✓ (`@Public()`) | ✓ | ✓ |
| POST /auth/resend-confirmation | ✓ (`@Public()`) | ✓ | ✓ |
| POST /auth/logout | ✗ (401 sem Bearer) | ✓ | ✓ |
| POST /api/auth/reset-password (BFF) | ✓ | ✓ | ✓ |
| POST /api/auth/resend-confirmation (BFF) | ✓ | ✓ | ✓ |
| POST /api/auth/logout (BFF) | ✓ (no-op: destrói cookie inexistente, 204) | ✓ | ✓ |
| `/confirm-email` (página RSC) | ✓ | ✓ | ✓ |
| `/reset-password` (página RSC + form) | ✓ | ✓ | ✓ |
| `AppHeader` → botão "Sair" | ✗ (renderiza "Entrar" / "Criar conta") | ✓ (renderiza e-mail/nickname + "Sair") | ✓ |

_Não há papel "Owner" distinto de "Authenticated" nesta task — os tokens de confirmação e reset identificam o usuário por si; o logout atua sobre a sessão do próprio chamador._

### Error Catalog

_Envelope herdado: `{ statusCode, error, message }` (`ApiErrorEnvelope`, per phase-02-auth/TD-07), produzido por `DomainExceptionFilter` / `ValidationExceptionFilter`. Nenhum código novo é introduzido; TD-03 altera apenas o gatilho de `INVALID_TOKEN` na confirmação._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| INVALID_TOKEN | 401 | `GET /auth/confirm-email`: token inexistente para `EMAIL_CONFIRMATION`, ou já usado com `user.is_confirmed` falso. `POST /auth/reset-password`: token inexistente ou já usado para `PASSWORD_RESET` |
| TOKEN_EXPIRED | 401 | Token encontrado e não usado, com `expires_at < now()` (confirmação ou reset) |
| validation error | 400 | `token` ausente/vazio; `new_password` fora de 8..128; `email` inválido no reenvio |
| (sem código — `JwtAuthGuard`) | 401 | `POST /auth/logout` sem `Authorization: Bearer` válido — engolido pelo BFF |

#### Mapeamento erro → estado de tela *(per saneamento-fase-02-e-infra/TD-04)*

| Tela | Resposta upstream | Estado renderizado |
|------|-------------------|--------------------|
| `/confirm-email` (RSC) | 204 (inclui o caso idempotente de TD-03) | `success` — mensagem de conta confirmada + CTA para `/login` |
| `/confirm-email` (RSC) | 401 INVALID_TOKEN | `invalid` — mensagem + formulário de reenvio (`POST /api/auth/resend-confirmation`) |
| `/confirm-email` (RSC) | 401 TOKEN_EXPIRED | `expired` — mensagem + formulário de reenvio |
| `/confirm-email` (RSC) | `token` ausente na URL | `invalid` — sem chamada ao upstream |
| `/reset-password` (Client form) | 204 | `success` — mensagem + CTA para `/login` |
| `/reset-password` (Client form) | 401 INVALID_TOKEN / TOKEN_EXPIRED | `error` — `root.serverError` com link para `/forgot-password` (token inválido ou expirado) |
| `/reset-password` (Client form) | 400 validation error | `error` — `root.serverError` com a `message` do envelope |
| `/reset-password` (RSC) | `token` ausente na URL | `error` — sem formulário; link para `/forgot-password` |

---

### SI-11 — Criar a página `/resend-confirmation`

_Appended 2026-10-18 (append-mode manual, após a revisão de alinhamento com a documentação — ver `progress.md`). Fonte: `saneamento-fase-02-e-infra/TD-04` — Revisions._

**Test Specs:** see `next-frontend/specs/resend-confirmation.plan.md`

**Description:** Fecha o 404 do link "Reenviar e-mail de confirmação" que `components/auth/login-form.tsx` exibe no `403 EMAIL_NOT_CONFIRMED` desde a Fase 02: uma página standalone no padrão visual das telas de auth que reutiliza o `ResendConfirmationForm` entregue no SI-8.

**Technical actions:**

1. Criar `app/(auth)/resend-confirmation/page.tsx` (RSC) compondo `Card` + `BrandLogo` + `h1` + `ResendConfirmationForm` + `AuthFooter` (pergunta "Already confirmed?", link "Sign in" → `/login`), apenas com tokens de `app/globals.css` (per `saneamento-fase-02-e-infra/TD-04` — Revisions; `phase-02-auth-frontend/TD-05`)
2. Não criar formulário, handler MSW nem rota BFF novos — `POST /api/auth/resend-confirmation` (SI-7) e o handler `POST /auth/resend-confirmation` (SI-8) já cobrem a página (per `### API Contracts` → BFF tier)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `/resend-confirmation` | E2E (Playwright, MSW server-side): página renderiza e o reenvio com e-mail válido exibe o sucesso inline; `badrequest@example.com` mantém o formulário com erro de campo | `tests/resend-confirmation.e2e-spec.ts` |

_(O `ResendConfirmationForm` já é coberto por `components/auth/__tests__/resend-confirmation-form.wiring.test.tsx` — SI-8.)_

**Dependencies:** SI-8 — reutiliza `ResendConfirmationForm` e o handler MSW de reenvio; SI-7 — rota BFF de reenvio

**Acceptance criteria:**

- `/resend-confirmation` renderiza o título, o campo "Email address" e o botão "Resend confirmation link" no mesmo arranjo visual de `/forgot-password`
- Submeter um e-mail válido exibe a confirmação inline no lugar do formulário, com link para `/login`, sem criar sessão
- Submeter `badrequest@example.com` mantém o formulário com o erro no campo e sem estado de sucesso
- O link exibido pelo login em `403 EMAIL_NOT_CONFIRMED` resolve para esta página (sem 404)

---

## Dependency Map

SI-1 (root — Git Flow + README)
├── SI-2 — depends on SI-1 (rede Docker nasce na branch de feature)
├── SI-3 — depends on SI-1 (workflow dispara em push para `dev`, que precisa existir)
├── SI-4 — depends on SI-1 (FRONTEND_URL + links de e-mail)
├── SI-5 — depends on SI-1 (confirm idempotente)
├── SI-10 — depends on SI-1 (header com logout; só usa rotas BFF já existentes)
└── SI-6 — depends on SI-4, SI-5 (spec exportado reflete DTOs e descrição finais)
    └── SI-7 — depends on SI-6 (aliases tipados de `ResetPasswordDto` / `ResendConfirmationDto`)
        ├── SI-8 — depends on SI-7, SI-5, SI-4 (reenvio via BFF; backend idempotente; link do e-mail)
        │   └── SI-11 — depends on SI-8 (página standalone reutilizando `ResendConfirmationForm`; appended 2026-10-18)
        └── SI-9 — depends on SI-7, SI-4 (reset via BFF; link do e-mail)

---

## Deliverables

- [ ] SI-1 — Adotar o Git Flow e sanear o README
- [ ] SI-2 — Compartilhar a rede Docker entre as stacks
- [ ] SI-3 — Criar o workflow de CI `openapi-freshness`
- [ ] SI-4 — Apontar os links de e-mail para o frontend
- [ ] SI-5 — Tornar a confirmação de e-mail idempotente
- [ ] SI-6 — Enriquecer o contrato OpenAPI e sincronizar os tipos
- [ ] SI-7 — Expor os Route Handlers BFF de reset e reenvio
- [ ] SI-8 — Criar a tela de confirmação de conta
- [ ] SI-9 — Criar a tela de redefinição de senha
- [ ] SI-10 — Adicionar o header session-aware com logout
- [ ] SI-11 — Criar a página `/resend-confirmation` _(appended 2026-10-18)_

**Full test suites** _(comandos conforme `nestjs-project/CLAUDE.md` e `next-frontend/CLAUDE.md` — tudo dentro dos containers, exceto Docker, Playwright e `scripts/*.sh`)_:

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type-check passes (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type-check passes (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev" && npx playwright test` — Playwright no host)
- [ ] OpenAPI chain in sync (`diff -q nestjs-project/openapi.json next-frontend/openapi.json` exit 0 e `git diff --exit-code -- next-frontend/lib/api/types.gen.ts` exit 0 após `npm run openapi:types`)
