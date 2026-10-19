---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-10-19
scope_description: "Saneamento das pendências da Fase 04 antes da Fase 05: zerar a dívida de lint do nestjs-project (specs/integration/e2e das Fases 02/03; meta de 0 erros e 0 warnings, travada com --max-warnings 0 no script lint), corrigir a derivação de nickname no cadastro (reservados e < 3 caracteres), corrigir o token --progress-track no tema escuro, remover o comentário obsoleto e os casts dos BFFs de auth (os casts para o shape do upstream e o parse do corpo, que passa a usar readJson/invalidBody de lib/api/bff.ts, com JSON inválido respondendo 400 VALIDATION_ERROR) e eliminar os 2 warnings de React Compiler (react-hook-form watch) no next-frontend"
---

# Technical Decisions — Saneamento da Fase 04

_Subprojects in scope:_

- `nestjs-project/` — recebe a estratégia para zerar o lint (TD-01) e a regra de nickname no cadastro (TD-02). A allowlist `[a-z0-9_]` e o fallback `user_<random>` para prefixo vazio são herdados de `phase-02-auth/TD-10`; a lista `RESERVED_NICKNAMES` e o padrão `^[a-z0-9_]{3,50}$` são herdados de `video-channel-management/TD-08`. Nenhum deles é reaberto aqui.
- `next-frontend/` — recebe a decisão sobre o token `--progress-track` (TD-03). Os itens (4) e (5) do escopo **não têm decisão em aberto**: (4) é remoção de código morto — o comentário de `components/auth/signup-form.tsx` e os casts `body as never` / `error as ApiErrorEnvelope` dos BFFs de auth ficaram sem razão desde que os DTOs de auth passaram a ser tipados no OpenAPI; o implementador segue o padrão já existente em `lib/api/bff.ts` (Fase 04). (5) é a troca de `watch()` por `useWatch({ control, name })`, padrão já adotado na Fase 04 (`channel-settings-form.tsx`, `video-edit-form.tsx`) e recomendado pela documentação do react-hook-form 7.76 ("isolates re-rendering at the custom hook level").

_Nota de pesquisa:_ o MCP `context7` não estava disponível nesta sessão. Fontes primárias consultadas diretamente: typescript-eslint (regra `unbound-method`, que recomenda `eslint-plugin-jest` para arquivos de teste) e react-hook-form (`useWatch`). Versões instaladas verificadas nos lockfiles: `typescript-eslint` 8.57.0, `eslint` 9.39.4, `jest` 30.3.0, `supertest` 7.2.2 (`@types/supertest` 6.0.3) no backend; `next` 16.2.6, `react-hook-form` 7.76.0, `eslint-plugin-react-hooks` 7.1.1 no frontend. O MCP do Figma está sem cota (plano Starter), o que afeta TD-03.

_Diagnóstico do lint (2026-10-19, `eslint "{src,apps,libs,test}/**/*.ts"`):_ 217 erros e 54 warnings, **todos em código de teste** — 13 arquivos (`auth.service.spec.ts` 45E/32W, `test/auth.e2e-spec.ts` 47E, `test/videos-playback.e2e-spec.ts` 21E/8W, `test/videos-upload-flow.e2e-spec.ts` 25E/3W, `test/videos-create.e2e-spec.ts` 21E/2W, `channels.service.spec.ts` 15E/5W, `mail.service.integration-spec.ts` 16E/2W, mais 6 arquivos com ≤ 9 problemas cada). Por regra: `no-unsafe-member-access` 135, `no-unsafe-argument` 54 (warning), `no-unsafe-assignment` 46, `unbound-method` 19 (todos em `auth.service.spec.ts`, padrão `expect(repo.save).toHaveBeenCalled…`), `no-unsafe-return` 6, `no-unsafe-call` 5, `require-await` 4, `no-unused-vars` 1, `no-unsafe-function-type` 1. A origem dominante é `res.body` do supertest (tipado `any`) acessado sem asserção de tipo — os specs e2e da Fase 04 já usam o padrão `res.body as XBody` e passam no lint.

---

## TD-01: Estratégia para zerar a dívida de lint no código de teste do backend

**Scope:** Backend

**Trigger:** `npm run lint` do `nestjs-project` falha com 217 erros e 54 warnings em 13 arquivos de teste das Fases 02/03, o que viola o item 4 do Definition of Done; é preciso escolher entre corrigir o código dos testes ou ajustar a configuração do ESLint para arquivos de teste.

**Context:** a config atual (`eslint.config.mjs`) aplica `tseslint.configs.recommendedTypeChecked` a todo `{src,test}/**/*.ts`, sem distinção entre produção e teste. Nenhum erro está em código de produção. Os testes novos (Fase 04) já convivem com as regras tipando `res.body`; os antigos não. A escolha também define a convenção para os testes das Fases 05–07.

