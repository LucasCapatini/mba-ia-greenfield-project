# phase-06-social-interactions — Screen Inventory

> **Phase:** Fase 06 — Interações Sociais (Likes, Comentários, Inscrições)
> **Status:** Validated
> **Date:** 2026-10-20
> **Screens in scope:** 3

_Extração por imagem:_ como na Fase 05, as telas foram inventariadas a partir dos PNGs exportados pelo usuário em `docs/inventories/assets/phase-06/` (`Video show.png`, `Channel Show.png`, `Left Menu.png`, `Home (Catalog Show).png`), sem `get_design_context`. Os node ids de componentes vêm do inventário da Fase 04 quando já conhecidos (Channel Show, SideNav); os demais ficam `—`. A checagem de drift de tokens Figma ↔ `globals.css` não foi executada.

_Escopo da tela 1:_ a watch page já está inventariada em `screen-inventory-phase-05-watch-page.md`; a seção abaixo lista só os componentes da Fase 06 e os pontos de encaixe nos componentes existentes (decisão do usuário).

---

## Screen: Página de visualização do vídeo — interações (Video show)

**Route:** `/watch/{publicId}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (node `0RBoWy5FbrK8SHEz1eK6gb:152:2219`)
**Referência visual:** `docs/inventories/assets/phase-06/Video show.png`
**Purpose (from project-plan.md):** "Interface completa de comentários, likes e inscrições"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Watch page — RSC da rota (152:2219) | Server-connected | ✓ | `app/(app)/watch/[publicId]/page.tsx` | Já existe (Fase 05). Passa a ler também a primeira página de comentários (`latest`) em paralelo com playback e sugestões, e repassa `viewer_reaction`, `channel.subscriber_count` e `channel.viewer_subscribed` do `GET /videos/{publicId}` (`social-interactions/TD-04`) aos componentes abaixo. Sem `router.refresh()` nas interações (`TD-09`) |
| Canal do vídeo — avatar + nome + inscritos (—) | Server-connected | ✓ | `components/watch/video-channel-link.tsx` | Ganha a linha "9.88K subscribers" sob o nome (`formatCompactNumber`), atualizada localmente após inscrever/desinscrever |
| SubscribeButton (—) | Server-connected | ✗ | `components/channel/subscribe-button.tsx (new)` | Compartilhado com a página do canal. Pill preta "Subscribe" (`components/ui/button.tsx`, variante primária); estado inscrito ("Subscribed") não desenhado. `useOptimistic` + reconciliação pela resposta de `PUT/DELETE /channels/{nickname}/subscription` (`TD-03`, `TD-09`); notifica o contexto do menu lateral. Anônimo → `/login?returnTo=` (`TD-10`). **Oculto quando o espectador é o dono do canal** (decisão do usuário) |
| Par like/dislike do vídeo (—) | Server-connected | ✗ | `components/watch/video-reaction-buttons.tsx (new)` | Pill segmentada cinza: like com contagem ("1.2K", `formatCompactNumber`) + divisória + dislike **sem** contagem. Estado ativo (pressionado) não desenhado. `PUT/DELETE /videos/{publicId}/reaction`, otimista (`TD-03`, `TD-09`); anônimo → login (`TD-10`) |
| Ícone like (—) | Presentational | ✓ | `components/icons/thumb-up-icon.tsx` | Variante preenchida para o estado ativo não existe (ver Observations) |
| Ícone dislike (—) | Presentational | ✗ | `components/icons/thumb-down-icon.tsx (new)` | Espelho do thumb-up |
| Seção de comentários (—) | Server-connected | ✗ | `components/comments/comment-section.tsx (new)` | Cabeçalho + composer + lista; primeira página vinda do RSC, páginas seguintes, respostas e itens novos em estado local via BFF (`TD-09`) |
| Contagem de comentários "4,256 Comments" (—) | Presentational | ✗ | new | `<h2>` com `comment_count` do vídeo (raízes + respostas, `TD-05`) em número completo com separador de milhar, não compacto |
| Seletor "Sort by: Latest" (—) | Server-connected | ✗ | `components/comments/comment-sort-menu.tsx (new)` | Gatilho com `components/icons/sort-icon.tsx` + `components/ui/dropdown-menu.tsx`; opções Latest (padrão) e Top; trocar a ordem refaz a primeira página (`TD-06`). Conteúdo do menu não desenhado |
| Composer "Add a comment…" (—) | Server-connected | ✗ | `components/comments/comment-composer.tsx (new)` | Avatar do usuário (`components/channel/channel-avatar.tsx`) + campo com sublinhado (`components/ui/textarea.tsx`, autoexpansível). Botões "Cancel"/"Comment" ao focar não desenhados. Texto 1–2.000 caracteres (`TD-07`). Mesmo componente para responder e editar. Anônimo → link "Sign in to comment" (`TD-10`) |
| Lista de comentários (—) | Server-connected | ✗ | `components/comments/comment-list.tsx (new)` | Raízes na ordem escolhida; botão "Show more comments" (`components/ui/button.tsx`) pedindo a próxima página por `next_cursor` via BFF — decisão do usuário (scroll infinito fica para a Fase 07). Botão e estado vazio não desenhados |
| Item de comentário (—) | Server-connected | ✗ | `components/comments/comment-item.tsx (new)` | Avatar 48px (`components/channel/channel-avatar.tsx`), "@nickname" (link para `/channel/{nickname}`) + tempo relativo (`formatRelativeTime`) em muted, texto com quebras preservadas, marca "(edited)" quando `edited_at` (não desenhada) |
| Like/dislike do comentário (—) | Server-connected | ✗ | `components/comments/comment-reaction-buttons.tsx (new)` | Ícones pequenos sem fundo: like com contagem ("245") + dislike sem contagem; `PUT/DELETE /comments/{commentId}/reaction` otimista; vale para raízes e respostas |
| Botão "Reply" (—) | Local-interactive | ✓ | `components/ui/button.tsx` | Variante ghost/link; abre o composer de resposta inline sob o item. Numa resposta, o composer abre na thread da raiz com `@nickname` pré-preenchido (`TD-05`). Anônimo → login |
| Composer de resposta (—) | Server-connected | ✗ | `components/comments/comment-composer.tsx (new)` | Mesmo componente do composer principal, recuado; não desenhado |
| Alternância "N replies" / respostas (—) | Server-connected | ✗ | `components/comments/comment-replies.tsx (new)` | Não desenhada. Mostra `reply_count`; ao abrir carrega `GET /comments/{commentId}/replies` (cronológico) com "Show more replies"; respostas recuadas um nível (`TD-05`, `TD-06`) |
| Menu "⋮" do comentário — Edit / Delete (—) | Server-connected | ✗ | `components/comments/comment-actions-menu.tsx (new)` | Não desenhado. Só para o autor (`TD-07`); gatilho `components/ui/icon-button.tsx` + `components/icons/more-vertical-icon.tsx` + `components/ui/dropdown-menu.tsx`. "Edit" troca o texto pelo composer; "Delete" pede confirmação |
| Diálogo de confirmação de exclusão (—) | Local-interactive | ✓ | `components/ui/dialog.tsx` | Não desenhado; avisa que as respostas também serão excluídas quando a raiz tiver respostas (`TD-07`) |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Curtir, descurtir ou remover a própria reação ao vídeo, exibindo a contagem de likes e o estado da minha reação | Par like/dislike do vídeo | "Like e dislike em vídeos (usuários autenticados)" |
| Inscrever-se ou cancelar a inscrição no canal do vídeo | SubscribeButton | "Inscrição em canais (seguir/deixar de seguir)" |
| Exibir a contagem de inscritos do canal ao lado do nome, abaixo do player | Canal do vídeo — avatar + nome + inscritos | "Interface completa de comentários, likes e inscrições" |
| Exibir os comentários do vídeo paginados, com a contagem total e ordenação por mais recentes ou mais curtidos | Seção de comentários; Seletor "Sort by"; Lista de comentários; Item de comentário | "Comentários em vídeos (usuários autenticados)" |
| Publicar um comentário no vídeo | Composer "Add a comment…" | "Comentários em vídeos (usuários autenticados)" |
| Editar o próprio comentário | Menu "⋮" do comentário → Composer | "Comentários em vídeos (usuários autenticados)" |
| Excluir o próprio comentário (com as respostas, se for raiz) | Menu "⋮" do comentário | "Comentários em vídeos (usuários autenticados)" |
| Responder a um comentário na thread da raiz | Composer de resposta | "Respostas a comentários (comentários aninhados)" |
| Exibir as respostas de um comentário sob demanda | Alternância "N replies" / respostas | "Respostas a comentários (comentários aninhados)" |
| Curtir, descurtir ou remover a própria reação a um comentário ou resposta | Like/dislike do comentário | "Like e dislike em comentários (usuários autenticados)" |
| Levar o visitante anônimo ao login ao tentar reagir, comentar, responder ou se inscrever | SubscribeButton; Par like/dislike do vídeo; Composer; Botão "Reply"; Like/dislike do comentário | "Interface completa de comentários, likes e inscrições" |

### Observations

- Extração por imagem (MCP não usada): node ids dos componentes ausentes; classificações derivadas do PNG + do inventário da Fase 05 + dos TDs de `technical-decisions-social-interactions.md`. Drift de tokens não verificado.
- Encaixe no layout existente: a linha abaixo do título passa a ser "canal + inscritos + Subscribe" à esquerda e "like/dislike + Share + ⋮" à direita (Share e ⋮ são da Fase 05, sem mudança). A seção de comentários entra abaixo do bloco de descrição, na coluna principal.
- Interação: estados não desenhados — like/dislike ativos (vídeo e comentário), "Subscribed", composer focado com "Cancel"/"Comment", "N replies" aberto/fechado, menu "⋮" do comentário, "(edited)", "Show more comments". Seguir os primitivos existentes (`Button`, `IconButton`, `DropdownMenu`, `Dialog`) e os tokens de `app/globals.css`.
- Interação: like e dislike são mutuamente exclusivos — clicar no ativo remove a reação (`DELETE`), clicar no outro troca (`PUT`); cliques rápidos convergem para o último estado (`TD-03`).
- Interação: o dono do canal não vê o "Subscribe" (decisão do usuário); pode curtir o próprio vídeo e comentar (`TD-03`).
- Fora do escopo, não renderizados: chips de filtro da sidebar e controles extras do player (já decididos na Fase 05); "Liked videos" e sino de notificações (sem capability — `social-interactions`).
- TD mention: a contagem de dislikes não aparece no Figma (vídeo nem comentário); `dislike_count` continua no contrato e a UI não o exibe (`TD-04`).
- a11y: botões de reação com `aria-pressed` e rótulo com a contagem ("Like, 1.2K"); "Subscribe"/"Subscribed" com `aria-pressed`; o composer precisa de `<label>` acessível ("Add a comment"); a alternância de respostas com `aria-expanded`; o menu "⋮" do comentário é icon-only e precisa de `aria-label`.

---

## Screen: Página pública do canal — inscrição e menu lateral (Channel Show)

**Route:** `/channel/{nickname}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (node `0RBoWy5FbrK8SHEz1eK6gb:155:1926`)
**Referência visual:** `docs/inventories/assets/phase-06/Channel Show.png`, `docs/inventories/assets/phase-06/Left Menu.png` (frame 150:959)
**Purpose (from project-plan.md):** "Contagem de inscritos na página do canal"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Channel Show — RSC da rota (155:1926) | Server-connected | ✓ | `app/(app)/channel/[nickname]/page.tsx` | Já existe (Fase 04). Lê `subscriber_count` e `viewer_subscribed` do `GET /channels/{nickname}` (`social-interactions/TD-04`) |
| channel header row (156:3513) | Presentational | ✓ | `components/channel/channel-header.tsx` | O slot `actions` (vazio na Fase 04) recebe o SubscribeButton |
| channel info (156:3515) | Server-connected | ✓ | `components/channel/channel-info.tsx` | Meta row passa a "@nickname • N subscribers • N videos" |
| Subscribers count (156:3521) | Presentational | ✗ | new | "2.4M subscribers" (`formatCompactNumber`; singular "subscriber" para 1); atualizado localmente após inscrever/desinscrever nesta página |
| Button Subscribe (156:3536) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado da Fase 04 — primitivo visual do SubscribeButton |
| SubscribeButton (—) | Server-connected | ✗ | `components/channel/subscribe-button.tsx (new)` | see screen: Página de visualização do vídeo — interações (Video show) |
| IconButton notifications (158:2691) | Presentational | ✓ | `components/ui/icon-button.tsx` | Sino de notificações sem capability — **não renderizado** |
| Body / app shell (2737:2153) | Presentational | ✗ | `components/layout/app-shell.tsx (new)` | SideNav + conteúdo principal. Com sessão, em todas as rotas `(app)` exceto a watch page (decisão do usuário); sem sessão, só o conteúdo |
| SideNav (155:1927) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | Herdado da Fase 04. Frame 150:959: grupo de navegação, divisória, seção "You", divisória, seção "Subscriptions". Fixa (sem colapso nesta fase — o "≡" e o mobile ficam para a Fase 07) |
| SideNav item Home / Subscriptions / Your videos (I155:1927;62:1620, 62:1630, 62:1653) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | Herdado da Fase 04. Destinos: Home → `/`, Subscriptions → `/feed/subscriptions`, Your videos → `/studio/videos`; item ativo pela rota atual. Ícones home/subscriptions/your videos ainda não existem em `components/icons/` |
| SideNav item Liked videos (I155:1927;62:1664) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | **Não renderizado** — sem capability (`social-interactions/TD-08`) |
| SideNav subscriptions list (I155:1927;62:1672) | Server-connected | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | Herdado da Fase 04 como placeholder; agora real: título "Subscriptions" + canais seguidos (avatar de iniciais `components/channel/channel-avatar.tsx` + nome) com link para `/channel/{nickname}`. Carregado no layout via `GET /me/subscriptions` e atualizado por um contexto cliente compartilhado com o SubscribeButton (`TD-08`, `TD-09`). Estado vazio e lista longa não desenhados |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Exibir a contagem de inscritos do canal no cabeçalho | Subscribers count em channel info | "Contagem de inscritos na página do canal" |
| Inscrever-se ou cancelar a inscrição no canal | SubscribeButton | "Inscrição em canais (seguir/deixar de seguir)" |
| Exibir no menu lateral os canais seguidos, com acesso à página de cada canal | SideNav subscriptions list | "Área de canais seguidos com acesso rápido aos vídeos" |
| Refletir no menu lateral a inscrição ou a desinscrição feita na página | SideNav subscriptions list (via contexto do SubscribeButton) | "Área de canais seguidos com acesso rápido aos vídeos" |
| Levar o visitante anônimo ao login ao tentar se inscrever | SubscribeButton | "Interface completa de comentários, likes e inscrições" |

