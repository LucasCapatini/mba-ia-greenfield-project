---
scope_type: ad-hoc
related_phases: []
status: decided
date: 2026-10-17
scope_description: "Saneamento das pendências da Fase 02 (telas de confirmação de conta, reset de senha e logout) e da infraestrutura do monorepo (topologia Docker, CI de frescura do OpenAPI, Git Flow) antes da Fase 03; inclui a correção da referência whiteboard.png → whiteboard.svg no README"
---

# Technical Decisions — Saneamento da Fase 02 e Infraestrutura

_Subprojects in scope:_

- `nestjs-project/` — recebe a variável de URL do frontend para os links de e-mail (TD-02) e o ajuste de idempotência da confirmação de conta (TD-03). Nenhuma outra decisão backend em aberto: os endpoints `GET /auth/confirm-email`, `POST /auth/reset-password` e `POST /auth/logout` já existem e seus contratos estão decididos em `phase-02-auth`.
- `next-frontend/` — recebe as telas de confirmação de conta e reset de senha (TD-02, TD-03, TD-04) e o host do botão de logout (TD-05). Os mecanismos de sessão, formulário e BFF são herdados de `phase-02-auth-frontend/TD-01..TD-07` e não são reabertos.
- repositório (raiz) — topologia Docker Compose (TD-01), pipeline de CI (TD-06) e adoção do Git Flow (TD-07).

_Nota de pesquisa:_ o MCP `context7` não estava disponível nesta sessão. As fontes primárias foram consultadas diretamente: Docker Compose (`include`, `networks`), GitHub Actions (`actions/setup-node` v7, service containers PostgreSQL) e o código atual dos dois subprojetos (`compose.yaml`, `mail.service.ts`, `auth.service.ts`, `lib/env.ts`, `playwright.config.ts`). Versões instaladas verificadas: Docker Compose v5.5.1 (suporta `include`), Node 25.6 no container da API e 22.16 no do frontend, Next.js 16, NestJS 11.

_Origem das decisões:_ issues abertas em `docs/tasks/task-saneamento-fase-02-e-infra/validation.md` — TD-01 resolve MD-1 e IC-1; TD-02 e TD-03 resolvem OQ-1; TD-04 resolve AMB-3; TD-05 resolve AMB-2; TD-07 resolve AMB-1. TD-06 cobre o workflow de CI do escopo.

---

## TD-01: Topologia Docker Compose entre `nestjs-project` e `next-frontend`

**Scope:** Repo-wide

**Trigger:** o frontend em container só alcança a API via `host.docker.internal:3000` (`extra_hosts` em `next-frontend/compose.yaml`), o que viola a regra "sempre usar o nome do serviço Compose" do `CLAUDE.md` e deixa `API_URL` dependente do ambiente. `next-frontend-config-base/TD-03` declarou explicitamente que esse gap de rede é uma decisão separada ainda não tomada.

**Context:** hoje cada subprojeto é um projeto Compose independente (`nestjs-project/compose.yaml` com `nestjs-api`, `db`, `mailpit`; `next-frontend/compose.yaml` com `next-frontend`). Todos os comandos dos `CLAUDE.md` de subprojeto assumem `docker compose exec <serviço>` rodado de dentro do diretório do subprojeto. A Fase 03 adiciona MinIO, fila e worker FFmpeg, que precisam da mesma rede que a API. A escolha também afeta `next-frontend-openapi-typing/TD-02`, cuja justificativa (1) é "preserves the compose-stack independence … neither subproject's compose file references the other" (IC-1 em `validation.md`). O E2E não muda em nenhuma opção: Playwright roda no host contra `localhost:3001` e o upstream é falsificado por MSW server-side.

**Options:**