**Options:**

### Option A: Corrigir o código dos testes, sem mudar a config
- Tipar `res.body` com asserções (`res.body as AuthTokensBody`) ou helpers por arquivo, no padrão dos e2e da Fase 04; trocar `expect(repo.save)` por referências `jest.fn()` guardadas em variáveis tipadas (ou `jest.mocked`); corrigir os 7 casos pontuais (`require-await`, variável não usada, tipo `Function`).
- **Pros:** mantém a mesma régua para produção e teste; segue o padrão já em uso na Fase 04; nenhuma dependência nova.
- **Cons:** ~270 pontos de edição em 13 arquivos, só mecânicos; os 19 `unbound-method` exigem reestruturar os mocks de `auth.service.spec.ts`.

### Option B: Relaxar as regras `no-unsafe-*` e `unbound-method` só para arquivos de teste
- Bloco no `eslint.config.mjs` com `files: ['**/*.spec.ts', '**/*.integration-spec.ts', 'test/**/*.ts']` desligando as regras `no-unsafe-*` e `unbound-method`; corrigir só o que sobrar (~7 casos).
- **Pros:** resolve em minutos; prática comum em projetos Nest com supertest.
- **Cons:** abre uma exceção permanente de type-safety nos testes (contraria o princípio "Type Safety" do CLAUDE.md); os testes futuros deixam de ter o retorno do linter sobre `any` em `res.body`.

### Option C: Corrigir o código + trocar `unbound-method` pela versão do `eslint-plugin-jest` nos testes
- Como A para todas as regras `no-unsafe-*` e os casos pontuais; para `unbound-method`, seguir a recomendação da própria typescript-eslint: desligar a regra core em arquivos de teste e habilitar `jest/unbound-method` (de `eslint-plugin-jest`), que entende `expect(obj.method)`.
- **Pros:** type-safety intacta; elimina os falsos positivos de `unbound-method` sem reestruturar os mocks; é a configuração documentada pelo typescript-eslint.
- **Cons:** uma devDependency nova (`eslint-plugin-jest`) e um bloco de config a mais, para 19 ocorrências num único arquivo.

**Recommendation:** **Option A (corrigir o código dos testes, sem mudar a config)** — todos os problemas são `any` vindo de `res.body` e de mocks, que a Fase 04 já resolveu tipando; manter a mesma régua em produção e teste preserva o princípio de Type Safety sem dependência nova. Os 19 `unbound-method` ficam em um único spec e somem guardando os `jest.fn()` em variáveis. C é a alternativa se esse refactor de mocks se mostrar invasivo.

**Decision:** A — corrigir o código dos testes (tipar `res.body` e guardar os `jest.fn()` em variáveis), sem mudar `eslint.config.mjs`.

**Revisions:**
- 2026-10-19 — Meta fixada em 0 problemas (os 217 erros e também os 54 warnings `no-unsafe-argument`) e o script `lint` do `package.json` ganha `--max-warnings 0` para impedir regressão; `eslint.config.mjs` continua igual. Rationale: AMB-2 do plan-validate da task (critério de pronto indefinido entre exit 0 e 0 problemas).

---

## TD-02: Nickname derivado do e-mail quando o prefixo é reservado ou tem menos de 3 caracteres

**Scope:** Backend

**Trigger:** `sanitizeNickname` (`src/channels/nickname.util.ts`) aplica a allowlist de `phase-02-auth/TD-10`, mas não consulta `RESERVED_NICKNAMES` nem o mínimo de 3 caracteres que `PATCH /channels/me` exige (`video-channel-management/TD-08`). Cadastros como `admin@…`, `me@…` ou `ab@…` criam canais com nickname inválido, e `me` fica inalcançável em `GET /channels/{nickname}`.

**Context:** a geração automática e a edição manual precisam obedecer ao mesmo contrato (`NICKNAME_PATTERN` + `RESERVED_NICKNAMES`, em `channels.constants.ts`). Já existe um mecanismo de desvio para colisões: `appendRandomSuffix` acrescenta `_xxx` (3 hex) ao prefixo. Não há canais inválidos para migrar: o banco de dev tem 0 casos e o projeto não tem ambiente de produção, então não há backfill de dados.

**Options:**

### Option A: Tratar reservado/curto como colisão — acrescentar sufixo aleatório
- Se o prefixo sanitizado é reservado ou tem menos de 3 caracteres, aplica `appendRandomSuffix` (`admin` → `admin_3fa`, `me` → `me_3fa`, `ab` → `ab_3fa`); a checagem de colisão segue igual.
- **Pros:** reaproveita o mecanismo existente; o nickname continua reconhecível pelo prefixo do e-mail (a intenção do project-plan); uma regra só.
- **Cons:** handles como `me_3fa` são pouco "limpos" (o usuário pode trocá-los depois pelo `PATCH`).