### Observations

- Extração por imagem: node ids herdados do inventário da Fase 04 (frame 155:1926 e SideNav 155:1927); o restante `—`.
- Reuso: o menu lateral é compartilhado com o feed (tela 3) e com as telas do estúdio da Fase 04 (`/studio/videos`, `/studio/videos/{publicId}/edit`, `/studio/channel`, `/studio/upload…`), cujos frames já o desenham; a watch page fica sem ele (frame 152:2219). O `AppHeader` atual continua sendo o header — a navegação completa (busca, menu da conta, "≡") é Fase 07.
- Interação: o dono vendo o próprio canal não vê o "Subscribe" (decisão do usuário); o sino (158:2691) não é renderizado.
- Interação: estados não desenhados — "Subscribed", menu lateral sem nenhuma inscrição, lista longa de inscrições (limite com "Show more"?), item ativo do menu lateral.
- TD mention: menu lateral visível apenas com sessão e sem "Liked videos" (`social-interactions/TD-08`).
- a11y: o menu lateral é um `<nav aria-label="Main">` com `aria-current="page"` no item ativo; a seção "Subscriptions" como lista com cabeçalho; avatares de iniciais são decorativos quando o nome do canal acompanha.

---

## Screen: Feed das inscrições (base visual: Home / Catalog Show)