### Option A: Rede Docker nomeada compartilhada, stacks separadas
- `nestjs-project/compose.yaml` declara `networks: streamtube: { name: streamtube }` (não externa, Compose cria) e anexa seus serviços; `next-frontend/compose.yaml` declara a mesma rede como `external: true` e anexa `next-frontend`. Compose registra o nome do serviço como alias DNS na rede, então `API_URL=http://nestjs-api:3000` resolve entre projetos. `extra_hosts` é removido.
- **Pros:** mudança mínima (duas chaves YAML por arquivo); nenhum comando dos `CLAUDE.md` muda; os compose files continuam sem referenciar um ao outro, preservando a premissa de `openapi-typing/TD-02` (IC-1 fecha sem revisão); serviços da Fase 03 entram no compose do backend e já ficam na rede.
- **Cons:** ordem de subida obrigatória (backend primeiro, senão a rede externa não existe e o frontend falha com erro explícito); dois `docker compose up` continuam necessários.

### Option B: `compose.yaml` de raiz com `include:` dos dois arquivos existentes
- Um `compose.yaml` na raiz com `include: [nestjs-project/compose.yaml, next-frontend/compose.yaml]`. Cada arquivo incluído resolve seus caminhos relativos no próprio diretório; todos os serviços caem no projeto raiz e na rede `default` dele, então `nestjs-api` resolve de imediato.
- **Pros:** um único `docker compose up -d` na raiz sobe tudo na ordem certa; arquivos de subprojeto permanecem válidos isoladamente.
- **Cons:** rodar `docker compose` de dentro de `nestjs-project/` cria um projeto separado com containers duplicados — todos os comandos dos `CLAUDE.md` de subprojeto e do README passam a ter de rodar da raiz (`docker compose exec nestjs-api …`), o que é uma mudança documental ampla; `openapi-typing/TD-02` precisa de uma `**Revisions:**` entry porque o arquivo raiz referencia os dois subprojetos; serviços da Fase 03 continuam no compose do backend, então o ganho é só orquestração.

### Option C: `compose.yaml` único na raiz com todos os serviços
- Os dois arquivos de subprojeto são removidos e um só arquivo na raiz declara `nestjs-api`, `db`, `mailpit`, `next-frontend` (e, na Fase 03, `minio`, `redis`, `video-worker`). Contextos de build apontam para os subdiretórios.
- **Pros:** modelo mental mais simples e alinhado ao diagrama C4; um único ponto para redes, volumes e `depends_on` entre API e frontend; prepara a Fase 03 sem nova migração.
- **Cons:** mesma mudança documental ampla da Option B, mais a perda da independência de stacks que o README e os `CLAUDE.md` descrevem hoje; `openapi-typing/TD-02` perde sua justificativa (1) e exige revisão; a `openapi-typing/TD-02` Option C (ler o spec direto do container) fica viável e pode reabrir a discussão de sourcing.

### Option D: Manter stacks separadas com `host.docker.internal` (risco aceito)
- Nada muda; o `CLAUDE.md` passa a documentar a exceção.
- **Pros:** zero trabalho.
- **Cons:** contradiz a regra de rede do próprio projeto; depende de `host-gateway`, que não existe em CI nem em produção; a Fase 03 teria de resolver o mesmo problema com mais serviços envolvidos.

**Recommendation:** Option A — resolve o `host.docker.internal` com duas declarações de rede, mantém intactos todos os comandos documentados e a premissa de `openapi-typing/TD-02`, e deixa a consolidação em compose único (Option C) como candidata natural para a entrada da Fase 03, quando o número de serviços justificar a reescrita da documentação.

**Decision:** A (Rede Docker nomeada compartilhada, stacks separadas)

---

## TD-02: Destino dos links de e-mail (confirmação de conta e reset de senha)

**Scope:** Cross-layer

**Trigger:** `MailService` monta os links como `${APP_URL}/auth/confirm-email?token=` e `${APP_URL}/auth/reset-password?token=`, onde `APP_URL` é a URL da própria API NestJS (`app.config.ts`, default `http://localhost:3000`). O usuário que clica hoje cai num `204 No Content` sem corpo (confirmação) ou num `404` (reset, que só existe como `POST`). As telas desta task só funcionam se os links apontarem para o Next.js.

