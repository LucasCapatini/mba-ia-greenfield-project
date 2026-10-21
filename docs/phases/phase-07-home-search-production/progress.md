# phase-07-home-search-production — Progress

**Status:** completed
**SIs:** 28/28 completed

### SI-07.0.1 — Custom-business simple group: category-chips + global-search + nav-drawer
- **Status:** completed
- **Tests:** 17 passing (category-chips 5, global-search 7, nav-drawer 5)
- **Observations:**
  - Chips de categoria renderizados como `<Link>` com `filterChipVariants` (o primitivo `FilterChip` é um `<button>`, e o filtro é navegação por URL — TD-01).
  - `NavDrawer` usa `DialogContent` com classes de posicionamento à esquerda e `aria-describedby={undefined}` (sem descrição; silencia o aviso de a11y do Radix).

### SI-07.1 — Infra: migration `AddVideoSearch` (pg_trgm + unaccent + índices de trigramas)
- **Status:** completed
- **Tests:** 14 passing (migrations.integration-spec.ts)
- **Observations:**
  - Migration criada com `migration:create` (extensões, função e índices de expressão não vêm de entidade); função `immutable_unaccent` usa o dicionário qualificado `'public.unaccent'::regdictionary`.
  - A suíte de migrations ganhou dois testes (criação e revert da busca) antes do revert das interações sociais, porque o `undoLastMigration` seguinte passou a desfazer a `AddVideoSearch`.

### SI-07.2 — Endpoint GET /videos (home e busca) + throttle das listagens públicas
- **Status:** completed
- **Tests:** 36 passing (list-public-videos.dto.spec 6, videos-listing.service.integration-spec 22, videos-list.e2e-spec 8)
- **Observations:**
  - Nova exceção `CategorySlugNotFoundException` (mesmo código `CATEGORY_NOT_FOUND`, status 404) em vez de mudar o 400 da `CategoryNotFoundException` usada pelo `PATCH /videos/{publicId}`.
  - O e2e usa `trust proxy = loopback` (como `throttler-proxy.e2e-spec.ts`) para o `X-Forwarded-For` identificar o visitante no cenário de 60 req/min.

### SI-07.3 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- **Status:** completed
- **Tests:** no tests (contrato + fixtures; regressão: 57 testes existentes de mocks/ e app/api/videos passando)
- **Observations:**
  - O catálogo do `GET /videos` no MSW junta os 16 vídeos elegíveis do store, os 24 de `tech_mastery` (categoria `technology` só nesta listagem) e "Música ao vivo" do canal `rock_club` — sem mexer no seed do estúdio nem do canal, cujas contagens os specs existentes verificam.
  - Qualquer slug fora das 10 categorias responde 404 (como o backend); `unknown-category` é só o valor usado nos specs.

### SI-07.4 — Route Handlers BFF das listagens paginadas no cliente
- **Status:** completed
- **Tests:** 11 passing (list 6, channels/[nickname]/videos 2, me/subscriptions/videos 3)
- **Observations:** none

### SI-07.5 — Scroll infinito com hook próprio (Setup)
- **Status:** completed
- **Tests:** no tests (Setup) — tsc + lint ok
- **Observations:**
  - Snippet do plano distribuído entre hook (storageKey, MAX_STORED_ITEMS, sessionStorage.setItem), grid (desestruturação de useCursorList) e sentinela (IntersectionObserver); hook segue o estilo de hooks/ (ponto e vírgula), componentes o de components/ (sem).
  - Persistência no sessionStorage ao desmontar (lista > 200 itens remove a entrada); restauração após a hidratação com scroll reposicionado depois do render dos itens restaurados.

### SI-07.6 — Página pública do canal → scroll infinito
- **Status:** completed
- **Tests:** 3 passing (channel-video-list.test.tsx); suíte components/channel 68 passing; E2E channel-public validado junto com SI-07.7
- **Observations:**
  - ChannelVideoList usa useCursorList + InfiniteScrollSentinel dentro do ChannelVideoGrid existente (em vez do InfiniteVideoGrid) para manter o layout do Figma 156:3590 e os cards sem canal; mesma mecânica do TD-04.
  - Removidos channel-load-more.tsx e o teste dele; a página lê só a primeira página e monta a lista com key={sort}. ChannelVideoSort mantém o params.delete("cursor") (limpa URLs antigas; não lê cursor).
  - specs/channel-public.plan.md 2.1 reescrito para o sentinela e marcado Source: manual.

