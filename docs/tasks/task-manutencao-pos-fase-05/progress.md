# task-manutencao-pos-fase-05 — Progress

**Status:** completed
**SIs:** 5/5 completed

### SI-1 — Volume nomeado para os dados do PostgreSQL de desenvolvimento
- **Status:** completed
- **Tests:** no tests (Infra) — verificado no ambiente: `docker compose config` resolve o volume `nestjs-project_pg_data` em `/var/lib/postgresql/data`; `migration:run` aplicou as 7 migrations no banco novo, e depois de `docker compose rm -sf db` + `up -d db` o banco continuou com as 7
- **Observations:**
  - A troca apagou uma única vez o banco de desenvolvimento anterior, como decidido no AMB-2; `migration:run` foi rodado logo depois.
  - O critério de `down` + `up` completo foi verificado aqui recriando só o container `db`; o `down` das duas stacks acontece na SI-2, ao recriar a rede, e confirma o mesmo comportamento.

### SI-2 — Reservar o IP fixo do next-frontend com `ip_range` na rede `streamtube`
- **Status:** completed
- **Tests:** no tests (Infra) — verificado no ambiente: `docker network inspect streamtube` mostra Subnet `172.30.0.0/24`, IPRange `172.30.0.128/25`, Gateway `172.30.0.1`; os containers do backend ficaram em `.128`–`.132` e o `next-frontend` em `.10`; depois do `down`/`up` completo das duas stacks o banco manteve as 7 migrations (confirma a SI-1)
- **Observations:**
  - O plano pedia retirar do `nestjs-project/CLAUDE.md` a observação sobre stacks com 9+ containers, mas ela só existia no `progress.md` da Fase 05; no `CLAUDE.md` o `ip_range` foi acrescentado ao bullet da sub-rede.
  - O critério da requisição com `X-Forwarded-For` vinda do `next-frontend` não foi exercitado ao vivo, porque o servidor da API só sobe a pedido do usuário. `TRUST_PROXY=172.30.0.10` (lido do `.env` via `dotenv`) continua igual ao IP do frontend; o comportamento é coberto pelo e2e `throttler-proxy` na verificação final.

### SI-3 — Renomear o token tipográfico `--text-overlay` para `--text-overlay-md`
- **Status:** completed
- **Tests:** `lib/__tests__/utils.test.ts` 3/3; `components/watch` segue verde (8 arquivos / 33 testes no total com o novo); `tsc --noEmit` e lint limpos. No build de produção, o CSS gerado tem `.text-overlay-md{font-size:16px;line-height:20px;font-weight:400}` sem cor e `.text-overlay{color:var(--overlay)}` só com cor; no player da watch page o tempo sai branco (`rgb(255, 255, 255)` = `--color-neutral-100`), 16px / 20px / 400
- **Observations:**
  - O `lib/utils.ts` já registrava `overlay` no grupo `font-size`; a busca da validação, feita por `text-overlay`, não encontrou a entrada `"overlay"`. O registro foi trocado por `overlay-md`, e com isso `cn` passou a tratar `text-overlay` como cor, coberto pelo teste.
  - O tempo do player trocou `text-body-lg` (16/24) por `text-overlay-md` (16/20), o estilo "Inter/Overlay" do frame. A única mudança visual é a altura de linha do tempo dentro da barra de controles.
  - `globals.css` ganhou um comentário curto junto ao token explicando o sufixo `-md`.

### SI-4 — Centralizar a origem pública da requisição em `lib/request-origin.ts`
- **Status:** completed
- **Tests:** `lib/__tests__/request-origin.test.ts` 3/3; `tsc --noEmit` e lint limpos; E2E `studio-video-edit` + `studio-upload-processing` 11/11 no build de produção com MSW. Conferido no navegador logado: o link do cartão de vídeo mostra `localhost:3001/watch/ready-draft-01` nas duas telas e, com `X-Forwarded-Host: streamtube.example` + `X-Forwarded-Proto: https`, `streamtube.example/watch/ready-draft-01`
- **Observations:**
  - A tela de upload em processamento (`app/(app)/studio/upload/[publicId]/page.tsx`) tinha uma segunda cópia idêntica de `requestOrigin()`, encontrada no planejamento; as duas páginas agora importam `@/lib/request-origin`, e o import de `headers` saiu de ambas.
  - O `VideoConfigCard` exibe o link sem o protocolo (`host/watch/id`); a origem completa (com `https://`) é a que o botão de copiar usa.

### SI-5 — Investigar o alias `utils` do shadcn CLI e tornar os próximos installs seguros
- **Status:** completed
- **Tests:** no tests (investigação + documentação) — verificado numa cópia mínima do projeto em `/tmp` dentro do container: o add do `slider` seguido do procedimento documentado deixa `import { cn } from "@/lib/utils"`, `package.json` e `package-lock.json` byte-idênticos aos originais (sha1) e sem `cn` no `node_modules`; no projeto, `package.json`, `package-lock.json` e `components/ui/**` ficaram sem mudanças
- **Observations:**
  - Causa: o próprio registry oficial (`ui.shadcn.com/r/styles/{style}/{name}.json`) publica hoje os itens com `import { cn } from "cn"` e `dependencies: ["cn"]` — confirmado em `radix-nova` e `new-york-v4`, e em `slider`, `button`, `progress` e `tabs`. O CLI não reescreve esse import. Não é configuração do projeto: `npx shadcn info` resolve `utils → @/lib/utils`; `components.json` e `tsconfig.json` não mudaram.
  - O CLI pinado (`shadcn` 4.7.0) e o `shadcn@latest` (4.22.1) se comportam igual, porque buscam o mesmo registry remoto. A documentação passa a recomendar o binário pinado (`npx shadcn`), para a versão do CLI acompanhar o lockfile.
  - Procedimento em `next-frontend/CLAUDE.md` ("Adding shadcn primitives"): dry-run/view → add → trocar `from "cn"` por `@/lib/utils` → `npm uninstall cn` no container + `git checkout -- package.json package-lock.json` no host → conferir. O `npm uninstall cn` sozinho reescreve o `package-lock.json`, daí o `git checkout`. A regra `.claude/rules/next-frontend-ui.md` aponta para esse procedimento.
  - O container `next-frontend` não tem `git`; na reprodução, os manifestos foram comparados por sha1.

## Final verification (2026-10-20)

- Backend: unit + integração 61 suítes / 529 testes; e2e 18 suítes / 124 testes (inclui `throttler-proxy`, que cobre a confiança no `X-Forwarded-For` do BFF citada na SI-2); `tsc --noEmit` limpo; eslint (`{src,apps,libs,test}/**/*.ts`, `--max-warnings 0`, sem `--fix`) limpo.
- Frontend: Vitest 95 arquivos / 604 testes; `tsc --noEmit` limpo; lint limpo; build de produção ok; Playwright 57/57 contra `next start` com MSW.
- Nenhuma correção foi necessária na verificação.