**Context:** `phase-02-auth-frontend/TD-07` decidiu que o RSC da tela é dono do token ("RSC owns the token, Client Component owns the input"), o que pressupõe que o link do e-mail chega numa rota do frontend. O backend não conhece a URL do frontend em nenhuma variável hoje. Afeta `env.validation.ts` (Joi), `.env.example`, `compose.yaml`, `mail.service.ts`, os templates `.hbs`, as rotas do Next e os fixtures MSW.

**Options:**

### Option A: Nova variável `FRONTEND_URL` no backend; links apontam para rotas do Next
- Adicionar `FRONTEND_URL` (Joi `uri`, obrigatória) ao namespace `app` e montar `${FRONTEND_URL}/confirm-email?token=` e `${FRONTEND_URL}/reset-password?token=`. `APP_URL` segue existindo para usos próprios da API. No Next, `app/(auth)/confirm-email/page.tsx` e `app/(auth)/reset-password/page.tsx` leem `searchParams.token`.
- **Pros:** segue TD-07 sem desvio; separação limpa de responsabilidades (API não conhece rotas de UI além de uma base); testável no backend com uma asserção de URL no teste de integração do `MailService` já existente.
- **Cons:** uma variável a mais em três arquivos; em dev, o valor é `http://localhost:3001` (o link é aberto no navegador do host, não no container).

### Option B: Backend continua destino e redireciona para o frontend
- `GET /auth/confirm-email` consome o token e responde `302` para `${FRONTEND_URL}/confirm-email?status=ok|invalid|expired`; o reset ganha um `GET /auth/reset-password` que só redireciona para o formulário do Next.
- **Pros:** o link do e-mail não muda de domínio; a confirmação acontece sem o Next tocar no token.
- **Cons:** continua exigindo `FRONTEND_URL`; muda o contrato de um endpoint já documentado no OpenAPI (204 → 302) e rompe os testes E2E existentes; contradiz TD-07 (RSC dono do token) e afasta a confirmação do padrão BFF; o problema de prefetch (TD-03) fica inteiramente no backend.

### Option C: Link aponta para um Route Handler BFF do Next
- Link `${FRONTEND_URL}/api/auth/confirm-email?token=`; o Route Handler chama o upstream e redireciona para uma página de resultado.
- **Pros:** mantém toda a lógica dentro de `app/api/**`, que já tem padrão de teste com MSW.
- **Cons:** TD-07 rejeitou explicitamente a Option "Route-Handler-as-link-target" ("adds redirects for no clean gain"); duas requisições por clique; igualmente precisa de `FRONTEND_URL`.

**Recommendation:** Option A — é a única que executa TD-07 como decidido, com custo de uma variável de ambiente e sem alterar contratos já publicados no `openapi.json`.

**Decision:** A (Nova variável `FRONTEND_URL` no backend; links apontam para rotas do Next)

---

## TD-03: Idempotência da confirmação de conta frente a prefetch de links

**Scope:** Cross-layer

**Trigger:** `consumeVerificationToken` busca o token com `used_at IS NULL` e marca `used_at` no primeiro uso; uma segunda chamada lança `InvalidTokenException` (`400`). Clientes de e-mail e proxies corporativos fazem prefetch de links (`GET`), o que consumiria o token antes do clique real e mostraria "link inválido" ao usuário. `phase-02-auth-frontend/TD-07` registrou isso como ponto a confirmar ("solved at the backend's idempotent-confirmation level") e o `validation.md` o reabriu como OQ-1.

**Context:** depende de TD-02 (o link chega ao RSC do Next, que chama `GET /auth/confirm-email` no primeiro paint). O reset de senha não tem o mesmo problema: a página só exibe o formulário e o token é consumido no `POST` disparado pelo usuário. A decisão afeta `auth.service.ts`, os testes de integração/E2E do backend e o conjunto de estados da tela (TD-04).

