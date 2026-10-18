# task-saneamento-fase-02-e-infra — Progress

**Status:** completed
**SIs:** 11/11 completed (SI-11 appended 2026-10-18)

### SI-1 — Adotar o Git Flow e sanear o README
- **Status:** completed
- **Tests:** no tests
- **Observations:**
  - `dev` criada a partir de `main` e publicada (`origin/dev`); `feature/saneamento-fase-02-e-infra` criada a partir de `dev` e carrega os artefatos de planejamento ainda não commitados (docs/, CLAUDE.md, nestjs-project/specs/). Commits ficam a cargo do usuário.
  - Setup de ambiente feito no preflight (fora do escopo do SI): `nestjs-project/.env` e `next-frontend/.env.local` criados localmente (gitignored). O `nestjs-project/.env.example` tem `MAIL_FROM="StreamTube" <noreply@streamtube.com>`, que o Docker Compose rejeita ("unexpected character <"); corrigido só no `.env` local para `MAIL_FROM="StreamTube <noreply@streamtube.com>"`. Candidato a correção no `.env.example` quando o SI-4 tocar esse arquivo.
  - A ferramenta `TaskCreate` não está disponível nesta sessão; este `progress.md` é a lista de tarefas persistente.

### SI-2 — Compartilhar a rede Docker entre as stacks
- **Status:** completed
- **Tests:** no tests (ACs verificados manualmente: `docker network inspect streamtube` com os 4 containers; `fetch('http://nestjs-api:3000')` de dentro do container do frontend retornou `Hello World!`; rede externa ausente falha com "declared as external, but could not be found"; suíte Playwright existente 9/9 passando)
- **Observations:**
  - A imagem `node:22.16.0-slim` do frontend não tem `wget` nem `ps`; o AC foi verificado com `node -e "fetch(...)"`. Vale ajustar o texto do AC/README se for reutilizado.
  - Compilação do `nest start --watch` levou ~6,5 min no bind mount `C:\` do Docker Desktop (I/O bound); nada a ver com a rede, mas afeta qualquer verificação que precise da API rodando. O dev server foi encerrado após a verificação.
  - No host Windows, `npx playwright test` não funciona porque o `node_modules` foi instalado pelo Linux do container (sem shim `.cmd`); o equivalente que funciona é `node node_modules/@playwright/test/cli.js test`. Chromium instalado no host em `%LOCALAPPDATA%\ms-playwright`. Candidato a nota no README/CLAUDE.md do frontend (fora do escopo deste SI).
  - As redes `nestjs-project_default` e `next-frontend_default` antigas ficaram órfãs; `docker network prune` as remove (não executado).
  - Também atualizei o `CLAUDE.md` da raiz (duas frases sobre `host.docker.internal`) para não contradizer a nova topologia.
  - `next-frontend/.gitignore` ignorava `.env*`, o que engoliria o novo `.env.example`; adicionada a exceção `!.env.example`.
  - O `npm install` do setup alterou `next-frontend/package-lock.json` e a execução do Playwright alterou `next-frontend/test-results/.last-run.json` (artefato versionado). Nenhum dos dois é mudança do SI; o usuário decide se commita ou descarta (`git checkout -- <arquivo>`).

### SI-3 — Criar o workflow de CI `openapi-freshness`
- **Status:** completed
- **Tests:** no tests (gate reproduzido localmente: sync + `openapi:types` + `git diff` → exit 0; `types.gen.ts` adulterado → exit 1; regeneração → exit 0 e arquivo byte-idêntico; YAML parseado com js-yaml, 6 steps; zero menções a services/postgres/env do backend)
- **Observations:**
  - `next-frontend/.gitignore` ignorava `openapi.json` (linha 43), contrariando `next-frontend-openapi-typing/TD-02` (cópia commitada). Por decisão do usuário, a linha foi removida; `next-frontend/openapi.json` agora aparece como untracked e precisa de `git add` para o diff do workflow cobri-lo. Enquanto não for commitado, o gate só detecta drift via `types.gen.ts` (que já é rastreado).
  - Os ACs "`gh workflow list` exibe o workflow" e "PR com check verde" dependem de push + PR, operações de git a cargo do usuário. `gh` CLI não está instalado no host.
  - `core.autocrlf=true` no host gera aviso de LF→CRLF em `types.gen.ts` (gerado em Linux). O git normaliza na comparação, então não há falso diff; em CI (Linux) a questão não existe.
  - No host não há `npm ci` local; o passo foi reproduzido com o `node_modules` já instalado no container — equivalente para fins do gate.

### SI-4 — Apontar os links de e-mail para o frontend
- **Status:** completed
- **Tests:** 10 passing (`src/mail/mail.service.integration-spec.ts` 7 incl. 2 novos; `src/config/env.validation.spec.ts` 3 novos); `tsc --noEmit` exit 0; eslint limpo nos arquivos de produção e no código de teste novo
- **Observations:**
  - `src/mail/mail.service.integration-spec.ts` já tinha 16 erros de ESLint em HEAD (`no-unsafe-member-access` / `no-unsafe-assignment` sobre o JSON `any` retornado por `src/test/mailpit.ts`), verificados com `git stash` do arquivo. Nenhum é do bloco novo. Correção de raiz (tipar os retornos do helper `mailpit.ts`) está fora do escopo deste SI; precisa de decisão antes da verificação final, porque `npm run lint` do backend falha por causa deles.
  - Aproveitei a edição do `.env.example` para corrigir `MAIL_FROM` para a forma com aspas envolvendo tudo (`"StreamTube <noreply@streamtube.com>"`), que o Docker Compose aceita. **Correção (2026-10-18):** a inserção de `APP_URL`/`FRONTEND_URL` no `.env.example` havia falhado silenciosamente (substituição não casou por CRLF) e esta observação registrava como feita; detectado na revisão de alinhamento da documentação e corrigido — um `cp .env.example .env` novo voltaria a impedir o boot da API por `FRONTEND_URL` obrigatória.
  - `app.config.ts` usa `process.env.FRONTEND_URL ?? ''` apenas para manter a factory chamável como função (`data-source.ts`); o Joi `required()` garante o valor em runtime e o teste unitário prova a rejeição de ausência/não-URI.
  - O AC "iniciar a API sem `FRONTEND_URL` falha no bootstrap" foi coberto pelo teste do schema (o `AppModule` usa `envValidationSchema` com `abortEarly: false`); não houve bootstrap manual porque a compilação do Nest no bind mount leva ~6 min.

### SI-5 — Tornar a confirmação de e-mail idempotente
- **Status:** completed
- **Tests:** 106 passing — `src/auth/auth.service.spec.ts` 30 (3 novos), `src/auth/auth.service.integration-spec.ts` 26 (1 novo), `test/auth.e2e-spec.ts` 45 (1 invertido), `test/auth-confirm-email.e2e-spec.ts` 5 (novo, derivado de `specs/auth-confirm-email.plan.md`); `tsc --noEmit` exit 0; eslint limpo em `auth.service.ts`, `auth.controller.ts`, no E2E novo e no bloco unitário adicionado
- **Observations:**
  - **Ajuste de infra fora do escopo (aprovado pelo usuário):** `testTimeout: 30000` adicionado ao bloco `jest` do `package.json` e a `test/jest-e2e.json`. Sem isso, a primeira suíte com banco de cada processo Jest estourava os 5 s padrão no `beforeAll` (boot frio do `AppModule` sob ts-jest no bind mount do Windows) e nenhum corpo de teste rodava; a segunda suíte do mesmo processo passava. Não altera asserções.
  - O teste pré-existente "returns 401 with INVALID_TOKEN on an already-used token" em `test/auth.e2e-spec.ts` contradizia a TD-03 e foi invertido para esperar `204` na segunda chamada, com comentário apontando para o E2E derivado do spec.
  - A linha do plano "`resetPassword` reutilizando token continua lançando `InvalidTokenException`" já era coberta por um teste de integração existente (`throws InvalidTokenException when the same token is reused`); não foi duplicada. O cenário 2.1 do spec cobre o mesmo contrato via HTTP.
  - Dívida de lint pré-existente (fora do diff): 77 problemas em `auth.service.spec.ts`, 8 em `auth.service.integration-spec.ts`, 47 em `test/auth.e2e-spec.ts` — todos `no-unsafe-*` / `unbound-method` / `require-await` sobre `any` e spies. Soma-se aos 16 de `mail.service.integration-spec.ts` (SI-4). `npm run lint` do backend falha por eles; decisão pendente para a verificação final.
  - O método `confirm` deixou de usar `consumeVerificationToken` (que permanece intacto para `PASSWORD_RESET`); o lookup sem filtro de `used_at` é coberto por teste unitário que inspeciona o `where`.

### SI-6 — Enriquecer o contrato OpenAPI e sincronizar os tipos
- **Status:** completed
- **Tests:** 12 passing (`src/openapi-export.integration-spec.ts`, 3 novos); `tsc --noEmit` exit 0 no backend e no frontend; eslint limpo nos DTOs e no spec; `diff -q` entre os dois `openapi.json` idêntico; `types.gen.ts` regenerado expõe `ResetPasswordDto { token; new_password }`, `ResendConfirmationDto { email }` e `AuthController_confirmEmail.parameters.query.token: string`
- **Observations:**
  - Variação em relação à ação 1 do plano: não adicionei `@ApiQuery` no controller porque o `@Query() dto: ConfirmEmailDto` com `@ApiProperty` já faz o Swagger emitir o parâmetro `token` (`in: query`, `required: true`); o `@ApiQuery` duplicaria o parâmetro. O AC (query param obrigatório no spec) está atendido e coberto por teste.
  - Causa raiz dos DTOs `{}`: `openapi:export` roda via `ts-node`, sem o plugin do Nest CLI que inferiria as propriedades dos decorators `class-validator`; por isso os decorators explícitos são necessários. Os demais DTOs (`RegisterDto`, `LoginDto`, `RefreshTokenDto`, `ForgotPasswordDto`) continuam `{}` no spec — fora do escopo deste SI; candidato a task `openapi-explicit-dtos` (afeta a tipagem dos BFFs de signup/login/refresh/forgot no frontend, que hoje operam sem shape de body).
  - Artefatos regenerados aguardando commit pelo usuário no mesmo change: `nestjs-project/openapi.json` (M), `next-frontend/openapi.json` (novo, untracked após o SI-3) e `next-frontend/lib/api/types.gen.ts` (M). Até lá, o gate de SI-3 acusaria drift em `types.gen.ts`.

### SI-7 — Expor os Route Handlers BFF de reset e reenvio
- **Status:** completed
- **Tests:** 6 passing (`app/api/auth/reset-password/__tests__/route.integration.test.ts` 4, `app/api/auth/resend-confirmation/__tests__/route.integration.test.ts` 2); `tsc --noEmit` exit 0; eslint exit 0 nos 6 arquivos tocados; nenhum "request unhandled"
- **Observations:**
  - Graças ao SI-6, os novos Route Handlers passam o body tipado direto ao `upstream.POST` (sem o `as never` que `forgot-password/route.ts` ainda usa porque `ForgotPasswordDto` segue `{}` no spec).
  - Triggers reservados adicionados em `mocks/handlers/auth.ts`: `token = "expired-token"` → 401 `TOKEN_EXPIRED`, `"invalid-token"` → 401 `INVALID_TOKEN`, `"badrequest-token"` → 400 `VALIDATION_ERROR`; reenvio reutiliza `badrequest@example.com` → 400. Códigos espelham as exceções reais do backend.
  - Drift pré-existente nos fixtures MSW (fora do escopo): os handlers antigos usam `VALIDATION_FAILED` e `EMAIL_ALREADY_REGISTERED`, enquanto o backend emite `VALIDATION_ERROR` e `EMAIL_ALREADY_EXISTS`. Não afeta os testes atuais (que só olham `statusCode`), mas vale alinhar numa task de higiene dos mocks.

### SI-8 — Criar a tela de confirmação de conta
- **Status:** completed
- **Tests:** 7 unit/integration novos passing (`resend-confirmation-form.wiring.test.tsx` 3, `confirm-email-result.test.tsx` 4) + 5 E2E novos (`tests/confirm-email.e2e-spec.ts`); regressão: 26 Vitest (todas as rotas BFF) e 14 Playwright passando; `tsc --noEmit` exit 0; eslint exit 0 nos arquivos tocados
- **Observations:**
  - **Correção fora do plano em `lib/api/upstream.ts` (necessária para o SI):** o `createClient` do `openapi-fetch` capturava `globalThis.fetch` na avaliação do módulo, e no React Server Component essa referência contornava o MSW server-side (`instrumentation.ts`), batendo na API real pela rede `streamtube` (ou dando `ECONNREFUSED` com a API parada). Route Handlers não sofriam porque os testes os importam dinamicamente após `server.listen()`. Passei a resolver o `fetch` em tempo de chamada (`fetch: (input) => globalThis.fetch(input)`), o que faz MSW e o patch de `fetch` do Next valerem em todas as camadas. Verificado: 4 estados da página via MSW, zero `ECONNREFUSED`, nenhuma regressão nos 26 testes de rota nem nos 9 E2E antigos.
  - O watcher do Turbopack no bind mount do Windows não detecta diretórios novos de rota (`/confirm-email` dava 404 até reiniciar) e pode não recarregar edições. Para E2E confiável, reiniciar o container (`docker compose restart next-frontend`) e subir um único dev server; a imagem slim não tem `ps`/`pkill` (usar `/proc`).
  - Durante um restart eu derrubei por engano o `npm test` do subagente (padrão `*npm*` no kill); os testes foram re-executados com sucesso.
  - Um dev server da API (`node dist/main`, filho do `nest start --watch`) havia sobrevivido ao `pkill` do SI-2 e respondia em `nestjs-api:3000`; encerrado. Nenhum dev server da API está ativo agora.
  - Nome do arquivo de teste do formulário segue a convenção existente `*.wiring.test.tsx` (o plano citava `resend-confirmation-form.test.tsx`).
  - Reutilizei `mapForgotPasswordErrorToForm` no formulário de reenvio (mesma semântica: 400 → campo e-mail); nenhuma alteração em `error-mapping.ts` neste SI.
  - Ruído observado: `app/api/auth/login/route.ts` (ou seu teste) tem um `console.log` de depuração imprimindo a resposta upstream a cada teste; fora do escopo, candidato a limpeza.

### SI-9 — Criar a tela de redefinição de senha
- **Status:** completed
- **Tests:** 7 Vitest novos passing (`reset-password-form.wiring.test.tsx` 4, `lib/auth/__tests__/error-mapping.test.ts` 3) + 4 E2E novos (`tests/reset-password.e2e-spec.ts`); regressão: 33 Vitest (10 arquivos, todas as rotas BFF) e 18 Playwright passando; `tsc --noEmit` exit 0; eslint exit 0 (1 warning `react-hooks/incompatible-library` em `watch()`, mesmo padrão de `signup-form.tsx`)
- **Observations:**
  - **Correção fora do plano (necessária, fecha de vez o problema do SI-8):** a intercepção do MSW server-side era uma corrida. O Next instala seu `fetch` patchado envolvendo a referência capturada no boot; quando `import("./mocks/server")` demora (bind mount), o `listen()` do MSW chega depois e as chamadas via o wrapper do Next contornam o MSW (`ECONNREFUSED` contra `nestjs-api:3000`, inclusive em Route Handlers — login, reset). Evidência: log de `globalThis.fetch` = `fetchProxy` (MSW) logo após o `listen()`, mas `fetch` patchado do Next no momento da chamada. Solução determinística: `instrumentation.ts` publica `globalThis.__mswFetch = globalThis.fetch` após o `listen()`, e `lib/api/upstream.ts` usa `globalThis.__mswFetch ?? globalThis.fetch` em tempo de chamada. Em produção o símbolo é `undefined`. `instrumentation.ts` também passou a logar `[msw] server-side mocking enabled` para diagnóstico de E2E. Após a mudança: login 200, reset 204/401, páginas OK, zero `ECONNREFUSED`, 18/18 E2E.
  - `mapResetPasswordErrorToForm` usa `type: "reset-link-invalid"` no erro root para o componente renderizar o link para `/forgot-password` dentro do próprio alerta; `RESET_LINK_INVALID_MESSAGE` exportado para reuso nos testes.
  - Não existe endpoint de pré-validação do token de reset; a página exibe o formulário sempre que há `token` e os erros aparecem no submit (conforme TD-04/Error Catalog). Candidato futuro: `GET /auth/reset-password/validate` se a UX exigir feedback antes do submit.
  - Seletor E2E: `getByRole("alert")` colide com o `__next-route-announcer__` do Next; os specs usam `[data-slot='form-error']` para o alerta do formulário.
  - Os reinícios do container para o E2E derrubaram execuções Vitest concorrentes do subagente (exit 137) e, sob carga (dev server + Vitest), o worker jsdom do Vitest às vezes não inicia em 60 s; repetir o arquivo isolado resolve. Para a verificação final, rodar Vitest com o dev server parado.

### SI-10 — Adicionar o header session-aware com logout
- **Status:** completed
- **Tests:** 4 Vitest novos passing (`components/layout/__tests__/app-header.test.tsx`) + 5 do `login-form.wiring.test.tsx` atualizado + 3 E2E novos (`tests/logout.e2e-spec.ts`); suíte Playwright completa 21/21; `tsc --noEmit` exit 0; eslint exit 0
- **Observations:**
  - `app/page.tsx` movido com `git mv` para `app/(app)/page.tsx` (placeholder mínimo com `BrandLogo` + tagline); `app/(app)/layout.tsx` renderiza o `AppHeader`; o grupo `(auth)` não o recebe (verificado por E2E em `/login`, `/signup`, `/forgot-password`).
  - Ação 4 do plano exigiu mudança de comportamento em `components/auth/login-form.tsx`: após o 200, agora `router.push("/")` + `router.refresh()` (antes só `refresh`, mantendo o usuário em `/login`). O teste `login-form.wiring.test.tsx` foi atualizado para mockar `push` e assertar `push("/")`. O E2E `auth-login` 1.1 continua passando (asserta cookie e ausência de erro, não a URL).
  - `BrandLogo` só aceita `size` `md | lg`; o header usa `md`. Botões do header usam o tamanho `sm` e a variante padrão; refinamento visual fica para a Fase 07, quando o Figma do header existir.
  - O logout engole falhas do upstream por design (a rota BFF destrói o cookie incondicionalmente); o `finally` do header garante `push("/")` + `refresh()` mesmo se o `fetch` rejeitar.

### SI-11 — Criar a página `/resend-confirmation`
- **Status:** completed
- **Tests:** 2 E2E novos passing (`tests/resend-confirmation.e2e-spec.ts`); suíte Playwright completa 23/23; `tsc --noEmit` exit 0; eslint exit 0 (2 avisos pré-existentes)
- **Observations:**
  - SI anexado manualmente ao plano em 2026-10-18 (append-mode manual, sem rodar `/decide` → `/plan-context` → `/plan-validate` → `/plan-build`): a revisão de alinhamento com a documentação encontrou o link "Reenviar e-mail de confirmação" do login (`403 EMAIL_NOT_CONFIRMED`) apontando para uma rota inexistente desde a Fase 02. A decisão está registrada como `**Revisions:**` em `saneamento-fase-02-e-infra/TD-04`; `context.md` e `validation.md` da task **não** foram regenerados (task já concluída), por isso o `sources_mtime` da decisão foi atualizado só no frontmatter do plano.
  - Nenhum componente, handler MSW ou rota BFF novos: a página reutiliza `ResendConfirmationForm` (SI-8) e `POST /api/auth/resend-confirmation` (SI-7). Turbopack exigiu `docker compose restart next-frontend` para enxergar o novo diretório de rota.

### Final verification (2026-10-17)
- **Backend:** `npm test -- --runInBand --forceExit` → 24 suítes / 156 testes passing (242 s); `npm run test:e2e -- --runInBand --forceExit` → 4 suítes / 57 testes passing (128 s); `tsc --noEmit` exit 0; ESLint (sem `--fix`) exit 1 com 189 problemas (149 erros, 40 avisos), todos em 11 arquivos pré-existentes — nenhum nos arquivos criados/alterados por esta task.
- **Frontend:** `npm test` (Vitest) → 24 arquivos / 97 testes passing (alguns arquivos precisaram de re-execução isolada por timeout de início de worker jsdom no bind mount, zero falhas de asserção); `tsc --noEmit` exit 0; `npm run lint` exit 0 (2 avisos pré-existentes `react-hooks/incompatible-library`); Playwright 21/21 com dev server em `MSW_ENABLED=true`.
- **Cadeia OpenAPI:** `diff -q` dos dois `openapi.json` idêntico após sync; `openapi:types` idempotente (`types.gen.ts` inalterado).
- **Correções de teste feitas durante a verificação (fora dos SIs):** (1) `src/config/env.validation.integration-spec.ts` ganhou `FRONTEND_URL` no env base — regressão legítima do SI-4, 3 testes voltaram a passar; (2) `src/database/migrations.integration-spec.ts` passa a executar `DROP TYPE IF EXISTS "public"."verification_tokens_type_enum"` no `beforeAll` — bug pré-existente: o teste derrubava tabelas mas não o enum, então só passava num banco onde as migrations nunca tinham rodado.
- **Jest não encerra sozinho** após a suíte unit+integration ("Jest did not exit one second after…", handles abertos) — pré-existente; a verificação usou `--forceExit`. O script `npm test` puro fica pendurado ao final; candidato a `--forceExit` no script ou `--detectOpenHandles` numa task de higiene.
- **Dev server da API não está ativo**; o dev server do frontend com MSW ficou ativo após o Playwright (`docker compose restart next-frontend` o encerra).

### Revisão de alinhamento com a documentação (2026-10-18)
- **Motivação:** o README define o critério de avaliação do MBA ("construir uma aplicação do zero utilizando IA de forma adequada no processo"); auditamos README, `CLAUDE.md`, rules, artefatos do pipeline e históricos da Fase 02 contra o que esta task entregou.
- **Bug corrigido:** `nestjs-project/.env.example` não tinha `FRONTEND_URL`/`APP_URL` (a substituição do SI-4 falhou silenciosamente por CRLF e o SI-4 acima registrava como feito — observação corrigida). Com a Joi `required()`, um `cp .env.example .env` novo impedia o boot da API.
- **Specs E2E do frontend:** `/plan-test-specs` não gerou specs para SI-8/9/10 porque, sem inventário Figma (TD-04 deferiu o `/screen-inventory`), os SIs de tela foram emitidos sem o sufixo `Xb`/`**Test Specs:**` que a Stage 1 do skill usa como discriminador. Escritos a posteriori a partir dos E2E já implementados (`next-frontend/specs/{confirm-email,reset-password,logout,resend-confirmation}.plan.md`) e ligados ao plano por `**Test Specs:**`; classificação manual equivalente: 4 specs PRESERVED, todas as ACs dos SIs 8–11 cobertas, 0 ORPHAN. O spec do backend (SI-5) aparece como UPDATED porque o plano foi editado depois dele (append do SI-11) — conteúdo inalterado.
- **Revisions:** registradas em `phase-02-auth-frontend/TD-07` e `phase-02-auth/TD-04` (confirmação idempotente altera a premissa single-use) e em `saneamento-fase-02-e-infra/TD-04` (página `/resend-confirmation`).
- **Documentação:** README raiz (link do `.fig`, Node 22+, `cp .env.example`, comandos de teste, nota Windows do Playwright, telas e rotas BFF novas, árvore, seção "Processo com IA"), `nestjs-project/CLAUDE.md`, `next-frontend/CLAUDE.md`, rules `next-frontend-bff-api` e `next-frontend-msw-mocks`, READMEs boilerplate dos subprojetos substituídos por ponteiros, anotações nos artefatos históricos da Fase 02 e no `project-plan.md`, diagramas `skills-workflow` e `software-arch`.
- **Higiene de repositório:** `test-results/` e `playwright-report/` adicionados ao `.gitignore` do frontend; `next-frontend/openapi.json`, `test-results/.last-run.json` e `playwright-report/index.html` ainda rastreados/não rastreados — `git add`/`git rm --cached` ficam com o usuário, junto com a exportação de `_claude-sessions/14-saneamento-fase-02-e-infra.txt`.
- **Verificação:** Playwright 23/23 (dev server `MSW_ENABLED=true` após `docker compose restart next-frontend`); frontend `tsc --noEmit` exit 0 (um `tsc` intermediário falhou em `.next/dev/types/validator.ts` corrompido pela regeneração concorrente do dev server — resolvido apagando `.next/dev/types` e reiniciando o dev server) e `npm run lint` 0 erros; backend `tsc` exit 0 e `env.validation.spec.ts` 3/3 (nenhum código backend mudou nesta revisão — só `.env.example`). Vitest: ver linha abaixo.
- **Vitest (24 arquivos / 91 testes passing, 18,6 s):** rodado a partir de uma cópia do projeto no disco local do container (`/tmp/vapp`), porque pelo bind mount 9p `require("jsdom")` leva ~100 s e o Vitest 4 aborta o worker que não inicia em 60 s (`START_TIMEOUT` fixo) — erro `[vitest-pool-runner]: Timeout waiting for worker to respond` em 7–11 arquivos jsdom por rodada, sem nenhuma falha de asserção; `--no-file-parallelism` e `--pool=threads` não resolvem. A contagem de 97 testes registrada em 2026-10-17 não se reproduz numa execução única (91 é o total real da suíte). Reforça o follow-up já anotado: volume nomeado para `node_modules` em `next-frontend/compose.yaml`.
