# task-dx-volumes-e-jest — Progress

**Status:** completed
**SIs:** 4/4 completed

### SI-1 — Sobrepor `node_modules` com volume nomeado na stack do backend
- **Status:** completed
- **Tests:** no tests (Infra) — ACs verificados: volume `nestjs-project_node_modules` criado; `node_modules` em `ext4` e o código em `9p`; `npm install` como `node` sem erro (38 s, 689 pacotes); `require("@nestjs/core")` em 271 ms; `npx tsc --noEmit` exit 0 em 7 s; rede `streamtube` com as duas stacks anexadas
- **Observations:**
  - O `chown` no `Dockerfile.dev` funcionou como previsto: o volume novo nasceu com dono `node` (`drwxr-xr-x node node`), sem precisar de `user:` no compose nem de `sudo`.
  - Ganho medido além do esperado: `npx tsc --noEmit` passou de minutos (compilação fria no bind mount) para 7 s. O `node_modules` do host em `nestjs-project/` permanece no disco e fica desatualizado em relação ao do container — é o comportamento documentado no SI-4.

### SI-2 — Sobrepor `node_modules` e `.next` com volumes nomeados na stack do frontend
- **Status:** completed
- **Tests:** no tests (Infra) — ACs verificados: volumes `next-frontend_node_modules` e `next-frontend_next_cache` em `ext4` com dono `node`; `npm install` em 43 s (575 pacotes); `require("jsdom")` em 868 ms (antes ~100 s); `npm test` em paralelo 24 arquivos / 91 testes em 22,8 s sem `Timeout waiting for worker`; dev server com `MSW_ENABLED=true` responde 200 em `/` e `/login` e loga `[msw] server-side mocking enabled`; Playwright no host 23/23 em 24,8 s; `npm run openapi:types` regenerou `types.gen.ts` idêntico (0 linhas de diff) pelo bind mount
- **Observations:**
  - Após `openapi:types` o `git status` marca `types.gen.ts` como modificado só por fim de linha (o gerador escreve LF, o checkout está em CRLF por `autocrlf`); `git diff` tem 0 linhas — comportamento pré-existente, não introduzido por esta task.
  - O dev server com MSW ficou ativo no container após o Playwright (`docker compose restart next-frontend` o encerra). O `.next` agora vive no volume: o host não vê mais essa pasta, e o `tsc` do container continua enxergando `.next/dev/types/**` normalmente.

### SI-3 — Encerrar o Jest do backend com `--forceExit`
- **Status:** completed
- **Tests:** no tests (Infra) — ACs verificados: `npm test -- --runInBand src/config/env.validation.spec.ts` encerra sozinho com exit 0 em 3 s (3 testes); `npm run test:e2e -- --runInBand test/auth-confirm-email.e2e-spec.ts` encerra sozinho com exit 0 em 10 s (5 testes); `test:watch`, `test:integration` e `test:cov` inalterados
- **Observations:**
  - O Jest agora imprime `Force exiting Jest: Have you considered using --detectOpenHandles…` ao final — é o aviso esperado da flag e confirma que handles continuam abertos; a correção de raiz (fechar conexões nas suítes com banco) fica para a task de higiene já sugerida no `CLAUDE.md`.
  - `test:integration` compartilha o mesmo problema de encerramento e ficou fora do escopo por decisão da prosa da task; candidato a receber a flag na mesma task de higiene.
  - `package.json` e `CLAUDE.md` do backend usam CRLF (a checagem anterior de fim de linha estava errada para esses dois arquivos); as edições preservaram o CRLF.

### SI-4 — Documentar o novo ciclo de dependências nos CLAUDE.md e no README
- **Status:** completed
- **Tests:** no tests (documentação) — ACs verificados por grep: nenhuma ocorrência de `first time only` / `apenas na primeira vez`; os dois `CLAUDE.md` explicam o volume, quando rodar `npm install` e o efeito de `down -v`; `next-frontend/CLAUDE.md` e README registram a exceção do Playwright (`npm ci` no host); `nestjs-project/CLAUDE.md` § Jest Configuration cita `--forceExit`; zero `host.docker.internal`
- **Observations:**
  - Os três arquivos estão em CRLF e as edições preservaram o fim de linha.
  - `next-frontend/lib/api/types.gen.ts` apareceu como modificado após o `openapi:types` do SI-2 apenas por fim de linha (0 linhas de diff); restaurado com `git checkout` para não poluir o commit.

### Final verification (2026-10-18)
- **Backend (volume `node_modules`):** `npm test -- --runInBand` → 24 suítes / 156 testes passing em 23 s (antes desta task: 242 s), encerrando sozinho; `npm run test:e2e -- --runInBand` → 4 suítes / 57 testes em 17 s; `tsc --noEmit` exit 0 em 5 s; ESLint sem `--fix` → 189 problemas pré-existentes (nenhum novo; o único `.ts` tocado, `migrations.integration-spec.ts`, passa limpo).
- **Frontend (volumes `node_modules` + `.next`):** `npm test` em paralelo → 24 arquivos / 91 testes em 23 s; `tsc --noEmit` exit 0 em 8 s; `npm run lint` 0 erros (2 avisos pré-existentes); Playwright no host 23/23 em 18,8 s com o dev server `MSW_ENABLED=true`.
- **Cadeia OpenAPI:** `scripts/sync-openapi.sh` + `openapi:types` → `git diff --exit-code` limpo (`types.gen.ts` só muda fim de linha; restaurado com `git checkout`).
- **Correção de teste feita durante a verificação (fora dos SIs):** a primeira rodada completa do backend falhou em `src/database/migrations.integration-spec.ts` com `deadlock detected` — o `beforeAll` disparava cinco `DROP TABLE … CASCADE` concorrentes via `Promise.all` em conexões distintas do pool, e o Postgres detectava deadlock pela ordem de locks das FKs; o spec passava isolado (3/3), ou seja, corrida pré-existente que o ambiente mais rápido tornou provável. Trocado por um único `DROP TABLE IF EXISTS … CASCADE` com todas as tabelas; duas rodadas completas seguidas verdes.
- **Ambiente ao final:** dev server do frontend com MSW continua ativo no container (`docker compose restart next-frontend` o encerra); API dev server não está ativo. Os `node_modules` do host nas duas pastas ficaram no disco e não são mais os dos containers (documentado no SI-4).
