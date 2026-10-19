---
kind: task
name: task-saneamento-fase-04
test_specs_aware: true
sources_mtime:
  docs/tasks/task-saneamento-fase-04/context.md: "2026-10-19T20:33:45Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T20:33:01Z"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T13:27:46Z"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-03-upload-processing.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T20:16:01Z"
  docs/phases/phase-04-video-channel-management/context.md: "2026-10-19T20:16:01Z"
---

# Task — Saneamento da Fase 04

## Objective

Saneamento das pendências da Fase 04 antes da Fase 05: zerar a dívida de lint do nestjs-project (specs/integration/e2e das Fases 02/03; meta de 0 erros e 0 warnings, travada com --max-warnings 0 no script lint), corrigir a derivação de nickname no cadastro (reservados e < 3 caracteres), corrigir o token --progress-track no tema escuro, remover o comentário obsoleto e os casts dos BFFs de auth (os casts para o shape do upstream e o parse do corpo, que passa a usar readJson/invalidBody de lib/api/bff.ts, com JSON inválido respondendo 400 VALIDATION_ERROR) e eliminar os 2 warnings de React Compiler (react-hook-form watch) no next-frontend

---

## Step Implementations

### SI-1 — Zerar o lint dos specs de auth e canais (backend)

**Description:** Corrige os problemas de lint de `auth.service.spec.ts` (45 erros / 32 warnings, inclusive os 19 `unbound-method`), `auth.service.integration-spec.ts` (7 / 1) e `channels.service.spec.ts` (15 / 5) tipando os valores `any` e reestruturando os mocks, sem mudar `eslint.config.mjs` (per `saneamento-fase-04/TD-01`).

**Technical actions:**

1. `nestjs-project/src/auth/auth.service.spec.ts` — guardar cada `jest.fn()` dos repositórios/serviços mockados em variáveis tipadas (`jest.Mock` / `jest.mocked(...)`) e usá-las nas asserções `expect(...).toHaveBeenCalled…` no lugar de `expect(repo.save)`, eliminando os 19 `unbound-method`; tipar os retornos e argumentos `any` que geram `no-unsafe-*` (per `saneamento-fase-04/TD-01`).
2. `nestjs-project/src/auth/auth.service.integration-spec.ts` — tipar os valores `any` (`no-unsafe-*`), remover `async` das arrow functions sem `await` (`require-await`, linhas 70 e 591) e a variável `userId` não usada (linha 233).
3. `nestjs-project/src/channels/channels.service.spec.ts` — tipar os mocks e valores `any` (`no-unsafe-*`), no mesmo padrão da ação 1.
4. Conferir com `npx eslint` (sem `--fix`) nos três arquivos: 0 erros e 0 warnings; nenhuma asserção removida ou enfraquecida.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `AuthService` | Unit (regressão — mesmas asserções, agora tipadas) | `nestjs-project/src/auth/auth.service.spec.ts` |
| `AuthService` | Integration (regressão — banco real) | `nestjs-project/src/auth/auth.service.integration-spec.ts` |
| `ChannelsService` | Unit (regressão) | `nestjs-project/src/channels/channels.service.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `npx eslint src/auth/auth.service.spec.ts src/auth/auth.service.integration-spec.ts src/channels/channels.service.spec.ts` reporta 0 erros e 0 warnings.
- Os três arquivos executam o mesmo número de testes de antes da mudança, todos passando.
- `eslint.config.mjs` permanece inalterado.

---

### SI-2 — Zerar o lint dos demais specs e helpers de teste em `src/` (backend)

**Description:** Corrige os problemas de lint restantes sob `src/`: `mail.service.integration-spec.ts` (16 / 2), `domain-exception.filter.spec.ts` (7), `validation-exception.filter.spec.ts` (2), `env.validation.integration-spec.ts` (2) e o helper `src/test/create-test-data-source.ts` (1 `no-unsafe-function-type`), sem mudar `eslint.config.mjs` (per `saneamento-fase-04/TD-01`).

**Technical actions:**

1. `nestjs-project/src/mail/mail.service.integration-spec.ts` — tipar a resposta da API do Mailpit e os valores derivados dela (`no-unsafe-*`).
2. `nestjs-project/src/common/filters/domain-exception.filter.spec.ts` e `validation-exception.filter.spec.ts` — tipar o corpo de resposta capturado do mock de `Response` (`no-unsafe-*`).
3. `nestjs-project/src/config/env.validation.integration-spec.ts` — tipar os valores `any` apontados (`no-unsafe-*`).
4. `nestjs-project/src/test/create-test-data-source.ts` — trocar o tipo `Function` por uma assinatura explícita (`no-unsafe-function-type`).
5. Conferir com `npx eslint` (sem `--fix`) nos cinco arquivos: 0 erros e 0 warnings.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `MailService` | Integration (regressão — Mailpit real) | `nestjs-project/src/mail/mail.service.integration-spec.ts` |
| `DomainExceptionFilter` | Unit (regressão) | `nestjs-project/src/common/filters/domain-exception.filter.spec.ts` |
| `ValidationExceptionFilter` | Unit (regressão) | `nestjs-project/src/common/filters/validation-exception.filter.spec.ts` |
| Schema de env (Joi) | Integration (regressão) | `nestjs-project/src/config/env.validation.integration-spec.ts` |
| `createTestDataSource` | Integration (regressão — consumido por todas as suítes de integração) | `nestjs-project/src/database/migrations.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `npx eslint` nos cinco arquivos desta SI reporta 0 erros e 0 warnings.
- As suítes de integração que usam `createTestDataSource` continuam subindo o banco e passando.
- `eslint.config.mjs` permanece inalterado.

