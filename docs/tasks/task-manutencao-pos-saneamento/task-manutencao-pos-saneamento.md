---
kind: task
name: task-manutencao-pos-saneamento
test_specs_aware: true
sources_mtime:
  docs/tasks/task-manutencao-pos-saneamento/context.md: "2026-10-19T21:42:04Z"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T13:27:46Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T21:30:21Z"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T20:16:01Z"
  docs/phases/phase-04-video-channel-management/context.md: "2026-10-19T20:16:01Z"
---

# Task — Manutenção pós-saneamento da Fase 04

## Objective

manutenção após a task de saneamento da Fase 04. (1) next-frontend: remover o console.log(error, data, response) de depuração em app/api/auth/login/route.ts, que grava access_token e refresh_token no log do servidor e polui a saída do Vitest; (2) docs: sincronizar README.md e docs/project-plan.md com a task-saneamento-fase-04 — retirar das pendências da Fase 04 a dívida de lint do backend e a validação de nicknames (resolvidas), documentar a regra de nickname reservado ou com menos de 3 caracteres recebendo sufixo aleatório, registrar na seção de testes a política de lint (backend com --max-warnings 0, frontend com 0 problemas) e, em "Processo com IA", que as transcrições são sanitizadas antes do commit (regra de confidencialidade do CLAUDE.md); manter como pendência só a reauditoria do Figma; (3) .claude/skills/testing-guide-next-frontend: atualizar as instruções de E2E para a convenção next build + next start com MSW_ENABLED=true e workers: 1 (hoje descreve next dev e lista "Playwright contra production build" como anti-pattern); (4) next-frontend: estabilizar o E2E tests/studio-videos.e2e-spec.ts › 2.2 processing-row-updates-automatically, que falha por timing (o mock mantém becomes-ready-02 em processing por 2 leituras, o polling é de 3 s e o toHaveText espera 15 s), preferencialmente sem alterar o mock compartilhado com o Vitest.

---

## Step Implementations

### SI-1 — Remover o log de depuração do BFF de login

**Description:** Remove o `console.log(error, data, response)` de `app/api/auth/login/route.ts`, que em login bem-sucedido escreve o `access_token` e o `refresh_token` do upstream no log do servidor — contraria a custódia de tokens no servidor de `phase-02-auth-frontend` (tokens selados no cookie `iron-session`, nunca expostos) e polui a saída do Vitest.

**Technical actions:**

1. `next-frontend/app/api/auth/login/route.ts` — remover a linha `console.log(error, data, response);` (nenhum outro log do BFF de login passa a existir no lugar).
2. `next-frontend/app/api/auth/login/__tests__/route.integration.test.ts` — acrescentar o caso "não escreve nada no console em login bem-sucedido nem em erro do upstream", com `vi.spyOn(console, "log")` (e `info`/`debug`) e asserção de zero chamadas.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /api/auth/login` | Integration (MSW): nenhum `console.log` em sucesso e em erro; regressão dos casos existentes (cookie de sessão, 400/401/403) | `next-frontend/app/api/auth/login/__tests__/route.integration.test.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `POST /api/auth/login` com credenciais válidas retorna `200` com corpo `{}`, grava o cookie de sessão e não escreve nada no console do servidor.
- `POST /api/auth/login` com erro do upstream (ex.: `401 INVALID_CREDENTIALS`) repassa o envelope de erro com o mesmo status e não escreve nada no console do servidor.
- `app/api/auth/login/route.ts` não contém `console.`.

---

### SI-2 — Estabilizar o E2E `studio-videos › 2.2` e corrigir a lista do estúdio que não reflete o fim do processamento

_Emenda (2026-10-19, aprovada pelo usuário durante o /implement): o diagnóstico mostrou que a instabilidade não era de timing — em ~1 de cada 4–10 execuções o 3º poll devolve `ready`, o `router.refresh()` é chamado e o RSC responde com `processing_status: "ready"`, mas o router descarta a resposta e a linha fica em "Processing" até recarregar a página. A SI passa a corrigir o app; a restrição original "não alterar `hooks/`" foi removida (o mock compartilhado continua intocado)._