**Options:**

### Option A: Tornar `confirm` idempotente no backend; RSC confirma no carregamento
- `confirm(token)` passa a buscar o token sem o filtro `used_at IS NULL`; se já usado e `user.is_confirmed` for verdadeiro, retorna sucesso sem alterar nada; se não existir, `InvalidTokenException`; se expirado e não usado, `TokenExpiredException`. A tela RSC chama o endpoint e renderiza o resultado no primeiro paint (TD-07 intacto).
- **Pros:** o prefetch deixa de ser destrutivo; um token de confirmação reutilizado não concede nada (a conta já está confirmada), então não há perda de segurança; mudança localizada em um método mais dois testes.
- **Cons:** `confirm` deixa de ser estritamente "single-use" no banco (a semântica de `used_at` passa a ser "primeiro uso"); exige nota no `@ApiOperation` do OpenAPI.

### Option B: Confirmação em duas etapas no frontend (clique explícito)
- O RSC renderiza "Confirmar minha conta" com o token embutido; o clique faz `POST /api/auth/confirm-email` no BFF, que chama o upstream. Prefetch de `GET` nunca consome o token.
- **Pros:** backend inalterado; padrão recomendado por provedores de e-mail para links sensíveis.
- **Cons:** adiciona um clique ao fluxo; cria um Route Handler e um Client Component a mais; desvia de TD-07 ("confirmation is RSC-only") e exige `**Revisions:**` naquela TD.

### Option C: Manter single-use e aceitar o risco com caminho de recuperação
- Nada muda no backend; a tela, ao receber `InvalidToken`, oferece o formulário de reenvio (`POST /auth/resend-confirmation`).
- **Pros:** zero mudança de contrato.
- **Cons:** o usuário que sofreu prefetch vê um erro na primeira visita e precisa de um segundo e-mail; a causa é invisível e parece bug.

**Recommendation:** Option A — preserva TD-07 e elimina a falha mais provável do fluxo com uma mudança de poucas linhas, sem reduzir segurança porque o token de confirmação não concede sessão.

**Decision:** A (Tornar `confirm` idempotente no backend; RSC confirma no carregamento)

---

## TD-04: Fonte visual e estados das telas de confirmação de conta e reset de senha

**Scope:** Cross-layer

**Trigger:** as duas telas não existem no Figma (`phase-02-auth-frontend` registrou "the reset-password destination screen is absent from Figma") e o inventário de telas desta task foi deferido. Sem uma fonte de verdade declarada, `/implement` não tem como derivar layout nem estados.

**Context:** o padrão visual de auth já existe em `/signup`, `/login` e `/forgot-password` (`Card` + `BrandLogo` + `AuthFooter` + `BackLink`, tokens em `app/globals.css`). TD-07 fixa a mecânica (RSC dono do token; reset usa Client form com `react-hook-form` + Zod, TD-04/TD-05 do frontend). Resta decidir de onde vem a especificação visual e qual é a lista fechada de estados.

**Options:**

### Option A: Derivar do padrão de `/forgot-password` com lista de estados fechada neste doc
- Ambas as telas reutilizam a composição de `/forgot-password`. Estados obrigatórios — confirmação: `success` (CTA para `/login`), `invalid` (mensagem + formulário de reenvio), `expired` (idem). Reset: `form` (senha + confirmação, mesmas regras de força do signup), `success` (CTA para `/login`), `error` no submit mapeando `InvalidToken`/`TokenExpired` para mensagem com link para `/forgot-password`. Nenhum inventário é necessário; `## UI Inventory` permanece deferido.
- **Pros:** destrava a implementação agora com consistência visual garantida pelos componentes existentes; os estados vêm das exceções já publicadas no `openapi.json`.
- **Cons:** sem screenshot de referência, a validação visual é por comparação com as telas irmãs, não pixel-a-pixel; se o design system ganhar essas telas depois, pode haver retrabalho cosmético.