### Option B: Cair no fallback `user_<random>` de `phase-02-auth/TD-10`
- Reservado ou curto é tratado como prefixo vazio: `user_<8 hex>`.
- **Pros:** reutiliza o fallback já decidido; resultado sempre válido e uniforme.
- **Cons:** descarta o prefixo do e-mail, contrariando "o prefixo do e-mail se torna o nome do canal"; o usuário recebe um handle sem relação com ele.

### Option C: Regras separadas — completar os curtos e sufixar os reservados
- Prefixo curto é completado até 3 caracteres (ex.: `ab` → `ab0`); reservado recebe sufixo.
- **Pros:** handles curtos ficam mais limpos.
- **Cons:** duas regras para manter e testar; o preenchimento determinístico aumenta colisões (todo `ab@` vira `ab0`) e cai no sufixo aleatório de qualquer jeito.

**Recommendation:** **Option A (sufixo aleatório, como numa colisão)** — mantém o vínculo com o prefixo do e-mail exigido pelo project-plan, reusa `appendRandomSuffix` e reduz a correção a uma condição a mais na derivação, com a validação apoiada nas mesmas constantes do `PATCH` (`NICKNAME_PATTERN` e `RESERVED_NICKNAMES`), o que fecha a divergência entre cadastro e edição.

**Decision:** A — prefixo reservado ou com menos de 3 caracteres recebe sufixo aleatório (`appendRandomSuffix`), como numa colisão.

---

## TD-03: Token `--progress-track` no tema escuro

**Scope:** Frontend

**Trigger:** em `app/globals.css`, `--progress-track` vale `#e3e3e3` no claro e `#ffffff` no escuro — o mesmo valor do indicador (`--primary` escuro) — então uma barra de progresso que o usasse ficaria invisível no dark mode.

**Context:** na Fase 04 o token não foi adotado por causa disso: o primitivo `components/ui/progress.tsx` usa `bg-muted` (igual ao track no claro) e o drift report (`phase-04-video-channel-management/frontend-drift-report.md`) registrou a troca como condicionada à correção do token. O valor correto viria do Figma (Track `157:1939`), mas o MCP do Figma está sem cota até o próximo ciclo.

**Options:**

### Option A: Corrigir o valor escuro e adotar o token no primitivo `Progress`
- `--progress-track` escuro passa a `#3d3d3d` (mesmo valor de `--muted`/`--border` no escuro, a escala neutra que o DS já usa para trilhas e superfícies); o token é exposto no `@theme inline` e o `Progress` troca `bg-muted` por ele, fechando o item do drift report.
- **Pros:** alinha o código ao token nomeado no Figma; o claro não muda (`#e3e3e3`); corrige a causa, não o sintoma.
- **Cons:** o valor escuro é inferido do DS, não lido do Figma; precisa ser confirmado na reauditoria quando a cota voltar.

### Option B: Remover o token e manter `bg-muted`
- Apaga `--progress-track` das duas paletas; o `Progress` segue com `bg-muted`.
- **Pros:** menos tokens; nenhuma inferência de valor.
- **Cons:** perde a paridade com a variável do Figma; se o DS diferenciar track de muted no futuro, o token volta.

### Option C: Adiar até a reauditoria do Figma
- Nada muda agora; a correção acontece quando a cota do MCP voltar, lendo o valor real.
- **Pros:** nenhum valor inventado.
- **Cons:** o item fica aberto e a task não fecha o escopo pedido; o token continua com um valor que quebraria a barra se alguém o adotasse.

**Recommendation:** **Option A (corrigir para `#3d3d3d` e adotar no `Progress`)** — o claro já coincide com `muted` e no escuro o DS usa `#3d3d3d` para `muted`/`border`/`accent`, então o valor inferido é o mais coerente com a paleta existente; fica registrado como inferência a confirmar na reauditoria do Figma (ajuste via `/decide` como Revision se o Figma divergir).

**Decision:** A — `--progress-track` escuro = `#3d3d3d` e adoção do token no primitivo `Progress` (valor inferido; confirmar na reauditoria do Figma).

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Estratégia para zerar a dívida de lint no código de teste | A — corrigir o código, sem mudar a config | A |
| TD-02 | Backend | Nickname do cadastro com prefixo reservado ou < 3 caracteres | A — sufixo aleatório, como numa colisão | A |
| TD-03 | Frontend | Token `--progress-track` no tema escuro | A — `#3d3d3d` e adoção no `Progress` | A |
