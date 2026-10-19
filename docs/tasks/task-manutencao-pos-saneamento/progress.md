# task-manutencao-pos-saneamento — Progress

**Status:** completed
**SIs:** 4/4 completed

### SI-1 — Remover o log de depuração do BFF de login
- **Status:** completed
- **Tests:** 6 passing (`app/api/auth/login/__tests__/route.integration.test.ts`, +1 caso: nenhum `console.log`/`info`/`debug` em sucesso nem em erro 401 do upstream); `tsc --noEmit` e `eslint app/api/auth/login` limpos
- **Observations:**
  - `route.ts` não contém mais nenhuma chamada a `console.`; a saída do Vitest para este arquivo deixou de mostrar os envelopes e objetos `Response` do upstream.

### SI-2 — Estabilizar o E2E `studio-videos › 2.2` e corrigir a lista do estúdio que não reflete o fim do processamento
- **Status:** completed
- **Tests:** Unit 9 passing (`use-processing-poll.test.ts` 8, +3; `owner-video-list.test.tsx` 1, novo — falha sem a correção e passa com ela); E2E `tests/studio-videos.e2e-spec.ts --repeat-each=10` contra `next build` + `MSW_ENABLED=true next start`: 50/50, cenário 2.2 10/10 (17,1–17,3 s); regressão dos outros consumidores do hook (`video-edit-form`, `upload-status-row` ×2): 30 passing; `tsc` e lint limpos
- **Observations:**
  - **Escopo emendado com aprovação do usuário.** A 1ª correção (só no teste: esperar o 3º poll) ainda falhou 2/5. Um diagnóstico com Playwright (polls, refresh do RSC, payload e badge com tempo relativo; 34 execuções) mostrou um bug real: em ~1 de cada 4–10 execuções o 3º poll devolve `ready`, o `router.refresh()` dispara e o RSC responde com `processing_status: "ready"`, mas o router descarta a resposta (nenhum re-render, nenhum prefetch de link depois) e a linha fica em "Processing" até recarregar a página. A SI foi emendada no plano (restrição "não alterar `hooks/`" removida; mock intocado).
  - Correção: `useProcessingPoll(ids, onSettled?)` entrega o vídeo terminal ao callback (lido via `useEffectEvent`, React 19.2 — trocar o callback não reinicia o timer) antes do `router.refresh()`; o `OwnerVideoList` aplica `patchFrom` na linha. O refresh continua para reler o resto da página.
  - **Follow-up:** a edição de vídeo (`video-edit-form.tsx`) e a linha de upload (`upload-status-row.tsx`) também dependem só do `router.refresh()` para sair de "processing" e estão sujeitas ao mesmo descarte; podem adotar o `onSettled` numa task própria. A causa no router do Next 16.2.6 (por que descarta o refresh) não foi investigada a fundo.

### SI-3 — Atualizar o `testing-guide-next-frontend` para o E2E contra o build de produção
- **Status:** completed
- **Tests:** no tests (documentação de skill) — verificação por grep: 0 ocorrências de "not yet installed" / "does not exist yet" / "once installed" / "containerized `next dev`" / "against a production build"; as menções restantes a `next dev` são as proibições novas
- **Observations:**
  - Arquivos: `SKILL.md` (nota de tooling 2026-10, anti-pattern, §6, checklist e passo 4 do "How to use"), `references/file-conventions.md` (`playwright.config.ts` com `workers: 1`, sequência restart → build → `MSW_ENABLED=true npm run start` → Playwright via `node …/cli.js`), `references/gotchas.md` (motivo do build de produção e regra `workers: 1`) e `artifacts/pages.md`.
  - A contagem de cenários E2E prevista na ação 1 não foi escrita na nota de tooling: ela muda a cada fase e envelheceria o guia; o resto da ação foi aplicado.

### SI-4 — Sincronizar README e project-plan com o saneamento da Fase 04
- **Status:** completed
- **Tests:** no tests (documentação; ACs verificados por leitura e grep — nenhuma menção restante à dívida de lint ou à validação de nicknames como pendência)
- **Observations:**
  - README ganhou a subseção `### Lint` em "🧪 Testes" (comandos dos dois subprojetos + política `--max-warnings 0`), a regra de nickname reservado/curto em "Autenticação (Fase 02)" e a nota de sanitização das transcrições (regra *Confidentiality* do `CLAUDE.md`) no bullet de `_claude-sessions/`, sem citar nenhum dado.
  - A pendência da Fase 04 que resta no README e no `project-plan.md` é só a reauditoria do frame Figma 154:1724 e do valor escuro de `--progress-track`.

## Final verification (2026-10-19)

- **Frontend tests:** `npm test` → 78 arquivos / 529 testes passando.
- **Frontend type check:** `npx tsc --noEmit` → 0 erros.
- **Frontend lint:** `npm run lint` → 0 problemas.
- **Frontend build:** `npm run build` → ok.
- **Frontend E2E:** Playwright no host contra `next build` + `MSW_ENABLED=true npm run start` → **50/50** na primeira execução completa (inclusive `studio-videos › 2.2`).
- **Backend:** nenhum arquivo de `nestjs-project/` foi alterado nesta task — suítes não reexecutadas.

## Follow-ups (fora do escopo desta task)

- `components/studio/video-edit-form.tsx` e `components/upload/upload-status-row.tsx` ainda dependem só do `router.refresh()` quando o processamento termina; adotar o `onSettled` do `useProcessingPoll` se o mesmo sintoma aparecer.
- Causa raiz do router do Next descartar o payload RSC do `router.refresh()` disparado pelo poll não foi investigada.
- Reauditoria do Figma (frame 154:1724) para confirmar o valor escuro de `--progress-track` quando a cota do MCP do Figma voltar.