---

### SI-3 — Zerar o lint dos e2e do backend

**Description:** Corrige os problemas de lint dos e2e das Fases 02/03 — `test/auth.e2e-spec.ts` (47), `test/videos-upload-flow.e2e-spec.ts` (25 / 3), `test/videos-playback.e2e-spec.ts` (21 / 8), `test/videos-create.e2e-spec.ts` (21 / 2) e `test/videos-upload.e2e-spec.ts` (8 / 1) — tipando `res.body` do supertest no padrão já usado pelos e2e da Fase 04 (`res.body as XBody` em helpers por arquivo), sem mudar `eslint.config.mjs` (per `saneamento-fase-04/TD-01`).

**Technical actions:**

1. `nestjs-project/test/auth.e2e-spec.ts` — declarar os shapes de corpo usados (tokens, usuário, envelope de erro) e acessar `res.body` só através deles; remover `async` das arrow functions sem `await` (linhas 67 e 519).
2. `nestjs-project/test/videos-upload-flow.e2e-spec.ts` e `test/videos-upload.e2e-spec.ts` — tipar `res.body` (sessão de upload, partes, vídeo) e os valores `any` passados adiante (`no-unsafe-argument`, `no-unsafe-call`).
3. `nestjs-project/test/videos-playback.e2e-spec.ts` — tipar `res.body` (vídeo, playback) e as chamadas sobre valores `any` (`no-unsafe-call`, linhas 232, 255 e 256).
4. `nestjs-project/test/videos-create.e2e-spec.ts` — tipar `res.body` (vídeo criado, envelope de erro).
5. Conferir com `npx eslint` (sem `--fix`) nos cinco arquivos: 0 erros e 0 warnings.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Fluxos de auth | E2E (regressão — supertest) | `nestjs-project/test/auth.e2e-spec.ts` |
| Upload multipart completo | E2E (regressão) | `nestjs-project/test/videos-upload-flow.e2e-spec.ts` |
| Sessão de upload | E2E (regressão) | `nestjs-project/test/videos-upload.e2e-spec.ts` |
| Playback | E2E (regressão) | `nestjs-project/test/videos-playback.e2e-spec.ts` |
| Pré-cadastro de vídeo | E2E (regressão) | `nestjs-project/test/videos-create.e2e-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `npx eslint` nos cinco arquivos desta SI reporta 0 erros e 0 warnings.
- `npm run test:e2e` executa o mesmo número de testes de antes da mudança, todos passando.
- `eslint.config.mjs` permanece inalterado.

---

### SI-4 — Travar o lint do backend em 0 problemas

**Description:** Fecha a meta de 0 erros e 0 warnings no projeto inteiro e impede regressão acrescentando `--max-warnings 0` ao script `lint` (per `saneamento-fase-04/TD-01`, Revision 2026-10-19).

**Technical actions:**

1. `nestjs-project/package.json` — script `lint` passa a `eslint "{src,apps,libs,test}/**/*.ts" --fix --max-warnings 0` (`eslint.config.mjs` inalterado) (per `saneamento-fase-04/TD-01`).
2. Rodar `npx eslint "{src,apps,libs,test}/**/*.ts"` (sem `--fix`) e confirmar 0 problemas no projeto inteiro, inclusive em arquivos não listados nas SIs 1–3; corrigir qualquer remanescente no mesmo padrão.
3. `nestjs-project/CLAUDE.md` — atualizar a nota de ESLint (hoje: "`no-floating-promises` and `no-unsafe-argument` are warnings") para registrar que o script `lint` falha com qualquer warning (`--max-warnings 0`).

**Tests:** _(empty — Infra; o gate é o próprio `npm run lint`)_

**Dependencies:** SI-1, SI-2, SI-3 — o gate só fecha depois que os três grupos de arquivos estão limpos.

**Acceptance criteria:**

- `npm run lint` no `nestjs-project` termina com código 0 e reporta 0 erros e 0 warnings.
- Um warning introduzido em qualquer arquivo de `src/` ou `test/` faz `npm run lint` terminar com código diferente de 0.
- `nestjs-project/CLAUDE.md` descreve a política de 0 warnings.

---

### SI-5 — Derivar nickname válido no cadastro para prefixos reservados ou curtos

**Description:** Faz a geração automática do nickname no cadastro obedecer ao mesmo contrato do `PATCH /channels/me` — `NICKNAME_PATTERN` (`^[a-z0-9_]{3,50}$`) e `RESERVED_NICKNAMES` —, acrescentando o sufixo aleatório de colisão quando o prefixo sanitizado é reservado ou tem menos de 3 caracteres (per `saneamento-fase-04/TD-02`; estende `phase-02-auth/TD-10` e respeita `video-channel-management/TD-08`).

**Technical actions:**

1. `nestjs-project/src/channels/nickname.util.ts` — exportar uma checagem de nickname utilizável (`length >= 3` e fora de `RESERVED_NICKNAMES`, importados de `channels.constants.ts` — fonte única com o DTO do `PATCH`) e mantê-la separada de `sanitizeNickname`, que segue aplicando a allowlist `[a-z0-9_]` e o fallback `user_<random>` de `phase-02-auth/TD-10` (per `saneamento-fase-04/TD-02`).
2. `nestjs-project/src/channels/channels.service.ts` — em `createChannel`, quando o prefixo sanitizado não for utilizável, o primeiro candidato já é `appendRandomSuffix(baseNickname)` (ex.: `admin` → `admin_3fa`, `me` → `me_3fa`, `ab` → `ab_3fa`); o laço de colisão existente continua gerando novos sufixos a partir do mesmo prefixo. O `name` do canal continua sendo o prefixo sanitizado.
3. Cobrir a regra nos testes listados abaixo (unit da util e do serviço, integração com banco e e2e do cadastro).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `nickname.util` | Unit: reservado, curto (1 e 2 caracteres), exatamente 3 caracteres, prefixo comum | `nestjs-project/src/channels/nickname.util.spec.ts` |
| `ChannelsService.createChannel` | Unit: branch prefixo inutilizável → primeiro candidato com sufixo (mock repo) | `nestjs-project/src/channels/channels.service.spec.ts` |
| `ChannelsService.createChannel` | Integration: canal persistido com nickname válido e único para `admin`, `me` e `ab`; colisão entre dois cadastros `admin@` | `nestjs-project/src/channels/channels.service.integration-spec.ts` |
| `POST /auth/register` | E2E: cadastro `me@…` gera canal acessível por `GET /channels/{nickname}` | `nestjs-project/test/auth.e2e-spec.ts` |

**Dependencies:** SI-1 — `channels.service.spec.ts` já sai limpo de lint; SI-3 — `test/auth.e2e-spec.ts` já sai limpo de lint (as duas SIs editam os mesmos arquivos de teste).

**Acceptance criteria:**

- `POST /auth/register` com `admin@example.com` cria um canal cujo nickname casa `^admin_[0-9a-f]{3}$`.
- `POST /auth/register` com `me@example.com` cria um canal cujo nickname casa `^me_[0-9a-f]{3}$`, e `GET /channels/{nickname}` desse canal retorna `200`.
- `POST /auth/register` com `ab@example.com` cria um canal cujo nickname casa `^ab_[0-9a-f]{3}$`.
- `POST /auth/register` com `john@example.com` (prefixo válido e livre) continua criando o canal com nickname `john`.
- Todo nickname gerado no cadastro casa `^[a-z0-9_]{3,50}$` e não pertence a `RESERVED_NICKNAMES`.

---

### SI-6 — Token `--progress-track` no tema escuro (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### saneamento-fase-04/TD-03 — Token `--progress-track` no tema escuro`

