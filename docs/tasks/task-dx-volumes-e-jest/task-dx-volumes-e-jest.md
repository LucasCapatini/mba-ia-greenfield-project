---
kind: task
name: task-dx-volumes-e-jest
test_specs_aware: true
sources_mtime:
  docs/tasks/task-dx-volumes-e-jest/context.md: "2026-10-18T12:42:48-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-18T12:13:58-04:00"
  docs/phases/phase-02-auth/context.md: "2026-10-17T09:27:46-04:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-10-18T12:13:58-04:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T09:27:45-04:00"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-17T09:27:45-04:00"
---

# Task — Volumes nomeados para `node_modules` e Jest `--forceExit`

## Objective

> Volume nomeado para node_modules nos dois compose (nestjs-project/compose.yaml e next-frontend/compose.yaml, no frontend também para .next), sobrepondo o bind mount 9p: medido em 2026-10-18, require("jsdom") leva ~100 s pelo bind mount contra o timeout fixo de 60 s do worker do Vitest 4, e a compilação fria do Nest leva ~6 min. Adicionar --forceExit aos scripts test e test:e2e do nestjs-project/package.json (Jest não encerra por handles abertos, pré-existente). Atualizar nestjs-project/CLAUDE.md, next-frontend/CLAUDE.md e o README raiz: npm install obrigatório após o primeiro up e após mudar package.json; node_modules do host deixa de refletir o do container; exceção do Playwright, que roda no host e precisa de node_modules do host com @playwright/test.

---

## Step Implementations

### SI-1 — Sobrepor `node_modules` com volume nomeado na stack do backend

**Description:** Tira as dependências do backend do bind mount 9p: um volume nomeado do Docker passa a ocupar `/home/node/app/node_modules` dentro do container `nestjs-api`, enquanto o código continua vindo do bind mount — é a causa raiz da compilação fria de ~6 min e do custo de I/O em cada suíte Jest.

**Technical actions:**