### SI-07.7 — Feed das inscrições → scroll infinito
- **Status:** completed
- **Tests:** E2E 12 passing (subscriptions-feed 4, channel-public 3 — inclui a validação do SI-07.6 —, channel-social 5) sobre next build + MSW
- **Observations:**
  - Feed lê só a primeira página e monta InfiniteVideoGrid (aria-label "Subscription videos"); removidos subscription-feed-list.tsx, subscription-video-grid.tsx e o teste do grid (a cobertura do grid passa ao InfiniteVideoGrid no SI-07.16).
  - Removido o redirect do 400 de cursor (o cursor não vem mais da URL; o hook trata o 400 voltando à primeira página).
  - specs/subscriptions-feed.plan.md 2.2 reescrito para o sentinela e marcado Source: manual.

### SI-07.8 — Shell de navegação responsivo (Setup)
- **Status:** completed
- **Tests:** no tests (Setup) — Vitest components/layout + subscribe-button 55 passing; suíte E2E completa 73 passing sobre next build + next start (MSW)
- **Observations:**
  - NavStateProvider (mode + drawer, toggle por matchMedia lg e rota: /watch/* sempre abre o drawer) e NavDrawer passa a ler o contexto quando não recebe open/onOpenChange — o snippet <NavDrawer>{sideNav}</NavDrawer> fica sem props.
  - SubscriptionsProvider e a leitura GET /me/subscriptions?limit=7 subiram para app/(app)/layout.tsx; o contexto ganhou available (leitura falhou → SideNavActive omite a seção), substituindo o firstPage ? ... : undefined do layout (shell).
  - O modo mini só tem efeito visual a partir do SI-07.11/07.12 (AppShell/SideNav consomem o contexto); o "≡" chega no SI-07.9. A variante do anônimo no drawer fica para o SI-07.12.

### SI-07.9 — Header do Figma com menu da conta → shell responsivo
- **Status:** completed
- **Tests:** app-header.test.tsx 5 passing; account-menu.integration.test.tsx 4 passing; Vitest components/layout+auth+use-session 22 arquivos ok; E2E completo 73 passing
- **Observations:**
  - SessionState do cliente ganhou channelName (root layout repassa session.channelName); fixtures dos testes de sessão atualizados.
  - Ícones novos em components/icons: menu, add, edit-square, logout (Material Symbols). O "+" é um Link com iconButtonVariants (IconButton não tem asChild).
  - Sign Out mantém router.push("/") + router.refresh() do header antigo (spec de logout espera a URL /).
  - E2E atualizados: logout (avatar → Sign Out; Sign in com returnTo), studio-channel (avatar → Edit Channel), studio-videos (menu lateral → Your videos); specs/logout.plan.md 1.1/1.2 reescritos e marcados Source: manual.

### SI-07.10 — Layout `(shell)` com menu para o anônimo → shell responsivo
- **Status:** completed
- **Tests:** side-nav-active.test.tsx 21 passing (sessão, anônimo, mini, drawer); E2E completo 73 passing
- **Observations:**
  - Layout (shell) virou síncrono: AppShell com SideNavActive sempre; a variante do anônimo (Home + convite "Sign in to see your subscriptions" com returnTo da página + query) vive no SideNavActive, que lê a sessão do SessionContext.
  - E2E channel-social 1.1 atualizado para o menu do anônimo; specs/channel-social.plan.md 1.1 reescrito e marcado Source: manual.

### SI-07.11 — AppShell com breakpoints → shell responsivo
- **Status:** completed
- **Tests:** app-shell.test.tsx 6 passing; E2E completo 73 passing
- **Observations:**
  - AppShell virou client component: data-mode do contexto (fora do provider, expanded); coluna hidden abaixo de lg, w-64 expandida / w-20 mini. A verificação visual em 1280/390 px fica coberta pelo shell-responsive.e2e-spec.ts do SI-07.17.

### SI-07.12 — SideNav nos modos expandido, mini e drawer → shell responsivo
- **Status:** completed
- **Tests:** side-nav.test.tsx 7 passing; side-nav-item.test.tsx 5 passing; drawer/mini também em side-nav-active.test.tsx
- **Observations:**
  - SideNav ganhou mode (expanded|mini|drawer) e o slot invite; SideNavItem ganhou layout row|column (data-layout). Em mini, SideNavActive monta Home, Subscriptions e You (→ /studio/videos).
  - Ids dos títulos das seções via useId (coluna e drawer podem coexistir no DOM). No drawer, clicar em qualquer link chama closeDrawer (inclusive a rota atual); o app layout monta <SideNavActive mode="drawer" />.

### SI-07.13 — Telas existentes → layout responsivo (watch, canal, feed, auth, estúdio)
- **Status:** completed
- **Tests:** owner-video-row.test.tsx 2 passing; Vitest components/studio+channel+video 28 arquivos ok; E2E completo 73 passing (desktop sem regressão)
- **Observations:**
  - Diagnóstico temporário em 390 px (Playwright, removido depois): nenhuma tela tinha rolagem horizontal da página, mas o edit de vídeo (card de config w-82, botão de thumbnail) e o Channel Settings tinham conteúdo cortado; watch page e telas de auth já estavam ok em 390 px. Depois dos ajustes, nenhum elemento passa da viewport em /login, /signup, /channel, /watch, /, /feed, /studio/videos, edit, /studio/channel e /studio/upload.
  - Canal: banner h-32/avatar size-24 e info empilhada abaixo de md; grid 1/2 colunas abaixo de lg mantendo o flex-wrap de cards fixos do Figma em lg+; chips de ordenação com overflow-x-auto.
  - Estúdio: VideoListItem em grid empilhado abaixo de md (thumbnail largura total, detalhes + menu lado a lado); formulários de vídeo e canal em coluna única abaixo de md, config card abaixo dos campos; gutters px-4 abaixo de sm nas páginas.

### SI-07.14.0 — Drift audit: Página inicial (Home / Catalog Show)
- **Status:** completed
- **Tests:** no tests (audit-only)
- **Observations:**
  - Auditoria contra os PNGs da fase (Figma MCP sem cota, OQ-6) + capturas do app em 1440 px: 12 alinhado, 3 drift menor (altura do header, avatar do menu da conta, spinner), 2 drift relevante (lupa duplicada na busca; FilterChip com CONFLICT vs SI-04.19.0 → exception até o acesso ao Figma voltar, por exigir variante com nome do Figma).
  - A auditoria não editou código; o AC de git diff vazio não é verificável literalmente porque as mudanças das SIs anteriores da fase seguem sem commit (o usuário controla o VCS).

### SI-07.14a — Tela de Página inicial (Home / Catalog Show) (visual shell)
- **Status:** completed
- **Tests:** no tests (visual shell) — next build ok; E2E completo 80 passing
- **Observations:**
  - Decisões do drift report aplicadas: header h-15; avatar do menu da conta size-16; spinner size-10 border-2; busca com uma lupa só (segmento do SearchInput é o submit com o campo vazio; com texto o segmento vira "Clear search" e o IconButton de envio volta ao lado — nota acrescentada ao report); FilterChip exception (CONFLICT).
  - Home, loading.tsx e error.tsx ficam no grupo app/(app)/(shell)/(home)/ (URL / inalterada) em vez de direto em (shell): um loading.tsx em (shell) viraria o skeleton de /studio/upload e /results, que não têm loading próprio.

### SI-07.14b — Tela de Página inicial (Home / Catalog Show) (lógica & wiring)
- **Status:** completed
- **Tests:** home-listing.test.ts 6 passing; tests/home.e2e-spec.ts 7 passing (2 repetições estáveis); E2E completo 80 passing
- **Observations:**
  - lib/home/home-listing.ts recebe a função de leitura (publicRead + upstream) por parâmetro — testável sem MSW; 404 só cai para a lista geral quando o código é CATEGORY_NOT_FOUND.
  - error.tsx usa unstable_retry no "Try again" (Next 16) e chama reset() quando a query muda: o Next só reseta o boundary quando o pathname muda, e /?category=upstream-error → / mantém o pathname (cenário 3.1 do spec).
  - E2E: 2.1 ignora prefetches (header next-router-prefetch) dos links de chips/cards ao checar requisições de RSC; 2.2 remove o IntersectionObserver para exercitar o fallback de teclado de forma determinística.

### SI-07.15.0 — Drift audit: Resultados da busca
- **Status:** completed
- **Tests:** no tests (audit-only)
- **Observations:**
  - Seção results: 6 alinhado — os componentes já haviam sido auditados na home e as correções aplicadas em SI-07.14a; sem edição de código.

### SI-07.15a — Tela de Resultados da busca (visual shell)
- **Status:** completed
- **Tests:** no tests (visual shell) — next build ok (rota ƒ /results)
- **Observations:**
  - Seção results do drift report sem ações (6 alinhado). Página com título "Results for “q”" (h1), grid sem chips, estado vazio com link para a home; loading.tsx com skeleton do título e do grid.

### SI-07.15b — Tela de Resultados da busca (lógica & wiring)
- **Status:** completed
- **Tests:** search-query.test.ts 10 passing; tests/search-results.e2e-spec.ts 5 passing (2 repetições estáveis); E2E completo 85 passing; tsc + lint ok
- **Observations:**
  - parseSearchQuery corta em 100 e aplica trim de novo depois do corte (um termo que termina em espaço após o corte não vira busca com espaço final).
  - results/error.tsx segue o padrão da home: unstable_retry no "Try again" e reset() quando a query muda (nova busca mantém o pathname /results).
  - O GlobalSearch é montado com key={q atual}, então o campo acompanha o q ao navegar entre buscas.

### SI-07.16 — Scroll infinito com hook próprio (Verification)
- **Status:** completed
- **Tests:** use-cursor-list.test.tsx 11 passing; infinite-video-grid.test.tsx 3 passing; infinite-scroll-sentinel.test.tsx 5 passing; regression guards E2E (channel-public, subscriptions-feed, home — inclui 2.3 voltar da watch page sem nova chamada a /api/videos) na suíte completa de 85 passing
- **Observations:**
  - Os testes do hook cobrem também 400 (recomeça da página da RSC), 401 (login com returnTo) e uma entrada de sessionStorage por URL; o limite de MAX_STORED_ITEMS é verificado na gravação (spy em setItem) e na leitura.

### SI-07.17 — Shell de navegação responsivo (Verification)
- **Status:** completed
- **Tests:** nav-state-provider.test.tsx 6 passing; tests/shell-responsive.e2e-spec.ts 6 passing (mobile 4 + desktop 2); --project=mobile 4 passing; --project=chromium 87 passing (regression guards das Fases 02, 04, 05 e 06 incluídos)
- **Observations:**
  - Focus de volta ao "≡": o NavDrawer não tem DialogTrigger, então o provider guarda o elemento que abriu o drawer (restoreFocus) e o NavDrawer o foca em onCloseAutoFocus — achado pelo teste de unidade.
  - Projeto mobile (Pixel 7) restrito por testMatch ao shell-responsive; o spec separa os perfis com test.skip por isMobile. O desktop confere no HTML do servidor (page.request) que a coluna já sai data-mode="mini" com o cookie, sem salto na hidratação.
  - next-frontend/CLAUDE.md documenta os dois projetos do Playwright.

### SI-07.18 — Suíte E2E full-stack dos fluxos principais
- **Status:** completed
- **Tests:** full-stack: 6 passing + 1 skipped (play sem SMOKE_VIDEO_ID) numa passada limpa; --grep @smoke com SMOKE_VIDEO_ID 4 passing sem criar usuários; backend e2e categories + throttler-proxy + read-throttle passing; suíte E2E com MSW 91 passing (chromium + mobile)
- **Observations:**
  - A suíte full-stack achou 3 defeitos de rate limit (todos com o throttle global de 10 req/min por rota e visitante) e os corrigi — DESVIO DO PLANO, sugerido formalizar via /decide como Revision do TD-01: (1) GET /categories passa a 60/min (CATEGORIES_THROTTLE) e a home lê as categorias via publicRead; (2) leituras de alta frequência — GET /videos/{publicId}, /playback, /related, /comments e GET /me/subscriptions — passam a 60/min (READ_THROTTLE em src/common/throttling/read-throttle.ts): o polling de processamento de 3 s (20/min) e o layout com sessão estouravam 10/min; (3) as leituras de RSC sem os headers do visitante (confirm-email, layout (app), feed, canal, páginas do estúdio) caíam todas no orçamento único do IP do BFF — agora encaminham clientHeaders() (watch-page/TD-03); a confirmação de e-mail tinha, na prática, 10/min para a plataforma inteira.
  - test/throttler-proxy.e2e-spec.ts passou a sondar o limite global em GET /channels/{nickname} (404 conta) porque /categories ganhou throttle próprio; novo test/read-throttle.e2e-spec.ts cobre os 60/min; categories.e2e-spec.ts cobre o limite das categorias. Cadeia OpenAPI regenerada (429 documentado).
  - Suíte full-stack: publishVideo espera "Checks complete" antes de preencher o formulário (o router.refresh ao fim do processamento resetava a categoria escolhida) e a jornada social confere o canal seguido pelo href (o nome do canal nasce do nickname derivado, não do Full Name).
  - Limite de auth (10/min por IP) é real: passadas consecutivas no mesmo minuto dão 429 no cadastro/login — documentado no next-frontend/CLAUDE.md (seção Full-stack E2E), junto com o fato de o npm run openapi:export derrubar o start:dev.

### SI-07.19 — Backend pronto para produção: SMTP autenticado e migrations compiladas
- **Status:** completed
- **Tests:** env.validation.spec.ts + mail.module.spec.ts + data-source.spec.ts: 27 passing (5 novos de SMTP, 2 do mailer, 2 do data source); mail.service.integration-spec 7 passing
- **Observations:**
  - MAIL_USER/MAIL_PASSWORD com .and() no schema Joi (a mensagem nomeia a chave faltante); mailTransport() exportado do mail.module e testado via MAILER_OPTIONS (sem credenciais = transporte idêntico ao Mailpit + secure:false).
  - data-source.ts resolve caminhos absolutos por __dirname + extensão do arquivo (dataSourcePaths); verificado com o dist estável: migration:show -d dist/database/data-source.js lista as 9 migrations [X] e migration:run:prod responde "No migrations are pending" sem ts-node.
  - O start:dev (deleteOutDir) apaga o dist durante a inspeção — documentado no nestjs-project/CLAUDE.md junto com MAIL_*, migration:run:prod, SWAGGER_ENABLED e os throttles de leitura.

### SI-07.20 — Infra: imagens de produção multi-stage (API/worker/migrate e Next standalone)
- **Status:** completed
- **Tests:** no tests (Infra) — docker build das duas imagens ok; checagens manuais abaixo
- **Observations:**
  - streamtube-api: sem .env no contexto (.dockerignore), ffmpeg 5.1.9, npm ls --omit=dev limpo, sem jest, USER node; com o .env de dev + NODE_ENV=production responde 200 em GET /; o mesmo image roda node dist/worker ("Video worker started") e npm run migration:run:prod ("No migrations are pending").
  - streamtube-web: standalone (server.js + .next/static + public), USER node, sem vitest; com API_URL/SESSION_PASSWORD de runtime responde 200 em / com chips e cards reais e não loga [msw].
  - lib/env.ts ganhou skipValidation por SKIP_ENV_VALIDATION=true, definido só no estágio de build do Dockerfile (as variáveis do frontend são de runtime).
  - Com output: standalone, next start (usado pelo E2E) avisa que não é suportado mas continua servindo — documentado no next-frontend/CLAUDE.md.

### SI-07.21 — Infra: compose de produção com Caddy, env e backup (validado localmente)
- **Status:** completed
- **Tests:** no tests (Infra) — validação local: config ok (base e base+local); up com profile local-validation
- **Observations:**
  - migrate saiu 0 (20:10:29) antes de api (20:10:33) e worker; https://localhost 200; só o caddy publica 80/443 (api/web/worker sem porta no host; rustfs 9100 e mailpit 8125 só no profile local).
  - X-Forwarded-For forjado (1.2.3.1..12) em POST /api/auth/forgot-password: 10×204 e depois 429 — o Caddy sobrescreve o header e o throttler conta o IP real.
  - backup.sh: dump -Fc enviado a backups/ no RustFS local; pg_restore --list lê o arquivo (Format: CUSTOM, tabelas public.*); GET anônimo no prefixo responde 403. O envio é por stdin (sem bind mount), e BACKUP_S3_ENDPOINT/COMPOSE_FILES permitem a validação local.
  - Smoke @smoke (3 passing) e a jornada account (cadastro → e-mail no Mailpit → login → Sign Out) passaram contra https://localhost; playwright.full-stack.config.ts ganhou FULL_STACK_IGNORE_HTTPS_ERRORS só para a CA local do Caddy. A jornada de upload não roda nesse modo (RustFS http sob página https = mixed content; em produção o S3 é https).
  - deploy/.gitignore ignora deploy/.env; a stack de validação foi derrubada com down -v.

### SI-07.22 — Infra: pipeline de CI de qualidade via Docker Compose
- **Status:** completed
- **Tests:** no tests (Infra) — actionlint limpo em ci.yml e openapi-freshness.yml; cada comando dos jobs foi executado localmente nas SIs anteriores (mesmos comandos do CLAUDE.md)
- **Observations:**
  - Jobs backend, frontend e full-stack; full-stack só em PR para main, push em dev e quando chamado pelo deploy (workflow_call). Todo npm/npx de Jest, Vitest, tsc e lint roda via docker compose exec; Playwright roda no runner (exceção documentada) com relatório como artefato em falha.
  - O checkout pertence ao uid do runner (1001) e os containers rodam como node (1000): o workflow faz chmod -R a+rwX no workspace antes do compose up. O job frontend cria a rede streamtube com a mesma sub-rede fixa (sem a stack do backend). No full-stack o video-worker é reiniciado depois do npm ci (o volume node_modules nasce vazio).
  - Lint do backend em CI usa o comando sem --fix documentado no CLAUDE.md (npx eslint ... --max-warnings 0). Status checks exigidos documentados no CLAUDE.md raiz; a proteção de branch fica a cargo do usuário. Não foi possível executar o workflow no GitHub nesta sessão.

### SI-07.23 — Infra: workflow de deploy (GHCR + SSH) e runbook de produção
- **Status:** completed
- **Tests:** no tests (Infra) — actionlint limpo em ci.yml, deploy.yml e openapi-freshness.yml
- **Observations:**
  - deploy.yml: push em main → gates (ci.yml via workflow_call) → images (docker build/push para ghcr.io/<owner>/streamtube-{api,web}:<sha>, packages: write só nesse job) → deploy no Environment production (checagem dos 4 secrets antes de qualquer SSH, scp de compose/Caddyfile/backup.sh, pull → up --wait db → run --rm migrate → up -d) → smoke @smoke contra https://$DOMAIN com relatório em falha. workflow_dispatch com image_tag pula gates e build (rollback).
  - Opcionais: secret SSH_KNOWN_HOSTS (senão ssh-keyscan) e variáveis DEPLOY_PATH/SMOKE_VIDEO_ID. A VPS precisa de docker login no GHCR (read:packages) ou pacotes públicos — no runbook.
  - docs/deploy/runbook.md cobre (a)–(h) + validação local; CLAUDE.md raiz atualizado (status da fase, deploy/, workflows, produção, comandos). Nenhum .env/chave entra no git (deploy/.gitignore). O deploy real e a execução dos workflows no GitHub não foram feitos nesta sessão (tarefa operacional do usuário, TD-11).

