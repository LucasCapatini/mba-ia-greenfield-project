---
scope_type: phase
related_phases: [7]
status: decided
date: 2026-10-20
scope_description: "Fase 07 — página inicial, busca e finalização, backend + frontend + repositório: contrato e ordenação da listagem da home com filtro por categoria, contrato e mecanismo da busca por título e canal, paginação vs. scroll infinito no frontend (reavaliação do TanStack Query prevista em social-interactions/TD-09), shell de navegação responsivo (header, menu lateral colapsável/drawer), estratégia dos testes dos fluxos principais, CI de qualidade, alvo de hospedagem, serviços com estado, borda (proxy reverso/TLS) e artefatos/mecanismo de deploy de produção."
---

# Technical Decisions — Fase 07: Página Inicial, Busca e Finalização

_Subprojects in scope:_

- `nestjs-project/` — recebe a listagem pública global de vídeos (home, filtro por categoria), a busca por título e canal (migration com extensões/índices), o ajuste do throttler nas listagens públicas, a imagem de produção (API, worker e migrations) e a configuração de produção (SMTP real, storage, `TRUST_PROXY`). TD-03 é exclusivo dele; TD-01 e TD-02 são contratos que ele produz.
- `next-frontend/` — recebe a home (`/`, hoje um placeholder) com grid e chips de categoria, a página de resultados de busca, o header completo (logo, busca, login/avatar, "≡"), o menu lateral colapsável e o drawer mobile, o layout responsivo das páginas existentes, o scroll infinito e a imagem de produção (`output: 'standalone'`). TD-04 e TD-05 são exclusivos dele; TD-01 e TD-02 são contratos que ele consome. Sem decisão aberta (composição sobre o que já existe): **card de vídeo** (`VideoCard` e `VideoCardItem` existentes — o canal não tem coluna de avatar, então o card usa as iniciais do `ChannelAvatar`), **formatação de números/tempo relativo** (`lib/format.ts`), **leitura das páginas** em RSC via `upstream`/`publicRead`.
- repositório (raiz) — recebe a suíte de testes dos fluxos principais, a pipeline de CI de qualidade, o compose de produção, as imagens e o mecanismo de deploy. TD-06..TD-11 são `Repo-wide`.

_Decisões herdadas que esta fase NÃO reabre:_ cursor keyset `{ items, next_cursor }` com `DEFAULT_PAGE_LIMIT` 20 / máx. 50 e cursor amarrado à ordenação (`video-channel-management/TD-06`); autenticação opcional nas leituras públicas (`TD-07`); nickname na URL do canal (`TD-08`); thumbnails com leitura anônima no prefixo `thumbnails/*` (`TD-10`); RSC + BFF + `router.refresh()` no resto da app (`TD-12`); `GET /videos/{publicId}/related` como lista fechada (`watch-page/TD-04`); rota `/watch/{publicId}` (`watch-page/TD-06`); IP real via `X-Forwarded-For` + `TRUST_PROXY` com IP fixo do `next-frontend` (`watch-page/TD-03` e Revisions — inclusive a pendência "o deploy precisa de um proxy reverso que sobrescreva o `X-Forwarded-For`", tratada em TD-10 abaixo); `useOptimistic` nas interações sociais e menu lateral com canais seguidos (`social-interactions/TD-08`, `TD-09` — este **reavaliado** em TD-04, como ele próprio previu); Swagger UI desligado em produção por `SWAGGER_ENABLED` (`openapi-docs-nestjs/TD-03`); Strict BFF com `API_URL` server-only (`next-frontend-config-base/TD-03`); duas stacks Compose ligadas pela rede `streamtube` em dev (`saneamento-fase-02-e-infra/TD-01`); gate `openapi-freshness` em CI (`saneamento-fase-02-e-infra/TD-06`); Git Flow `dev` → `main` (`TD-07`); pg-boss no mesmo PostgreSQL, worker como segundo entrypoint com ffmpeg do apt (`phase-03-videos/TD-04..TD-06`); `@nestjs-modules/mailer` com transporte SMTP (`phase-02-auth/TD-05`).

_Estado atual relevante:_ não existe listagem global de vídeos nem busca pública — a única busca é o `q` (`ILIKE '%q%'`) do painel do dono em `GET /channels/me/videos`; categorias têm `slug` único; `videos` já tem o índice `(status, visibility, published_at, id)`, mas nenhum índice de texto nem extensão (`pg_trgm`/`unaccent`). No frontend, toda listagem pagina por botão "Load more" (`LoadMore` → `router.replace(?cursor=)`), o header é o `AppHeader` mínimo (sem busca, sem avatar, sem "≡"), o menu lateral é uma coluna fixa `w-64` só com sessão, e quase não há breakpoints. Os 17 E2E do Playwright rodam todos sobre MSW, só em "Desktop Chrome". Não há Dockerfile de produção, compose de produção nem CI de testes — o único workflow é `openapi-freshness`.

_Observação sobre o throttler:_ o limite global é de 10 req/min **por rota e por visitante** (`social-interactions`, observação do throttler). Scroll infinito e busca fazem várias leituras seguidas da mesma rota, por isso TD-01/TD-02 fixam um limite próprio para as listagens públicas.

_Observação sobre o Figma:_ ainda não há `/screen-inventory 7`. O inventário da Fase 04 já cataloga o TopNav (152:1827) com o campo de busca global (62:1879), o botão de busca (62:1881), o "≡" (62:1860) e o avatar, todos marcados como "fase 07"; o progress da Fase 04 adia "Home / Catalog Show (143:948)" para esta fase, e o inventário da Fase 05 adia os chips de categoria ("All", categorias) para a home. A busca por voz e o botão "+" (criar) do Figma não têm capability e ficam fora.