**Description:** Corrige o valor escuro do token e o expõe como utility do Tailwind v4, para que o primitivo `Progress` possa adotá-lo (per `saneamento-fase-04/TD-03`).

**Technical actions:**

1. `next-frontend/app/globals.css` — no bloco `@media (prefers-color-scheme: dark) :root`, `--progress-track: #3d3d3d` (no lugar de `#ffffff`); o valor claro `#e3e3e3` não muda (per `saneamento-fase-04/TD-03`).
2. `next-frontend/app/globals.css` — expor `--color-progress-track: var(--progress-track)` no `@theme inline`, gerando a utility `bg-progress-track`; Setup snippet byte-verbatim da spec.

**Dependencies:** —

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Acceptance criteria:**

- No tema escuro, `--progress-track` resolve para `#3d3d3d`, diferente do indicador (`--primary` = `#ffffff`); no claro continua `#e3e3e3`.
- `npm run build` gera a utility `bg-progress-track` sem erro de compilação do CSS.

---

### SI-7 — `components/ui/progress.tsx` → trilha com `--progress-track`

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### saneamento-fase-04/TD-03 — Token `--progress-track` no tema escuro` → Migração row for `next-frontend/components/ui/progress.tsx`

**Description:** Troca a trilha do primitivo `Progress` de `bg-muted` pelo token `bg-progress-track`, fechando o contorno registrado como `exception` no drift report da Fase 04 (per `saneamento-fase-04/TD-03`).