### Option B: Desenhar as telas no Figma e rodar `/screen-inventory` antes de implementar
- Produzir os frames no arquivo `FC Tube.fig`, rodar `/screen-inventory saneamento-fase-02-e-infra`, reexecutar `/plan-context` e seguir o fluxo Figma-to-code das rules.
- **Pros:** paridade com o processo da Fase 02; inventário ativo habilita os checks `UIG-N` e a seção `UI Contracts` no plano.
- **Cons:** bloqueia a task num trabalho de design fora do repositório; para duas telas de um fluxo de transição, o custo supera o ganho.

### Option C: Páginas mínimas sem composição de auth (texto + link)
- Páginas RSC simples com mensagem e link, sem `Card`/`BrandLogo`.
- **Pros:** menor esforço absoluto.
- **Cons:** quebra a consistência do fluxo de auth; viola a rule `next-frontend-ui` (reuso de primitivas e tokens); seria refeito na Fase 07.

**Recommendation:** Option A — as primitivas e os tokens já cobrem o visual, e a lista de estados fechada aqui é o que `/plan-build` precisa para gerar os SIs sem inventário.

**Decision:** A (Derivar do padrão de `/forgot-password` com lista de estados fechada neste doc)

**Revisions:**
- 2026-10-18 — A lista fechada de estados ganha a tela standalone `/resend-confirmation` (`app/(auth)/resend-confirmation/page.tsx`): mesma composição `Card` + `BrandLogo` + `AuthFooter` e reuso do `ResendConfirmationForm` já entregue no SI-8, servindo de destino ao link que `login-form.tsx` exibe em `403 EMAIL_NOT_CONFIRMED`. Entregue como SI-11 (append-mode manual). Rationale: a revisão de alinhamento com a documentação (README/MBA) encontrou o link apontando para uma rota inexistente (404) desde a Fase 02; a Option A permanece — nenhuma fonte visual nova, só mais um estado derivado do padrão de `/forgot-password`.

---

## TD-05: Host do botão de logout na interface autenticada

**Scope:** Cross-layer

**Trigger:** `POST /api/auth/logout` existe no BFF, mas nenhuma tela o chama. O `phase-02-auth-frontend` deferiu o botão para "authenticated chrome (typically Phase 04)" e a home ainda é o boilerplate do `create-next-app`; o header/navbar completo só está previsto na Fase 07.

**Context:** `app/layout.tsx` já lê a sessão no RSC e a entrega ao `SessionProvider` (`phase-02-auth-frontend/TD-06`), então qualquer componente cliente sabe se há usuário logado sem round-trip. TD-06 também exige `router.refresh()` após mutações de sessão para o RSC re-renderizar.

**Options:**

### Option A: Header mínimo session-aware no layout das rotas de aplicação
- Um `AppHeader` (logo + "Entrar"/"Criar conta" quando anônimo; e-mail/nickname + "Sair" quando logado) renderizado num layout de grupo de rotas da aplicação (fora do grupo `(auth)`, para não aparecer nas telas de login/cadastro). "Sair" chama `POST /api/auth/logout` e faz `router.push("/")` + `router.refresh()`. A home boilerplate é substituída por uma página placeholder mínima que usa esse layout.
- **Pros:** entrega o logout onde a Fase 07 vai colocá-lo, sem retrabalho estrutural (o header cresce, não muda de lugar); exercita o `SessionProvider` de ponta a ponta; testável por E2E com o MSW server-side já existente.
- **Cons:** adiciona um componente que o Figma ainda não especifica (mesma ressalva de TD-04 Option A); a home deixa de ser boilerplate antes da Fase 07, o que é um escopo pequeno a mais.