_Pesquisa:_ o MCP `context7` não está disponível neste ambiente; as versões foram conferidas nos manifestos e as APIs nas fontes primárias: documentação empacotada do Next 16 (`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` — proxy reverso recomendado, chaves de ambiente em runtime; `03-api-reference/05-config/01-next-config-js/output.md` — `output: 'standalone'`), PostgreSQL 17 (`pgtrgm.html` — índice GIN atende `LIKE`/`ILIKE` sem âncora, extensão "trusted", padrão sem trigramas degenera para varredura do índice), Caddy (`reverse_proxy` — ignora `X-Forwarded-*` vindos de clientes fora de `trusted_proxies`) e Cloudflare R2 (API S3 — multipart e CORS implementados, `PutBucketPolicy` **não** implementado). Versões instaladas: `@nestjs/core` 11, `typeorm` 0.3.28, `@nestjs/throttler` 6.5.0, PostgreSQL 17, `next` 16.2.6, `react` 19.2.4, `@playwright/test` 1.60, `msw` 2.14.6; `@tanstack/react-query` 5.x no registry (não instalado).

---

## TD-01: Contrato da listagem da home — ordenação e filtro por categoria

**Scope:** Cross-layer

**Capability:** Transversal — covers: Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação); Filtro de vídeos por categoria na home; Paginação ou scroll infinito nas listagens de vídeos

**Context:** a home precisa de uma listagem pública global que hoje não existe (`watch-page/TD-04` deixou de propósito essa decisão para esta fase). Elegibilidade é fixa — `published` + `public` + `ready`, unlisted nunca aparece. Em aberto: a ordenação (que decide se o cursor keyset herdado continua estável), como a categoria é identificada na API e na URL, e o orçamento do throttler para várias páginas seguidas. Cross-layer: define a rota, os query params, o envelope e o formato da URL da home.

**Options:**

### Option A: `GET /videos?category=<slug>&cursor=&limit=` em ordem cronológica
- Listagem `@Public()` em `published_at DESC, id DESC` (usa o índice `(status, visibility, published_at, id)` existente), envelope `CursorPage<VideoCardItem>`; `category` opcional pelo `slug` (slug desconhecido → 404). A home lê `?category=` dos `searchParams` e os chips são `<Link>` (o "All" limpa o filtro), com as categorias de `GET /categories`.
- **Pros:** cursor estável (a chave não muda durante a navegação); nenhum índice novo; URL compartilhável e botão "voltar" funcionando; o mesmo endpoint serve a busca (TD-02).
- **Cons:** sem noção de relevância/popularidade — um catálogo grande vira "o mais recente primeiro".

### Option B: ordenação por popularidade (`view_count DESC, id DESC`)
- Mesmo endpoint, chave de ordenação = contador de visualizações.
- **Pros:** home tipo "em alta"; destaca o que já performa.
- **Cons:** `view_count` muda durante a navegação → o keyset produz duplicatas e saltos entre páginas (exatamente o drift que `video-channel-management/TD-06` quis evitar); índice novo; vídeos novos nunca sobem.

### Option C: home em prateleiras por categoria (`GET /home` com seções)
- Uma seção por categoria com os N mais recentes; o chip abre um grid filtrado.
- **Pros:** variedade na primeira dobra.
- **Cons:** consulta "top-N por grupo" (`LATERAL`) e paginação por seção; dois contratos (prateleiras + grid); diverge do grid com chips do Figma (Catalog Show 143:948).

**Recommendation:** **Option A (`GET /videos?category=` cronológico)** — é a única que preserva o cursor keyset herdado sem drift, reaproveita o índice existente e segue o grid com chips do Figma; popularidade pode virar um `sort` adicional depois, sem quebrar o contrato. Parâmetros a fixar junto: `category` = `slug`; filtro na URL da home como `/?category=<slug>`; `@Throttle` próprio de 60 req/min por visitante em `GET /videos` (e nas listagens públicas que passarem a usar scroll infinito — canal e feed), porque o limite global de 10/min por rota esgota com poucas páginas.

**Decision:** A (`GET /videos?category=<slug>&cursor=&limit=` público em `published_at DESC, id DESC`, envelope `CursorPage<VideoCardItem>`, slug desconhecido → 404; filtro na URL da home como `/?category=<slug>` com chips `<Link>`; `@Throttle` de 60 req/min por visitante em `GET /videos` e nas listagens públicas com scroll infinito)

**Revisions:**
- 2026-10-20 — `?category=<slug>` desconhecido: a home trata o 404 de `GET /videos` renderizando a lista sem filtro, com o chip "All" ativo e um aviso discreto de categoria não encontrada (sem `notFound()` nem redirect). Rationale: OQ-2 do `/plan-validate 7`, escolha do usuário.
- 2026-10-20 — Orçamento de 60 req/min por visitante estendido além das listagens: `GET /categories` (`CATEGORIES_THROTTLE`) e as leituras de alta frequência `GET /videos/{publicId}`, `/playback`, `/related`, `GET /videos/{publicId}/comments` e `GET /me/subscriptions` (`READ_THROTTLE` em `src/common/throttling/read-throttle.ts`, 429 documentado); todas as leituras de RSC encaminham o IP do visitante via `clientHeaders()` (confirmação de e-mail, layout `(app)`, feed, canal, estúdio, home). Rationale: a suíte full-stack (SI-07.18) mostrou que o polling de processamento de 3 s (20/min) e o layout com sessão estouravam o limite global de 10/min por rota, que abrir mais de 10 vídeos/min levava à página de erro, e que leituras de RSC sem o IP do visitante caíam no orçamento único do BFF — a confirmação de e-mail tinha 10/min para a plataforma inteira; as rotas de auth seguem no limite global.

---

## TD-02: Contrato e superfície da busca (o que "título e canal" devolve)

**Scope:** Cross-layer

**Capability:** Transversal — covers: Barra de busca (pesquisa por título e canal); Header/navbar com logo, barra de busca, botão de login/avatar e navegação