1. Editar `nestjs-project/compose.yaml`: no serviço `nestjs-api`, adicionar a montagem `node_modules:/home/node/app/node_modules` logo após `.:/home/node/app` (a ordem importa — o volume nomeado sobrepõe o subdiretório do bind mount); declarar `node_modules: {}` no bloco `volumes:` de nível superior, com comentário explicando o porquê (bind mount 9p lento no Windows) e que o diretório nasce vazio (per `saneamento-fase-02-e-infra/TD-01` — stacks separadas, cada compose dono dos seus volumes; rede `streamtube` intacta)
2. Editar `nestjs-project/Dockerfile.dev`: antes de `USER node`, criar o ponto de montagem com o dono correto — `RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app` — para que o volume nomeado seja inicializado com propriedade de `node` e o `npm install` não falhe com `EACCES` (volumes novos copiam conteúdo e dono do caminho da imagem na primeira montagem)
3. Recriar o serviço com a imagem nova (`docker compose up -d --build nestjs-api`) e popular o volume com `docker compose exec nestjs-api npm install`; confirmar com `docker compose exec nestjs-api sh -c "mount | grep node_modules"` que o caminho está num volume (`overlay`/ext4), não em `9p`

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose up -d --build` na pasta `nestjs-project/` cria o volume `nestjs-project_node_modules` (`docker volume ls`) e o serviço `nestjs-api` sobe com status `running`
- Dentro do container, `mount | grep /home/node/app/node_modules` mostra um filesystem que não é `9p`, enquanto `mount | grep "/home/node/app "` continua mostrando o bind mount do código
- `docker compose exec nestjs-api npm install` conclui sem erro de permissão e `ls node_modules/.bin/nest` existe dentro do container
- `docker compose exec nestjs-api npx tsc --noEmit` sai com código 0 e `docker compose exec nestjs-api sh -c 'time node -e "require(\"@nestjs/core\")"'` leva menos de 3 s
- A rede `streamtube` continua sendo criada por esta stack e o frontend ainda sobe com ela declarada como `external`

---

### SI-2 — Sobrepor `node_modules` e `.next` com volumes nomeados na stack do frontend

**Description:** Aplica o mesmo padrão ao container `next-frontend`, incluindo o cache de build do Turbopack: é o que leva `require("jsdom")` de ~100 s para menos de 3 s e devolve ao Vitest a execução paralela sem `Timeout waiting for worker to respond`.

**Technical actions:**

1. Editar `next-frontend/compose.yaml`: no serviço `next-frontend`, adicionar `node_modules:/home/node/app/node_modules` e `next_cache:/home/node/app/.next` após `.:/home/node/app`; declarar `node_modules: {}` e `next_cache: {}` no bloco `volumes:` de nível superior, com comentário (bind mount 9p lento; `.next` é regenerado pelo dev server e nunca precisa estar no host) (per `saneamento-fase-02-e-infra/TD-01` — compose do frontend permanece um projeto separado, só anexado à rede `streamtube`)
2. Editar `next-frontend/Dockerfile.dev`: antes de `USER node`, `RUN mkdir -p /home/node/app/node_modules /home/node/app/.next && chown -R node:node /home/node/app`, pelo mesmo motivo de propriedade do SI-1
3. Recriar o serviço (`docker compose up -d --build next-frontend`), popular o volume com `docker compose exec next-frontend npm install` e confirmar que `node_modules` e `.next` estão em volumes (`mount | grep -E "node_modules|\.next"`)
4. Verificar que `openapi.json` e `lib/api/types.gen.ts` continuam no bind mount (um `npm run openapi:types` dentro do container deve refletir no host) — a cadeia OpenAPI e o gate `openapi-freshness` não podem depender dos volumes

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose up -d --build` na pasta `next-frontend/` cria os volumes `next-frontend_node_modules` e `next-frontend_next_cache` e o serviço sobe com status `running`
- `docker compose exec next-frontend sh -c 'time node -e "require(\"jsdom\")"'` leva menos de 3 s
- `docker compose exec next-frontend npm test` passa com os 24 arquivos / 91 testes em execução paralela, sem nenhum `Timeout waiting for worker to respond`
- `docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev"` seguido de `curl -I http://localhost:3001/login` retorna `200`, e `docker compose logs next-frontend` contém `[msw] server-side mocking enabled`
- A suíte Playwright no host (`node node_modules/@playwright/test/cli.js test`, usando o `node_modules` do host) continua 23/23
- Após `npm run openapi:types` dentro do container, `git status --short next-frontend/lib/api/types.gen.ts` no host está vazio (arquivo regenerado idêntico, visível pelo bind mount)

---

### SI-3 — Encerrar o Jest do backend com `--forceExit`

**Description:** Faz os scripts de teste do backend devolverem o prompt ao terminar: o Jest fica pendurado por handles abertos (pré-existente), o que já obrigou a verificação final da task anterior a passar a flag à mão.

**Technical actions:**