### Option B: Página provisória `/account` com dados da sessão e botão de logout
- Uma rota autenticada simples que mostra e-mail/nickname e o botão "Sair". Sem header global.
- **Pros:** não toca na home nem cria layout novo.
- **Cons:** a página não tem futuro no plano (não há "página de conta" no `project-plan.md`), então é descarte garantido; não há como chegar nela sem digitar a URL.

### Option C: Retirar o logout do escopo desta task
- Manter a rota BFF e entregar o botão com o header da Fase 07 (ou o painel do canal na Fase 04).
- **Pros:** zero trabalho agora.
- **Cons:** a capability "Logout" da Fase 02 continua sem UI por mais duas fases; o fluxo cadastro → login não é fechável manualmente sem apagar cookie.

**Recommendation:** Option A — é o único host que sobrevive às fases seguintes e fecha a capability "Logout" da Fase 02 usando exclusivamente mecanismos já decididos (TD-06 do frontend).

**Decision:** A (Header mínimo session-aware no layout das rotas de aplicação)

---

## TD-06: Escopo e ambiente do workflow de CI `openapi-freshness`

**Scope:** Repo-wide

**Trigger:** `next-frontend-openapi-typing/TD-03` decidiu que existe um gate de CI (sync → gen → diff) e três documentos citam `.github/workflows/openapi-freshness.yml`, mas o arquivo nunca foi criado e a pasta `.github/` não existe. Falta decidir o que o workflow cobre e onde roda.

**Context:** o repositório está no GitHub, então GitHub Actions é a plataforma. Os dois subprojetos têm `package-lock.json` próprios (`actions/setup-node@v7` aceita `cache-dependency-path` com múltiplos lockfiles). O gate decidido em TD-03 só detecta drift no lado do frontend (`openapi.json` copiado e `types.gen.ts`); ele não detecta um `nestjs-project/openapi.json` desatualizado em relação aos controllers, porque re-exportar exige subir o `AppModule` com PostgreSQL. As rules proíbem rodar `npm` no host em dev, mas em CI o runner é o ambiente controlado, então essa regra não se aplica.

**Options:**

### Option A: Somente o gate de frescura decidido em TD-03, no runner com Node
- Job único em `pull_request` e `push` para `dev`/`main`: checkout, `setup-node` (Node 22 do `next-frontend/Dockerfile.dev`, cache npm com os dois lockfiles), `bash scripts/sync-openapi.sh`, `npm ci` + `npm run openapi:types` em `next-frontend/`, `git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts`.
- **Pros:** implementa exatamente TD-03; sem banco, sem containers, roda em menos de dois minutos; escopo da task permanece "saneamento".
- **Cons:** não pega backend com `openapi.json` esquecido; lint, `tsc` e testes continuam sem gate automatizado.

### Option B: Option A + re-export do backend com PostgreSQL como service container
- Segundo job: service `postgres:17` com healthcheck `pg_isready`, `npm ci` em `nestjs-project/`, `npm run openapi:export` com `DB_HOST=localhost` e demais envs mínimos, `git diff --exit-code -- nestjs-project/openapi.json` antes do job de frontend.
- **Pros:** fecha o buraco do gate: qualquer mudança de controller/DTO sem re-export falha o PR; prepara o terreno para testes de integração em CI.
- **Cons:** sobe o `AppModule` inteiro só para exportar o spec (TypeORM conecta no init); exige replicar as variáveis Joi obrigatórias (`JWT_SECRET`, `MAIL_*`) no workflow; mais tempo e mais superfície de falha; TD-03 de `openapi-typing` precisaria de `**Revisions:**` registrando a extensão.

### Option C: Option A + gates de qualidade (lint, `tsc --noEmit`, testes unitários) por subprojeto
- Jobs paralelos por subprojeto rodando `npm run lint`, `npx tsc --noEmit`, `npm test` (Vitest) e `jest` só com `*.spec.ts` (sem banco).
- **Pros:** automatiza o Definition of Done do `CLAUDE.md`; valor alto para o restante do projeto.
- **Cons:** é uma task própria ("CI de qualidade"), não saneamento; os testes de integração/E2E do backend ficariam de fora ou exigiriam a Option B; mistura escopos, contra a política do projeto.