**Context:** "pesquisa por título e canal" admite duas leituras: vídeos cujo título **ou** canal casa com o termo, ou resultados de canais além de vídeos. A escolha define a rota da API, o shape da resposta, a página de resultados do frontend e o gatilho da busca (ao digitar vs. ao enviar), que pesa no throttler. O mecanismo de correspondência fica em TD-03. Depende de TD-01.

**Options:**

### Option A: `GET /videos?q=` — vídeos cujo título ou canal casam com o termo
- O endpoint de TD-01 ganha `q` (combinável com `category`); casa título do vídeo **ou** `name`/`nickname` do canal; resposta continua `CursorPage<VideoCardItem>`. O header navega para `/results?q=` ao enviar (Enter ou botão); a página reusa o grid e o scroll infinito da home.
- **Pros:** um endpoint, um shape, um componente de grid; "buscar pelo canal" devolve os vídeos desse canal; sem consulta por tecla.
- **Cons:** não há um card de canal no topo — para chegar à página do canal o usuário clica no nome do canal num card.

### Option B: `GET /search?q=` com resultado misto
- Resposta `{ channels: ChannelCard[] (até 3, sem paginação), videos: CursorPage<VideoCardItem> }`; a página de resultados mostra os canais no topo e os vídeos abaixo.
- **Pros:** padrão do YouTube; leva direto ao canal.
- **Cons:** shape novo só para a busca; o cursor pagina só a parte de vídeos (a primeira resposta difere das seguintes); `ChannelCard` novo no OpenAPI, no MSW e no frontend.

### Option C: dois endpoints (`GET /videos?q=` + `GET /channels?q=`) compostos no frontend
- A página de resultados faz as duas chamadas em paralelo.
- **Pros:** cada recurso continua com seu contrato; canais paginam por conta própria.
- **Cons:** duas chamadas por busca no orçamento do throttler; listagem pública de canais nova sem outra capability que a use.

**Recommendation:** **Option A (`GET /videos?q=` + página `/results?q=`)** — atende as duas metades da capability com o contrato e o grid da home, sem shape novo; resultado de canais (B) pode ser acrescentado depois sem quebrar A. Parâmetros a fixar junto: `q` com `trim`, 2 a 100 caracteres; busca disparada só ao enviar (sem autocomplete — sem capability e caro no throttler); ordenação conforme TD-03; o campo do header vem preenchido com o `q` atual na página de resultados.

**Decision:** A (`GET /videos?q=` casando título do vídeo ou `name`/`nickname` do canal, combinável com `category`, mesmo `CursorPage<VideoCardItem>`; página `/results?q=` disparada ao enviar, sem autocomplete; `q` com `trim`, 2 a 100 caracteres)

**Revisions:**
- 2026-10-20 — `q` inválido: o campo do header não envia `q` vazio ou só com espaços e limita a 100 caracteres; `/results` aberto direto com `q` vazio redireciona para `/`; com 1 caractere renderiza o estado vazio com a regra ("Enter at least 2 characters") sem chamar a API. Rationale: OQ-3 do `/plan-validate 7`, escolha do usuário.

---

## TD-03: Mecanismo de correspondência textual da busca

**Scope:** Backend

**Capability:** Barra de busca (pesquisa por título e canal)

**Context:** hoje não há índice de texto nem extensão no banco; o `ILIKE '%q%'` do painel do dono varre a tabela, o que é aceitável no escopo de um canal mas não no catálogo inteiro com join em `channels`. O conteúdo mistura português e inglês, títulos curtos e nicknames como `dev_lucas`. A escolha define a migration (extensões, índices), a semântica do casamento (substring, palavra, acento) e se há ordenação por relevância — que muda a chave do cursor.

**Options:**

### Option A: `pg_trgm` + `unaccent` com `ILIKE` por substring, ordem cronológica
- Migration cria as extensões (ambas "trusted") e índices GIN `gin_trgm_ops` sobre `immutable_unaccent(lower(...))` de `videos.title`, `channels.name` e `channels.nickname`; a consulta casa `%termo%` sem acento nem caixa e ordena por `published_at DESC, id DESC` (cursor de TD-01).
- **Pros:** casa pedaços de palavra ("tutor" → "tutorial") e nicknames; sem dependência de idioma; reaproveita o cursor e a ordenação da home; resultado previsível.
- **Cons:** sem relevância — um título exato aparece atrás de vídeos mais novos que só contêm o termo; precisa de uma função wrapper `IMMUTABLE` para indexar `unaccent`; termos com menos de 3 caracteres não geram trigramas e varrem o índice inteiro.

### Option B: full-text search (`tsvector` gerado + GIN, `websearch_to_tsquery`), ordem por `ts_rank`
- Coluna gerada com pesos (título A, canal B) numa configuração (`simple` + `unaccent`, ou `portuguese`); cursor keyset sobre `(rank, id)`.
- **Pros:** relevância; sintaxe de busca ("termo1 -termo2", aspas); stemming se usar `portuguese`.
- **Cons:** casa palavras inteiras (prefixo só com `:*`) — "tutor" não acha "tutorial" sem ajuste; stemming em português erra em títulos em inglês; o rank vira chave de cursor, um tipo de cursor novo; `nickname` com `_` é tokenizado.

### Option C: motor externo (Meilisearch/OpenSearch)
- Serviço novo no compose, indexação na publicação/edição (job pg-boss) e consulta pelo motor.
- **Pros:** tolerância a erro de digitação, relevância e destaque prontos.
- **Cons:** mais um serviço com estado em dev e produção; sincronização eventual (vídeo publicado não aparece na hora; despublicado continua aparecendo até reindexar); desproporcional ao volume do projeto.

**Recommendation:** **Option A (`pg_trgm` + `unaccent`, substring, ordem cronológica)** — dá o comportamento que um usuário espera de uma caixa de busca simples (pedaço de palavra, sem acento) com o PostgreSQL que já está no stack, mantém o cursor único da home e não adiciona serviço; relevância (B) fica como evolução se o catálogo crescer. O custo dos termos de 2 caracteres é aceitável no volume do projeto.

