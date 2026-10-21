# phase-07-home-search-production — Screen Inventory

> **Phase:** Fase 07 — Página Inicial, Busca e Finalização
> **Status:** Validated
> **Date:** 2026-10-20
> **Screens in scope:** 2

_Extração por imagem:_ como nas Fases 05 e 06, as telas foram inventariadas a partir dos PNGs exportados em `docs/inventories/assets/phase-07/` (`Home (Catalog Show).png`, `Account User Menu.png`, `Left Menu.png`), sem `get_design_context`: o MCP do Figma listou as páginas do arquivo e em seguida devolveu o limite de chamadas do plano Starter. Os node ids de componentes vêm dos inventários das Fases 04 e 06 quando já conhecidos (TopNav, SideNav, FilterChip, VideoCard); os demais ficam `—`. A checagem de drift de tokens Figma ↔ `globals.css` não foi executada.

_Componentes compartilhados:_ o header (TopNav) e o menu lateral aparecem em todas as rotas de app; eles são inventariados uma vez, na tela 1, e as mudanças valem para as telas já existentes (canal, feed, estúdio e watch page — onde o menu passa a abrir como drawer, `home-search-production/TD-05`).

---

## Screen: Página inicial (Home / Catalog Show)

**Route:** `/`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`)
**Referência visual:** `docs/inventories/assets/phase-07/Home (Catalog Show).png`; menu da conta em `Account User Menu.png` (frame 150:1267); menu lateral em `Left Menu.png` (frame 150:959)
**Purpose (from project-plan.md):** "Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Home page — RSC da rota (143:948) | Server-connected | ✗ | new | `app/(app)/(shell)/page.tsx` substitui o placeholder atual. Lê `?category=` dos `searchParams`, a primeira página de `GET /videos` e as categorias de `GET /categories` (`home-search-production/TD-01`); acesso anônimo |
| TopNav / header (componente 152:1827) | Local-interactive | ✓ | `components/layout/app-header.tsx` | Reescrito conforme `TD-05`: "≡", logo, busca, "+" e login/avatar em todas as rotas de app (inclusive a watch page). O conteúdo atual (e-mail, "Meus vídeos", "Meu canal", "Sair") sai do header e vai para o menu lateral e o menu da conta |
| Menu trigger "≡" (I152:1827;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Em `lg+` alterna o menu lateral entre expandido e mini (estado em cookie lido no RSC); abaixo de `lg` e na watch page abre o drawer de navegação |
| BrandLogo / Size=sm (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | Link para `/` |
| Busca global — campo + botão (I152:1827;62:1879 + 62:1881) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | Compõe `components/ui/search-input.tsx` (DS "Search" 158:4007). Ao enviar (Enter ou botão) navega para `/results?q=` (`TD-02`); sem autocomplete. Abaixo de `md` vira ícone que expande a barra ocupando o header |
| Voice search (I152:1827;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | **Não renderizado** — busca por voz sem capability (decisão do usuário) |
| IconButton "+" (I152:1827;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Atalho para `/studio/upload`, só com sessão (decisão do usuário) |
| Avatar da conta (I152:1827;62:1892) | Local-interactive | ✓ | `components/channel/channel-avatar.tsx` | Iniciais do nome do canal (já na sessão); abre o menu da conta. O canal não tem imagem de avatar |
| Botão "Sign in" do header (—) | Local-interactive | ✓ | `components/ui/button.tsx` | Estado anônimo (não desenhado no frame): link para `/login?returnTo=<página atual>` no lugar do avatar e do "+" |
| Account User Menu — painel da conta (150:1267) | Server-connected | ✗ | `components/layout/account-menu.tsx (new)` | Painel lateral direito sobre `components/ui/dialog.tsx`: título "Account" + fechar, nome e @nickname do canal (link para `/channel/{nickname}`), "Edit Channel" → `/studio/channel`, "Sign Out" → fluxo de logout existente |
| Body / app shell (2737:2153) | Presentational | ✓ | `components/layout/app-shell.tsx` | Ganha breakpoints: coluna do menu expandido ou mini em `lg+`, sem coluna abaixo de `lg` |
| SideNav (150:959) | Local-interactive | ✓ | `components/layout/side-nav.tsx` | Três estados (`TD-05`): expandido (frame), mini (ícones + rótulo curto: Home, Subscriptions, You) e dentro do drawer. Visível também para o anônimo, com "Home" e um convite para entrar; "Liked videos" segue não renderizado |
| SideNav item Home / Subscriptions / Your videos (I155:1927;62:1620, 62:1630, 62:1653) | Local-interactive | ✓ | `components/layout/side-nav-item.tsx` | "Home" ativo nesta rota; "Subscriptions" e "Your videos" só com sessão |
| SideNav subscriptions list (I155:1927;62:1672) | Server-connected | ✓ | `components/layout/side-nav-subscriptions.tsx` | Herdado da Fase 06 sem mudança de verbo; só com sessão; oculto no estado mini |
| Drawer de navegação (—) | Local-interactive | ✗ | `components/layout/nav-drawer.tsx (new)` | Sem frame (decisão do usuário): o mesmo SideNav dentro de um `Dialog` lateral esquerdo, aberto pelo "≡" abaixo de `lg` e na watch page; fecha ao navegar |
| Barra de chips de categoria (—) | Server-connected | ✗ | `components/home/category-chips.tsx (new)` | "All" + as categorias de `GET /categories` em `sort_order`; cada chip é um `<Link>` para `/?category=<slug>` ("All" limpa o filtro). Rolagem horizontal com esmaecimento na borda direita quando não cabe (como no frame) |
| FilterChip (158:2651) | Local-interactive | ✓ | `components/ui/filter-chip.tsx` | Variantes active/normal; "All" ativo sem `category` |
| Grid de vídeos com scroll infinito (—) | Server-connected | ✗ | `components/videos/infinite-video-grid.tsx (new)` | Grid de 4 colunas no frame (1/2/3/4 por breakpoint). Primeira página do RSC; as seguintes pelo BFF com o hook de cursor de `TD-04`, reiniciado ao trocar a categoria. Reaproveitado na busca, no canal e no feed |
| VideoCard com avatar do canal (143:2505) | Server-connected | ✓ | `components/videos/video-card.tsx` | Variante `default` com avatar de iniciais; thumbnail, título em 2 linhas, nome do canal, visualizações e tempo relativo. Selo de verificado não renderizado (não existe no domínio) |
| Spinner / sentinela de scroll infinito (—) | Server-connected | ✗ | `components/videos/infinite-scroll-sentinel.tsx (new)` | O frame mostra um spinner circular abaixo do grid. Dispara a próxima página ao entrar na tela; botão "Load more" como fallback acessível (`TD-04`); some quando `next_cursor` é `null` |
| Estado vazio da home (—) | Presentational | ✗ | new | Não desenhado: plataforma sem vídeos públicos, ou categoria sem vídeos (com link para "All") |
| Verified badge (I156:3591;156:3819) | Presentational | ✗ | new | **Não renderizado** — verificação de canal não existe no domínio |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Exibir a grade de vídeos públicos mais recentes da plataforma | Home page — RSC da rota; Grid de vídeos com scroll infinito; VideoCard com avatar do canal | "Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)" |
| Listar as categorias disponíveis como filtros da home | Barra de chips de categoria | "Filtro de vídeos por categoria na home" |
| Filtrar a grade da home por categoria | Barra de chips de categoria; Home page — RSC da rota | "Filtro de vídeos por categoria na home" |
| Carregar mais vídeos da home ao chegar ao fim da grade | Spinner / sentinela de scroll infinito; Grid de vídeos com scroll infinito | "Paginação ou scroll infinito nas listagens de vídeos" |
| Encerrar a sessão pelo menu da conta | Account User Menu — painel da conta ("Sign Out") | "Header/navbar com logo, barra de busca, botão de login/avatar e navegação" |

### Observations

- Chips do frame que não são categorias ("Live", "Mixes", "Recently uploaded", "Watched") não são renderizados: os chips vêm de `GET /categories` (`home-search-production/TD-01`); os rótulos do frame ("Gaming", "Music", "Programming", …) são só ilustrativos.
- Interação: o filtro vive na URL (`/?category=<slug>`); trocar de chip é uma navegação que refaz o RSC e reinicia o scroll infinito. A rolagem e as páginas extras ao voltar da watch page seguem a observação de `TD-04` (opcionalmente guardadas em `sessionStorage`).
- Interação: o scroll infinito vale também para a página do canal e para `/feed/subscriptions`, que hoje usam o `LoadMore` (`components/studio/load-more.tsx`); o estúdio mantém o botão (`TD-04`).
- Reuso: o shell responsivo muda as telas já existentes — a watch page passa a ter o header completo e o drawer; o estúdio, o canal e o feed ganham o menu mini e o drawer. Nenhum frame cobre essas larguras: os layouts abaixo de `lg` são derivados (decisão do usuário).
- Reuso: o menu lateral para o anônimo altera o parâmetro "visível apenas com sessão" de `social-interactions/TD-08` (Revision prevista em `home-search-production/TD-05`).
- a11y: o "≡" precisa de `aria-label` e `aria-expanded`; drawer e menu da conta como `Dialog` (foco preso, `Esc` fecha, foco volta ao gatilho); o campo de busca com `role="search"` e rótulo acessível; o sentinela não pode ser o único caminho — o botão "Load more" continua alcançável por teclado; chips com `aria-current` no ativo.

---

## Screen: Resultados da busca

**Route:** `/results`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`)
**Referência visual:** `docs/inventories/assets/phase-07/Home (Catalog Show).png` — a página de resultados não tem frame próprio; o grid da Home sem os chips é a base (decisão do usuário)
**Purpose (from project-plan.md):** "Barra de busca (pesquisa por título e canal)"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Results page — RSC da rota (—) | Server-connected | ✗ | new | `app/(app)/(shell)/results/page.tsx`. Lê `q` dos `searchParams` e a primeira página de `GET /videos?q=` (`home-search-production/TD-02`); acesso anônimo |
| TopNav / header (componente 152:1827) | Local-interactive | ✓ | `components/layout/app-header.tsx` | see screen: Página inicial (Home / Catalog Show); o campo de busca vem preenchido com o `q` atual |
| Busca global — campo + botão (I152:1827;62:1879 + 62:1881) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | see screen: Página inicial (Home / Catalog Show) |
| Body / app shell e SideNav (2737:2153, 150:959) | Local-interactive | ✓ | `components/layout/side-nav.tsx` | see screen: Página inicial (Home / Catalog Show); nenhum item ativo nesta rota |
| Título "Resultados para “{q}”" (—) | Presentational | ✗ | new | Não existe no frame; orienta a página (`<h1>`) |
| Grid de resultados com scroll infinito (—) | Server-connected | ✗ | `components/videos/infinite-video-grid.tsx (new)` | see screen: Página inicial (Home / Catalog Show); sem os chips de categoria; reiniciado quando o `q` muda |
| VideoCard com avatar do canal (143:2505) | Server-connected | ✓ | `components/videos/video-card.tsx` | see screen: Página inicial (Home / Catalog Show) |
| Spinner / sentinela de scroll infinito (—) | Server-connected | ✗ | `components/videos/infinite-scroll-sentinel.tsx (new)` | see screen: Página inicial (Home / Catalog Show) |
| Estado vazio da busca (—) | Presentational | ✗ | new | Não desenhado: nenhum vídeo para o termo (sugere outro termo e link para a home) |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Pesquisar vídeos públicos pelo título ou pelo nome do canal | Results page — RSC da rota; Grid de resultados com scroll infinito; VideoCard com avatar do canal | "Barra de busca (pesquisa por título e canal)" |
| Carregar mais resultados ao chegar ao fim da grade | Spinner / sentinela de scroll infinito; Grid de resultados com scroll infinito | "Paginação ou scroll infinito nas listagens de vídeos" |

