---
kind: drift-report
phase: phase-04-video-channel-management
plan_mtime: "2026-10-19T03:27:57Z"
---

# phase-04-video-channel-management — Drift Report

## Screen: upload-de-video — audited at SI-04.15.0 (2026-10-19)

**Quick scan:** 1 alinhado · 1 drift menor · 1 drift relevante · 0 ausente

**Source:** o frame `154:1724` segue ilegível — `get_design_context` respondeu "You've reached the Figma MCP tool call limit on the Starter plan" em 2026-10-19, e nenhuma árvore de nós nem screenshot dele existe nos transcripts do `/screen-inventory`. Por isso, a demanda veio da tela irmã do mesmo fluxo, **Upload video processing** (`156:2110`: TopNav `156:2112`, SideNav `156:2111`, Card `156:2137`, Button primário `156:2771`), cujo `get_design_context` está gravado no transcript do subagente do inventário. Os nomes de variante do Figma não vieram na resposta, só as classes resolvidas. Reauditar quando a cota voltar (`/screen-inventory 4` extension run pendente).

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- Card (`card.tsx`) → `drift menor` (exception)
- Button (`button.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: a demanda do Figma é o app shell completo — TopNav de 62px com logo, busca em pílula `bg-secondary` e ações, e SideNav de 256px. Esse shell é a navbar da Fase 07 (home/busca). O header segue mínimo (`saneamento-fase-02-e-infra/TD-05`); a Fase 04 só acrescenta os links do estúdio (OQ-3, SI-04.13). Altura e padding (`h-[62px] px-4` contra `py-3 px-6`) também ficam para a Fase 07.
- **Prior:** _(none)_

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o container bate com o Figma (`bg-card`, `border-border`, `rounded-[var(--radius-2)]`, `flex-col`, `overflow-hidden`). Só o espaçamento difere: o Figma põe padding 32 e gap 24 no frame interno ("Channel card") e o Card do DS tem `py-4 gap-4` como padrão. A tela compõe `p-8 gap-6` via `className` (`cn` sobrescreve). Retunar o padrão do Card mudaria os cards de auth da Fase 02.
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: upload-em-processamento — audited at SI-04.16.0 (2026-10-19)

**Quick scan:** 12 alinhado · 3 drift menor · 4 drift relevante · 0 ausente

**Source:** o `get_design_context` novo do frame `156:2110` falhou (2026-10-19, cota do plano Starter). A demanda vem da resposta completa desse mesmo frame gravada no transcript do subagente do `/screen-inventory` (60 kB, com subnós TopNav `156:2112`, Card `156:2137`, TextField `156:3151`, Textarea `156:3152`, ProgressLinear `157:1939`, Category select `2096:2223`, Buttons `156:2616`/`156:2772`/`156:2771`, CardVideoConfig `156:3170`, PrivacyOption `156:2728`/`156:2717`, Status `2769:2088`). É a mesma fonte das SIs 04.0.x que criaram os componentes compostos. Os nomes de variante do Figma não vêm nessa resposta, só as classes resolvidas.

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- Card (`card.tsx`) → `drift menor` (exception)
- Label (`label.tsx`) → `alinhado`
- Input (`input.tsx`) → `drift menor`
- Textarea (`textarea.tsx`) → `drift relevante` (7 changes)
- Select (`select.tsx`) → `drift relevante` (9 changes)
- Progress (`progress.tsx`) → `drift relevante` (exception)
- Button (`button.tsx`) → `drift menor`
- SectionHeader (`section-header.tsx`) → `alinhado`
- VideoFileIcon (`video-file-icon.tsx`) → `alinhado`
- UploadStatusRow (`upload-status-row.tsx`) → `alinhado`
- UploadStatusBadge (`upload-status-badge.tsx`) → `alinhado`
- VideoConfigCard (`video-config-card.tsx`) → `alinhado`
- VideoPreview (`video-preview.tsx`) → `alinhado`
- CopyLinkButton (`copy-link-button.tsx`) → `alinhado`
- ThumbnailPreview (`thumbnail-preview.tsx`) → `alinhado`
- CategorySelect (`category-select.tsx`) → `alinhado`
- PrivacyOption (`privacy-option.tsx`) → `alinhado`
- VideoChecksStatus (`video-checks-status.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o TopNav `156:2112` (62px, busca em pílula, botão "+" e avatar) e a SideNav `156:2111` (256px) são o app shell da Fase 07. O header segue mínimo (`saneamento-fase-02-e-infra/TD-05`) com os links do estúdio (OQ-3).
- **Prior:** "exception at SI-04.15.0 — 'TopNav/SideNav são a navbar da Fase 07; header mínimo'"

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o container `156:2137` bate (`bg-card`, `border-border`, `rounded-[var(--radius-2)]`, `flex-col`, `overflow-hidden`). O padding 32 e o gap 24 ficam no frame interno "Channel card" `156:2136`, e a tela os compõe via `className` (`p-8 gap-6`) sem retunar o padrão `py-4 gap-4`, que é usado pelos cards de auth da Fase 02.
- **Prior:** "exception at SI-04.15.0 — 'padding composto pela tela; padrão do Card preservado para a Fase 02'"

### next-frontend/components/ui/label.tsx — Label

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/input.tsx — Input

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune padding: default — px-4 → pl-4 pr-2
- **Prior:** _(none)_

_Note: TextField `156:3151`: `bg-input-background`, `border-border`, `rounded-[var(--radius-1)]`, altura 36, Inter 16/24/400 (`text-body-lg`) e `py-1.5` batem. Só o padding direito difere: o Figma usa `pr-[var(--spacing-2)]` = 8px, reservando o slot do ícone final._

### next-frontend/components/ui/textarea.tsx — Textarea

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune border: default — border-input → border-border
  - retune background: default — bg-transparent → bg-input-background
  - retune radius: default — rounded-lg → rounded-[var(--radius-1)]
  - retune padding: default — px-2.5 py-2 → px-4 py-3
  - retune text: default — text-base md:text-sm → text-body-lg text-foreground
  - drop variant override: dark:bg-input/30 (conflicts with token-driven --input-background)
  - drop variant override: dark:disabled:bg-input/80 (conflicts with token-driven --input-background)
- **Prior:** _(none)_

_Note: o arquivo é o scaffold do `npx shadcn add` (SI-04.0.1) sem reconciliação. Demanda do Textarea `156:3152`: `bg-input-background`, `border-border`, `rounded-[var(--radius-1)]`, `px-4 py-3` e Inter 16/24/400. A altura de 192px é da tela (`className`). `disabled:bg-input/50` e `dark:aria-invalid:*` são de estado e ficam como estão._

### next-frontend/components/ui/select.tsx — Select

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune border: default — border-input → border-border
  - retune background: default — bg-transparent → bg-input-background
  - retune radius: default — rounded-lg → rounded-[var(--radius-1-5)]
  - retune padding: default — py-2 pr-2 pl-2.5 → px-3 py-2
  - retune gap: default — gap-1.5 → gap-2
  - retune text: default — text-sm → text-body-md text-foreground
  - retune size: default — data-[size=default]:h-8 → data-[size=default]:h-9
  - drop variant override: dark:bg-input/30 (conflicts with token-driven --input-background)
  - drop variant override: dark:hover:bg-input/50 (conflicts with token-driven --input-background)
- **Prior:** _(none)_

_Note: só o `SelectTrigger` está desenhado (Category select `2096:2223`: altura 36, `bg-input-background`, `border-border`, `rounded-[var(--radius-1-5)]` = 6px, `px-3 py-2`, `gap-2`, chevron de 16px). O `category-select.tsx` sobrescreve esses valores via `className`, mas não consegue sobrescrever o `dark:bg-input/30` do primitivo (especificidade `0,2,0`), e por isso o fundo sai errado no tema escuro. A lista, os itens e o `data-[size=sm]` não aparecem no frame e ficam como estão._

### next-frontend/components/ui/progress.tsx — Progress

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o Track `157:1939` usa `--progress-track` e o DS usa `bg-muted`. São tokens diferentes, mas iguais no claro (`#e3e3e3`). No escuro o `--progress-track` é `#ffffff`, igual ao indicador `primary`, e a barra sumiria. A troca fica condicionada à correção do token (decisão de design registrada na SI-04.0.x). Altura (4px) e raio (`rounded-full` = 2px em 4px de altura) batem.
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune variant: outline — border-foreground → border-border
- **Prior:** "skip at SI-04.15.0 honored"

_Note: o primário "Save Changes" `156:2771` segue alinhado com `size sm` / `default`. Os botões contornados "Change Thumbnail" `156:2616` e "Cancel" `156:2772` (sem fundo, `border-[var(--border)]`, `rounded-[var(--radius-3)]`, `px-4 py-2`, Inter 14/20/500 `text-foreground`) correspondem à variante `outline` do DS, exceto pela cor da borda. O nome da variante no Figma não vem na resposta; a correspondência é pelo papel visual. Hoje só arquivos da Fase 04 consomem `outline` (`video-filters`, `video-row-actions`, o "Close" do `dialog` e o "Try again" do `upload-dropzone`)._

### next-frontend/components/ui/section-header.tsx — SectionHeader

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/video-file-icon.tsx — VideoFileIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/upload/upload-status-row.tsx — UploadStatusRow

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/upload/upload-status-badge.tsx — UploadStatusBadge

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-config-card.tsx — VideoConfigCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-preview.tsx — VideoPreview

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/copy-link-button.tsx — CopyLinkButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/thumbnail-preview.tsx — ThumbnailPreview

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/category-select.tsx — CategorySelect

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/privacy-option.tsx — PrivacyOption

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-checks-status.tsx — VideoChecksStatus

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: painel-de-videos — audited at SI-04.17.0 (2026-10-19)

**Quick scan:** 12 alinhado · 1 drift menor · 4 drift relevante · 0 ausente

**Source:** o `get_design_context` novo do Figma segue sem cota (plano Starter, 2026-10-19). A demanda vem da resposta completa do frame `152:1824` gravada no transcript do subagente do `/screen-inventory`. Os subnós usados: TopNav `152:1827` com IconButton "add", cabeçalho "videos table" `152:2137` com Button "Upload video" `152:2154`, linha de filtros `152:2163` com Button "Filter" `152:2183`, chips `158:2949` e Search `158:4013`, Sort row `2726:2140` e VideoList `158:3096`. É a mesma fonte das SIs 04.0.x que criaram os componentes do estúdio. Os nomes de variante do Figma não vêm na resposta, só as classes resolvidas.

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- IconButton (`icon-button.tsx`) → `drift relevante` (exception)
- BrandLogo (`brand-logo.tsx`) → `drift menor` (exception)
- Separator (`separator.tsx`) → `alinhado`
- Button (`button.tsx`) → `drift relevante` (CONFLICT)
- Badge (`badge.tsx`) → `drift relevante`
- SearchInput (`search-input.tsx`) → `alinhado`
- DropdownMenu (`dropdown-menu.tsx`) → `alinhado`
- Dialog (`dialog.tsx`) → `alinhado`
- StudioPageHeader (`studio-page-header.tsx`) → `alinhado`
- VideoFilters (`video-filters.tsx`) → `alinhado`
- VideoSortMenu (`video-sort-menu.tsx`) → `alinhado`
- VideoList (`video-list.tsx`) → `alinhado`
- VideoListItem (`video-list-item.tsx`) → `alinhado`
- VideoStats (`video-stats.tsx`) → `alinhado`
- VideoRowActions (`video-row-actions.tsx`) → `alinhado`
- VideoThumbnail (`video-thumbnail.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o TopNav `152:1827` (62px, busca global, IconButton "+", avatar) e a SideNav são o app shell da Fase 07. O header segue mínimo com os links "Meus vídeos" e "Meu canal" (OQ-3).
- **Prior:** "exception at SI-04.15.0 — 'TopNav/SideNav são a navbar da Fase 07; header mínimo'"

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o único IconButton do frame é o "add" do TopNav (`bg-secondary`, `border-border`, pílula `rounded-[var(--radius-full)]` de 40×44, `p-2.5`), que pertence ao shell da Fase 07 e não é renderizado nesta fase. Não existe uma variante pílula no DS; ela entra quando o TopNav for construído.
- **Prior:** _(none)_

### next-frontend/components/auth/brand-logo.tsx — BrandLogo

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o TopNav usa o BrandLogo no tamanho "sm" (altura 30px), e o DS só tem `md`/`lg` (o header usa `md`, ícone de 32px). O tamanho "sm" faz parte do shell da Fase 07.
- **Prior:** _(none)_

### next-frontend/components/ui/separator.tsx — Separator

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** drift relevante
- **Decision:** `CONFLICT`
  - **Note:** o "Upload video" `152:2154` é primário com `px-4 py-2`, Inter 14/20/500 (= `size sm`), mas em pílula (`rounded-[999px]`). Em `156:2110`, o mesmo tamanho primário ("Save Changes") é `rounded-[var(--radius-3)]`, e esse foi o resultado aceito nas SIs 04.15.0 e 04.16.0.
  - **Verb body:** `exception`
    - reason: o raio em pílula vai na chamada (`className="rounded-[var(--radius-full)]"` no "Upload video"). O nome da variante no Figma não vem na resposta, e retunar o `sm` quebraria os botões da tela de processamento.
- **Prior:** "skip at SI-04.15.0 (primário `size sm` com `rounded-[var(--radius-3)]`); outline retuned at SI-04.16.0"

_Note: o "Filter" `152:2183` e os chips `158:2949` (`bg-secondary`, `border-border`, `rounded-[var(--radius-4)]`, `px-6 py-2`, `gap-2`, ícone de 24px, Inter 16/24/500 `text-foreground`) batem com `variant="secondary"` + `size="md"` (`--secondary-foreground` = `--foreground`)._

### next-frontend/components/ui/badge.tsx — Badge

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune text: default — text-xs font-medium → text-caption
- **Prior:** _(none)_

_Note: o Figma desenha o status como texto solto, só "Public", Inter 12/18/400 em `text-success-text`. O UI Contract pede Badge com variantes distinguíveis por texto e cor (draft, unlisted, processing, failed), decisão mantida desde a SI-04.0.x; por isso o mecanismo de chip fica. A tipografia do Badge, porém, é a do scaffold (`text-xs font-medium`, fora dos utilitários do projeto), e a demanda 12/18/400 é exatamente o `text-caption`._

### next-frontend/components/ui/search-input.tsx — SearchInput

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/dropdown-menu.tsx — DropdownMenu

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

_Note: sem demanda no frame. O menu do kebab e as opções de ordenação não estão desenhados (UI Contract: "opções não desenhadas")._

### next-frontend/components/ui/dialog.tsx — Dialog

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

_Note: sem demanda no frame. O diálogo de confirmação de exclusão não está desenhado._

### next-frontend/components/studio/studio-page-header.tsx — StudioPageHeader

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-filters.tsx — VideoFilters

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-sort-menu.tsx — VideoSortMenu

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-list.tsx — VideoList

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-list-item.tsx — VideoListItem

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-stats.tsx — VideoStats

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/studio/video-row-actions.tsx — VideoRowActions

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/video/video-thumbnail.tsx — VideoThumbnail

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: edicao-de-video — audited at SI-04.18.0 (2026-10-19)

**Quick scan:** 13 alinhado · 1 drift menor · 2 drift relevante · 0 ausente

**Source:** o `get_design_context` novo segue sem cota (plano Starter, 2026-10-19). A demanda vem da resposta completa do frame `156:2790` gravada no transcript do subagente do `/screen-inventory`. Comparadas as classes de todas as camadas nomeadas, ela é idêntica à de `156:2110` (auditado na SI-04.16.0). Só mudam o frame raiz "Edit/Publish video" e o rodapé "publish form" (mesmas classes do "upload form"); não há linha de upload. Os nomes de variante do Figma não vêm na resposta, só as classes resolvidas.

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- Card (`card.tsx`) → `drift menor` (exception)
- Label (`label.tsx`) → `alinhado`
- Input (`input.tsx`) → `alinhado`
- Textarea (`textarea.tsx`) → `alinhado`
- Select (`select.tsx`) → `alinhado`
- RadioGroup (`radio-group.tsx`) → `drift relevante` (6 changes)
- Button (`button.tsx`) → `alinhado`
- SectionHeader (`section-header.tsx`) → `alinhado`
- VideoConfigCard (`video-config-card.tsx`) → `alinhado`
- VideoPreview (`video-preview.tsx`) → `alinhado`
- CopyLinkButton (`copy-link-button.tsx`) → `alinhado`
- ThumbnailPreview (`thumbnail-preview.tsx`) → `alinhado`
- CategorySelect (`category-select.tsx`) → `alinhado`
- PrivacyOption (`privacy-option.tsx`) → `alinhado`
- VideoChecksStatus (`video-checks-status.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o TopNav `156:2792` e a SideNav são o app shell da Fase 07. O header segue mínimo com os links do estúdio (OQ-3).
- **Prior:** "exception at SI-04.15.0 — 'TopNav/SideNav são a navbar da Fase 07; header mínimo'"

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o container `156:2797` bate com o DS. O padding 32 e o gap 24 ficam no "Channel card" `156:2796`, e a tela os compõe via `className` (`p-8 gap-6`) sem mudar o padrão `py-4 gap-4` dos cards da Fase 02.
- **Prior:** "exception at SI-04.16.0 — 'padding composto pela tela; padrão do Card preservado para a Fase 02'"

### next-frontend/components/ui/label.tsx — Label

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/ui/input.tsx — Input

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune padding `pl-4 pr-2` at SI-04.16.0 honored"

### next-frontend/components/ui/textarea.tsx — Textarea

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (border/background/radius/padding/text + drop `dark:`) at SI-04.16.0 honored"

### next-frontend/components/ui/select.tsx — Select

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit do trigger (border/background/radius/padding/gap/text/`h-9` + drop `dark:`) at SI-04.16.0 honored"

### next-frontend/components/ui/radio-group.tsx — RadioGroup

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune border: default — border border-input → border-2 border-border
  - retune variant override: data-checked:bg-primary → data-checked:bg-transparent
  - retune indicator: default — bg-primary-foreground → bg-primary
  - drop variant override: dark:bg-input/30 (conflicts with the unfilled Figma radio)
  - drop variant override: dark:data-checked:bg-primary (conflicts with the unfilled Figma radio)
  - drop variant override: group-has-[:focus-visible]/field-label:not-data-checked:border-input (conflicts with token-driven border-border)
- **Prior:** _(none)_

_Note: o rádio do PrivacyOption `156:2822` tem 16px, `border-2` e raio cheio. Marcado, a borda é `--primary`, sem preenchimento, com um ponto interno de 8px em `--primary`; desmarcado, a borda é `--border`. O arquivo ainda é o scaffold do `npx shadcn add` (SI-04.0.1): borda de 1px `border-input`, fundo `primary` quando marcado com ponto `primary-foreground`, e `dark:bg-input/30`. O `privacy-option.tsx` sobrescreve isso na chamada, mas não consegue vencer os utilitários `dark:` do primitivo, de especificidade maior, e por isso o rádio sai com fundo no tema escuro. O primitivo só é consumido pelo `privacy-option.tsx`._

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "outline retuned at SI-04.16.0 honored (Change Thumbnail / Cancel); primário `size sm` `rounded-[var(--radius-3)]` (Save Changes) honored"

### next-frontend/components/ui/section-header.tsx — SectionHeader

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/video-config-card.tsx — VideoConfigCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/video-preview.tsx — VideoPreview

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/copy-link-button.tsx — CopyLinkButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/thumbnail-preview.tsx — ThumbnailPreview

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/category-select.tsx — CategorySelect

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/privacy-option.tsx — PrivacyOption

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/studio/video-checks-status.tsx — VideoChecksStatus

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

## Screen: edicao-do-canal — audited at SI-04.19.0 (2026-10-19)

**Quick scan:** 9 alinhado · 1 drift menor · 2 drift relevante · 0 ausente

**Source:** o `get_design_context` novo segue sem cota (plano Starter, 2026-10-19). A demanda vem da resposta completa do frame `154:1367` gravada no transcript do subagente do `/screen-inventory`, a mesma fonte das SIs 04.0.x que criaram os componentes de canal e os ícones. Subnós usados: Channel card `154:1486` (banner `154:1487`, Avatar `2405:2276`, metas com o ícone groups `2450:2302`), Card `154:1509`, form "Canal" `154:1512` (TextField `154:1537`, Textarea `154:1580`), rodapé "channel form" `154:1683` (Status com o ícone alarm `156:2106`) e os Buttons `154:1713`/`154:1696`. Os nomes de variante do Figma não vêm na resposta, só as classes resolvidas.

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- Card (`card.tsx`) → `drift menor` (exception)
- Avatar (`avatar.tsx`) → `drift relevante` (exception)
- Label (`label.tsx`) → `alinhado`
- Input (`input.tsx`) → `alinhado`
- Textarea (`textarea.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`
- GroupsIcon (`groups-icon.tsx`) → `alinhado`
- VideocamIcon (`videocam-icon.tsx`) → `alinhado`
- AlarmIcon (`alarm-icon.tsx`) → `alinhado`
- ChannelHeaderCard (`channel-header-card.tsx`) → `alinhado`
- ChannelBanner (`channel-banner.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o TopNav `154:1369` e a SideNav são o app shell da Fase 07. O header segue mínimo com os links do estúdio (OQ-3).
- **Prior:** "exception at SI-04.15.0 — 'TopNav/SideNav são a navbar da Fase 07; header mínimo'"

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o container `154:1509` bate (`bg-card`, `border-border`, `rounded-[var(--radius-2)]`). O espaçamento interno fica nos frames de dentro (cabeçalho com `p-[32px]`, form, rodapé `px-[32px] py-[16px]`) e é composto pela tela, sem mudar o padrão `py-4 gap-4` dos cards da Fase 02.
- **Prior:** "exception at SI-04.16.0 — 'padding composto pela tela; padrão do Card preservado para a Fase 02'"

### next-frontend/components/ui/avatar.tsx — Avatar

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o Avatar `2405:2276` tem 128px (UI Contract: "Avatar 2xl"), com `border-border` e raio cheio, e o DS só vai até `lg` (40px). O único consumidor desse tamanho é o `ChannelAvatar`, que já compõe `size-32` e as iniciais em `text-h1` na chamada. O primitivo também será a base do menu da conta da Fase 07, então não ganha um tamanho só por esta tela.
- **Prior:** _(none)_

### next-frontend/components/ui/label.tsx — Label

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.16.0 honored"

### next-frontend/components/ui/input.tsx — Input

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit retune padding `pl-4 pr-2` at SI-04.16.0 honored"

### next-frontend/components/ui/textarea.tsx — Textarea

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (border/background/radius/padding/text + drop `dark:`) at SI-04.16.0 honored"

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "outline retuned at SI-04.16.0 honored (Cancel `154:1713`); primário `size sm` `rounded-[var(--radius-3)]` (Save Changes `154:1696`) honored"

### next-frontend/components/icons/groups-icon.tsx — GroupsIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/videocam-icon.tsx — VideocamIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/alarm-icon.tsx — AlarmIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-header-card.tsx — ChannelHeaderCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-banner.tsx — ChannelBanner

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

_Note: o banner `154:1487` do Figma tem um gradiente com hex (`#261440` → `#141f4d` → `#0d3347`); no DS ele usa os tokens `--banner-from/via/to`, registrados no `globals.css` na SI-04.0.x._

## Screen: pagina-publica-do-canal — audited at SI-04.20.0 (2026-10-19)

**Quick scan:** 9 alinhado · 1 drift menor · 4 drift relevante · 0 ausente

**Source:** o `get_design_context` novo segue sem cota (plano Starter, 2026-10-19). A demanda vem da resposta completa do frame `155:1926` gravada no transcript do subagente do `/screen-inventory`, a mesma fonte das SIs 04.0.x que criaram os componentes de canal, o `filter-chip` e o `video-card`. Subnós: banner `156:3511`, cabeçalho `156:3513` (Button Subscribe `156:3536`, IconButton sino `158:2691`, Avatar `2405:2283`), Tabs `158:2613` (Tab 1 "Video", Tab 2 "About", Divider `158:2581`), Filter chips `2737:2145` e VideoCard `156:3591`. Os nomes de variante do Figma não vêm na resposta, só as classes resolvidas.

- AppHeader (`app-header.tsx`) → `drift relevante` (exception)
- IconButton (`icon-button.tsx`) → `drift relevante` (exception)
- BrandLogo (`brand-logo.tsx`) → `drift menor` (exception)
- Avatar (`avatar.tsx`) → `drift relevante` (exception)
- Button (`button.tsx`) → `alinhado`
- Tabs (`tabs.tsx`) → `drift relevante` (5 changes)
- Separator (`separator.tsx`) → `alinhado`
- FilterChip (`filter-chip.tsx`) → `alinhado`
- ChannelBanner (`channel-banner.tsx`) → `alinhado`
- ChannelHeader (`channel-header.tsx`) → `alinhado`
- ChannelInfo (`channel-info.tsx`) → `alinhado`
- ChannelVideoSort (`channel-video-sort.tsx`) → `alinhado`
- ChannelVideoGrid (`channel-video-grid.tsx`) → `alinhado`
- VideoCard (`video-card.tsx`) → `alinhado`

### next-frontend/components/layout/app-header.tsx — AppHeader

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o TopNav e a SideNav são o app shell da Fase 07. O header segue mínimo (`saneamento-fase-02-e-infra/TD-05`).
- **Prior:** "exception at SI-04.15.0 — 'TopNav/SideNav são a navbar da Fase 07; header mínimo'"

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o sino `158:2691` (pílula `bg-secondary` de 44px) é o recurso de notificações da Fase 06, e o UI Contract manda ocultá-lo nesta fase. O "+" do TopNav é da Fase 07. Nenhum IconButton é renderizado nesta tela.
- **Prior:** "exception at SI-04.17.0 — '\"+\" pílula do TopNav da Fase 07'"

### next-frontend/components/auth/brand-logo.tsx — BrandLogo

- **Status:** drift menor
- **Decision:** `exception`
  - reason: o tamanho "sm" do logo só aparece no TopNav da Fase 07.
- **Prior:** "exception at SI-04.17.0 — 'tamanho \"sm\" do TopNav da Fase 07'"

### next-frontend/components/ui/avatar.tsx — Avatar

- **Status:** drift relevante
- **Decision:** `exception`
  - reason: o avatar de 128px ("2xl", `2405:2283`) é composto na chamada pelo `ChannelAvatar` (`size-32`, iniciais em `text-h1`). O primitivo não ganha um tamanho só por uma tela.
- **Prior:** "exception at SI-04.19.0 — '128px composto na chamada pelo ChannelAvatar'"

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "CONFLICT at SI-04.17.0 (pílula `rounded-[var(--radius-full)]` na chamada, `exception`) honored"

_Note: o Subscribe `156:3536` é o mesmo primário `size sm` em pílula do "Upload video", mas o UI Contract diz "fase 06: não renderizar nesta fase". Sem consumo nesta tela._

### next-frontend/components/ui/tabs.tsx — Tabs

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune variant: line — gap-1 bg-transparent → w-full justify-start gap-0 border-b border-border bg-transparent p-0
  - retune size: line — group-data-horizontal/tabs:h-8 → data-[variant=line]:h-12
  - retune text: default — text-sm font-medium text-foreground/60 → text-body-md text-muted-foreground
  - retune padding: default — px-1.5 py-0.5 → px-4
  - retune indicator: default — group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 → group-data-horizontal/tabs:after:inset-x-0.5 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-0.75
- **Prior:** _(none)_

_Note: as Tabs `158:2613` do Figma usam o estilo sublinhado. A lista tem 48px e ocupa a largura toda, com o Divider de 1px embaixo (`border-border`). Cada aba tem `px-[16px]`, texto Inter 14/20/400 (`text-body-md`) em `text-foreground` quando ativa e `text-muted-foreground` quando inativa, e um indicador de 3px em `--foreground` colado na base com 2px de recuo lateral. A variante `line` do scaffold shadcn corresponde a esse estilo pelo papel visual (o nome da variante no Figma não vem na resposta); a `default` (pílula em `bg-muted`) fica como está. O arquivo ainda não tem consumidor. O UI Contract manda renderizar só "Videos" (a aba About está fora do escopo, OQ-7)._

### next-frontend/components/ui/separator.tsx — Separator

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.17.0 honored"

### next-frontend/components/ui/filter-chip.tsx — FilterChip

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-banner.tsx — ChannelBanner

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "alinhado/skip at SI-04.19.0 honored"

### next-frontend/components/channel/channel-header.tsx — ChannelHeader

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-info.tsx — ChannelInfo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-video-sort.tsx — ChannelVideoSort

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/channel/channel-video-grid.tsx — ChannelVideoGrid

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/videos/video-card.tsx — VideoCard

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_