**Decision:** A (`pg_trgm` + `unaccent` com wrapper `IMMUTABLE`, índices GIN `gin_trgm_ops` em `videos.title`, `channels.name` e `channels.nickname`; `ILIKE` por substring sem acento/caixa; ordem cronológica com o cursor de TD-01)

---

## TD-04: Paginação vs. scroll infinito no frontend e camada de dados das listas (reavaliação de `social-interactions/TD-09`)

**Scope:** Frontend

**Capability:** Transversal — covers: Paginação ou scroll infinito nas listagens de vídeos; Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação); Barra de busca (pesquisa por título e canal)

**Context:** todas as listagens paginam hoje por botão "Load more" que faz `router.replace(?cursor=)` e re-renderiza o RSC; os comentários já paginam no cliente via BFF. A home e os resultados de busca são as listas mais longas da app, e `social-interactions/TD-09` pediu reavaliar o TanStack Query "se a Fase 07 trouxer mais listas paginadas no cliente". A decisão é como as próximas páginas chegam, em quais listas, e o que acontece ao voltar da watch page para a home.

**Options:**

### Option A: scroll infinito com `IntersectionObserver` + estado local, sem dependência nova
- Primeira página no RSC; um hook compartilhado (ex.: `useCursorList`) busca as seguintes pelo BFF (`GET /api/videos?…`) quando um sentinela entra na tela, com botão "Load more" como fallback acessível. Trocar de categoria/termo reinicia a lista (`key` pelos `searchParams`). Vale para home, resultados, página do canal e feed; o estúdio mantém o botão.
- **Pros:** zero dependência; mesmo padrão dos comentários; nenhum re-render do RSC (header, chips e categorias não são buscados de novo a cada página).
- **Cons:** ao voltar da watch page, a lista remonta só com a primeira página e a rolagem se perde (a menos que se guarde em `sessionStorage`); cache e deduplicação escritos à mão.

### Option B: manter o `LoadMore` atual (`router.replace(?cursor=)`) também na home e na busca
- Paginação por botão; cada clique re-renderiza o RSC com o cursor na URL e o cliente acumula os cards.
- **Pros:** nenhum padrão novo; a capability aceita "paginação".
- **Cons:** cada página refaz as leituras do RSC (lista + categorias + sessão) no orçamento do throttler; URL com cursor que, recarregada, mostra uma página solta; sem scroll infinito.

### Option C: TanStack Query (`useInfiniteQuery`) + `IntersectionObserver`
- `QueryClientProvider` no layout, primeira página hidratada do RSC (`HydrationBoundary`) e as seguintes por `queryFn` via BFF.
- **Pros:** cache entre montagens — voltar para a home restaura as páginas já carregadas; deduplicação e retry prontos; base para migrar comentários e o menu lateral.
- **Cons:** dependência, Provider e hidratação novos; dois caminhos de leitura (RSC e `queryFn`) a manter coerentes; testes de componente passam a precisar de `QueryClient`; contraria a convergência em `useOptimistic` recém-feita na Fase 06.

**Recommendation:** **Option A (scroll infinito com hook próprio, sem dependência)** — entrega o scroll infinito com o padrão já usado nos comentários, sem refazer o RSC por página e sem um segundo modelo de dados na app; a perda das páginas extras ao voltar é contornável guardando cursor e itens em `sessionStorage`. Se a restauração completa ao voltar for requisito, a Option C passa a valer o custo.

**Decision:** A (scroll infinito com `IntersectionObserver` + hook próprio via BFF, botão "Load more" como fallback; home, resultados, página do canal e feed; estúdio mantém o botão; sem TanStack Query; páginas extras opcionalmente guardadas em `sessionStorage` para a volta da watch page)

**Renders in:** frontend-runtime

**Revisions:**
- 2026-10-20 — Restauração ao voltar: o hook de cursor guarda itens, `next_cursor` e a posição de rolagem por URL em `sessionStorage` (com limite de itens guardados) e restaura ao remontar a lista; sem dado salvo, recomeça na primeira página. Rationale: AMB-2 do `/plan-validate 7`, escolha do usuário.

---

## TD-05: Shell de navegação responsivo — header, menu lateral e mobile

**Scope:** Frontend

**Capability:** Transversal — covers: Header/navbar com logo, barra de busca, botão de login/avatar e navegação; Layout responsivo para dispositivos móveis

**Context:** o `AppHeader` atual é mínimo (e-mail, "Meus vídeos", "Meu canal", "Sair"); o menu lateral (`social-interactions/TD-08`) é uma coluna fixa, só com sessão, e deixou "colapso pelo ≡ e comportamento mobile" para esta fase; a watch page fica fora do shell. O Figma traz header com busca, "≡" e avatar. É preciso decidir a forma da navegação em telas estreitas, o colapso no desktop e o que o anônimo vê — escolhas que valem para todas as páginas.

**Options:**

### Option A: shell único no padrão do Figma — menu persistente colapsável no desktop, drawer abaixo de `lg`
- Header global em todas as rotas de app: "≡", logo, busca (no mobile vira ícone que expande a barra), login ou avatar com menu (Your channel, Studio, Sign out). Em `lg+` o menu lateral alterna entre expandido e mini (ícones) pelo "≡", com o estado num cookie lido no RSC (sem flash); abaixo de `lg` e na watch page o "≡" abre um drawer (`Dialog` do `radix-ui`, padrão Sheet do shadcn). O anônimo também vê o menu com "Home" e um convite para entrar; as seções de inscrições só aparecem com sessão.
- **Pros:** é o desenho do Figma e o padrão conhecido do YouTube; uma navegação para todas as larguras; reaproveita os primitivos Radix já instalados.
- **Cons:** três estados de menu (expandido, mini, drawer) a testar; mostrar o menu ao anônimo altera um parâmetro de `social-interactions/TD-08` ("visível apenas com sessão"), que vira Revision.

