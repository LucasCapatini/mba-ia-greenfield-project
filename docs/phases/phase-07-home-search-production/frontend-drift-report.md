---
kind: drift-report
phase: phase-07-home-search-production
plan_mtime: "2026-10-20T17:49:40Z"
---

# phase-07-home-search-production — Drift Report

## Screen: home — audited at SI-07.14.0 (2026-10-20)

_Fonte do Figma: sem cota na Figma MCP (resolução OQ-6 do `/plan-validate 7`) — comparação contra `docs/inventories/assets/phase-07/Home (Catalog Show).png`, `Account User Menu.png` e `Left Menu.png` (exportados em 2× a partir de um frame de 1440 px; medidas convertidas para px de CSS) e contra capturas do app em 1440 px (build de produção + MSW). Sem `get_design_context`, os nomes de variante do Figma não estão disponíveis: onde a correção exigiria uma variante nova (Naming constraint), a decisão é `exception` até o acesso voltar._

**Quick scan:** 12 alinhado · 3 drift menor · 2 drift relevante · 0 ausente

- AppHeader (`app-header.tsx`) → `drift menor`
- IconButton (`icon-button.tsx`) → `alinhado`
- BrandLogo (`brand-logo.tsx`) → `alinhado`
- GlobalSearch (`global-search.tsx`) → `drift relevante`
- ChannelAvatar (`channel-avatar.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`
- AccountMenu (`account-menu.tsx`) → `drift menor`
- AppShell (`app-shell.tsx`) → `alinhado`
- SideNav (`side-nav.tsx`) → `alinhado`
- SideNavItem (`side-nav-item.tsx`) → `alinhado`
- SideNavSubscriptions (`side-nav-subscriptions.tsx`) → `alinhado`
- NavDrawer (`nav-drawer.tsx`) → `alinhado`
- CategoryChips (`category-chips.tsx`) → `alinhado`
- FilterChip (`filter-chip.tsx`) → `drift relevante` (CONFLICT)
- InfiniteVideoGrid (`infinite-video-grid.tsx`) → `alinhado`
- VideoCard (`video-card.tsx`) → `alinhado`
- InfiniteScrollSentinel (`infinite-scroll-sentinel.tsx`) → `drift menor`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune height: header — h-14 → h-15 (TopNav 152:1827 ≈ 60 px no PNG; hoje 56 px)
- **Prior:** _(none)_

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-06.16.0 honored"

### next-frontend/components/auth/brand-logo.tsx — BrandLogo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/global-search.tsx — GlobalSearch

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune submit: IconButton separado (`variant="secondary" size="lg"`, depois do campo) → botão transparente sobre o segmento de busca à direita do `SearchInput` (`absolute right-0`, `h-11 w-18`, `rounded-r-[var(--radius-full)]`) enquanto o campo está vazio — o Figma (62:1881) tem uma única lupa, que é o botão; hoje aparecem duas (o ícone do `SearchInput` + o IconButton). Com texto, o segmento do `SearchInput` vira "Clear search" e o IconButton de envio volta ao lado do campo (uma lupa só nos dois estados)
- **Prior:** _(none)_

### next-frontend/components/channel/channel-avatar.tsx — ChannelAvatar

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/account-menu.tsx — AccountMenu

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune avatar: ChannelAvatar do bloco do canal — size-10 (`md`) → size-16 (Account User Menu 150:1267 ≈ 64 px no PNG)
- **Prior:** _(none)_

### next-frontend/components/layout/app-shell.tsx — AppShell

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/layout/side-nav.tsx — SideNav

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-06.16.0 honored"

### next-frontend/components/layout/side-nav-item.tsx — SideNavItem

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-06.16.0 honored"

### next-frontend/components/layout/side-nav-subscriptions.tsx — SideNavSubscriptions

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-06.16.0 honored"

### next-frontend/components/layout/nav-drawer.tsx — NavDrawer

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/home/category-chips.tsx — CategoryChips

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/filter-chip.tsx — FilterChip

- **Status:** drift relevante
- **Decision:** `CONFLICT`
  - **Note:** a home (143:948) mostra o chip ativo preto com texto branco e os inativos com fundo cinza; a ordenação do canal (2737:2145, SI-04.19.0) pede o ativo cinza e os inativos transparentes — o estado atual do `FilterChip`
  - **Verb body:** `exception`
    - reason: a correção seria uma variante nova, cujo nome tem de vir do Figma (Naming constraint) e não está disponível sem a MCP; a home mantém o `FilterChip` atual para não quebrar a página do canal — reavaliar quando o acesso ao Figma voltar
- **Prior:** "alinhado/skip at SI-04.19.0"

### next-frontend/components/videos/infinite-video-grid.tsx — InfiniteVideoGrid

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/videos/video-card.tsx — VideoCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "additive +variant 'horizontal' at SI-05.11.0; alinhado/skip at SI-04.19.0" — o selo de verificado do Figma não tem capability (sem campo no contrato)

### next-frontend/components/videos/infinite-scroll-sentinel.tsx — InfiniteScrollSentinel

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune spinner: size-12 border-4 → size-10 border-2 (spinner da home ≈ 40 px com traço fino no PNG)
- **Prior:** _(none)_

## Screen: results — audited at SI-07.15.0 (2026-10-20)

_Sem frame próprio: a tela é o grid da Home (143:948) sem a barra de chips, com um título acima. Mesma fonte da seção `home` (PNG em 2× + capturas do app em 1440 px). Todos os componentes já foram auditados na home e as correções `auto-Edit` foram aplicadas em SI-07.14a; a auditoria compara o estado atual em disco._

**Quick scan:** 6 alinhado · 0 drift menor · 0 drift relevante · 0 ausente

- AppHeader (`app-header.tsx`) → `alinhado`
- GlobalSearch (`global-search.tsx`) → `alinhado`
- SideNav (`side-nav.tsx`) → `alinhado`
- InfiniteVideoGrid (`infinite-video-grid.tsx`) → `alinhado`
- VideoCard (`video-card.tsx`) → `alinhado`
- InfiniteScrollSentinel (`infinite-scroll-sentinel.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune height h-14 → h-15 at SI-07.14.0 (applied at SI-07.14a)"

### next-frontend/components/layout/global-search.tsx — GlobalSearch

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune submit (uma lupa só) at SI-07.14.0 (applied at SI-07.14a)"

### next-frontend/components/layout/side-nav.tsx — SideNav

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-07.14.0"

### next-frontend/components/videos/infinite-video-grid.tsx — InfiniteVideoGrid

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-07.14.0"

### next-frontend/components/videos/video-card.tsx — VideoCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-07.14.0"

### next-frontend/components/videos/infinite-scroll-sentinel.tsx — InfiniteScrollSentinel

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune spinner size-10 border-2 at SI-07.14.0 (applied at SI-07.14a)"