### Observations

- Base visual emprestada: o frame Home (143:948) é a referência; aqui valem o header, o menu lateral, o grid, o card com avatar e o spinner. Os chips de categoria não entram.
- Interação: a busca é disparada só ao enviar o campo do header (Enter ou botão), sem autocomplete (`TD-02`); um novo termo é uma navegação para `/results?q=` que refaz o RSC.
- Interação: a ordem dos resultados é cronológica (`home-search-production/TD-03`) — o termo casa por pedaço de palavra, sem acento nem caixa, no título do vídeo ou no nome/nickname do canal.
- a11y: o título com o termo é o primeiro cabeçalho da página; o estado vazio precisa de texto, não só ilustração.

---

## Reconciliation summary

| Capability (project-plan.md) | Covered by | Screens |
|------------------------------|------------|---------|
| "Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)" | Home page — RSC da rota, Grid de vídeos com scroll infinito, VideoCard com avatar do canal | `/` |
| "Filtro de vídeos por categoria na home" | Barra de chips de categoria (com FilterChip), Home page — RSC da rota | `/` |
| "Barra de busca (pesquisa por título e canal)" | Busca global (header), Results page — RSC da rota, Grid de resultados, VideoCard com avatar do canal | header de todas as rotas, `/results` |
| "Header/navbar com logo, barra de busca, botão de login/avatar e navegação" | TopNav, Menu trigger "≡", BrandLogo, Busca global, IconButton "+", Avatar da conta, Botão "Sign in", Account User Menu | todas as rotas de app (inventariado em `/`) |
| "Paginação ou scroll infinito nas listagens de vídeos" | Spinner / sentinela de scroll infinito, Grid de vídeos com scroll infinito | `/`, `/results` (e, por reuso, `/channel/{nickname}` e `/feed/subscriptions`) |
| "Layout responsivo para dispositivos móveis" | App shell (breakpoints), SideNav (expandido/mini), Drawer de navegação, Menu trigger "≡", Busca global (modo ícone), grids com colunas por breakpoint — componentes de layout, sem verbo de servidor | todas as rotas de app (inventariado em `/`) |
| "Testes dos fluxos principais da plataforma" | — não-UI (`home-search-production/TD-06`, `TD-07`); fora do inventário de telas | — |
| "Ambiente de produção e deploy" | — não-UI (`home-search-production/TD-08..TD-11`); fora do inventário de telas | — |

