---
kind: drift-report
phase: phase-06-social-interactions
plan_mtime: "2026-10-20T04:48:16Z"
---

# phase-06-social-interactions — Drift Report

## Screen: channel-show-social — audited at SI-06.16.0 (2026-10-20)

_Fonte do Figma: sem MCP nesta fase (resolução OQ-1) — comparação contra `docs/inventories/assets/phase-06/Channel Show.png` e `Left Menu.png` (exportados em 2×; medidas convertidas para px de CSS)._

**Quick scan:** 7 alinhado · 1 drift menor · 1 drift relevante · 0 ausente

- channel header row (`channel-header.tsx`) → `alinhado`
- channel info (`channel-info.tsx`) → `drift relevante`
- Button Subscribe (`button.tsx`) → `alinhado`
- SubscribeButton (`subscribe-button.tsx`) → `alinhado`
- IconButton (`icon-button.tsx`) → `alinhado`
- Body / app shell (`app-shell.tsx`) → `drift menor`
- SideNav (`side-nav.tsx`) → `alinhado`
- SideNav item (`side-nav-item.tsx`) → `alinhado`
- SideNav subscriptions list (`side-nav-subscriptions.tsx`) → `alinhado`

### next-frontend/components/channel/channel-header.tsx — channel header row

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-info.tsx — channel info

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +prop 'subscriberCount' from Figma demand — meta row "@nickname • N subscribers • N videos" (`formatCompactNumber`; "subscriber" no singular), entre o nickname e a contagem de vídeos
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button Subscribe

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/subscribe-button.tsx — SubscribeButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/app-shell.tsx — Body / app shell

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune width: app-shell-nav — w-60 → w-64
- **Prior:** _(none)_

### next-frontend/components/layout/side-nav.tsx — SideNav

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/side-nav-item.tsx — SideNav item

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/side-nav-subscriptions.tsx — SideNav subscriptions list

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: watch-social — audited at SI-06.17.0 (2026-10-20)

_Fonte do Figma: sem MCP nesta fase (resolução OQ-1) — comparação contra `docs/inventories/assets/phase-06/Video show.png` (2×; medidas convertidas para px de CSS). Linhagem consultada: `phase-05-watch-page/frontend-drift-report.md` (`video-show`, SI-05.11.0) e a seção `channel-show-social` acima._

**Quick scan:** 12 alinhado · 2 drift menor · 1 drift relevante · 0 ausente

- VideoChannelLink (`video-channel-link.tsx`) → `drift relevante`
- SubscribeButton (`subscribe-button.tsx`) → `alinhado`
- Par like/dislike do vídeo (`video-reaction-buttons.tsx`) → `alinhado`
- Ícone like (`thumb-up-icon.tsx`) → `alinhado`
- Ícone dislike (`thumb-down-icon.tsx`) → `alinhado`
- Seção de comentários (`comment-section.tsx`) → `alinhado`
- Seletor "Sort by" (`comment-sort-menu.tsx`) → `alinhado`
- Composer "Add a comment…" (`comment-composer.tsx`) → `drift menor`
- Lista de comentários (`comment-list.tsx`) → `alinhado`
- Item de comentário (`comment-item.tsx`) → `drift menor`
- Like/dislike do comentário (`comment-reaction-buttons.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`
- Alternância "N replies" (`comment-replies.tsx`) → `alinhado`
- Menu "⋮" do comentário (`comment-actions-menu.tsx`) → `alinhado`
- Dialog (`dialog.tsx`) → `alinhado`

### next-frontend/components/watch/video-channel-link.tsx — VideoChannelLink

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +prop 'subscriberCount' from Figma demand — segunda linha "9.88K subscribers" sob o nome (`formatCompactNumber`, "subscriber" no singular; text-caption, muted)
- **Prior:** "skip at SI-05.11.0 — Fase 05 sem a linha de inscritos (fora do escopo daquela fase)"

### next-frontend/components/channel/subscribe-button.tsx — SubscribeButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-06.16.0 honored"

### next-frontend/components/watch/video-reaction-buttons.tsx — Par like/dislike do vídeo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/thumb-up-icon.tsx — Ícone like

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/thumb-down-icon.tsx — Ícone dislike

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/comments/comment-section.tsx — Seção de comentários

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/comments/comment-sort-menu.tsx — Seletor "Sort by"

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/comments/comment-composer.tsx — Composer "Add a comment…"

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune field: Textarea do composer — caixa com borda (`rounded-[var(--radius-1)] border bg-input-background px-4 py-3`) → só a linha inferior (`rounded-none border-0 border-b bg-transparent px-0 py-1`), como no frame
- **Prior:** _(none)_

### next-frontend/components/comments/comment-list.tsx — Lista de comentários

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/comments/comment-item.tsx — Item de comentário

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune size: avatar — size-12 → size-10
- **Prior:** _(none)_

### next-frontend/components/comments/comment-reaction-buttons.tsx — Like/dislike do comentário

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-06.16.0 honored"

### next-frontend/components/comments/comment-replies.tsx — Alternância "N replies"

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/comments/comment-actions-menu.tsx — Menu "⋮" do comentário

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/dialog.tsx — Dialog

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: subscriptions-feed — audited at SI-06.18.0 (2026-10-20)

_Fonte do Figma: sem MCP nesta fase (resolução OQ-1) — comparação contra `docs/inventories/assets/phase-06/Home (Catalog Show).png` (2×), só grid, card com avatar e menu lateral (chips de categoria e busca fora do escopo)._

**Quick scan:** 3 alinhado · 0 drift menor · 3 drift relevante · 0 ausente

- Body / app shell (`app-shell.tsx`) → `alinhado`
- SideNav subscriptions list (`side-nav-subscriptions.tsx`) → `alinhado`
- FilterChip (`filter-chip.tsx`) → `drift relevante` (exception)
- Grid de vídeos do feed (`subscription-video-grid.tsx`) → `alinhado`
- VideoCard com avatar do canal (`video-card.tsx`) → `drift relevante`
- "Load more" do feed (`load-more.tsx`) → `drift relevante` (exception)

### next-frontend/components/layout/app-shell.tsx — Body / app shell

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune width w-60 → w-64 at SI-06.16.0 honored"

### next-frontend/components/layout/side-nav-subscriptions.tsx — SideNav subscriptions list

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-06.16.0 honored"

### next-frontend/components/ui/filter-chip.tsx — FilterChip

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: a linha de chips de categoria do frame é da Home (Fase 07); o feed das inscrições não a renderiza (UI Contract desta tela)
- **Prior:** _(none)_

### next-frontend/components/feed/subscription-video-grid.tsx — Grid de vídeos do feed

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/videos/video-card.tsx — VideoCard com avatar do canal

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +prop 'showAvatar' from Figma demand — `ChannelAvatar` de iniciais (40px, a partir de `channel.name`) à esquerda da coluna de texto, com link para `/channel/{nickname}`; o nome do canal também vira link para o canal; thumbnail e título continuam linkando `/watch/{public_id}` (sem links aninhados); variantes `default`/`horizontal` inalteradas (resolução OQ-5)
- **Prior:** _(none)_

### next-frontend/components/studio/load-more.tsx — "Load more" do feed

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o frame mostra o spinner de rolagem infinita; o plano mantém o botão "Load more" com paginação por `searchParams` no RSC (padrão da Fase 04 — `social-interactions/TD-09` exclui o feed do estado cliente)
- **Prior:** _(none)_