**Recommendation:** Option A — entrega a dívida documentada sem ampliar o escopo; registrar as Options B e C como tasks futuras (`ci-backend-openapi-export` e `ci-quality-gates`) a planejar antes da Fase 03, quando o número de endpoints crescer.

**Decision:** A (Somente o gate de frescura decidido em TD-03, no runner com Node)

---

## TD-07: Entregável concreto da adoção do Git Flow

**Scope:** Repo-wide

**Trigger:** o `CLAUDE.md` descreve `dev` como branch de integração e `feature/*` a partir dela, mas o repositório só tem `main` (local e remoto) e todos os commits foram diretos nela. "Adotar o fluxo" não define o que `/implement` deve produzir (AMB-1).

**Context:** repositório público no GitHub (`LucasCapatini/mba-ia-greenfield-project`). Esta própria task é a primeira a poder seguir o fluxo. Regras de proteção de branch dependem de permissões de administrador e, para repositórios privados, de plano pago; em repositórios públicos estão disponíveis.

**Options:**

### Option A: Criar `dev` a partir de `main`, executar esta task em `feature/*` a partir de `dev` e documentar
- `git branch dev main` + `git push -u origin dev`; branch `feature/saneamento-fase-02-e-infra` criada de `dev`; README ganha uma seção curta "Fluxo de branches" espelhando o `CLAUDE.md`; merge desta task em `dev` via PR.
- **Pros:** torna o fluxo real sem depender de configuração do GitHub; primeiro PR do projeto serve de exemplo.
- **Cons:** nada impede tecnicamente um push direto em `main` ou `dev`.

### Option B: Option A + proteção de branches via `gh api` (PR obrigatório em `main` e `dev`, CI verde exigido)
- Aplicar branch protection rules exigindo PR, pelo menos o status check `openapi-freshness` (TD-06) e proibindo force-push.
- **Pros:** o fluxo passa a ser aplicado pela plataforma; o gate de CI ganha dentes.
- **Cons:** exige permissão de administrador no repositório e um passo fora do código (não é reproduzível por quem clona); um projeto de uma pessoa pode se bloquear ao revisar o próprio PR (precisa de "allow administrators to bypass" ou de `required_approving_review_count: 0`).

### Option C: Apenas criar a branch `dev`
- `git branch dev` + push, sem mudar o fluxo desta task nem documentar.
- **Pros:** trivial.
- **Cons:** não "adota" nada; o próximo commit cai em `main` de novo.

**Recommendation:** Option A — é o mínimo que torna o Git Flow verificável no histórico; a Option B pode ser aplicada manualmente depois do primeiro PR, quando o status check de TD-06 existir.

**Decision:** A (Criar `dev` a partir de `main`, executar esta task em `feature/*` a partir de `dev` e documentar)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Repo-wide | Topologia Docker Compose entre os subprojetos | A — rede nomeada compartilhada, stacks separadas | A |
| TD-02 | Cross-layer | Destino dos links de e-mail | A — `FRONTEND_URL` no backend; links para rotas do Next | A |
| TD-03 | Cross-layer | Idempotência da confirmação frente a prefetch | A — `confirm` idempotente; RSC confirma no load | A |
| TD-04 | Cross-layer | Fonte visual e estados das telas de confirmação/reset | A — derivar de `/forgot-password` com estados fechados | A |
| TD-05 | Cross-layer | Host do botão de logout | A — header mínimo session-aware no layout da aplicação | A |
| TD-06 | Repo-wide | Escopo e ambiente do workflow `openapi-freshness` | A — somente o gate de TD-03, runner com Node | A |
| TD-07 | Repo-wide | Entregável da adoção do Git Flow | A — criar `dev`, task em `feature/*`, documentar | A |