### Option B: barra de abas inferior no mobile + menu lateral fixo no desktop
- No mobile, abas fixas no rodapé (Home, Subscriptions, You); no desktop, o menu atual sem colapso.
- **Pros:** padrão de app nativo; navegação a um toque do polegar.
- **Cons:** não está no Figma; dois modelos de navegação a manter; a barra inferior disputa espaço com o player e com a caixa de comentário na watch page.

### Option C: mínimo — menu lateral escondido abaixo de `lg`, links essenciais no menu do avatar
- Sem drawer e sem colapso: abaixo de `lg` o menu some e "Subscriptions"/"Your videos" vão para o menu do avatar.
- **Pros:** menos código e menos estados.
- **Cons:** no mobile a lista de canais seguidos desaparece (a capability da Fase 06 fica sem acesso); o "≡" do Figma fica sem função; anônimo sem navegação.

**Recommendation:** **Option A (shell único: colapso no desktop, drawer abaixo de `lg`)** — é a leitura direta do Figma, mantém a área de canais seguidos acessível em qualquer largura e usa só primitivos já instalados; o cookie evita o salto de layout que um estado em `localStorage` causaria no SSR. Parâmetro a confirmar junto: menu visível para o anônimo (Revision de `social-interactions/TD-08`) ou mantido só com sessão.

**Decision:** A (shell único do Figma: header com "≡", busca e login/avatar com menu; menu lateral expandido/mini em `lg+` com estado em cookie lido no RSC; drawer abaixo de `lg` e na watch page; menu visível também para o anônimo com "Home" e convite para entrar — Revision de `social-interactions/TD-08`)

**Renders in:** frontend-runtime

**Revisions:**
- 2026-10-20 — Menu lateral visível também para o anônimo ("Home" + convite para entrar); "Subscriptions", "Your videos" e a lista de canais seguidos só com sessão — Revision correspondente em `social-interactions/TD-08`. Rationale: ICC-1 do `/plan-validate 7`, escolha do usuário.
- 2026-10-20 — @nickname no menu da conta: a sessão (`iron-session`) ganha `channelNickname`, preenchido no login/refresh e atualizado quando o nickname muda em `/studio/channel`, como já ocorre com `channelName`; sem leitura extra por render. Rationale: OQ-1 do `/plan-validate 7`, escolha do usuário.
- 2026-10-20 — Escopo do responsivo: além do shell, todas as telas — públicas (home, busca, watch, canal, feed), auth e estúdio; abaixo de `md`, as tabelas do estúdio viram lista empilhada e os formulários ficam em coluna única (sem frame mobile no Figma). Rationale: OQ-4 do `/plan-validate 7`, escolha do usuário.
- 2026-10-20 — Idioma dos textos sem frame: inglês, como o Figma ("Sign in", "Results for “{q}”", estados vazios, convite do menu do anônimo); o header atual em português ("Entrar", "Sair", "Meus vídeos") é substituído. Rationale: OQ-5 do `/plan-validate 7`, escolha do usuário.
- 2026-10-20 — Correção da Revision de OQ-1 acima: a sessão já carrega o nickname do canal em `channelSlug` (preenchido no login a partir de `GET /channels/me`, reescrito por `PATCH /api/channel` quando o nickname muda e exposto ao cliente pelo `SessionProvider`); o menu da conta usa `channelSlug` para o @nickname e para o link `/channel/{nickname}` — nenhum campo novo, `channelNickname` não é criado. Rationale: a premissa do inventário ("a sessão só guarda `channelName`") estava errada, verificado no código durante o `/plan-build 7`; escolha do usuário.

---

## TD-06: Estratégia dos testes dos fluxos principais

**Scope:** Repo-wide

**Capability:** Testes dos fluxos principais da plataforma

**Context:** cada subprojeto já tem sua pirâmide (backend: unit, integração com serviços reais e e2e supertest; frontend: Vitest + 17 E2E Playwright sobre MSW, só desktop). Nenhum teste exercita a integração real navegador → BFF → API → worker → storage, e o MSW só é conferido contra o contrato pelos tipos. A capability pede testes dos fluxos principais da plataforma; a decisão é em que camada eles vivem, contra o quê rodam e onde ficam no repositório.

**Options:**

### Option A: suíte E2E full-stack, enxuta, sobre as duas stacks reais (sem MSW)
- Um punhado de jornadas críticas em Playwright contra o frontend em build de produção e o backend real: cadastro → confirmação (link lido da API do Mailpit) → login; upload de uma fixture curta → processamento pelo worker → publicação → home e busca → watch com visualização; comentário, like e inscrição → feed. Cada execução cria seus próprios usuários. Fica no `next-frontend` como segunda configuração (`playwright.full-stack.config.ts`, pasta `full-stack/`), reusando a instalação do Playwright; o projeto MSW ganha um projeto mobile (`devices['Pixel 7']`) para a responsividade.
- **Pros:** prova a integração real que nenhuma camada cobre hoje (BFF, `TRUST_PROXY`, URLs pré-assinadas, CORS do bucket, worker); um subconjunto vira o smoke pós-deploy (TD-11).
- **Cons:** lenta (upload + ffmpeg) e mais frágil que MSW; exige as duas stacks no ar, com dados acumulando no banco de dev (usuários únicos por execução mitigam).

### Option B: só ampliar as camadas existentes
- E2E MSW para as telas novas (com viewport mobile) e e2e supertest para os endpoints novos; "fluxos principais" vira uma matriz documentada fluxo → testes existentes.
- **Pros:** nenhuma infraestrutura nova; rápida e determinística.
- **Cons:** nenhuma prova da integração real; divergência entre MSW e API continua só detectável pelos tipos.

### Option C: testes de contrato + smoke pós-deploy
- Validar as respostas dos handlers MSW e da API contra o `openapi.json` e rodar um smoke mínimo contra o ambiente publicado.
- **Pros:** fecha a lacuna MSW ↔ API sem subir tudo; o smoke pega erro de configuração de produção.
- **Cons:** valida shape, não comportamento (fila, worker, storage); o smoke só roda depois do deploy.

