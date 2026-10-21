---
kind: task
name: task-manutencao-pos-fase-05
test_specs_aware: true
sources_mtime:
  docs/tasks/task-manutencao-pos-fase-05/context.md: "2026-10-20T02:56:48Z"
  docs/decisions/technical-decisions-watch-page.md: "2026-10-20T02:51:17Z"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T21:30:21Z"
  docs/phases/phase-05-watch-page/context.md: "2026-10-20T02:42:59Z"
---

# Task — Manutenção pós-Fase 05

## Objective

manutenção após a Fase 05. (1) nestjs-project/compose.yaml: dar ao serviço db um volume nomeado para os dados do PostgreSQL, para que recriar a rede streamtube ou o container não apague o banco de desenvolvimento; atualizar o aviso de nestjs-project/CLAUDE.md (seção 'IP real do visitante atrás do BFF') que hoje manda rodar migration:run de novo após recriar a rede. (2) nestjs-project/compose.yaml: acrescentar ip_range ao ipam da rede streamtube (sub-rede 172.30.0.0/24), de modo que os IPs dinâmicos dos containers do backend nunca possam ocupar 172.30.0.10, o IP fixo do next-frontend em que a API confia (TRUST_PROXY). (3) next-frontend/app/globals.css: o token tipográfico --text-overlay colide com o token de cor --color-overlay — a classe text-overlay gera tamanho de fonte e cor #00000080 ao mesmo tempo, o que deixou o tempo do player quase invisível na Fase 05; renomear o token tipográfico (ou removê-lo, se continuar sem uso) e registrar o nome novo no extendTailwindMerge de lib/utils.ts, sem regressão visual nas telas existentes. (4) next-frontend: a página app/(app)/studio/videos/[publicId]/edit/page.tsx mantém uma cópia local de requestOrigin(); passar a usar lib/request-origin.ts, criado na Fase 05. (5) next-frontend: investigar por que npx shadcn@latest add slider resolveu o alias de utils como o pacote npm cn (gerou import { cn } from "cn" e o adicionou ao package.json), embora components.json declare utils = @/lib/utils, e corrigir a configuração ou documentar no next-frontend/CLAUDE.md o procedimento seguro para os próximos installs.

---

## Step Implementations

### SI-1 — Volume nomeado para os dados do PostgreSQL de desenvolvimento

**Description:** Dá ao serviço `db` do `nestjs-project/compose.yaml` um volume nomeado, para que recriar o container ou a rede `streamtube` deixe de apagar o banco de desenvolvimento, e alinha o `nestjs-project/CLAUDE.md` ao novo comportamento.

**Technical actions:**