1. Editar `nestjs-project/package.json`: `"test": "jest --forceExit"` e `"test:e2e": "jest --config ./test/jest-e2e.json --forceExit"`; os demais scripts (`test:watch`, `test:cov`, `test:debug`, `test:integration`) ficam como estão — `test:integration` fora do escopo desta task, a registrar como observação no `progress.md`
2. Registrar no bloco Jest de `nestjs-project/CLAUDE.md` (seção "Jest Configuration") um bullet explicando a flag e que `--detectOpenHandles` é o caminho para a correção de raiz numa task de higiene futura

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose exec nestjs-api npm test -- --runInBand src/config/env.validation.spec.ts` termina sozinho, com código 0, sem a mensagem `Jest did not exit one second after the test run has completed`
- `docker compose exec nestjs-api npm run test:e2e -- --runInBand test/auth-confirm-email.e2e-spec.ts` termina sozinho, com código 0
- `npm run test:watch` continua em modo watch (a flag não é adicionada a ele)

---

### SI-4 — Documentar o novo ciclo de dependências nos CLAUDE.md e no README

**Description:** Alinha a documentação operacional com o comportamento novo: o `npm install` passa a ser obrigatório depois do primeiro `up` e sempre que `package.json` mudar, o `node_modules` do host deixa de ser o do container, e o Playwright no host vira a única exceção que precisa de um `node_modules` local.

**Technical actions:**

1. Editar `nestjs-project/CLAUDE.md` § "Development Environment": trocar o comentário `# Install dependencies (first time only)` por "após o primeiro `up` e sempre que `package.json`/`package-lock.json` mudarem (o `node_modules` vive num volume nomeado, não no bind mount)"; adicionar à lista de serviços uma linha sobre o volume `node_modules` e o comando para zerá-lo (`docker compose down -v` apaga também o volume — avisar)
2. Editar `next-frontend/CLAUDE.md` § "Development Environment" (mesmo ajuste do comentário e parágrafo "Bind mount" citando os volumes `node_modules` e `.next`) e § "E2E test prerequisites": acrescentar que o Playwright usa o `node_modules` **do host**, que ele não é atualizado pelo `npm install` do container e que, quando a versão de `@playwright/test` mudar em `package.json`, roda-se `npm ci` no host uma vez (única exceção documentada à regra "nunca npm no host"); manter a nota Windows existente
3. Editar `README.md` § "Como rodar" (os dois blocos de comandos: comentário do `npm install` e uma nota curta sobre os volumes nomeados e `down -v`) e § "Testes → Frontend": a observação sobre o `node_modules` do host para o Playwright
4. Conferir que nenhum dos três arquivos ainda afirma que o `node_modules` do container é o mesmo do host nem que `npm install` é "apenas na primeira vez"

**Tests:** _(empty — documentação; verificada pelos ACs de leitura)_

**Dependencies:** SI-1, SI-2, SI-3 — a documentação descreve o comportamento final dos volumes e dos scripts

**Acceptance criteria:**

- `grep -n "first time only\|apenas na primeira vez" nestjs-project/CLAUDE.md next-frontend/CLAUDE.md README.md` não retorna nenhuma linha
- `nestjs-project/CLAUDE.md` e `next-frontend/CLAUDE.md` explicam, cada um, que `node_modules` está num volume nomeado, quando rodar `npm install` e o efeito de `docker compose down -v`
- `next-frontend/CLAUDE.md` e `README.md` registram que o Playwright roda com o `node_modules` do host e como atualizá-lo (`npm ci` no host) quando `@playwright/test` mudar
- `nestjs-project/CLAUDE.md` § "Jest Configuration" cita `--forceExit` nos scripts `test` e `test:e2e`
- Nenhuma referência a `host.docker.internal` ou a comandos `npm` fora de container (além da exceção do Playwright) é introduzida

---

## Dependency Map

SI-1 (root — volume `node_modules` do backend)
SI-2 (root — volumes `node_modules` + `.next` do frontend; independente de SI-1)
SI-3 (root — `--forceExit` nos scripts Jest do backend)
└── SI-4 — depends on SI-1, SI-2, SI-3 (documenta o comportamento final dos volumes e dos scripts)

---

## Deliverables

- [ ] SI-1 — Sobrepor `node_modules` com volume nomeado na stack do backend
- [ ] SI-2 — Sobrepor `node_modules` e `.next` com volumes nomeados na stack do frontend
- [ ] SI-3 — Encerrar o Jest do backend com `--forceExit`
- [ ] SI-4 — Documentar o novo ciclo de dependências nos CLAUDE.md e no README

**Full test suites** _(comandos conforme `nestjs-project/CLAUDE.md` e `next-frontend/CLAUDE.md` — tudo dentro dos containers, exceto Docker, Playwright e `scripts/*.sh`)_:

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`) — e o processo encerra sozinho
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type-check passes (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint introduces no new problems in touched files (`cd nestjs-project && docker compose exec nestjs-api npm run lint`; os 189 problemas pré-existentes são dívida registrada)
- [ ] Frontend tests pass in parallel (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type-check passes (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev" && node node_modules/@playwright/test/cli.js test` — Playwright no host)
- [ ] OpenAPI chain unaffected (`bash scripts/sync-openapi.sh` + `npm run openapi:types` no container → `git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts`)
