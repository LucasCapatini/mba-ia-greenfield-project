# task-saneamento-fase-04 — Progress

**Status:** completed
**SIs:** 9/9 completed

### SI-1 — Zerar o lint dos specs de auth e canais (backend)
- **Status:** completed
- **Tests:** 67 passing (auth.service.spec 30, auth.service.integration-spec 26, channels.service.spec 11 — mesma contagem do HEAD); `npx eslint` nos 3 arquivos: 0 erros / 0 warnings; `tsc --noEmit` limpo
- **Observations:**
  - `unbound-method`: em vez de variáveis soltas por `jest.fn()`, os mocks passaram a ser tipados com `MockOf<T, K>` (mapped type com chaves explícitas → propriedades `jest.MockedFunction`, não métodos), o que elimina o falso positivo em `expect(mock.fn)` sem reestruturar os `useValue` e preserva os tipos de `mock.calls`. Mesmo efeito pretendido pela TD-01 ("guardar os jest.fn() em variáveis"), com menos churn.
  - `auth.service.integration-spec.ts`: o filtro `{ revoked_at: null } as any` virou `revoked_at: IsNull()` (semântica pretendida do teste "active tokens"); o spy do MailService usa `authService['mailService']` no lugar de `(authService as any).mailService`.
  - Prettier rodado só nos 3 arquivos tocados (CRLF → LF no working tree; o git normaliza, diff só de conteúdo).

### SI-2 — Zerar o lint dos demais specs e helpers de teste em `src/` (backend)
- **Status:** completed
- **Tests:** 30 passing (mail.service.integration-spec 7, migrations.integration-spec 8, env.validation.integration-spec 7, domain-exception.filter.spec 6, validation-exception.filter.spec 2 — mesmas contagens do HEAD); `npx eslint` nos arquivos da SI + `src/test/mailpit.ts`: 0 erros / 0 warnings; `tsc --noEmit` limpo
- **Observations:**
  - Os 18 problemas de `mail.service.integration-spec.ts` vinham do helper `src/test/mailpit.ts` (retornos `any`); a correção foi tipar o helper (`MailpitMessageSummary` / `MailpitMessage`, subconjunto da API v1 do Mailpit) — o spec em si não mudou. O helper não estava listado na SI, mas é a origem do `any` que a ação 1 pede para tipar.
  - `createTestDataSource` passou a aceitar `NonNullable<DataSourceOptions['entities']>` (tipo do próprio TypeORM) no lugar de `(Function | string | EntitySchema<any>)[]`.
  - `env.validation.integration-spec.ts`: o `ValidationResult` do Joi tipa `value` como `any` no ramo de erro; o teste afirma `result.value as Record<string, unknown>` depois de checar `error`.

### SI-3 — Zerar o lint dos e2e do backend
- **Status:** completed
- **Tests:** 75 passing (auth 45, videos-upload-flow 5, videos-upload 7, videos-playback 11, videos-create 7 — mesmas contagens do HEAD); `npx eslint` nos 5 arquivos: 0 erros / 0 warnings; `tsc --noEmit` limpo (cobre os 14 arquivos de `test/`)
- **Observations:**
  - Corpos tipados por helpers no padrão dos e2e da Fase 04 (`errorBody(res)` etc.). Nos e2e de vídeo os tipos vêm dos DTOs de resposta da própria API (`VideoCreatedResponse`, `PresignedPartsResponse`, `UploadStateResponse`, `VideoResponse`, `PlaybackResponse` de `src/videos/dto/video-response.dto.ts`) — fonte única do contrato; no e2e de auth, tipos locais (`TokensBody`, `RegisterBody`, `MeBody`), porque os DTOs de resposta de auth não são classes exportadas.
  - Casts que ficaram redundantes foram removidos (`as string` sobre `public_id`, `as PresignedPart[]` e o tipo local `PresignedPart`); `thumbnail_url` (`string | null` no DTO) recebeu `!` nos dois pontos em que o teste já assume vídeo pronto.
  - Spy do MailService no e2e de auth: `authService['mailService']` + `Promise.resolve()` no lugar de `(authService as any)` + `async` vazio (mesmo padrão da SI-1).