1. Em `nestjs-project/compose.yaml`, montar no serviço `db` o volume nomeado `pg_data` em `/var/lib/postgresql/data` (diretório de dados da imagem `postgres:17`) e declará-lo no bloco `volumes:` de topo, ao lado de `node_modules` e `rustfs_data` (topologia de compose por stack, per `saneamento-fase-02-e-infra/TD-01`; serviços no compose do backend, per `phase-03-videos/TD-10`).
2. Em `nestjs-project/CLAUDE.md`, registrar o volume `pg_data` na lista de serviços (o banco sobrevive a `docker compose down`/`up` e a recriações da rede; só `docker compose down -v` o apaga, junto com os demais volumes nomeados) e substituir, na seção "IP real do visitante atrás do BFF", o aviso de que recriar o container do Postgres apaga os dados.
3. Documentar no mesmo `CLAUDE.md` o passo único da troca: na primeira subida com `pg_data` o banco nasce vazio e é preciso rodar `npm run migration:run` uma vez — os dados de desenvolvimento anteriores não são migrados (resolução AMB-2 da validação).
4. Aplicar no ambiente local: `docker compose up -d` (recria o `db` com o volume) seguido de `docker compose exec nestjs-api npm run migration:run`.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose config` (em `nestjs-project/`) mostra o serviço `db` montando o volume `pg_data` em `/var/lib/postgresql/data`, e `pg_data` aparece entre os volumes nomeados da stack
- Depois de `docker compose down` seguido de `docker compose up -d` (sem `-v`), `SELECT count(*) FROM migrations` no banco `streamtube` retorna o mesmo número de migrations aplicadas, sem rodar `migration:run` de novo
- `nestjs-project/CLAUDE.md` não afirma mais que recriar o container do Postgres apaga os dados, documenta `pg_data` (e o efeito de `down -v`) e o `migration:run` único da troca

---

### SI-2 — Reservar o IP fixo do next-frontend com `ip_range` na rede `streamtube`

**Description:** Restringe a alocação dinâmica de IPs da rede `streamtube` a uma faixa que não contém `172.30.0.10`, para que nenhum container do backend ocupe o IP fixo do `next-frontend` — o único endereço em que a API confia para `X-Forwarded-For` (`TRUST_PROXY`).

**Technical actions:**

1. Em `nestjs-project/compose.yaml`, no `ipam.config` da rede `streamtube`, manter `subnet: 172.30.0.0/24` e acrescentar `ip_range: 172.30.0.128/25` (pool dinâmico `.128`–`.254`) e `gateway: 172.30.0.1` explícito; atualizar o comentário do bloco explicando que o IP fixo `172.30.0.10` do `next-frontend` fica fora do pool dinâmico (per `watch-page/TD-03`, Revisions 2026-10-19 — sub-rede fixa + IP fixo do `next-frontend`).
2. Recriar a rede no ambiente local: `docker compose down` em `next-frontend/` e em `nestjs-project/`, depois `docker compose up -d` em `nestjs-project/` primeiro e em `next-frontend/` em seguida (o banco sobrevive graças ao volume da SI-1).
3. Atualizar a seção "IP real do visitante atrás do BFF" do `nestjs-project/CLAUDE.md`: registrar o `ip_range` (pool dinâmico fora do IP fixo) e retirar a observação de que só uma stack com 9+ containers colidiria com `.10`.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-1 — recriar a rede recria o container `db`; sem o volume nomeado o banco de desenvolvimento seria apagado

**Acceptance criteria:**

- `docker network inspect streamtube` mostra `Subnet` `172.30.0.0/24`, `IPRange` `172.30.0.128/25` e `Gateway` `172.30.0.1`
- Com as duas stacks no ar, todos os containers do backend têm IP entre `172.30.0.128` e `172.30.0.254`, e o `next-frontend` mantém `172.30.0.10`
- Uma requisição feita de dentro do `next-frontend` para a API com `X-Forwarded-For: 203.0.113.7` continua sendo rastreada pelo IP informado (a API segue confiando no `next-frontend` via `TRUST_PROXY`)

---

### SI-3 — Renomear o token tipográfico `--text-overlay` para `--text-overlay-md`

**Description:** Elimina a colisão entre o token tipográfico `--text-overlay` e o token de cor `--color-overlay` — a classe `text-overlay` gerava tamanho de fonte e a cor `#00000080` ao mesmo tempo — mantendo a contrapartida do estilo de texto "Inter/Overlay" do Figma com o nome `text-overlay-md` (resolução AMB-1 da validação).

**Technical actions:**

1. Em `next-frontend/app/globals.css` (`@theme inline`), renomear `--text-overlay`, `--text-overlay--line-height` e `--text-overlay--font-weight` para `--text-overlay-md`, `--text-overlay-md--line-height` e `--text-overlay-md--font-weight`, com os valores inalterados (16px / 20px / 400); `--color-overlay` e `--overlay` não mudam.
2. Em `next-frontend/lib/utils.ts`, trocar `"overlay"` por `"overlay-md"` no grupo `font-size` do `extendTailwindMerge`, para que `text-overlay` volte a ser tratado só como utilitário de cor.
3. Em `.claude/rules/next-frontend-ui.md` (§ Typography utilities), trocar `text-overlay` por `text-overlay-md` na lista de estilos de texto.
4. Em `next-frontend/components/watch/player-controls.tsx`, usar `text-overlay-md` no tempo atual / duração (o estilo "Inter/Overlay" que o frame do player pede) no lugar de `text-body-lg`, removendo o comentário que proibia `text-overlay`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `cn` (`lib/utils.ts`) | Unit: `text-overlay-md` pertence ao grupo `font-size` (conflita com `text-body-lg`, o último vence) e convive com utilitários de cor (`text-neutral-100`, `text-overlay`) | `next-frontend/lib/__tests__/utils.test.ts` |

**Dependencies:** none

**Acceptance criteria:**

- O CSS gerado pelo build define `.text-overlay-md` com tamanho 16px, line-height 20px e peso 400 e sem declaração de cor; `text-overlay` passa a produzir só a cor do token `--color-overlay`
- No player da watch page, o texto "0:00 / 0:00" é renderizado em branco (`--color-neutral-100`) com 16px / 20px
- `next-frontend/app/globals.css` não define mais `--text-overlay`, e a lista de estilos de texto de `.claude/rules/next-frontend-ui.md` traz `text-overlay-md`
- As telas existentes que não usam o token (estúdio, canal, auth) não mudam visualmente

---

### SI-4 — Centralizar a origem pública da requisição em `lib/request-origin.ts`

**Description:** Remove as cópias locais de `requestOrigin()` das páginas do estúdio e passa a usar o helper `lib/request-origin.ts` criado na Fase 05, mantendo um único lugar que monta o link público `${origin}/watch/{publicId}`.