**Technical actions:**

1. `next-frontend/components/ui/progress.tsx` — na classe do `ProgressPrimitive.Root`, substituir `bg-muted` por `bg-progress-track` (Migração row "Required change"); o indicador (`bg-primary`) e o modo indeterminado não mudam.
2. Smoke visual manual em `/studio/upload/{publicId}` (claro e escuro): trilha e indicador distinguíveis em ambos os temas; registrar o resultado e a pendência de confirmação do valor na reauditoria do Figma (frame 154:1724) nas Observations do `progress.md`.

**Dependencies:** SI-6 (Setup do mesmo padrão — a utility `bg-progress-track` precisa existir).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Progress` | Unit (regressão — `role`, `aria-*`, `data-slot`, determinado/indeterminado; sem asserção de classe) | `next-frontend/components/ui/__tests__/progress.test.tsx` |
| `UploadStatusRow` | Unit (regressão — único consumidor do primitivo) | `next-frontend/components/upload/__tests__/upload-status-row.test.tsx` |

**Acceptance criteria:**

- `components/ui/progress.tsx` não contém mais `bg-muted` na trilha e usa `bg-progress-track`.
- Na tela `/studio/upload/{publicId}`, a barra de progresso mostra trilha e indicador com cores distintas no tema claro e no escuro.
- Os testes pré-existentes do primitivo e do `UploadStatusRow` continuam passando.

---

### SI-8 — Remover casts obsoletos e alinhar o parse dos BFFs de auth ao helper do BFF

**Description:** Remove os casts que sobraram de antes da tipagem dos DTOs de auth (`body as never`, `error as ApiErrorEnvelope`) e troca o parse `(await request.json()) as XDto` por `readJson`/`invalidBody` de `next-frontend/lib/api/bff.ts`, para que JSON inválido responda `400` `VALIDATION_ERROR` em vez de `500` — clarificação AMB-1 da validação da task; padrão de BFF por Route Handler de `phase-02-auth-frontend/TD-05` e tipos de `next-frontend-openapi-typing/TD-04`.

**Technical actions:**

1. `next-frontend/app/api/auth/signup/route.ts` e `app/api/auth/login/route.ts` — `const body = await readJson<XDto>(request)`, `if (!body) return invalidBody()`; passar `body` ao `upstream.POST` sem `as never` e devolver `error` sem `as ApiErrorEnvelope` (o tipo vem de `paths`). O fluxo de sessão do login (`iron-session`) não muda.
2. `next-frontend/app/api/auth/forgot-password/route.ts` — mesma troca da ação 1 (parse + casts).
3. `next-frontend/app/api/auth/reset-password/route.ts` e `app/api/auth/resend-confirmation/route.ts` — trocar só o parse por `readJson`/`invalidBody` (esses dois já não têm os casts do upstream).
4. `next-frontend/components/auth/signup-form.tsx` — remover o comentário obsoleto "RegisterDto has no declared properties in the contract source yet…" (o payload continua `{ email, password }`).
5. Acrescentar, em cada teste de integração dos cinco BFFs, o caso de corpo não-JSON → `400` `VALIDATION_ERROR` sem chamada ao upstream (MSW com `onUnhandledRequest: "error"` garante que nenhum fetch escapa).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /api/auth/signup` | Integration (MSW): corpo inválido → 400; regressão dos casos existentes | `next-frontend/app/api/auth/signup/__tests__/route.integration.test.ts` |
| `POST /api/auth/login` | Integration (MSW): corpo inválido → 400 sem sessão criada; regressão | `next-frontend/app/api/auth/login/__tests__/route.integration.test.ts` |
| `POST /api/auth/forgot-password` | Integration (MSW): corpo inválido → 400; regressão | `next-frontend/app/api/auth/forgot-password/__tests__/route.integration.test.ts` |
| `POST /api/auth/reset-password` | Integration (MSW): corpo inválido → 400; regressão | `next-frontend/app/api/auth/reset-password/__tests__/route.integration.test.ts` |
| `POST /api/auth/resend-confirmation` | Integration (MSW): corpo inválido → 400; regressão | `next-frontend/app/api/auth/resend-confirmation/__tests__/route.integration.test.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `POST /api/auth/{signup,login,forgot-password,reset-password,resend-confirmation}` com corpo que não é JSON válido retorna `400` com `error: "VALIDATION_ERROR"` e não chama a API NestJS.
- `POST /api/auth/login` com corpo inválido não grava cookie de sessão.
- Com corpo válido, os cinco BFFs mantêm os status e corpos de sucesso e de erro que já retornavam.
- Nenhum `route.ts` em `app/api/auth/**` contém `as never` nem `as ApiErrorEnvelope`, e `signup-form.tsx` não contém mais o comentário "RegisterDto has no declared properties".

---

### SI-9 — Trocar `watch()` por `useWatch` nos formulários de signup e reset de senha

**Description:** Elimina os 2 warnings "Compilation Skipped: Use of incompatible library" do React Compiler, trocando `watch("password")` / `watch("new_password")` por `useWatch({ control, name })`, padrão já adotado na Fase 04 (`channel-settings-form.tsx`, `video-edit-form.tsx`); os formulários seguem `react-hook-form` + Zod (per `phase-02-auth-frontend/TD-04`).

**Technical actions:**

1. `next-frontend/components/auth/signup-form.tsx` — `const passwordValue = useWatch({ control, name: "password" })` no lugar de `watch("password")`; o medidor de força da senha continua recebendo o mesmo valor.
2. `next-frontend/components/auth/reset-password-form.tsx` — `useWatch({ control, name: "new_password" })` no lugar de `watch("new_password")`.
3. Rodar `npm run lint` no `next-frontend` e confirmar 0 erros e 0 warnings.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `SignupForm` | Unit (regressão — medidor de força reage à senha digitada; envio do formulário) | `next-frontend/components/auth/__tests__/signup-form.wiring.test.tsx` |
| `ResetPasswordForm` | Unit (regressão — medidor de força e validação da nova senha) | `next-frontend/components/auth/__tests__/reset-password-form.wiring.test.tsx` |

**Dependencies:** SI-8 — as duas SIs editam `components/auth/signup-form.tsx`.

**Acceptance criteria:**

- `npm run lint` no `next-frontend` reporta 0 erros e 0 warnings.
- Nas telas `/signup` e `/reset-password`, o medidor de força da senha continua atualizando a cada caractere digitado.
- `signup-form.tsx` e `reset-password-form.tsx` não chamam mais `watch(`.

---

## Technical Specifications

### Frontend Runtime

#### saneamento-fase-04/TD-03 — Token `--progress-track` no tema escuro

**Pattern:** o claro já coincide com `muted` e no escuro o DS usa `#3d3d3d` para `muted`/`border`/`accent`, então o valor inferido é o mais coerente com a paleta existente; fica registrado como inferência a confirmar na reauditoria do Figma (ajuste via `/decide` como Revision se o Figma divergir).

**Setup:**

```css
/* next-frontend/app/globals.css */
:root { --progress-track: #e3e3e3; }                 /* inalterado */
@theme inline { --color-progress-track: var(--progress-track); }
@media (prefers-color-scheme: dark) { :root { --progress-track: #3d3d3d; } }
```

```tsx
// next-frontend/components/ui/progress.tsx — trilha do Root
"relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-progress-track"
```

**Aplicação:** todo consumidor do primitivo `Progress` (`components/ui/progress.tsx`) passa a desenhar a trilha com o token — hoje o único consumidor é `components/upload/upload-status-row.tsx` (barra de upload e processamento das telas `/studio/upload/**`). Não há tela nova nesta task (`ui_in_scope: logic-only`); futuras barras de progresso (ex.: player da Fase 05) herdam o token via o primitivo.

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/components/ui/progress.tsx` | trilha usa `bg-muted` (contorno registrado como `exception` no drift report da Fase 04, porque o token escuro era `#ffffff`) | trilha usa `bg-progress-track` | SI-7 |

_O ajuste do token em `next-frontend/app/globals.css` (valor escuro `#3d3d3d` + `--color-progress-track` no `@theme inline`) é o Setup do padrão — SI-6._

**Verificação:**

- **Unit:** `components/ui/__tests__/progress.test.tsx` continua passando (asserções de `role`, `aria-*` e `data-slot`; sem asserção de classe Tailwind, que seria mirror test).
- **Integration:** n/a — mudança de token puro, sem fluxo de dados.
- **E2E:** n/a — sem mudança de comportamento; a verificação visual (claro e escuro) é manual no smoke da SI, comparando trilha vs. indicador na tela `/studio/upload/{publicId}`.
- **Regression guards:** `components/upload/__tests__/*` e o E2E `tests/studio-upload-processing.e2e-spec.ts` continuam passando; `npm run build` compila o CSS com a nova utility `bg-progress-track`.

---

## Dependency Map

```
SI-1 (root) — lint dos specs de auth e canais
SI-2 (root) — lint dos demais specs/helpers em src/
SI-3 (root) — lint dos e2e
├── SI-4 — depends on SI-1, SI-2, SI-3 (gate --max-warnings 0 só fecha com tudo limpo)
└── SI-5 — depends on SI-1 + SI-3 (edita channels.service.spec.ts e test/auth.e2e-spec.ts já limpos)
SI-6 (root, independent) — Setup do token --progress-track
└── SI-7 — depends on SI-6 (Migration de progress.tsx precisa da utility bg-progress-track)
SI-8 (root, independent) — BFFs de auth: casts + readJson/invalidBody
└── SI-9 — depends on SI-8 (as duas editam components/auth/signup-form.tsx)
```

Os três ramos (lint/nickname no backend, token no frontend, auth no frontend) são independentes entre si.

---

## Deliverables

- [ ] SI-1 — Zerar o lint dos specs de auth e canais (backend)
- [ ] SI-2 — Zerar o lint dos demais specs e helpers de teste em `src/` (backend)
- [ ] SI-3 — Zerar o lint dos e2e do backend
- [ ] SI-4 — Travar o lint do backend em 0 problemas
- [ ] SI-5 — Derivar nickname válido no cadastro para prefixos reservados ou curtos
- [ ] SI-6 — Token `--progress-track` no tema escuro (Setup)
- [ ] SI-7 — `components/ui/progress.tsx` → trilha com `--progress-track`
- [ ] SI-8 — Remover casts obsoletos e alinhar o parse dos BFFs de auth ao helper do BFF
- [ ] SI-9 — Trocar `watch()` por `useWatch` nos formulários de signup e reset de senha

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend lint passes with 0 problems (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] Backend type check passes (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend lint passes with 0 problems (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend type check passes (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend build passes (`cd next-frontend && docker compose exec next-frontend npm run build`)
- [ ] Frontend E2E passes against the production build with MSW (`next start`; `node node_modules/@playwright/test/cli.js test` on the host — see `next-frontend/CLAUDE.md` § "E2E test prerequisites")