### SI-4 — Travar o lint do backend em 0 problemas
- **Status:** completed
- **Tests:** no tests (Infra) — gate verificado: `npm run lint` sai com código 0 (0 erros / 0 warnings no projeto inteiro); com um arquivo-prova contendo um único `no-unsafe-argument` (warning), `npm run lint` sai com código 1 ("ESLint found too many warnings (maximum: 0)"); arquivo-prova removido em seguida
- **Observations:**
  - Nenhum remanescente fora das SIs 1–3: o lint do projeto inteiro já estava em 0/0 antes da troca do script.
  - `nestjs-project/CLAUDE.md`: a linha de comando `npm run lint` e a nota de ESLint registram a política de 0 warnings e como checar sem `--fix`.
  - `mail.service.integration-spec.ts` aparecia como modificado só por fim de linha (Prettier da SI-2; conteúdo idêntico) — restaurado com `git checkout` para não poluir o diff.

### SI-5 — Derivar nickname válido no cadastro para prefixos reservados ou curtos
- **Status:** completed
- **Tests:** 93 passing (nickname.util.spec 21 [+10], channels.service.spec 14 [+3], channels.service.integration-spec 10 [+4], test/auth.e2e-spec 48 [+3]); `npx eslint` nos arquivos tocados: 0/0; `tsc --noEmit` limpo
- **Observations:**
  - `isUsableNickname` (em `nickname.util.ts`) reusa `NICKNAME_PATTERN` e `RESERVED_NICKNAMES` de `channels.constants.ts` — mesma fonte do DTO do `PATCH /channels/me`; `sanitizeNickname` (allowlist + fallback `user_<random>` de phase-02-auth/TD-10) não mudou.
  - O critério "`john@` continua gerando `john`" é coberto pelo teste de integração pré-existente "derives nickname from email prefix".
  - Sem migração de dados: o banco de dev não tinha canais inválidos (0 de 1) e não há ambiente de produção (registrado no Context da TD-02).

### SI-6 — Token `--progress-track` no tema escuro (Setup)
- **Status:** completed
- **Tests:** no tests (Setup SI) — smoke: `npm run build` exit 0; o CSS gerado contém `--progress-track:#e3e3e3` (claro) e `--progress-track:#3d3d3d` (escuro)
- **Observations:**
  - `--color-progress-track: var(--progress-track)` adicionado ao `@theme inline`. O Tailwind v4 só emite a utility `bg-progress-track` quando algum componente a usa; a verificação de que ela é gerada fica com a SI-7 (Migration do `Progress`).
  - Comentário no bloco escuro registra que o valor é inferido da escala neutra (= `--muted`/`--border`) e deve ser confirmado na reauditoria do Figma (TD-03).

### SI-7 — `components/ui/progress.tsx` → trilha com `--progress-track`
- **Status:** completed
- **Tests:** 20 passing (progress.test 6, upload-status-row.test 14); `npm run build` exit 0 e o CSS emite `.bg-progress-track{background-color:var(--progress-track)}`
- **Observations:**
  - Smoke visual automatizado (build + `MSW_ENABLED=true npm run start` + Playwright no host, `colorScheme` claro/escuro, `/studio/upload/processing-01`), lendo as cores computadas: claro → trilha `rgb(227,227,227)` / indicador `rgb(15,15,15)`; escuro → trilha `rgb(61,61,61)` / indicador `rgb(255,255,255)`. Distintas nos dois temas.
  - O valor escuro `#3d3d3d` continua sendo inferência (TD-03): confirmar contra o Track 157:1939 na reauditoria do Figma (junto do frame 154:1724) quando a cota do MCP voltar; se divergir, ajustar via `/decide` como Revision.
  - O item do drift report da Fase 04 que mantinha `bg-muted` como `exception` fica superado por esta SI (o relatório da Fase 04 não foi editado — é artefato daquela fase).