**Technical actions:**

1. Em `next-frontend/app/(app)/studio/videos/[publicId]/edit/page.tsx`, apagar a função local `requestOrigin()` e importar `requestOrigin` de `@/lib/request-origin`; remover o import de `headers` se ficar sem uso.
2. Fazer o mesmo em `next-frontend/app/(app)/studio/upload/[publicId]/page.tsx`, que tem uma segunda cópia idêntica da função (encontrada no planejamento; mesmo objetivo do item 4 do escopo).
3. Cobrir o helper com teste unitário: `x-forwarded-host` / `x-forwarded-proto` têm precedência, `host` e `http` são o fallback e `localhost:3001` é o padrão sem headers.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `requestOrigin` (`lib/request-origin.ts`) | Unit (`next/headers` mockado): precedência dos headers encaminhados, fallback para `host`/`http`, padrão `localhost:3001` | `next-frontend/lib/__tests__/request-origin.test.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Na edição de um vídeo (`/studio/videos/{publicId}/edit`) e na tela de upload em processamento (`/studio/upload/{publicId}`), o link público exibido continua sendo `http://localhost:3001/watch/{publicId}` no ambiente local
- Com `X-Forwarded-Host: streamtube.example` e `X-Forwarded-Proto: https`, as duas telas exibem `https://streamtube.example/watch/{publicId}`
- Nenhuma página do App Router mantém uma implementação própria da origem pública — todas usam `lib/request-origin.ts`

---

### SI-5 — Investigar o alias `utils` do shadcn CLI e tornar os próximos installs seguros

**Description:** Descobre por que `npx shadcn@latest add slider` gerou `import { cn } from "cn"` e instalou o pacote npm `cn` apesar de `components.json` declarar `utils = @/lib/utils`, e corrige a configuração ou documenta no `next-frontend/CLAUDE.md` um procedimento de install que não suje o projeto.

**Technical actions:**

1. Reproduzir sem tocar no working tree: copiar `components.json`, `tsconfig.json`, `package.json`, `package-lock.json`, `app/globals.css` e `lib/utils.ts` para um diretório temporário dentro do container `next-frontend` e rodar ali o add do `slider`, comparando `npx shadcn@latest` com o binário local pinado (`shadcn` `^4.7.0` do `package.json`) e as opções não destrutivas do CLI (pré-visualização / dry-run, se a versão oferecer).
2. Identificar a causa (resolução do alias `utils` pelo CLI — `components.json` × `paths` do `tsconfig.json` × estilo `radix-nova` do registry — ou dependência listada no item do registry) e registrá-la.
3. Se a causa estiver na configuração do projeto, corrigi-la (`components.json` / `tsconfig.json`) e confirmar no diretório temporário que o add passa a gerar `import { cn } from "@/lib/utils"` sem acrescentar dependências.
4. Atualizar `next-frontend/CLAUDE.md` (comando de add em "Container-only commands" e regra de primitives): o comando recomendado (binário pinado ou `@latest`) e a verificação pós-install — `git diff package.json package-lock.json` sem dependência nova e imports de `cn` vindos de `@/lib/utils` —, com a causa encontrada.

**Tests:** _(empty — investigação + configuração/documentação; verificada pelos critérios de aceite)_

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/CLAUDE.md` descreve a causa do import `cn` errado e o procedimento de add de primitives (comando + verificação pós-install)
- Seguindo o procedimento documentado no diretório temporário, o add do `slider` gera `import { cn } from "@/lib/utils"` e não acrescenta o pacote `cn` ao `package.json`
- Ao fim da SI, `next-frontend/package.json`, `package-lock.json` e `components/ui/**` do projeto não têm mudanças vindas da reprodução

---

## Dependency Map

```
SI-1 (root)
└── SI-2 — depends on SI-1 (recriar a rede recria o container db; o volume nomeado preserva o banco)
SI-3 (root, independent)
SI-4 (root, independent)
SI-5 (root, independent)
```

---

## Deliverables

- [ ] SI-1 — Volume nomeado para os dados do PostgreSQL de desenvolvimento
- [ ] SI-2 — Reservar o IP fixo do next-frontend com `ip_range` na rede `streamtube`
- [ ] SI-3 — Renomear o token tipográfico `--text-overlay` para `--text-overlay-md`
- [ ] SI-4 — Centralizar a origem pública da requisição em `lib/request-origin.ts`
- [ ] SI-5 — Investigar o alias `utils` do shadcn CLI e tornar os próximos installs seguros

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type/compilation checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type/compilation checks pass (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec next-frontend npm run build`, `docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"`, then on the host `node node_modules/@playwright/test/cli.js test`)