**Recommendation:** **Option A (suíte full-stack enxuta + projeto mobile no MSW)** — é a única que testa o caminho que mais quebra em produção (BFF ↔ API ↔ worker ↔ storage), com poucas jornadas para manter o custo baixo; morar no `next-frontend` evita criar um `package.json` na raiz, e o mesmo código serve de smoke no deploy.

**Decision:** A (suíte E2E full-stack enxuta sobre as stacks reais, sem MSW, em `next-frontend` como segunda configuração Playwright; projeto mobile no Playwright MSW; subconjunto reaproveitado como smoke pós-deploy)

---

## TD-07: Pipeline de CI de qualidade

**Scope:** Repo-wide

**Capability:** Transversal — covers: Testes dos fluxos principais da plataforma; Ambiente de produção e deploy

**Context:** o Definition of Done (testes, `tsc`, lint) é verificado só localmente; o único workflow é o `openapi-freshness`, que roda no runner com Node (`saneamento-fase-02-e-infra/TD-06`). Para ir a produção com confiança — e para o deploy (TD-11) ter um gate — os testes precisam rodar em CI. A decisão é o ambiente de execução (os testes de integração do backend dependem de PostgreSQL, RustFS, Mailpit e ffmpeg) e o que roda em cada evento.

**Options:**

### Option A: GitHub Actions executando via Docker Compose (o mesmo ambiente do dev)
- Jobs por subprojeto sobem o compose e rodam os mesmos comandos do `CLAUDE.md` (`docker compose exec … npm test`, `test:e2e`, `tsc`, `lint`; no frontend também `build` e o Playwright MSW); um job full-stack sobe as duas stacks para a suíte de TD-06. `openapi-freshness` continua como está.
- **Pros:** paridade total com o dev (ffmpeg, RustFS, rede `streamtube`); nenhum segundo jeito de rodar testes a manter.
- **Cons:** mais lento (build de imagem, subida dos serviços); cache de `node_modules` em volume exige configuração.

### Option B: GitHub Actions nativo (`setup-node` + `services:`)
- Node no runner, PostgreSQL/Mailpit como `services`, RustFS como container de serviço e ffmpeg via apt.
- **Pros:** mais rápido, cache de npm nativo; segue o precedente do `openapi-freshness`.
- **Cons:** segunda definição do ambiente (versões de Node e ffmpeg, hosts, envs) que diverge do compose; `services:` não cobre o bootstrap do bucket (`storage-init`) sem script extra.

### Option C: sem CI de testes (status quo)
- DoD continua local; CI só com o gate de OpenAPI.
- **Pros:** zero trabalho.
- **Cons:** nenhum gate antes do deploy; regressões dependem da disciplina de cada execução local.

**Recommendation:** **Option A (Actions via Docker Compose)** — reaproveita exatamente o ambiente em que os testes já passam e evita manter uma segunda definição de serviços; o custo de tempo é aceitável no volume de PRs do projeto. Parâmetros a fixar junto: lint + `tsc` + unit/integração + e2e de cada subprojeto em todo PR para `dev` e `main`; a suíte full-stack em PR para `main` e push em `dev`; status checks obrigatórios na proteção de `main`.

**Decision:** A (GitHub Actions via Docker Compose com os comandos do `CLAUDE.md`; lint + `tsc` + unit/integração + e2e em todo PR para `dev` e `main`; suíte full-stack em PR para `main` e push em `dev`; status checks obrigatórios em `main`; `openapi-freshness` mantido)

---

## TD-08: Alvo de hospedagem de produção

**Scope:** Repo-wide

**Capability:** Ambiente de produção e deploy

**Context:** nenhum documento escolhe onde o StreamTube roda. A arquitetura tem cinco processos (Next, API, worker com ffmpeg, PostgreSQL com pg-boss, object storage) e depende de premissas de rede: a API não é exposta e confia só no IP fixo do `next-frontend` (`watch-page/TD-03`), o navegador fala direto com o storage por URL pré-assinada, e o worker precisa de ffmpeg e de conexão persistente com o banco. A escolha condiciona TD-09, TD-10 e TD-11.

**Options:**

### Option A: uma VM (VPS) com Docker Compose de produção
- Todos os containers numa máquina Linux (Next, API, worker, PostgreSQL, proxy reverso), na mesma topologia de rede do dev.
- **Pros:** o menor custo; preserva todas as premissas atuais (rede interna, `TRUST_PROXY` por IP fixo, worker com ffmpeg, pg-boss); a ferramenta (Compose) já é a do projeto.
- **Cons:** ponto único de falha; escala só vertical; atualizações do SO, backups e monitoramento ficam por conta do time.

### Option B: PaaS de containers (Render, Railway, Fly.io)
- Next, API e worker como serviços da plataforma a partir dos Dockerfiles; PostgreSQL gerenciado da própria plataforma.
- **Pros:** TLS, deploy por push, logs e restart prontos; banco com backup gerenciado.
- **Cons:** IP fixo do `next-frontend` em rede privada varia por plataforma — provavelmente obriga a trocar `TRUST_PROXY` pelo header assinado (Option C de `watch-page/TD-03`); custo cresce por serviço; recursos de CPU limitados para o ffmpeg.

### Option C: Vercel para o Next + VM/PaaS para API e worker
- Frontend na plataforma nativa do Next; backend em outro provedor.
- **Pros:** melhor suporte ao Next (CDN, cache, preview por PR).
- **Cons:** o BFF chama a API pela internet — a API passa a ser pública, quebrando a premissa de `TRUST_PROXY` e exigindo o header assinado; latência entre provedores em toda leitura do RSC; dois provedores para operar.

**Recommendation:** **Option A (VPS com Docker Compose)** — é a que mantém válidas as decisões de rede e confiança já tomadas (Strict BFF, `TRUST_PROXY`, worker no mesmo stack) com o menor custo e nenhuma ferramenta nova; os riscos de máquina única são aceitáveis para o escopo do projeto e atenuados por backups (TD-09). As Options B e C exigem antes reabrir `watch-page/TD-03`.