### SI-8 — Remover casts obsoletos e alinhar o parse dos BFFs de auth ao helper do BFF
- **Status:** completed
- **Tests:** 22 passing (signup 5, login 5, forgot-password 4, reset-password 5, resend-confirmation 3 — +1 caso "corpo não-JSON → 400 sem chamar o upstream" em cada); `tsc --noEmit` limpo; `eslint app/api/auth` limpo
- **Observations:**
  - Além de `body as never` e `error as ApiErrorEnvelope`, o login tinha dois casts do mesmo tipo, também removidos: `data as LoginTokenPair` (virou anotação `const tokens: LoginTokenPair = data`) e `(body as Record<string, string>).email` (virou `body.email`, já tipado por `LoginDto`).
  - O teste "sem chamar o upstream" usa `server.events.on("request:start")` do MSW para provar que nenhum fetch sai; no login, também confirma que o cookie de sessão não é gravado.
  - **Fora de escopo (não alterado):** `app/api/auth/login/route.ts` tem um `console.log(error, data, response)` de depuração que, em login bem-sucedido, escreve o `access_token` e o `refresh_token` no log do servidor. Recomendado remover (tarefa à parte ou ajuste com aval do usuário).

### SI-9 — Trocar `watch()` por `useWatch` nos formulários de signup e reset de senha
- **Status:** completed
- **Tests:** 10 passing (signup-form.wiring 5, reset-password-form.wiring 5 — +1 em cada); `npm run lint` do next-frontend: 0 erros / 0 warnings; `tsc --noEmit` limpo
- **Observations:**
  - Os testes de wiring existentes não verificavam o medidor de força; cada um ganhou o caso "updates the password strength meter on every typed character (useWatch)", que digita caractere a caractere e confere o `data-strength` do `PasswordStrengthMeter` (empty → weak → fair → strong → very-strong).
  - `reset-password-form.tsx` passou a desestruturar `control` do `useForm` (antes não usava) para alimentar o `useWatch`.

## Final verification (2026-10-19)

- **Backend unit + integration:** `npm test -- --runInBand` → 56 suítes / 496 testes passando.
- **Backend E2E:** `npm run test:e2e` → 14 suítes / 110 testes passando.
- **Backend type check:** `npx tsc --noEmit` → 0 erros.
- **Backend lint:** `npm run lint` (`--fix --max-warnings 0`) → 0 erros / 0 warnings; o `--fix` não alterou nenhum arquivo.
- **Frontend tests:** `npm test` → 77 arquivos / 524 testes passando.
- **Frontend type check:** `npx tsc --noEmit` → 0 erros.
- **Frontend lint:** `npm run lint` → 0 problemas (os 2 warnings de React Compiler sumiram).
- **Frontend build:** `npm run build` → ok (21/21 páginas estáticas, todas as rotas).
- **Frontend E2E:** Playwright no host contra `next build` + `MSW_ENABLED=true npm run start`:
  - 1ª execução completa: 48 passando, 1 falha, 1 não executado — `studio-videos.e2e-spec.ts › 2.2 processing-row-updates-automatically` estourou o timeout de 15 s esperando o badge sair de "Processing" (o `3.1` do mesmo arquivo não rodou por causa do `mode: "serial"`).
  - Rerun do arquivo isolado: 5/5; 2ª execução completa: **50/50**.
  - Diagnóstico: flakiness de timing num teste da Fase 04 — o mock mantém `becomes-ready-02` em `processing` por 2 leituras, o polling é de 3 s e o refresh da rota re-renderiza a lista; ~10 s em execução normal contra 15 s de timeout, sem `retries` local. Nenhum arquivo desta task toca `mocks/`, `tests/`, `hooks/` ou o estúdio.

## Follow-ups (fora do escopo desta task)

- `app/api/auth/login/route.ts`: remover o `console.log(error, data, response)` de depuração (já no HEAD) — em login bem-sucedido escreve `access_token`/`refresh_token` no log do servidor e polui a saída do Vitest.
- `tests/studio-videos.e2e-spec.ts › 2.2`: flaky por timing (ver acima) — aumentar a folga do `toHaveText` ou reduzir `READS_UNTIL_READY` no mock.
- Reauditoria do Figma (frame 154:1724 e Track 157:1939) para confirmar o `--progress-track` escuro `#3d3d3d` (TD-03, valor inferido).
- `testing-guide-next-frontend` ainda descreve o E2E contra `next dev` e lista "Playwright contra production build" como anti-pattern — desatualizado em relação à convenção `next build` + `next start` adotada na Fase 04.