## Open questions

- O menu da conta (frame 150:1267) mostra o @nickname do canal e leva à página do canal, mas a sessão (`lib/auth/session.ts`) guarda só `channelName`. Como o header obtém o nickname — acrescentar `channelNickname` à sessão (e atualizá-lo quando o nickname muda em `/studio/channel`, como já acontece com o nome) ou ler `GET /channels/me` no RSC do layout?
- `category` com slug desconhecido (`GET /videos` → 404 por `home-search-production/TD-01`): a home mostra a página `not-found` ou cai para "All" com um aviso?
- `q` vazio, só espaços ou fora de 2–100 caracteres em `/results`: redirecionar para `/`, mostrar o estado vazio com uma mensagem, ou ignorar o envio já no campo do header?
- Quais telas existentes precisam de ajuste responsivo nesta fase além do shell — em especial as tabelas do estúdio (`/studio/videos`) e o formulário de edição de vídeo, que não têm frame mobile? Todas, ou só as telas públicas (home, busca, watch, canal, feed)?
- Rótulos e textos sem frame: estado anônimo do header ("Sign in"), convite para entrar no menu lateral do anônimo, estados vazios da home/categoria/busca e o título da página de resultados — em inglês, como o Figma ("Sign in", "Results for…"), ou em português, como o header atual ("Entrar")?
- Sem acesso à Figma MCP até a renovação do plano, o `/implement` das telas desta fase não terá `get_design_context`: usar os PNGs em `docs/inventories/assets/phase-07/` como referência visual e os tokens já existentes em `app/globals.css`, e rodar a checagem de drift de tokens quando o acesso voltar.