**Decision:** A (uma VPS Linux com Docker Compose de produção, mesma topologia de rede do dev)

---

## TD-09: Serviços com estado em produção — PostgreSQL, object storage e e-mail

**Scope:** Repo-wide

**Capability:** Ambiente de produção e deploy

**Context:** em dev, PostgreSQL, RustFS e Mailpit são containers locais. Em produção o Mailpit não serve (é uma caixa de captura, não entrega e-mail), os vídeos de até 10 GB fazem o storage crescer rápido ("Armazenamento" nos Pontos de Atenção do plano) e o banco precisa de backup. A escolha também tem uma restrição herdada: `video-channel-management/TD-10` depende de política de bucket **por prefixo** (`thumbnails/*` anônimo, `videos/*` privado) — provedores sem `PutBucketPolicy` (ex.: Cloudflare R2) obrigariam a separar as thumbnails num segundo bucket. Depende de TD-08.

**Options:**

### Option A: tudo na VM — PostgreSQL e RustFS em volumes + provedor SMTP externo
- Containers de produção iguais aos de dev, com backup `pg_dump` agendado; e-mail por um provedor SMTP transacional.
- **Pros:** custo fixo; nenhuma diferença de comportamento entre dev e produção no storage (mesmo RustFS, mesma política de bucket).
- **Cons:** o disco da VM limita o acervo de vídeos e é o mesmo do banco; backup do storage fica por conta do time; egress de streaming sai da VM.

### Option B: PostgreSQL na VM + object storage gerenciado S3-compatível + provedor SMTP
- Banco em container com `pg_dump` agendado (enviado ao object storage); vídeos e thumbnails num S3 gerenciado; e-mail por SMTP transacional (só configuração no `@nestjs-modules/mailer`).
- **Pros:** tira da VM a parte que cresce sem limite; durabilidade do storage gerenciada; o código não muda (endpoint/credenciais por ambiente).
- **Cons:** custo variável (armazenamento + egress no AWS S3; R2 sem egress, mas sem política por prefixo → bucket separado para thumbnails e Revision de `video-channel-management/TD-10`); CORS e política do bucket configurados no provedor.

### Option C: tudo gerenciado — PostgreSQL gerenciado + object storage + SMTP
- Banco em provedor gerenciado (com backup e PITR), storage e e-mail idem.
- **Pros:** nenhum serviço com estado na VM; backup e restauração prontos.
- **Cons:** maior custo; pg-boss precisa de permissão para criar o schema `pgboss` e de conexões persistentes (planos gratuitos limitam); latência VM ↔ banco se em regiões diferentes.

**Recommendation:** **Option B (PostgreSQL na VM, storage S3 gerenciado, SMTP transacional)** — separa o que cresce (vídeos) do que cabe na VM (banco), sem mudar código, e mantém o banco perto da API e do worker. Parâmetro a fixar junto: provedor de storage — AWS S3 (mantém `TD-10` como está) ou R2 (sem egress, com bucket separado para thumbnails como Revision de `TD-10`).

**Decision:** B (PostgreSQL em container na VM com `pg_dump` agendado enviado ao object storage; vídeos e thumbnails no AWS S3, mantendo a política por prefixo de `video-channel-management/TD-10`; e-mail por provedor SMTP transacional)

**Revisions:**
- 2026-10-20 — Provedor do object storage em produção: AWS S3 — a política por prefixo de `video-channel-management/TD-10` (`thumbnails/*` anônimo, `videos/*` privado) é mantida sem Revision; R2 descartado. Rationale: AMB-3 do `/plan-validate 7`, escolha do usuário.

---

## TD-10: Borda de produção — proxy reverso, TLS, hostnames e `X-Forwarded-For`

**Scope:** Repo-wide

**Capability:** Ambiente de produção e deploy

**Context:** `watch-page/TD-03` deixou registrado que o `next start` mantém um `X-Forwarded-For` vindo do navegador e que "o deploy exige um proxy reverso que **sobrescreva** o `X-Forwarded-For`", senão um visitante forja o IP e escapa do throttler e da deduplicação de visualizações. A documentação do Next 16 também recomenda um proxy reverso na frente do `next start`. A borda precisa de TLS, definir os hostnames públicos (frontend e, se o storage for próprio, o endpoint público do storage em `S3_PUBLIC_ENDPOINT`), manter a API sem exposição e liberar uploads de 10 GB que vão direto ao storage. Depende de TD-08 (com A) e de TD-09.

**Options:**

### Option A: Caddy
- `reverse_proxy` para o `next-frontend` (e para o storage, se próprio), com certificado Let's Encrypt automático.
- **Pros:** TLS automático sem certbot; por padrão **ignora** `X-Forwarded-*` de clientes que não estão em `trusted_proxies` e grava o IP real — fecha a pendência de `watch-page/TD-03` sem configuração extra; Caddyfile curto.
- **Cons:** menos material de referência que o Nginx; ajustes finos de buffer/timeout são diferentes do que a maioria conhece.

### Option B: Nginx + certbot
- `proxy_pass` com `proxy_set_header X-Forwarded-For $remote_addr` explícito e renovação de certificado por certbot (container ou cron).
- **Pros:** o mais conhecido; controle fino de limites e cache.
- **Cons:** renovação de certificado é peça a mais; sobrescrever o XFF depende de lembrar o `$remote_addr` (o idioma comum, `$proxy_add_x_forwarded_for`, **acrescenta** e mantém o spoofing).

### Option C: Traefik com labels no Compose
- Roteamento declarado nos labels dos serviços, ACME automático.
- **Pros:** configuração junto de cada serviço; TLS automático.
- **Cons:** precisa do socket do Docker no proxy; `forwardedHeaders` também exige configuração de confiança; mais conceitos (entrypoints, routers, middlewares) para um único host.