**Description:** Faz a lista do estúdio refletir o fim do processamento sem depender de o `router.refresh()` ser aplicado: o `useProcessingPoll` passa a entregar o vídeo devolvido pelo poll a um callback opcional, e o `OwnerVideoList` atualiza a linha na hora com `patchFrom` (o mesmo patch local que as mutações do kebab já usam), mantendo o `router.refresh()` para reler o resto da página (per `video-channel-management/TD-12`: polling restrito ao processamento + invalidação por recarga de rota). O E2E 2.2 passa a esperar o poll que assenta o vídeo em vez de correr contra o relógio, sem alterar o mock compartilhado com o Vitest (per `next-frontend-msw-foundation`).

**Technical actions:**

1. `next-frontend/hooks/use-processing-poll.ts` — aceitar `onSettled?: (video: Video) => void` como 2º parâmetro; quando um id chega a `ready|failed`, chamar `onSettled(video)` antes do `router.refresh()`. Ler o callback por `useEffectEvent` (React 19.2) para não reiniciar o timer quando a identidade do callback muda.
2. `next-frontend/components/studio/owner-video-list.tsx` — passar `onSettled` que aplica `patchFrom(row, video)` à linha do id que assentou.
3. `next-frontend/tests/studio-videos.e2e-spec.ts` › 2.2 — esperar `polls.length >= 3` (3 = `READS_UNTIL_READY` + 1, comentário apontando `mocks/store.ts`) e então o badge "Draft" (`timeout: 10_000`); manter a verificação de que o polling para depois que o vídeo assenta.
4. Não alterar `mocks/store.ts`, `mocks/handlers/**` nem `playwright.config.ts`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `useProcessingPoll` | Unit: `onSettled` recebe o vídeo terminal (ready e failed) uma vez, antes do refresh; não é chamado enquanto `processing`; trocar a identidade do callback não reinicia o timer | `next-frontend/hooks/__tests__/use-processing-poll.test.ts` |
| `OwnerVideoList` | Unit (jsdom, `next/navigation` mockado com `refresh` no-op, MSW para `/api/videos/:id`): a linha em processing vira "Draft" pelo resultado do poll mesmo sem novo payload do RSC | `next-frontend/components/studio/__tests__/owner-video-list.test.tsx` |
| Polling do painel do estúdio | E2E (Playwright contra `next build` + `MSW_ENABLED=true next start`): arquivo completo com `--repeat-each=5` | `next-frontend/tests/studio-videos.e2e-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Em `/studio/videos`, uma linha em processing passa a mostrar o status final ("Draft" para um rascunho pronto) assim que o poll devolve `ready`, mesmo quando o `router.refresh()` não é aplicado.
- `tests/studio-videos.e2e-spec.ts` passa em 5 repetições consecutivas (`--repeat-each=5`) contra o build de produção com MSW.
- Depois que o vídeo assenta, nenhum novo `GET /api/videos/{id}` é feito para ele.
- `git diff` desta SI não toca `mocks/` nem `playwright.config.ts`; as telas que também usam o hook (edição de vídeo e upload) continuam funcionando sem passar o callback.

---

### SI-3 — Atualizar o `testing-guide-next-frontend` para o E2E contra o build de produção

**Description:** Alinha o skill de testes do frontend à convenção vigente desde a Fase 04 (documentada em `next-frontend/CLAUDE.md`): Playwright no host contra `next build` + `MSW_ENABLED=true next start`, `workers: 1`, sem `webServer` — o guia ainda diz que o Playwright "não está instalado", manda usar `next dev` e lista "rodar contra production build" como anti-pattern.

**Technical actions:**

1. `.claude/skills/testing-guide-next-frontend/SKILL.md` — atualizar a nota "Tooling status" (Playwright instalado, `playwright.config.ts` com `workers: 1`, 50 cenários E2E); reescrever o anti-pattern da linha "Add `webServer` … or run Playwright against a production build" para "Add `webServer` / rodar E2E contra `next dev`"; ajustar §6 (E2E Terminology) para "containerized production build (`next start`)".
2. `.claude/skills/testing-guide-next-frontend/references/file-conventions.md` — `playwright.config.ts` existe (`workers: 1`, `retries` só em CI, sem `webServer`); comandos de E2E: `restart` → `npm run build` → `MSW_ENABLED=true npm run start` → `node node_modules/@playwright/test/cli.js test` no host.
3. `.claude/skills/testing-guide-next-frontend/references/gotchas.md` (seção "Playwright is containerized") e `artifacts/pages.md` (linha do E2E) — trocar `next dev` por build de produção + `next start` e registrar o motivo (o `next dev` serve rotas profundas de forma intermitente no bind mount do Windows) e a regra `workers: 1` (store do MSW compartilhado por servidor).

**Tests:** _(empty — documentação de skill; verificado por grep no AC)_

**Dependencies:** none

**Acceptance criteria:**

- Nenhum arquivo de `.claude/skills/testing-guide-next-frontend/` recomenda `next dev` para E2E nem diz que o Playwright "não está instalado" / que `playwright.config.ts` "não existe".
- O guia descreve o E2E contra `next build` + `MSW_ENABLED=true next start`, com `workers: 1` e sem `webServer`, consistente com `next-frontend/CLAUDE.md` § "E2E test prerequisites".

---

### SI-4 — Sincronizar README e project-plan com o saneamento da Fase 04

**Description:** Atualiza `README.md` e `docs/project-plan.md` com o que a `task-saneamento-fase-04` entregou e com a regra de confidencialidade já registrada no `CLAUDE.md`, deixando como pendência da Fase 04 apenas a reauditoria do Figma.

**Technical actions:**

1. `README.md` § "✅ Funcionalidades implementadas → Autenticação (Fase 02)" — registrar que o nickname vem do prefixo do e-mail e que prefixo reservado ou com menos de 3 caracteres recebe sufixo aleatório (mesma regra do `PATCH /channels/me`).
2. `README.md` § "🧪 Testes" — acrescentar a política de lint: backend `npm run lint` com `--max-warnings 0` (0 erros e 0 warnings, inclusive specs e e2e) e `npx eslint …` sem `--fix` para checar; frontend `npm run lint` com 0 problemas.
3. `README.md` § "📚 Fases do Projeto" (parágrafo de pendências) e `docs/project-plan.md` (linha `_Status (2026-10-19)_` da Fase 04) — retirar a dívida de lint e a validação de nicknames das pendências, citar a `docs/tasks/task-saneamento-fase-04/` como a entrega que as resolveu, e manter só a reauditoria do Figma (frame 154:1724 e o valor escuro de `--progress-track`).
4. `README.md` § "🤖 Processo com IA" — registrar que as transcrições em `_claude-sessions/` são verificadas e sanitizadas antes do commit e que dados externos ao projeto não entram no repositório (regra "Confidentiality" do `CLAUDE.md`), sem citar nenhum dado específico.

**Tests:** _(empty — documentação; verificado por leitura no AC)_

**Dependencies:** none

**Acceptance criteria:**

- O README e o `project-plan.md` não listam mais a dívida de lint nem a validação de nicknames como pendências da Fase 04; a única pendência citada é a reauditoria do Figma.
- O README descreve a regra de nickname reservado/curto e a política de lint dos dois subprojetos.
- A seção "Processo com IA" do README menciona a sanitização das transcrições e a regra de confidencialidade, sem reproduzir nenhum dado sensível.

---

## Dependency Map

```
SI-1 (root, independent) — remover o log de depuração do BFF de login
SI-2 (root, independent) — lista do estúdio reflete o fim do processamento + E2E studio-videos › 2.2
SI-3 (root, independent) — testing-guide-next-frontend
SI-4 (root, independent) — README + project-plan
```

As quatro SIs são independentes; a ordem acima é a de execução (código e teste primeiro, documentação depois).

---

## Deliverables

- [ ] SI-1 — Remover o log de depuração do BFF de login
- [ ] SI-2 — Estabilizar o E2E `studio-videos › 2.2` e corrigir a lista do estúdio que não reflete o fim do processamento
- [ ] SI-3 — Atualizar o `testing-guide-next-frontend` para o E2E contra o build de produção
- [ ] SI-4 — Sincronizar README e project-plan com o saneamento da Fase 04

**Full test suites:**

- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend lint passes with 0 problems (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend type check passes (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend build passes (`cd next-frontend && docker compose exec next-frontend npm run build`)
- [ ] Frontend E2E passes against the production build with MSW (`next start`; `node node_modules/@playwright/test/cli.js test` on the host — see `next-frontend/CLAUDE.md` § "E2E test prerequisites")