**Route:** `/feed/subscriptions`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`)
**Referência visual:** `docs/inventories/assets/phase-06/Home (Catalog Show).png` — o feed não tem frame próprio; o grid do Home é a base (decisão do usuário)
**Purpose (from project-plan.md):** "Área de canais seguidos com acesso rápido aos vídeos"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Feed page — RSC da rota (—) | Server-connected | ✗ | new | `app/(app)/feed/subscriptions/page.tsx`; exige sessão (o `proxy.ts` redireciona para `/login?returnTo=`, como no estúdio). Lê `GET /me/subscriptions/videos` (keyset por `published_at`, `TD-08`) |
| Body / app shell (—) | Presentational | ✗ | `components/layout/app-shell.tsx (new)` | see screen: Página pública do canal — inscrição e menu lateral (Channel Show) |
| SideNav e subscriptions list (—) | Server-connected | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | see screen: Página pública do canal — inscrição e menu lateral (Channel Show); o item "Subscriptions" fica ativo nesta rota |
| Título da página "Subscriptions" (—) | Presentational | ✗ | new | Não existe no frame Home; sugerido para orientar a página (`<h1>`, pode ser visualmente discreto) |
| Chips de categoria (—) | Local-interactive | ✓ | `components/ui/filter-chip.tsx` | **Não renderizados** — o filtro por categoria é da home (Fase 07) |
| Grid de vídeos do feed (—) | Server-connected | ✗ | `components/feed/subscription-video-grid.tsx (new)` | Grid de 4 colunas (frame Home) com os vídeos públicos dos canais seguidos, mais recentes primeiro |
| VideoCard com avatar do canal (—) | Server-connected | ✓ | `components/videos/video-card.tsx` | O frame Home usa a variante com avatar do canal à esquerda do título (DS 143:2505); o card atual tem `default`/`horizontal` sem avatar — falta a variante com avatar (`components/channel/channel-avatar.tsx`). Nome do canal visível; selo de verificado não renderizado |
| "Load more" do feed (—) | Server-connected | ✓ | `components/studio/load-more.tsx` | O frame mostra um spinner de scroll infinito; decisão do usuário: botão "Load more" pedindo ao RSC a próxima página por `cursor` (mesmo padrão do canal); scroll infinito na Fase 07 |
| Estado vazio (—) | Presentational | ✗ | new | Não desenhado: sem inscrições, ou canais seguidos sem vídeos públicos |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Exibir os vídeos públicos mais recentes dos canais seguidos | Feed page — RSC da rota; Grid de vídeos do feed; VideoCard com avatar do canal | "Área de canais seguidos com acesso rápido aos vídeos" |
| Carregar mais vídeos do feed | "Load more" do feed | "Área de canais seguidos com acesso rápido aos vídeos" |

### Observations

- Base visual emprestada: o frame Home (143:948) é da Fase 07; aqui valem só o grid, o card com avatar e o menu lateral. Os chips de categoria e a busca não entram.
- Reuso: o feed usa o shape `VideoCardItem` (`watch-page/TD-04`), que precisa trazer o canal (nickname, nome) para o card com avatar.
- Interação: o feed é lido no RSC e paginado pelo `LoadMore` do estúdio (query `cursor`), como na página do canal; ele não reflete inscrições feitas em outra aba até a próxima navegação.
- a11y: thumbnails com `alt` vazio quando o título é o texto do link; o estado vazio precisa de um texto que leve à descoberta de canais (link para a home).

---

## Reconciliation summary

| Capability (project-plan.md) | Covered by | Screens |
|------------------------------|------------|---------|
| "Like e dislike em vídeos (usuários autenticados)" | Par like/dislike do vídeo | `/watch/{publicId}` |
| "Comentários em vídeos (usuários autenticados)" | Seção de comentários, Seletor "Sort by", Composer, Lista e Item de comentário, Menu "⋮" do comentário | `/watch/{publicId}` |
| "Respostas a comentários (comentários aninhados)" | Composer de resposta, Alternância "N replies" / respostas | `/watch/{publicId}` |
| "Like e dislike em comentários (usuários autenticados)" | Like/dislike do comentário | `/watch/{publicId}` |
| "Inscrição em canais (seguir/deixar de seguir)" | SubscribeButton | `/watch/{publicId}`, `/channel/{nickname}` |
| "Área de canais seguidos com acesso rápido aos vídeos" | SideNav subscriptions list, Feed page, Grid de vídeos do feed, VideoCard com avatar, "Load more" do feed | `/channel/{nickname}` (e demais rotas com menu lateral), `/feed/subscriptions` |
| "Contagem de inscritos na página do canal" | Subscribers count em channel info | `/channel/{nickname}` |
| "Interface completa de comentários, likes e inscrições" | Canal do vídeo + inscritos, gate de login dos controles sociais (SubscribeButton, reações, composer, Reply) | `/watch/{publicId}`, `/channel/{nickname}` |

## Open questions

- Sem a Figma MCP, o `/implement` destas telas não terá `get_design_context`: usar os PNGs de `docs/inventories/assets/phase-06/` como referência visual e os tokens de `app/globals.css`, e rodar a checagem de drift de tokens quando o acesso voltar.
- Estados sem frame: like/dislike ativos (vídeo e comentário), "Subscribed", composer focado ("Cancel"/"Comment"), respostas abertas, menu "⋮" do comentário, "(edited)", confirmação de exclusão, "Show more comments"/"Show more replies", seção de comentários vazia, menu lateral sem inscrições e feed vazio. Qual visual cada um usa (derivar dos primitivos `Button`/`IconButton`/`DropdownMenu`/`Dialog`)?
- Lista de inscrições do menu lateral: mostrar todas ou limitar (ex.: primeiras N + "Show more")? Ordem alfabética ou pela data da inscrição?
- Ícones sem arquivo em `components/icons/`: thumb-down, home, subscriptions e your videos (menu lateral); variante preenchida do thumb-up/down para o estado ativo — exportar do Figma quando o acesso voltar ou desenhar a partir do Material Symbols, como os anteriores?
- O `VideoCard` precisa da variante com avatar do canal (frame Home) para o feed; o `VideoCardItem` traz o canal com os dados necessários (nickname e nome para as iniciais)?