**Recommendation:** **Option A (Caddy)** — resolve TLS e a sobrescrita do `X-Forwarded-For` no comportamento padrão, que é exatamente a pendência herdada de `watch-page/TD-03`, com a menor configuração. Parâmetros a fixar junto: um domínio para o frontend e, se o storage for próprio (TD-09 A), um subdomínio para o storage; a API só na rede interna; `FRONTEND_URL`, `S3_PUBLIC_ENDPOINT` e o CORS do bucket apontando para os hostnames públicos.

**Decision:** A (Caddy com TLS automático, sobrescrevendo o `X-Forwarded-For` com o IP real; API só na rede interna; `FRONTEND_URL`, `S3_PUBLIC_ENDPOINT` e CORS do bucket pelos hostnames públicos)

---

## TD-11: Artefatos de build e mecanismo de deploy (imagens, compose de produção, migrations, segredos)

**Scope:** Repo-wide

**Capability:** Ambiente de produção e deploy

**Context:** só existem `Dockerfile.dev` (que fazem `tail -f /dev/null` e dependem de bind mount), dois compose de dev separados e nenhum fluxo de entrega. Produção precisa de imagens autocontidas, de um compose que una as duas stacks, de um momento seguro para rodar as migrations (o `data-source.ts` aponta para `src/**/*.ts`, que não existe numa imagem compilada) e de um lugar para os segredos. Depende de TD-07 (gate) e TD-08.

**Options:**

### Option A: imagens multi-stage publicadas no GHCR pelo CI + deploy por SSH
- `Dockerfile` de produção por subprojeto: Next com `output: 'standalone'`; Nest com `nest build` e só dependências de produção, **uma** imagem para `api`, `worker` e `migrate` (comandos diferentes). Push em `main` (após os gates de TD-07) publica as imagens com tag do SHA e, por SSH, roda `docker compose pull`, `docker compose run --rm migrate` e `docker compose up -d`. Compose de produção único em `deploy/` na raiz; segredos num `.env` na VM, fora do git.
- **Pros:** artefato imutável testado no CI; rollback = subir a tag anterior; migrations rodam uma vez, antes da API e do worker, sem corrida.
- **Cons:** registry e chave SSH como segredos do GitHub; workflow de deploy a manter.

### Option B: build na própria VM (`git pull` + `compose up --build`), migrations no start da API
- Script de deploy na VM; a API roda `migration:run` ao subir.
- **Pros:** sem registry; simples de entender.
- **Cons:** compila na máquina de produção (CPU/RAM disputados com o ffmpeg); o que roda não é o que o CI testou; migrations no boot concorrem com o worker e com reinícios.

### Option C: build e deploy gerenciados pela plataforma
- A plataforma constrói a partir do Dockerfile a cada push e roda um "release command" para as migrations.
- **Pros:** nenhum workflow de deploy próprio.
- **Cons:** só se aplica se TD-08 for B ou C; acopla o deploy à plataforma.

**Recommendation:** **Option A (imagens no GHCR + deploy por SSH, migrations como job único)** — é a que entrega em produção exatamente o artefato que passou pelos gates, separa a migration do boot dos processos e tem rollback trivial; encaixa-se no Git Flow existente (deploy a partir de `main`). Parâmetros a fixar junto: data source de produção apontando para `dist/database/migrations/*.js`; MSW e Swagger desligados nas imagens de produção (`MSW_ENABLED` ausente, `SWAGGER_ENABLED=false`); o smoke da suíte de TD-06 roda contra o ambiente após o `up -d`.

**Decision:** A (Dockerfiles multi-stage — Next `standalone`, uma imagem Nest para `api`, `worker` e `migrate` — publicados no GHCR pelo CI em push para `main`; deploy por SSH: `pull` → `run --rm migrate` → `up -d`; compose único em `deploy/`; segredos em `.env` na VM; smoke pós-deploy)

**Revisions:**
- 2026-10-20 — Escopo da fase: entregar os artefatos de produção (Dockerfiles, `deploy/compose.yaml`, Caddyfile, workflow de deploy, `.env.example` de produção) e um runbook, validados subindo o compose de produção localmente; provisionar VPS, domínio/DNS, bucket S3 + IAM, provedor SMTP e secrets do GitHub e executar o deploy real ficam como tarefa operacional do usuário. Rationale: AMB-1 do `/plan-validate 7`, escolha do usuário.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Cross-layer | Contrato da listagem da home — ordenação e filtro por categoria | A — `GET /videos?category=<slug>` cronológico, keyset, throttle próprio | A |
| TD-02 | Cross-layer | Contrato e superfície da busca | A — `GET /videos?q=` (título ou canal) + página `/results?q=` ao enviar | A |
| TD-03 | Backend | Mecanismo de correspondência textual da busca | A — `pg_trgm` + `unaccent`, substring, ordem cronológica | A |
| TD-04 | Frontend | Paginação vs. scroll infinito e camada de dados das listas | A — scroll infinito com hook próprio, sem TanStack Query | A |
| TD-05 | Frontend | Shell de navegação responsivo | A — colapso no desktop, drawer abaixo de `lg`, header do Figma | A |
| TD-06 | Repo-wide | Estratégia dos testes dos fluxos principais | A — suíte E2E full-stack enxuta + projeto mobile no MSW | A |
| TD-07 | Repo-wide | Pipeline de CI de qualidade | A — GitHub Actions via Docker Compose | A |
| TD-08 | Repo-wide | Alvo de hospedagem de produção | A — VPS com Docker Compose | A |
| TD-09 | Repo-wide | Serviços com estado em produção | B — PostgreSQL na VM + S3 gerenciado + SMTP transacional | B |
| TD-10 | Repo-wide | Borda de produção (proxy, TLS, XFF) | A — Caddy | A |
| TD-11 | Repo-wide | Artefatos de build e mecanismo de deploy | A — imagens no GHCR + deploy por SSH, migrations como job único | A |
