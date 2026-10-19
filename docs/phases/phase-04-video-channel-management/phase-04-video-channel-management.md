---
kind: phase
name: phase-04-video-channel-management
test_specs_aware: true
sources_mtime:
  docs/phases/phase-04-video-channel-management/context.md: "2026-10-18T22:27:36-04:00"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-18T22:25:15-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
---

# Phase 04 — Gerenciamento de Vídeos e Canal

## Objective

Entregar a edição completa de vídeos (título, descrição, categoria e thumbnail customizada), o fluxo de rascunho → publicação com visibilidade pública ou unlisted, o painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status) com edição a partir dele e a UI de upload adiada da Fase 03, a edição das informações do canal (nickname, nome e descrição) e a página pública do canal com informações e listagem de vídeos — backend NestJS + frontend Next.js (BFF), sobre o catálogo de categorias da plataforma.

---

## Step Implementations

_Bootstrap (`SI-04.0.k`, sintetizadas dos marcadores `(new)` dos UI Contracts) → backend (`SI-04.1`–`SI-04.9`) → contrato OpenAPI (`SI-04.10`) → Frontend Runtime, BFF e uploader (`SI-04.11`–`SI-04.14`) → telas (`SI-04.15`–`SI-04.20`, cada uma com audit `.0`, shell `a` e wiring `b`). Fora do bootstrap por decisão de escopo: os componentes do shell global marcados "escopo fase 07" nos UI Contracts (`components/layout/global-search.tsx`, `side-nav.tsx`, `side-nav-item.tsx`, `side-nav-subscriptions.tsx`, `app-shell.tsx`) — a entrada mínima desta fase são os links no `AppHeader` existente (resolução OQ-3) — e os componentes Server-connected de formulário/wiring (`video-edit-form`, `channel-settings-form`, `upload-dropzone`, `upload-video-form`, `thumbnail-upload-button`), que pertencem às SIs `b` das telas._

### SI-04.0.1 — Infra: install batch shadcn primitives

**Description:** Instalar shadcn primitives via CLI registry; commitar arquivos gerados em `components/ui/`.

**Technical actions:**

1. Rodar `docker compose exec next-frontend npx shadcn@latest add avatar badge dialog dropdown-menu progress radio-group select separator tabs textarea` (alphabetical) — gera `components/ui/<name>.tsx` por primitive, respeitando `components.json` (style `radix-nova`, `cssVariables: true`).
2. Commitar `components/ui/<name>.tsx` per primitive instalado.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/{avatar,badge,dialog,dropdown-menu,progress,radio-group,select,separator,tabs,textarea}.tsx` existem.
- Generated files compile per `docker compose exec next-frontend npx tsc --noEmit`.

---

### SI-04.0.2 — Tests shadcn batch 1 (≤5 files)

**Description:** Unit tests para shadcn primitives instalados em SI-04.0.1 — variants, a11y, data-slot, event handlers.

**Technical actions:**

1. Author `components/ui/__tests__/{avatar,badge,dialog,dropdown-menu,progress}.test.tsx` (um por primitive; `// @vitest-environment jsdom`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `avatar.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" — fallback de iniciais, `data-slot`, `alt` | `components/ui/__tests__/avatar.test.tsx` |
| `badge.tsx` | Unit — variants (`default`, `secondary`, `destructive`, `outline`, `success`), `data-variant` | `components/ui/__tests__/badge.test.tsx` |
| `dialog.tsx` | Unit — abre/fecha, foco preso, `aria-describedby`, Escape fecha | `components/ui/__tests__/dialog.test.tsx` |
| `dropdown-menu.tsx` | Unit — abre por clique/teclado, `role="menu"`, seleção de item | `components/ui/__tests__/dropdown-menu.test.tsx` |
| `progress.tsx` | Unit — `role="progressbar"`, `aria-valuenow/min/max`, estado indeterminado | `components/ui/__tests__/progress.test.tsx` |

**Dependencies:** SI-04.0.1

**Acceptance criteria:**

- Each primitive in this batch has an Unit test file covering all CVA variants, ARIA attributes, data-slot anchors, and event handler wiring.
- Tests pass per `docker compose exec next-frontend npm test`.

---

### SI-04.0.3 — Tests shadcn batch 2 (≤5 files)

**Description:** Unit tests para os demais shadcn primitives instalados em SI-04.0.1.

**Technical actions:**

1. Author `components/ui/__tests__/{radio-group,select,separator,tabs,textarea}.test.tsx`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `radio-group.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" — `role="radiogroup"`/`role="radio"`, setas, `aria-checked` | `components/ui/__tests__/radio-group.test.tsx` |
| `select.tsx` | Unit — abre, seleciona opção, `aria-expanded`, valor controlado | `components/ui/__tests__/select.test.tsx` |
| `separator.tsx` | Unit — `role="separator"`, orientação, `data-slot` | `components/ui/__tests__/separator.test.tsx` |
| `tabs.tsx` | Unit — `role="tablist"`/`tab`, `aria-selected`, navegação por setas | `components/ui/__tests__/tabs.test.tsx` |
| `textarea.tsx` | Unit — valor controlado, `aria-invalid`, `maxLength` | `components/ui/__tests__/textarea.test.tsx` |

**Dependencies:** SI-04.0.1

**Acceptance criteria:**

- Each primitive in this batch has an Unit test file covering all CVA variants, ARIA attributes, data-slot anchors, and event handler wiring.
- Tests pass per `docker compose exec next-frontend npm test`.

---

### SI-04.0.4 — Custom-ui: filter-chip.tsx

**Description:** Author `components/ui/filter-chip.tsx` per UI Contract — primitive sob `components/ui/` não disponível no shadcn registry (chip toggle ~80×36, variantes active/normal).

**Technical actions:**

1. Author `components/ui/filter-chip.tsx` per UI Contract specs (Figma `FilterChip` 158:2651; `aria-pressed` ou uso como item de radiogroup; tokens de `app/globals.css`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `filter-chip.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" + custom-logic — variantes active/normal, `aria-pressed`, `onClick` | `components/ui/__tests__/filter-chip.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/filter-chip.tsx` exists and matches the UI Contract for this component.
- Unit test file exercises every variant + custom logic branch.

---

### SI-04.0.5 — Custom-ui: search-input.tsx

**Description:** Author `components/ui/search-input.tsx` per UI Contract — campo de busca com ícone e botão limpar (Figma `Search` 158:4007), compondo `components/ui/input.tsx`.

**Technical actions:**

1. Author `components/ui/search-input.tsx` per UI Contract specs (`type="search"`, `aria-label`, botão limpar com `aria-label="Clear search"`, `maxLength` configurável).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `search-input.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" + custom-logic — valor controlado, limpar, `onChange`, `maxLength` | `components/ui/__tests__/search-input.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/search-input.tsx` exists and matches the UI Contract for this component.
- Unit test file exercises every variant + custom logic branch.

---

### SI-04.0.6 — Custom-ui: section-header.tsx

**Description:** Author `components/ui/section-header.tsx` per UI Contract — título H2 + descrição muted (Figma `SectionHeader` 2390:2258/2267/2270/2273), usado nas seções Thumbnail/Category/Visibility.

**Technical actions:**

1. Author `components/ui/section-header.tsx` per UI Contract specs (`id` opcional para `aria-labelledby`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `section-header.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" — renderiza título/descrição, `id` propagado | `components/ui/__tests__/section-header.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/section-header.tsx` exists and matches the UI Contract for this component.
- Unit test file exercises rendering + `id` propagation.

---

### SI-04.0.7 — Custom-business simple group: alarm-icon + groups-icon + video-file-icon + videocam-icon

**Description:** Author os ícones SVG custom usados pelas telas de canal e upload (sem biblioteca de ícones, per `next-frontend/CLAUDE.md`).

**Technical actions:**

1. Author `components/icons/alarm-icon.tsx` per UI Contract (Figma 156:2106; "Last updated").
2. Author `components/icons/groups-icon.tsx` per UI Contract (Figma 2450:2302; inscritos).
3. Author `components/icons/video-file-icon.tsx` per UI Contract (Figma 157:1933; linha de status do upload).
4. Author `components/icons/videocam-icon.tsx` per UI Contract (Figma 107:928; contador de vídeos).

**Tests:** _(empty — icons are static SVG; per testing-guide-next-frontend § "Icons" no unit test)_

**Dependencies:** none

**Acceptance criteria:**

- Each icon exists at its declared path, accepts `className`/`aria-hidden` like `components/icons/check-icon.tsx`, and compiles.

---

### SI-04.0.8 — Custom-business simple group: studio-page-header + video-list + video-list-item + video-stats + video-thumbnail

**Description:** Author os componentes apresentacionais do painel (sem state) consumidos pela tela `/studio/videos`.

**Technical actions:**

1. Author `components/studio/studio-page-header.tsx` per UI Contract (título + subtítulo + slot de ação primária).
2. Author `components/studio/video-list.tsx` per UI Contract (container das linhas + slot "Load more").
3. Author `components/studio/video-list-item.tsx` per UI Contract (linha 1088×160: thumbnail, título 1 linha, descrição, métricas, tempo relativo, badge de status por `status`/`visibility`/`processing_status`, slot de ações).
4. Author `components/studio/video-stats.tsx` per UI Contract (views/likes/comments com rótulos acessíveis + `published_at` relativo ou "Draft").
5. Author `components/video/video-thumbnail.tsx` per UI Contract (256×144, duração sobreposta com fundo escurecido, `alt`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-list-item.tsx` | Unit per testing-guide-next-frontend § "Client Components" — badge por estado (`Public`/`Unlisted`/`Draft`/`Processing`/`Failed`), "Draft" sem `published_at` | `components/studio/__tests__/video-list-item.test.tsx` |
| `video-stats.tsx` | Unit — formatação compacta (1.2K) e rótulos acessíveis | `components/studio/__tests__/video-stats.test.tsx` |
| `video-thumbnail.tsx` | Unit — `alt`, duração formatada `m:ss`, ausência de duração | `components/video/__tests__/video-thumbnail.test.tsx` |

**Dependencies:** SI-04.0.1 (badge)

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-04.0.9 — Custom-business simple group: category-select + thumbnail-preview + video-checks-status + video-config-card + video-preview

**Description:** Author os componentes apresentacionais compartilhados pelas telas de edição de vídeo e de upload em processamento (mesmos componentes Figma; implementados uma vez em `components/studio/`).

**Technical actions:**

1. Author `components/studio/category-select.tsx` per UI Contract (wrapper de `components/ui/select.tsx` recebendo `categories: CategoryResponse[]`; `<Label>` associado).
2. Author `components/studio/thumbnail-preview.tsx` per UI Contract (thumbnail atual ou placeholder "No thumbnail yet"; overlay opcional de duração — cobre `thumb-upload`/`duration-badge` da tela de upload).
3. Author `components/studio/video-checks-status.tsx` per UI Contract (estados `pending`/`processing`/`ready`/`failed` com `processing_error`; `aria-live="polite"` — cobre `processing-checks-status`).
4. Author `components/studio/video-config-card.tsx` per UI Contract (link público `${origin}/watch/{publicId}` + slot copiar, nome do arquivo, qualidade `{height}p`, placeholders até `ready`).
5. Author `components/studio/video-preview.tsx` per UI Contract (poster + play; `<video src={stream_url}>` quando fornecido).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `category-select.tsx` | Unit per testing-guide-next-frontend § "Client Components" — lista opções, valor controlado, label associado | `components/studio/__tests__/category-select.test.tsx` |
| `video-checks-status.tsx` | Unit — texto/variante por estado e mensagem por `processing_error` | `components/studio/__tests__/video-checks-status.test.tsx` |
| `video-config-card.tsx` | Unit — link `/watch/{publicId}`, placeholders antes de `ready` | `components/studio/__tests__/video-config-card.test.tsx` |

**Dependencies:** SI-04.0.1 (select), SI-04.0.6 (section-header)

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-04.0.10 — Custom-business simple group: channel-banner + channel-header + channel-header-card + channel-info + channel-video-grid

**Description:** Author os componentes apresentacionais de canal (página pública e cabeçalho das configurações), implementados uma vez em `components/channel/` (os caminhos `components/channels/*` do inventário apontam para os mesmos componentes).

**Technical actions:**

1. Author `components/channel/channel-banner.tsx` per UI Contract (gradiente estático decorativo, `alt=""` — placeholder OQ-6).
2. Author `components/channel/channel-header.tsx` per UI Contract (container banner + avatar sobreposto + info + ações).
3. Author `components/channel/channel-header-card.tsx` per UI Contract (card das configurações: banner, avatar com iniciais, nome, `@nickname`, "{video_count} videos").
4. Author `components/channel/channel-info.tsx` per UI Contract (`<h1>` nome, `@nickname`, "{video_count} videos", descrição; contador de inscritos oculto nesta fase).
5. Author `components/channel/channel-video-grid.tsx` per UI Contract (grid responsivo de `VideoCard` + estado vazio "This channel has no public videos yet" + slot "Load more").

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `channel-info.tsx` | Unit per testing-guide-next-frontend § "Client Components" — nome como `h1`, `@nickname`, pluralização de videos | `components/channel/__tests__/channel-info.test.tsx` |
| `channel-video-grid.tsx` | Unit — estado vazio vs. grid, slot de "Load more" | `components/channel/__tests__/channel-video-grid.test.tsx` |

**Dependencies:** SI-04.0.1 (avatar, separator)

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-04.0.11 — Custom-business simple group: upload-status-badge + upload-status-row + video-card

**Description:** Author os componentes apresentacionais do fluxo de upload e o card de vídeo das listagens públicas.

**Technical actions:**

1. Author `components/upload/upload-status-badge.tsx` per UI Contract (rótulo por `uploading | processing | ready | failed`, texto + cor).
2. Author `components/upload/upload-status-row.tsx` per UI Contract (ícone `video-file-icon`, nome do arquivo, "Uploading… {pct}%" / "Processing…" com `aria-live`, `Progress` determinado/indeterminado, badge).
3. Author `components/videos/video-card.tsx` per UI Contract (thumbnail 16:9 `rounded-[var(--radius-4)]`, título 2 linhas com `title`, views, tempo relativo; variante sem linha de canal; `<Link href="/watch/{publicId}">`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `upload-status-row.tsx` | Unit per testing-guide-next-frontend § "Client Components" — porcentagem, `role="progressbar"` com `aria-valuenow`, indeterminado em `processing` | `components/upload/__tests__/upload-status-row.test.tsx` |
| `video-card.tsx` | Unit — `href` `/watch/{publicId}`, `alt`, views formatadas | `components/videos/__tests__/video-card.test.tsx` |

**Dependencies:** SI-04.0.1 (progress, badge), SI-04.0.7 (video-file-icon)

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-04.0.12 — Custom-business complex: channel-video-sort

**Description:** Author `components/channel/channel-video-sort.tsx` — business component com state per Notes "Grupo de 3 FilterChip; 'Latest' ativo por padrão; reordenar exige nova consulta (TD-06)".

**Technical actions:**

1. Author `components/channel/channel-video-sort.tsx` per UI Contract (`"use client"`; radiogroup de `FilterChip` Latest/Popular/Oldest; valor inicial de `searchParams.sort`; ao mudar, `router.replace` com `?sort=` e sem `cursor`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `channel-video-sort.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline (mock `next/navigation`) | `components/channel/__tests__/channel-video-sort.test.tsx` |
| `channel-video-sort.tsx` | Unit: toggle assertions — chip ativo reflete `sort`, clique chama `router.replace` com `sort` novo e sem `cursor` | (same file) |

**Dependencies:** SI-04.0.4 (filter-chip)

**Acceptance criteria:**

- `components/channel/channel-video-sort.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the state-driven logic (chip ativo, `router.replace`).

---

### SI-04.0.13 — Custom-business complex: copy-link-button

**Description:** Author `components/studio/copy-link-button.tsx` — business component com state per Notes "copia o link para o clipboard; sem I/O com backend; feedback 'Copied'".

**Technical actions:**

1. Author `components/studio/copy-link-button.tsx` per UI Contract (`"use client"`; `navigator.clipboard.writeText(url)`; estado `copied` por 2 s; `aria-label="Copy link"`; `aria-live` para o feedback).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `copy-link-button.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline | `components/studio/__tests__/copy-link-button.test.tsx` |
| `copy-link-button.tsx` | Unit: state assertions — chama `clipboard.writeText` com a URL, mostra "Copied" e volta após 2 s (fake timers) | (same file) |

**Dependencies:** none

**Acceptance criteria:**

- `components/studio/copy-link-button.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the state-driven logic (copied feedback).

---

### SI-04.0.14 — Custom-business complex: privacy-option

**Description:** Author `components/studio/privacy-option.tsx` — business component com toggle per Notes "item radio com ícone, título e descrição; estado selecionado; a escolha só vai ao servidor via Save Changes".

**Technical actions:**

1. Author `components/studio/privacy-option.tsx` per UI Contract (`"use client"`; grupo `fieldset`/`legend` sobre `components/ui/radio-group.tsx`; opções `public` (ícone globo, "Public — anyone can find and watch") e `unlisted` (ícone link, "Unlisted — only people with the link"); valor controlado por `react-hook-form`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `privacy-option.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline | `components/studio/__tests__/privacy-option.test.tsx` |
| `privacy-option.tsx` | Unit: toggle assertions — `aria-checked` segue o valor, seleção por clique e teclado chama `onChange` com `public`/`unlisted` | (same file) |

**Dependencies:** SI-04.0.1 (radio-group)

**Acceptance criteria:**

- `components/studio/privacy-option.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the toggle logic.

---

### SI-04.0.15 — Custom-business complex: video-filters

**Description:** Author `components/studio/video-filters.tsx` — business component com state per Notes "barra de filtros + busca do painel; altera a consulta da lista paginada (TD-06)".

**Technical actions:**

1. Author `components/studio/video-filters.tsx` per UI Contract (`"use client"`; chips "Public"/visibilidade e status, seletor de intervalo "Date" (`from`/`to`), `SearchInput` com debounce 300 ms e `maxLength=100`; estado local inicializado de `searchParams`; ao aplicar, `router.replace` com os params e sem `cursor`; botão "Clear filters").

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-filters.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline (mock `next/navigation`) | `components/studio/__tests__/video-filters.test.tsx` |
| `video-filters.tsx` | Unit: state assertions — debounce da busca, `router.replace` com `visibility`/`status`/`q`/`from`/`to` e sem `cursor`, validação `from ≤ to`, limpar filtros | (same file) |

**Dependencies:** SI-04.0.5 (search-input)

**Acceptance criteria:**

- `components/studio/video-filters.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the state-driven logic (params emitidos, debounce, validação de datas).

---

### SI-04.0.16 — Custom-business complex: video-row-actions

**Description:** Author `components/studio/video-row-actions.tsx` — business component com state per Notes "menu kebab com Editar / Publicar / Despublicar / Excluir com confirmação; compõe dropdown-menu e dialog".

**Technical actions:**

1. Author `components/studio/video-row-actions.tsx` per UI Contract (`"use client"`; `IconButton` kebab com `aria-label="Video actions"`; `DropdownMenu` com "Edit" (`<Link>`), "Publish" ou "Unpublish" conforme `status`, "Delete"; `Dialog` de confirmação de exclusão; callbacks `onPublish`/`onUnpublish`/`onDelete` injetados pela tela — o componente não chama o BFF diretamente).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-row-actions.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline | `components/studio/__tests__/video-row-actions.test.tsx` |
| `video-row-actions.tsx` | Unit: state assertions — item Publish/Unpublish por `status`, diálogo abre antes de `onDelete`, cancelar não dispara callback, item desabilitado quando `processing_status ≠ ready` | (same file) |

**Dependencies:** SI-04.0.1 (dropdown-menu, dialog)

**Acceptance criteria:**

- `components/studio/video-row-actions.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the state-driven logic (menu, confirmação).

---

### SI-04.0.17 — Custom-business complex: video-sort-menu

**Description:** Author `components/studio/video-sort-menu.tsx` — business component com state per Notes "reordenar implica nova consulta (TD-06); compõe dropdown-menu; opções não desenhadas".

**Technical actions:**

1. Author `components/studio/video-sort-menu.tsx` per UI Contract (`"use client"`; gatilho "Sort by: {label}" + ícone; `DropdownMenu` com Latest / Oldest / Most viewed (`sort=latest|oldest|views`); ao escolher, `router.replace` com `sort` e sem `cursor`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-sort-menu.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline (mock `next/navigation`) | `components/studio/__tests__/video-sort-menu.test.tsx` |
| `video-sort-menu.tsx` | Unit: state assertions — rótulo reflete `sort` atual, escolha chama `router.replace` com o valor e sem `cursor` | (same file) |

**Dependencies:** SI-04.0.1 (dropdown-menu)

**Acceptance criteria:**

- `components/studio/video-sort-menu.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the state-driven logic.

---

### SI-04.1 — Criar catálogo de categorias

**Description:** Entregar a tabela `categories` com carga inicial por migration e o endpoint público `GET /categories`, base da edição de vídeo (Fase 04), das sugestões (Fase 05) e do filtro da home (Fase 07).

**Technical actions:**

1. Criar `src/categories/entities/category.entity.ts` com os campos de `### Data Model → Category` (`slug` unique, `name`, `sort_order`) e registrar em `src/database/entities.ts` (per `video-channel-management/TD-01`; regra `nestjs-entities.md`).
2. Gerar a migration de schema com `npm run migration:generate -- src/database/migrations/CreateCategories` e escrever à mão a data migration `SeedCategories` (INSERT das 10 linhas `slug → name` na ordem de `### Data Model → Category → Seed`, `sort_order` 1..10; `down` remove por `slug`) (per `video-channel-management/TD-01` Revisions 2026-10-18; `typeorm-migrations.md` permite SQL manual para dados).
3. Criar `src/categories/categories.module.ts` (`TypeOrmModule.forFeature([Category])`, exporta `CategoriesService`), `categories.service.ts` (`findAll()` ordenado por `sort_order`; `findById()` para validação de FK) e `categories.controller.ts` com `GET /categories` `@Public()` devolvendo `CategoryResponse[]` (per `### API Contracts → GET /categories`; `nestjs-controllers.md`).
4. Criar `src/categories/dto/category-response.dto.ts` anotado com `@ApiProperty` (per `openapi-docs-nestjs`) e registrar `CategoriesModule` no `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Category` + migrations | Integration: `migration:run` deixa 10 categorias na ordem esperada; `slug` unique viola em duplicata; `down` da seed remove as linhas | `src/categories/entities/category.entity.integration-spec.ts` |
| `CategoriesModule` | Unit: compilation test (`Test.createTestingModule({ imports: [CategoriesModule] })`) | `src/categories/categories.module.spec.ts` |
| `CategoriesService` | Integration: `findAll` ordenado por `sort_order`; `findById` inexistente → `null` | `src/categories/categories.service.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Após `npm run migration:run` em banco limpo, `SELECT count(*) FROM categories` retorna 10 e `slug` `music` tem `sort_order` 1 e `other` tem 10
- `GET /categories` sem token retorna `200` com 10 itens `{ id, slug, name, sort_order }` ordenados por `sort_order`
- Inserir uma segunda categoria com `slug` existente viola a unique constraint

---

### SI-04.2 — Estender modelo do vídeo com publicação, visibilidade, categoria e contadores

**Description:** Acrescentar à entidade `Video` o eixo de publicação completo, a visibilidade, a categoria, a thumbnail customizada e os contadores, com migration e resposta estendida — base de todos os endpoints desta fase.

**Technical actions:**

1. Estender `src/videos/entities/video.entity.ts` com as colunas de `### Data Model → Video` (`title`, `description`, `category_id` + relação `ManyToOne(Category)`, `visibility`, `published_at`, `custom_thumbnail_key`, `view_count`, `like_count`, `dislike_count`, `comment_count`) e os índices compostos; gerar a migration com `npm run migration:generate -- src/database/migrations/ExtendVideosForPublishing` (o `title` nasce `not null` com `default ''` na migration + backfill `UPDATE videos SET title = split_part(original_filename, '.', 1)` para linhas existentes) (per `video-channel-management/TD-02`, `TD-04`, `TD-05`; `typeorm-migrations.md`).
2. Atualizar `src/videos/videos.constants.ts`: `VIDEO_STATUSES = ['draft', 'published']`, novo `VIDEO_VISIBILITIES = ['public', 'unlisted']`, novos códigos em `VIDEO_ERROR_CODES` (`CATEGORY_NOT_FOUND`, `NOT_PUBLISHABLE`, `THUMBNAIL_INVALID`, `THUMBNAIL_TOO_LARGE`) (per `### Error Catalog`).
3. No pré-cadastro (`VideosService.createUpload`), preencher `title` com `original_filename` sem extensão truncado a 100 chars (per `### Data Model → Video`).
4. Estender `src/videos/dto/video-response.dto.ts` (`VideoResponse`, novos `VideoListItem`, `VideoCardItem`) com os campos de `### API Contracts → Shapes compartilhados`, incluindo `category: CategoryResponse | null`, `has_custom_thumbnail`, contadores e `published_at`; `VideosModule` importa `CategoriesModule` (per `openapi-docs-nestjs`; `nestjs-dtos.md`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Video` (colunas novas) | Integration: defaults (`visibility = public`, contadores 0, `status = draft`), FK `category_id` com `ON DELETE SET NULL`, backfill de `title` na migration | `src/videos/entities/video.entity.integration-spec.ts` |
| `VideosService.createUpload` | Unit: `title` derivado de `original_filename` (sem extensão, truncado a 100) | `src/videos/videos.service.spec.ts` (estender) |

**Dependencies:** SI-04.1 — `categories` precisa existir para a FK

**Acceptance criteria:**

- `POST /videos` com `original_filename: "Minha aula.final.mp4"` retorna `201` e `GET /videos/{publicId}` traz `title: "Minha aula.final"`, `status: "draft"`, `visibility: "public"`, `category: null`, `view_count: 0`, `like_count: 0`, `dislike_count: 0`, `comment_count: 0`, `published_at: null`, `has_custom_thumbnail: false`
- Após `migration:run` sobre um banco com vídeos da Fase 03, nenhuma linha fica com `title` vazio
- Apagar uma categoria referenciada deixa `videos.category_id = NULL` (não falha)

---

### SI-04.3 — Implementar autenticação opcional e regra de leitura pública

**Description:** Permitir que rotas públicas conheçam o usuário quando há token e aplicar a regra "dono vê tudo; demais só `published`" em `GET /videos/{publicId}` e `GET /videos/{publicId}/playback`, preparando as Fases 05/06 sem duplicar rotas.

**Technical actions:**

1. Estender `src/auth/guards/jwt-auth.guard.ts`: em rota `@Public()`, se houver `Authorization: Bearer`, verificar o token e popular `request.user`; token inválido/expirado → 401 mesmo em rota pública; sem header → segue anônimo (per `video-channel-management/TD-07`; `### Authorization Matrix`).
2. Criar `src/auth/decorators/optional-user.decorator.ts` (`@OptionalUser()` → `JwtPayload | undefined`) para os controllers (per `nestjs-controllers.md`).
3. Estender `src/videos/videos-ownership.ts` com `loadReadable(user: JwtPayload | undefined, publicId)`: dono → qualquer status; outros → só `status = published`; rascunho de terceiro ou inexistente → `VideoNotFoundException` (404, não revela existência) (per `video-channel-management/TD-07`, `TD-02`).
4. Marcar `GET /videos/{publicId}` e `GET /videos/{publicId}/playback` como `@Public()` com `@OptionalUser()` e trocar `loadOwned` por `loadReadable` nessas duas rotas (as rotas de upload continuam `loadOwned`); atualizar os decorators Swagger (401 passa a ser "token presente e inválido") (per `### API Contracts`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `JwtAuthGuard` | Unit: rota pública sem header → passa sem `user`; com token válido → popula `user`; com token inválido → `UnauthorizedException`; rota protegida inalterada | `src/auth/guards/jwt-auth.guard.spec.ts` (estender) |
| `VideosOwnership.loadReadable` | Unit: dono vê draft; anônimo vê published; anônimo em draft → 404; autenticado não-dono em draft → 404; autenticado não-dono em published unlisted → ok | `src/videos/videos-ownership.spec.ts` (estender) |

**Dependencies:** SI-04.2 — `status`/`visibility` no modelo

**Acceptance criteria:**

- `GET /videos/{publicId}` de um vídeo `published` sem `Authorization` retorna `200`
- `GET /videos/{publicId}` de um rascunho sem token retorna `404` com `error: "VIDEO_NOT_FOUND"`; com token do dono retorna `200`
- `GET /videos/{publicId}` com `Authorization: Bearer invalido` retorna `401` mesmo para vídeo `published`
- `GET /videos/{publicId}/playback` de vídeo `published` + `ready` sem token retorna `200` com `stream_url`

---

### SI-04.4 — Endpoints PATCH /videos/{publicId}, POST …/publish e POST …/unpublish

**Route:** PATCH /videos/{publicId}
**Test Specs:** see `nestjs-project/specs/videos-edit-publish.plan.md`
**Authorization:** Owner — per `### Authorization Matrix` (401 anônimo; 403 `VIDEO_FORBIDDEN` autenticado não-dono)

**Description:** Entregar a edição parcial dos campos editoriais e as ações dedicadas de publicação/despublicação com as pré-condições de TD-02.

**Technical actions:**

1. Criar `src/videos/dto/update-video.dto.ts` (`title` `@IsOptional @IsString @Length(1,100)` com trim, `description` `@IsOptional @MaxLength(5000)` ou `null`, `category_id` `@IsOptional @IsUUID` ou `null`, `visibility` `@IsOptional @IsIn(VIDEO_VISIBILITIES)`) + validação "ao menos um campo" (per `### API Contracts → Validation Rules`; `phase-02-auth/TD-06`).
2. Criar as exceções `CategoryNotFoundException` (400), `VideoNotPublishableException` (409) em `src/videos/videos.exceptions.ts` (per `### Error Catalog`; `phase-02-auth/TD-07`).
3. Estender `VideosService` com `updateVideo(video, dto)` (valida `category_id` via `CategoriesService.findById`; salva; devolve `VideoResponse`), `publish(video)` (`processing_status = ready` e `title` não vazio senão `VideoNotPublishableException`; `status = published`; `published_at = now()` só se nulo; idempotente) e `unpublish(video)` (`status = draft`; preserva `visibility`/`published_at`; idempotente) (per `video-channel-management/TD-02`, `TD-03`).
4. Adicionar ao `VideosController` as rotas `PATCH /videos/:publicId` (200), `POST /videos/:publicId/publish` (200) e `POST /videos/:publicId/unpublish` (200) com `loadOwned` e decorators Swagger dos códigos de `### API Contracts` (per `nestjs-controllers.md`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.updateVideo/publish/unpublish` | Unit (repo e categorias mockados): `category_id` inexistente → `CATEGORY_NOT_FOUND`; publish com `processing` → `VIDEO_NOT_PUBLISHABLE`; publish com título vazio → idem; publish idempotente não reescreve `published_at`; unpublish preserva `visibility` | `src/videos/videos.service.spec.ts` (estender) |
| `VideosService.publish` | Integration (DB real): `published_at` gravado uma vez; `status` persistido | `src/videos/videos.service.integration-spec.ts` (estender) |
| `UpdateVideoDto` | E2E: uma requisição inválida (`title` vazio) → 400 `VALIDATION_ERROR` — prova do `ValidationPipe` | _(autorado via /plan-test-specs — ver `**Test Specs:**`)_ |

**Dependencies:** SI-04.1 (categorias), SI-04.2 (modelo), SI-04.3 (`VideosOwnership` estendido)

**Acceptance criteria:**

- `PATCH /videos/{publicId}` do dono com `{ title: "Novo", visibility: "unlisted" }` retorna `200` com `title: "Novo"` e `visibility: "unlisted"` e `status` inalterado
- `PATCH /videos/{publicId}` com `{}` retorna `400` com `error: "VALIDATION_ERROR"`; com `category_id` inexistente retorna `400` com `error: "CATEGORY_NOT_FOUND"`
- `POST /videos/{publicId}/publish` com `processing_status = processing` retorna `409` com `error: "VIDEO_NOT_PUBLISHABLE"`; com `ready` retorna `200` com `status: "published"` e `published_at` preenchido
- `POST /videos/{publicId}/unpublish` retorna `200` com `status: "draft"`, mantendo `visibility` e `published_at`
- Qualquer uma das três rotas por autenticado não-dono retorna `403` com `error: "VIDEO_FORBIDDEN"`

---

### SI-04.5 — Entrega pública de thumbnails com URL estável

**Description:** Tornar o prefixo `thumbnails/*` legível anonimamente no storage e trocar a thumbnail pré-assinada por uma URL pública estável com cache-busting, para grades anônimas e `next/image`.

**Technical actions:**

1. Estender o `storage-init` em `nestjs-project/compose.yaml` com `put-bucket-policy` (`Principal: "*"`, `s3:GetObject`, `Resource: arn:aws:s3:::$S3_BUCKET/thumbnails/*`), idempotente, com log "storage-init: policy pública de thumbnails aplicada" (per `video-channel-management/TD-10`; `phase-03-upload-processing/TD-10`).
2. Criar `StorageService.publicUrl(key)` → `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${key}` (path-style, per `phase-03/TD-02`) e `VideosService.thumbnailUrl(video)` → `publicUrl(custom_thumbnail_key ?? thumbnail_key) + '?v=' + updated_at epoch`, ou `null` (per `### API Contracts → Shapes compartilhados`).
3. Substituir `presignThumbnail` em `getVideo`/`getPlayback` pela URL estável; registrar em `nestjs-project/CLAUDE.md` o smoke test (`curl -sI $S3_PUBLIC_ENDPOINT/$S3_BUCKET/thumbnails/x/auto.jpg` → 200/404 sem credenciais; `…/videos/x/source` → 403) e o fallback para URL pré-assinada se a policy falhar no RustFS (per `TD-10`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `StorageService.publicUrl` | Unit: compõe endpoint público + bucket + chave | `src/storage/storage.service.spec.ts` (estender) |
| `VideosService.thumbnailUrl` | Unit: prefere `custom_thumbnail_key`; `null` sem chaves; `?v=` muda com `updated_at` | `src/videos/videos.service.spec.ts` (estender) |
| bucket policy | Integration (RustFS real): `GET` anônimo de `thumbnails/<x>` → 200 após `putObject`; `GET` anônimo de `videos/<x>` → 403 | `src/storage/storage.service.integration-spec.ts` (estender) |

**Dependencies:** SI-04.2 — `custom_thumbnail_key` e `updated_at` no modelo

**Acceptance criteria:**

- `curl -sI "$S3_PUBLIC_ENDPOINT/$S3_BUCKET/thumbnails/<publicId>/auto.jpg"` sem credenciais retorna `200` para um vídeo processado
- `curl -sI "$S3_PUBLIC_ENDPOINT/$S3_BUCKET/videos/<publicId>/source"` sem credenciais retorna `403`
- `GET /videos/{publicId}` retorna `thumbnail_url` sem query de assinatura (`X-Amz-*`), com sufixo `?v=`

---

### SI-04.6 — Endpoints PUT e DELETE /videos/{publicId}/thumbnail

**Route:** PUT /videos/{publicId}/thumbnail
**Test Specs:** see `nestjs-project/specs/videos-thumbnail.plan.md`
**Authorization:** Owner — per `### Authorization Matrix`

**Description:** Receber a thumbnail customizada pela API, validar pelos bytes, normalizar para JPEG 1280×720 e gravar no storage, com reversão para a automática.

**Technical actions:**

1. Adicionar `sharp` ao `package.json` do backend (`npm install sharp` no container; prebuilt N-API, Node 25 compatível) e `THUMBNAIL_MAX_BYTES` (default 5 MiB) ao namespace `upload` + schema Joi (per `video-channel-management/TD-04`; `phase-01-configuracao-base/TD-02`).
2. Criar `src/videos/thumbnail.processor.ts`: `sharp(buffer).metadata()` confirma formato JPEG/PNG/WebP e dimensões ≥ 640×360 (senão `ThumbnailInvalidException` 400); `resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 })` (per `TD-04`).
3. Estender `VideosService` com `setCustomThumbnail(video, buffer)` (`storage.putObject('thumbnails/{public_id}/custom.jpg', jpeg, 'image/jpeg')`, grava `custom_thumbnail_key`) e `removeCustomThumbnail(video)` (`deleteObject` tolerando `NoSuchKey`, anula a chave; idempotente) (per `### API Contracts`).
4. Adicionar ao `VideosController` `PUT /videos/:publicId/thumbnail` com `@UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: THUMBNAIL_MAX_BYTES } }))` (limite excedido → `ThumbnailTooLargeException` 413; sem campo → 400 `VALIDATION_ERROR`; `@ApiConsumes('multipart/form-data')`) e `DELETE /videos/:publicId/thumbnail` (204) (per `nestjs-controllers.md`; `openapi-docs-nestjs`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `thumbnail.processor.ts` | Unit (buffers gerados com `sharp` em memória): PNG 800×450 → JPEG 1280×720; 320×180 → `THUMBNAIL_INVALID`; bytes não-imagem → `THUMBNAIL_INVALID` | `src/videos/thumbnail.processor.spec.ts` |
| `VideosService.setCustomThumbnail/removeCustomThumbnail` | Integration (RustFS real): objeto `custom.jpg` criado e removido; `custom_thumbnail_key` gravada/anulada; `thumbnail_url` alterna | `src/videos/videos.service.integration-spec.ts` (estender) |

**Dependencies:** SI-04.2 (modelo), SI-04.5 (URL estável)

**Acceptance criteria:**

- `PUT /videos/{publicId}/thumbnail` do dono com `file` PNG 1920×1080 de 1 MB retorna `200` com `has_custom_thumbnail: true` e `thumbnail_url` apontando para `thumbnails/{publicId}/custom.jpg`; o objeto no storage é JPEG 1280×720
- `PUT …/thumbnail` com arquivo de 6 MB retorna `413` com `error: "THUMBNAIL_TOO_LARGE"`; com um `.txt` renomeado retorna `400` com `error: "THUMBNAIL_INVALID"`
- `DELETE …/thumbnail` retorna `204` e `GET /videos/{publicId}` volta a `has_custom_thumbnail: false` com `thumbnail_url` da automática; repetir o `DELETE` retorna `204`

---

### SI-04.7 — Endpoints GET/PATCH /channels/me e GET /channels/{nickname}

**Route:** PATCH /channels/me
**Test Specs:** see `nestjs-project/specs/channels-me.plan.md`
**Authorization:** Authenticated (próprio canal) para `/channels/me`; Anonymous para `/channels/{nickname}` — per `### Authorization Matrix`

**Description:** Expor a leitura e a edição do canal do usuário (nickname, nome e descrição) e a leitura pública por nickname, com a política de nickname de TD-08.

**Technical actions:**

1. Criar `src/channels/channels.controller.ts` com `GET /channels/me`, `PATCH /channels/me` e `GET /channels/:nickname` (`@Public()`); mover a rota literal `me` antes de `:nickname`; DTOs `update-channel.dto.ts` (`nickname` `@Matches(/^[a-z0-9_]{3,50}$/)` + `@NotIn(RESERVED_NICKNAMES)` custom, `name` `@Length(1,50)`, `description` `@MaxLength(1000)` ou `null`; ao menos um campo) e `channel-response.dto.ts` (`ChannelResponse`, `ChannelPublicResponse`) anotados (per `### API Contracts`; `video-channel-management/TD-08`; `nestjs-dtos.md`).
2. Estender `ChannelsService` com `findByNickname`, `updateChannel(userId, dto)` (pré-checagem de nickname + captura de unique violation `23505` → `NicknameTakenException` 409, reaproveitando `isPgUniqueViolationOnColumn`) e `countPublicVideos(channelId)` (`status = published AND visibility = public`) (per `TD-08`, `TD-02`).
3. Criar `src/channels/channels.exceptions.ts` (`NicknameTakenException` 409, `ChannelNotFoundException` 404) e `RESERVED_NICKNAMES` em `src/channels/channels.constants.ts` (per `### Error Catalog`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ChannelsService.updateChannel` | Unit (DataSource mockado): nickname reservado nunca chega ao banco; conflito pré-checado → `NICKNAME_TAKEN`; unique violation → `NICKNAME_TAKEN` | `src/channels/channels.service.spec.ts` (estender) |
| `ChannelsService.updateChannel/countPublicVideos` | Integration (DB real): nickname trocado libera o antigo; `countPublicVideos` ignora drafts e unlisted | `src/channels/channels.service.integration-spec.ts` |
| `UpdateChannelDto` | E2E: `nickname: "Ab"` → 400 `VALIDATION_ERROR` — prova do `ValidationPipe` | _(autorado via /plan-test-specs — ver `**Test Specs:**`)_ |

**Dependencies:** SI-04.2 — `status`/`visibility` para `video_count`

**Acceptance criteria:**

- `GET /channels/me` com token retorna `200` com `{ id, nickname, name, description, video_count, created_at, updated_at }`; sem token retorna `401`
- `PATCH /channels/me` com `{ nickname: "novo_nick" }` retorna `200` e `GET /channels/novo_nick` passa a retornar `200` enquanto `GET /channels/<antigo>` retorna `404` com `error: "CHANNEL_NOT_FOUND"`
- `PATCH /channels/me` com nickname de outro canal retorna `409` com `error: "NICKNAME_TAKEN"`; com `nickname: "admin"` retorna `400` com `error: "VALIDATION_ERROR"`
- `GET /channels/{nickname}` sem token retorna `200` com `{ nickname, name, description, video_count, created_at }` e `video_count` conta só vídeos `published` + `public`

---

### SI-04.8 — Endpoints de listagem GET /channels/me/videos e GET /channels/{nickname}/videos

**Route:** GET /channels/me/videos
**Test Specs:** see `nestjs-project/specs/channels-videos.plan.md`
**Authorization:** Authenticated (próprio canal) para `/channels/me/videos`; Anonymous para `/channels/{nickname}/videos` (só `published` + `public`) — per `### Authorization Matrix`

**Description:** Entregar as duas listagens paginadas por cursor keyset — painel do dono (com filtros, busca, ordenação e `total`) e página pública do canal — base também das listagens das Fases 05/07.

**Technical actions:**

1. Criar `src/common/pagination/cursor.ts` (`encodeCursor({ sortValue, id })` → base64url; `decodeCursor` → 400 `VALIDATION_ERROR` em cursor inválido) e `src/common/pagination/cursor-page.dto.ts` (`CursorPage<T>` com `items`, `next_cursor`; variante com `total`) (per `video-channel-management/TD-06`).
2. Criar `src/videos/dto/list-owner-videos.dto.ts` (`limit` 1..50 default 20, `cursor`, `status`, `visibility`, `processing_status`, `q` ≤ 100, `sort` `latest|oldest|views`, `from`/`to` `@IsDateString` com `from ≤ to`) e `list-channel-videos.dto.ts` (`limit`, `cursor`, `sort` `latest|popular|oldest`) (per `### API Contracts → Validation Rules`).
3. Criar `src/videos/videos-listing.service.ts` com `listOwnerVideos(channelId, query)` (QueryBuilder keyset `(sort_col, id)` com `limit + 1` para calcular `next_cursor`; `COUNT` separado para `total`; `ILIKE` em `title`; filtros) e `listChannelPublicVideos(channelId, query)` (`status = published AND visibility = public`; `published_at`/`view_count` como chave) devolvendo `VideoListItem[]` / `VideoCardItem[]` com `thumbnail_url` (per `TD-06`, `TD-05`, `TD-10`; `typeorm-queries.md`).
4. Adicionar `GET /channels/me/videos` e `GET /channels/:nickname/videos` (`@Public()`) ao `ChannelsController`, resolvendo o canal por `user.sub` ou por nickname (404 `CHANNEL_NOT_FOUND`) e delegando ao `VideosListingService` (`ChannelsModule` importa `VideosModule` que exporta o serviço — sem dependência circular: `VideosModule` já importa `ChannelsModule`, então o listing service vive em `VideosModule` e `ChannelsController` o recebe via `forwardRef` **ou** o controller das listagens fica em `src/videos/channel-videos.controller.ts` dentro do `VideosModule` com `@Controller('channels')` — preferir a segunda forma, sem `forwardRef`) (per `nestjs-modules.md`, `arch-avoid-circular-deps`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `cursor.ts` | Unit: round-trip encode/decode; cursor corrompido → `VALIDATION_ERROR` | `src/common/pagination/cursor.spec.ts` |
| `VideosListingService` | Integration (DB real, 25 vídeos semeados): página 1 com 20 + `next_cursor`, página 2 com 5 e `next_cursor: null`, sem duplicatas quando um vídeo é inserido entre as páginas; filtros `status`/`visibility`/`q`/`from-to`; `total` ignora o cursor; pública exclui draft/unlisted; `popular` ordena por `view_count` | `src/videos/videos-listing.service.integration-spec.ts` |
| `ListOwnerVideosDto` | E2E: `limit=500` → 400 `VALIDATION_ERROR` — prova do `ValidationPipe` | _(autorado via /plan-test-specs — ver `**Test Specs:**`)_ |

**Dependencies:** SI-04.2 (modelo e índices), SI-04.5 (`thumbnail_url`), SI-04.7 (lookup por nickname e `ChannelsController`)

**Acceptance criteria:**

- `GET /channels/me/videos` com token e 25 vídeos retorna `200` com `items.length = 20`, `total = 25` e `next_cursor` não nulo; `GET /channels/me/videos?cursor=<next_cursor>` retorna os 5 restantes e `next_cursor: null`
- `GET /channels/me/videos?status=draft&q=aula` retorna só rascunhos cujo `title` contém "aula" (case-insensitive) e `total` corresponde ao filtro
- `GET /channels/{nickname}/videos` sem token retorna `200` apenas com vídeos `published` + `public`, cada item com `{ public_id, title, thumbnail_url, duration_seconds, view_count, published_at, channel: { nickname, name } }`
- `GET /channels/{nickname}/videos?sort=popular` ordena por `view_count` decrescente; `?cursor=xxx` inválido retorna `400` com `error: "VALIDATION_ERROR"`; nickname inexistente retorna `404` com `error: "CHANNEL_NOT_FOUND"`

---

### SI-04.9 — Endpoint DELETE /videos/{publicId} e job video.delete

**Route:** DELETE /videos/{publicId}
**Test Specs:** see `nestjs-project/specs/videos-delete.plan.md`
**Authorization:** Owner — per `### Authorization Matrix`

**Description:** Excluir um vídeo do dono com hard delete transacional e liberar os objetos no storage por um job do worker, no mesmo padrão transacional da Fase 03.

**Technical actions:**

1. Estender `VideosService` com `deleteVideo(video)`: se há `VideoUpload` `active`, `storage.abortMultipartUpload` (tolera `NoSuchUpload`); em `dataSource.transaction`: `DELETE` do `Video` (a sessão cai em cascata) e `queue.send('video.delete', payload de ### Events/Messages, { singletonKey: 'video-delete:<videoId>', retryLimit: 3, retryBackoff: true })` com o `EntityManager` adaptado à opção `db` como no `completeUpload` (per `video-channel-management/TD-09`; `phase-03-upload-processing/TD-11`).
2. Adicionar `DELETE /videos/:publicId` (204) ao `VideosController` com `loadOwned` e decorators Swagger (per `### API Contracts`; `nestjs-controllers.md`).
3. Criar `src/worker/video-deletion.worker.ts` (handler de `video.delete`: `deleteObject` para `storageKey` e cada `thumbnailKeys[]`, tolerando `NoSuchKey`; outro erro relança; na última tentativa loga `video.delete failed` com as chaves restantes) e registrá-lo no `WorkerModule`; adicionar o nome da fila em `queue.constants.ts` (per `TD-09`; `phase-03/TD-05`).
4. Documentar em `nestjs-project/CLAUDE.md` o pipeline de `video.delete` e a pendência operacional (objetos completos não têm lifecycle) (per `TD-09`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.deleteVideo` | Unit (storage/fila mockados): aborta sessão ativa antes de apagar; payload com chaves não nulas; sem thumbnail customizada → `thumbnailKeys` só com a automática | `src/videos/videos.service.spec.ts` (estender) |
| `VideosService.deleteVideo` | Integration (DB + pg-boss reais): linha e sessão removidas; job `video.delete` existe com `singletonKey`; rollback (erro simulado no `send`) mantém o vídeo | `src/videos/videos.service.integration-spec.ts` (estender) |
| `VideoDeletionWorker` | Integration (RustFS real): remove `source` e thumbnails; chave inexistente não falha | `src/worker/video-deletion.worker.integration-spec.ts` |

**Dependencies:** SI-04.2 (modelo), SI-04.6 (`custom_thumbnail_key` no payload)

**Acceptance criteria:**

- `DELETE /videos/{publicId}` do dono de um vídeo `ready` retorna `204`; `GET /videos/{publicId}` passa a retornar `404`; após o worker processar, `headObject` de `videos/{publicId}/source` e das thumbnails retorna ausente
- `DELETE /videos/{publicId}` de um vídeo com upload `active` retorna `204` e o multipart deixa de existir no storage
- `DELETE /videos/{publicId}` por autenticado não-dono retorna `403` com `error: "VIDEO_FORBIDDEN"`; inexistente retorna `404`

---

### SI-04.10 — Sincronizar contrato OpenAPI, aliases e handlers MSW

**Description:** Propagar os contratos novos/modificados do backend ao frontend pela cadeia OpenAPI e preparar os fixtures MSW por domínio que as SIs de BFF e de telas consomem.

**Technical actions:**

1. No container do backend: `npm run openapi:export`; no host: `bash scripts/sync-openapi.sh`; no container do frontend: `npm run openapi:types` — commitar `nestjs-project/openapi.json`, `next-frontend/openapi.json` e `next-frontend/lib/api/types.gen.ts` juntos (per `next-frontend-openapi-typing/TD-02`, `TD-03`; `openapi-docs-nestjs/TD-02`).
2. Estender `next-frontend/lib/api/contracts.ts` com aliases pass-through (`Category`, `Video`, `VideoListItem`, `VideoCardItem`, `Channel`, `ChannelPublic`, `OwnerVideosPage`, `ChannelVideosPage`, `UpdateVideoInput`, `UpdateChannelInput`, mais os de upload da Fase 03 ainda não aliasados) a partir de `paths` (per `next-frontend-openapi-typing/TD-04`).
3. Criar `next-frontend/mocks/handlers/{videos,channels,categories}.ts` tipados via `paths` (`HttpResponse.json<paths[...]>`) com fixtures determinísticos para todos os endpoints de `### API Contracts` (backend tier) e trigger fixtures reservados (`publicId` `notfound-id` → 404, `forbidden-id` → 403, `processing-id` → `processing_status: processing`, nickname `taken_nick` → 409 `NICKNAME_TAKEN`) + `mocks/factories/videos.ts` para listas (per `next-frontend-msw-foundation/TD-01`, `TD-03`, `TD-04`; `next-frontend-openapi-typing/TD-05`; `next-frontend-msw-mocks.md`).
4. Registrar os três módulos no barrel `mocks/handlers/index.ts` e documentar os triggers em `next-frontend/CLAUDE.md` § E2E architecture.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/api/types.gen.ts` + `openapi.json` | Gate de frescura: `bash scripts/sync-openapi.sh && npm run openapi:types` sem diff (`.github/workflows/openapi-freshness.yml`) | _(CI)_ |
| `mocks/handlers/*` | Type-check: `npx tsc --noEmit` prova que todo fixture bate com `paths` | _(build gate)_ |

**Dependencies:** SI-04.1, SI-04.2, SI-04.3, SI-04.4, SI-04.5, SI-04.6, SI-04.7, SI-04.8, SI-04.9 — o export só reflete os controllers finais

**Acceptance criteria:**

- `next-frontend/lib/api/types.gen.ts` contém `paths` para `/categories`, `/videos/{publicId}` (`patch`, `delete`), `/videos/{publicId}/publish`, `/videos/{publicId}/unpublish`, `/videos/{publicId}/thumbnail`, `/channels/me`, `/channels/me/videos`, `/channels/{nickname}`, `/channels/{nickname}/videos`
- `git diff --exit-code nestjs-project/openapi.json next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` é vazio após rerodar a cadeia
- `docker compose exec next-frontend npx tsc --noEmit` passa com os novos handlers e aliases

---

### SI-04.11 — Estratégia de dados do frontend — RSC, polling e invalidação (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### video-channel-management/TD-12 — Estratégia de dados do frontend — RSC, polling e invalidação`

**Technical actions:**

1. Nenhuma biblioteca a instalar (`**Libraries:** —` em `video-channel-management/TD-12`); registrar no `next-frontend/CLAUDE.md` § Architecture a regra "leituras em RSC via `upstream`; mutações em Route Handlers + `router.refresh()`; polling só para processamento" (per `TD-12`).
2. Implementar o **Setup snippet** byte-verbatim de `### Frontend Runtime → #### video-channel-management/TD-12 → Setup` em `next-frontend/hooks/use-processing-poll.ts` (`POLL_INTERVAL_MS = 3_000`, `TERMINAL = new Set(["ready", "failed"])`, `fetch('/api/videos/{publicId}')`, `router.refresh()` ao atingir estado terminal) estendendo com o boilerplate derivável (`useEffect`/`setInterval`, cleanup, `useRouter`).
3. Criar `next-frontend/app/(app)/studio/layout.tsx` (RSC: `getSession()`; sem sessão → `redirect('/login?returnTo=' + pathname)`; monta `<UploadProvider>` de `components/upload/upload-provider.tsx` — canonical shape do Setup, com `beforeunload` só enquanto há upload em voo; o uploader em si é SI-04.14) (per `TD-12`, `TD-11`; `phase-02-auth-frontend/TD-06`).

**Dependencies:** —

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Acceptance criteria:**

- Setup snippet's F2-load-bearing content (`POLL_INTERVAL_MS = 3_000`, `TERMINAL` set, `fetch('/api/videos/${publicId}')`, `router.refresh()` on terminal; `<UploadProvider>` em `app/(app)/studio/layout.tsx`) present byte-verbatim from the Frontend Runtime spec.
- `GET /studio/videos` sem cookie de sessão redireciona para `/login?returnTo=/studio/videos`; com sessão renderiza o layout do estúdio.
- Application boots without runtime error related to the new pattern (`docker compose exec next-frontend npx tsc --noEmit` e `npm run dev` servem `/studio/videos` com sessão).

---

### SI-04.12 — Route Handlers BFF de vídeos, upload e canal

**Route:** PATCH /api/videos/{publicId} (e demais rotas do BFF tier)
**Authorization:** Authenticated (sessão `iron-session`) — o Route Handler injeta `Authorization: Bearer` e deixa a matriz de propriedade para o upstream — per `### Authorization Matrix`

**Description:** Entregar as rotas same-origin que o navegador chama (fluxo de upload, polling, mutações de vídeo, thumbnail e canal), proxiando o upstream com o helper de refresh e aplicando as duas projeções decididas (publicação encadeada e `channelSlug` na sessão).

**Technical actions:**

1. Criar `app/api/videos/route.ts` (`POST`) e `app/api/videos/[publicId]/{route.ts (GET, PATCH, DELETE), publish/route.ts, unpublish/route.ts, thumbnail/route.ts (PUT, DELETE), upload/route.ts (GET, DELETE), upload/parts/route.ts (POST), upload/complete/route.ts (POST)}` usando `upstream` + `withRefresh` (`lib/auth/refresh.ts`) e devolvendo o envelope do upstream pass-through com o mesmo status (per `### API Contracts → BFF tier`; `next-frontend-bff-api.md`; `phase-02-auth-frontend/TD-03`, `TD-05`).
2. Em `PATCH /api/videos/[publicId]`: aceitar `UpdateVideoInput & { publish?: boolean }`; após o `PATCH` upstream, se `publish !== false` e a resposta tem `status = draft`, `processing_status = ready` e `title` não vazio, chamar `POST /videos/{publicId}/publish`; responder `{ video, published }`; `409 VIDEO_NOT_PUBLISHABLE` do `publish` vira `published: false` com 200 (per `video-channel-management/TD-03` Revisions 2026-10-18).
3. Em `PUT /api/videos/[publicId]/thumbnail`: repassar o `FormData` recebido (`request.formData()` → novo `FormData` com `file`) ao upstream via `upstream.PUT` com `body` multipart (sem `Content-Type` manual) (per `### API Contracts → PUT /api/videos/{publicId}/thumbnail`).
4. Criar `app/api/channel/route.ts` (`PATCH` → `PATCH /channels/me`); quando a resposta traz `nickname ≠ session.channelSlug`, atualizar `session.channelSlug` e `session.save()` (per `TD-08`; `phase-02-auth-frontend/TD-02`).
5. Documentar as rotas em `next-frontend/CLAUDE.md` § Project Structure (`app/api/videos/**`, `app/api/channel`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/[publicId]/route.ts` (PATCH) | Integration (Route Handler como função + MSW): encadeia `publish` quando draft+ready+título; não encadeia quando `processing`; `publish: false` não encadeia; `VIDEO_NOT_PUBLISHABLE` → `published: false`; 401 upstream → refresh → retry | `app/api/videos/[publicId]/__tests__/route.integration.test.ts` |
| `app/api/videos/[publicId]/thumbnail/route.ts` | Integration: repassa multipart com campo `file`; 413 pass-through | `app/api/videos/[publicId]/thumbnail/__tests__/route.integration.test.ts` |
| `app/api/videos/route.ts` + `upload/*` | Integration: `POST /api/videos` pass-through 201; `complete` 202; `DELETE upload` 204; 409 `UPLOAD_NOT_ACTIVE` pass-through | `app/api/videos/__tests__/route.integration.test.ts`, `app/api/videos/[publicId]/upload/__tests__/route.integration.test.ts` |
| `app/api/channel/route.ts` | Integration: reescreve `channelSlug` na sessão quando o nickname muda; 409 `NICKNAME_TAKEN` pass-through | `app/api/channel/__tests__/route.integration.test.ts` |
| `app/api/videos/[publicId]/publish|unpublish/route.ts`, `DELETE` | Integration: pass-through de 200/204/403/409 | `app/api/videos/[publicId]/__tests__/actions.integration.test.ts` |

**Dependencies:** SI-04.10 (tipos e handlers MSW)

**Acceptance criteria:**

- `PATCH /api/videos/{publicId}` com sessão válida e corpo `{ title: "x" }` sobre um rascunho `ready` responde `200` com `{ video: { status: "published", … }, published: true }`; sobre um rascunho `processing` responde `200` com `published: false`
- `PATCH /api/channel` com `{ nickname: "novo" }` responde `200` e o cookie de sessão reemitido carrega `channelSlug: "novo"`
- `PUT /api/videos/{publicId}/thumbnail` com `FormData` contendo `file` responde com o status e o corpo do upstream (200 ou 400/413 com o envelope)
- Qualquer rota sem cookie de sessão responde `401`; nenhuma rota expõe `access_token`/`refresh_token` no corpo

---

### SI-04.13 — `components/layout/app-header.tsx` → Estratégia de dados do frontend (links do estúdio)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### video-channel-management/TD-12 — Estratégia de dados do frontend — RSC, polling e invalidação` → Migração row for `next-frontend/components/layout/app-header.tsx`

**Technical actions:**

1. Read `components/layout/app-header.tsx` → identificar o header mínimo da Fase 02 (logo + e-mail + "Sair"; "Entrar"/"Criar conta" para visitante).
2. Refactor `components/layout/app-header.tsx`: para sessão autenticada, acrescentar `<Link href="/studio/videos">Meus vídeos</Link>` e `<Link href="/studio/channel">Meu canal</Link>` antes de "Sair"; para visitante, manter "Entrar"/"Criar conta" (resolução OQ-3; per `TD-12`).
3. Atualizar `components/layout/__tests__/app-header.test.tsx` para os novos links.

**Dependencies:** SI-04.11 (Setup — o layout do estúdio precisa existir para os links terem destino)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/app-header.tsx` | Unit per testing-guide-next-frontend § "Client Components" — com sessão: links "Meus vídeos"/"Meu canal" com `href` corretos + "Sair"; sem sessão: nenhum link de estúdio; testes anteriores do header continuam passando | `components/layout/__tests__/app-header.test.tsx` |

**Acceptance criteria:**

- `components/layout/app-header.tsx` renderiza, com sessão, links para `/studio/videos` e `/studio/channel` (grep-verifiable) e, sem sessão, não os renderiza.
- All pre-existing tests for `app-header.tsx` still pass.
- New tests asserting the new links pass.

---

### SI-04.14 — Implementar cliente de upload multipart no navegador

**Description:** Entregar o módulo próprio que orquestra o protocolo multipart da Fase 03 a partir do navegador (fatiamento, pool de concorrência, retry, retomada, progresso, cancelamento) e o `UploadProvider` que mantém o envio vivo durante a navegação no estúdio.

**Technical actions:**

1. Criar `lib/upload/multipart-uploader.ts`: `startUpload({ file, created: VideoCreatedResponse })` → fatia por `part_size`, pede URLs em lotes de até 100 a `POST /api/videos/{publicId}/upload/parts`, faz `PUT` direto em cada `url` (`S3_PUBLIC_ENDPOINT`) com pool de 4 concorrentes, coleta `ETag`, retry com backoff (3×) por parte, repede o lote quando a URL expira (403), e ao fim chama `POST /api/videos/{publicId}/upload/complete`; expõe `progress` (bytes enviados/total), `cancel()` (`AbortController`) e `resume()` via `GET /api/videos/{publicId}/upload` (pula `uploaded_parts`) (per `video-channel-management/TD-11`; `phase-03-upload-processing/TD-03`).
2. Implementar `components/upload/upload-provider.tsx` (`"use client"`; contexto com `uploads: Map<publicId, { file, progress, status, error }>`; `start`, `cancel`, `resume`; `beforeunload` só enquanto há upload `uploading`) e o hook `useUpload(publicId)` (per `TD-11`; Setup de `### Frontend Runtime`).
3. Registrar o cliente em `next-frontend/CLAUDE.md` § Architecture (exceção explícita ao Strict BFF: só os `PUT` das partes vão ao storage).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/upload/multipart-uploader.ts` | Unit (MSW para `/api/videos/**` + `fetch` do storage interceptado por handler MSW em `S3_PUBLIC_ENDPOINT` de teste): fatiamento correto (última parte menor), pool ≤ 4, retry após falha de parte, retomada pula partes já aceitas, `complete` recebe `{ part_number, etag }` de todas as partes, `cancel` aborta e chama `DELETE …/upload` | `lib/upload/__tests__/multipart-uploader.test.ts` |
| `components/upload/upload-provider.tsx` + `useUpload` | Unit (`renderHook`, jsdom): `start` cria entrada com `progress 0`; progresso propaga; `beforeunload` registrado só durante `uploading` | `components/upload/__tests__/upload-provider.test.tsx` |

**Dependencies:** SI-04.11 (Setup — provider montado no layout), SI-04.12 (rotas BFF do fluxo de upload)

**Acceptance criteria:**

- Com `UPLOAD_PART_SIZE` de 5 MiB e um arquivo de 12 MiB, o uploader envia 3 partes (5, 5, 2 MiB), chama `complete` com 3 ETags e a API responde `202`
- Uma falha transitória (500) no `PUT` de uma parte é retentada e o upload termina com sucesso sem reenviar as partes já aceitas
- `cancel()` interrompe os `PUT` em andamento e `GET /api/videos/{publicId}/upload` passa a responder `409 UPLOAD_NOT_ACTIVE`
- Navegar entre `/studio/upload/{publicId}` e `/studio/videos` não interrompe o envio; o progresso continua disponível ao voltar

---

### SI-04.15.0 — Drift audit: Upload de vídeo (escolha do arquivo)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1724 _(frame não inventariado — cota do Figma MCP; se a leitura falhar de novo, auditar só os componentes reutilizados em disco e registrar o frame como `componente ausente` por indisponibilidade)_
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload de vídeo (escolha do arquivo)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1724
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/card.tsx`, `components/ui/button.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`upload-dropzone`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/studio/upload/page.tsx` + `components/upload/upload-dropzone.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection. Write a `## Screen: upload-de-video — audited at SI-04.15.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md`. **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-04.0.1

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: upload-de-video` exists with the current run's date in heading.
- Every component in the Reused DS list has exactly one row in the table, with a populated Decision column per the status enum (`alinhado → skip`; `drift menor → auto-Edit/exception`; `drift relevante → auto-Edit/exception/CONFLICT`; `componente ausente → create`), and every `exception` carries a one-liner.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.15a — Tela de Upload de vídeo (escolha do arquivo) (visual shell)

**Route:** /studio/upload
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1724 _(não inventariado — shell derivado do UI Contract; se o Figma MCP seguir sem cota, gerar o shell a partir do contrato e dos primitivos)_
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload de vídeo (escolha do arquivo)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: upload-de-video`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; for each row apply the Decision verb (`auto-Edit` → Edit the DS file; `create` → create; `exception`/`skip` → no-op; `CONFLICT: …; <verb>` → apply `<verb>`). No re-judgment.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1724
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/card.tsx`, `components/ui/button.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`upload-dropzone`]
   - Target paths: `app/(app)/studio/upload/page.tsx` + `components/upload/upload-dropzone.tsx` (shell visual: dropzone com estados idle/dragging/erro, instruções "MP4 or WebM, up to 10 GB", botão "Select file")

**Dependencies:** SI-04.15.0 + SI-04.0.1, SI-04.11

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches the UI Contract (título "Upload video", dropzone, botão) within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.15b — Tela de Upload de vídeo (escolha do arquivo) (lógica & wiring)

**Test Specs:** see `next-frontend/specs/studio-upload.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload de vídeo (escolha do arquivo)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Authenticated`: coberto pelo `app/(app)/studio/layout.tsx` (SI-04.11) que redireciona sem sessão para `/login?returnTo=/studio/upload`; a página não repete a checagem.
2. **Rendering strategy application** — página RSC mínima; `components/upload/upload-dropzone.tsx` recebe `"use client"` (estado idle/dragging/erro, `<input type="file" accept="video/mp4,video/webm">` real com `<label>`).
3. **Endpoint wiring** — ao aceitar um arquivo: validar localmente (`content_type`, `size_bytes ≤ 10 GiB`) → `fetch('/api/videos', { method: 'POST', body: { original_filename, content_type, size_bytes } })` tipado por `UpdateVideoInput`/`VideoCreated` de `@/lib/api/contracts` → `useUpload().start(file, created)` → `router.push('/studio/upload/{public_id}')` (per `### API Contracts → POST /api/videos`; `TD-11`).
4. **Error mapping** — `VIDEO_UNSUPPORTED_MEDIA_TYPE` → "Only MP4 and WebM files are supported"; `VIDEO_TOO_LARGE` → "Files must be 10 GB or smaller"; `STORAGE_UNAVAILABLE` → toast com retry; `401` → redirect `/login?returnTo=`; fallback genérico (per `### UI Contracts → Error Catalog → UX mapping`).
5. **Client-side validation mirror** — `content_type ∈ {video/mp4, video/webm}`, `size_bytes` 1..10 GiB, `original_filename` 1..255: validar antes de qualquer chamada e desabilitar o envio quando inválido.

**Dependencies:**

- `SI-04.15a` (visual shell must exist before wiring).
- Backend SIs: nenhuma nova — `POST /videos` é da Fase 03; BFF `SI-04.12`; uploader/provider `SI-04.14`.
- Shared-types SI: `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/upload/upload-dropzone.tsx` | Unit per testing-guide-next-frontend § "Client Components" — arquivo válido chama `POST /api/videos` (MSW) e `start`+`router.push`; tipo inválido mostra erro sem fetch; mapeamento de `VIDEO_TOO_LARGE`/`VIDEO_UNSUPPORTED_MEDIA_TYPE` | `components/upload/__tests__/upload-dropzone.test.tsx` |

E2E for the page (auth guard redirects, page-level routing, full user flows) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- Escolher um `.mp4` válido dispara `POST /api/videos` com `{ original_filename, content_type: "video/mp4", size_bytes }` e navega para `/studio/upload/{public_id}` com o envio já em andamento.
- Escolher um `.mov` mostra a mensagem inline sem nenhuma chamada ao BFF.
- Sem sessão, `/studio/upload` redireciona para `/login?returnTo=/studio/upload`.
- Client-side validation matches BE Validation Rules 1:1 (tipos e limite de tamanho).

---

### SI-04.16.0 — Drift audit: Upload em processamento (Upload video processing)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload em processamento (Upload video processing)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/card.tsx`, `components/ui/label.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/progress.tsx`, `components/ui/button.tsx`, `components/ui/section-header.tsx`, `components/icons/video-file-icon.tsx`, `components/upload/upload-status-row.tsx`, `components/upload/upload-status-badge.tsx`, `components/studio/video-config-card.tsx`, `components/studio/video-preview.tsx`, `components/studio/copy-link-button.tsx`, `components/studio/thumbnail-preview.tsx`, `components/studio/category-select.tsx`, `components/studio/privacy-option.tsx`, `components/studio/video-checks-status.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`upload-status-row`, `upload-status-badge`, `processing-checks-status`, `video-config-card`, `thumb-upload`, `thumbnail-upload-button`, `upload-video-form`, `category-select`, `privacy-option`, `copy-link-button`, `cancel-upload`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/studio/upload/[publicId]/page.tsx` + `components/upload/upload-video-form.tsx`

   Value-level diff per component, 4-value status enum, Decision per default policy, `prior_decisions` from earlier sections, write `## Screen: upload-em-processamento — audited at SI-04.16.0 ({YYYY-MM-DD})` to `frontend-drift-report.md`. **No code edits.**

**Dependencies:** SI-04.0.1, SI-04.0.6, SI-04.0.7, SI-04.0.9, SI-04.0.11, SI-04.0.13, SI-04.0.14

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` has section `## Screen: upload-em-processamento` with the current run's date; one row per Reused DS component with a populated Decision; every `exception` justified.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.16a — Tela de Upload em processamento (visual shell)

**Route:** /studio/upload/{publicId}
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload em processamento (Upload video processing)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: upload-em-processamento`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; apply each Decision verb mechanically (`auto-Edit` / `create` / `exception` / `skip`; strip any `CONFLICT:` prefix and apply its verb).
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110
   - Reused DS components: [lista de SI-04.16.0] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [lista de SI-04.16.0]
   - Target paths: `app/(app)/studio/upload/[publicId]/page.tsx` + `components/upload/upload-video-form.tsx` (compõe a linha de status + o mesmo formulário de `components/studio/video-edit-form.tsx` da SI-04.18b; título "Upload video" per OQ-9; status/badge/progress por estado; rodapé com Cancel/Save Changes)

**Dependencies:** SI-04.16.0 + SI-04.0.1, SI-04.0.6, SI-04.0.7, SI-04.0.9, SI-04.0.11, SI-04.0.13, SI-04.0.14, SI-04.11

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches Figma node 156:2110 fidelity within tolerance of DS component set, including the four status variants (`uploading`, `processing`, `ready`, `failed`) listed in the UI Contract.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.16b — Tela de Upload em processamento (lógica & wiring)

**Test Specs:** see `next-frontend/specs/studio-upload-processing.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Upload em processamento (Upload video processing)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Authenticated+Owner`: sessão pelo layout do estúdio (SI-04.11); a página RSC lê `upstream.GET('/videos/{publicId}')` com o token da sessão — `404`/`403` do upstream → `notFound()` (o dono é verificado pelo upstream).
2. **Rendering strategy application** — página RSC carrega `video` + `categories` e passa por props; `upload-video-form.tsx` e `upload-status-row.tsx` com `"use client"`: a linha de status lê `useUpload(publicId)` (progresso do envio) e, quando não há upload em voo e `processing_status ∉ {ready, failed}`, usa `useProcessingPoll([publicId])`; recarga sem upload em voo e sessão `active` → "Upload interrupted — select the file again to resume" + `GET /api/videos/{publicId}/upload` para retomar (per `### Frontend Runtime`; `TD-11`, `TD-12`).
3. **Endpoint wiring** — `Save Changes` → `PATCH /api/videos/{publicId}` (`UpdateVideoInput & { publish: true }`) → toast "Video published" ou "Changes saved — the video stays a draft until processing finishes" conforme `published` → `router.refresh()`; `Change Thumbnail` → `PUT /api/videos/{publicId}/thumbnail` (`FormData`) → `router.refresh()`; `Cancel` → diálogo "Cancel upload? The file and this draft will be discarded." → `useUpload().cancel()` + `DELETE /api/videos/{publicId}/upload` (sessão ativa) ou `DELETE /api/videos/{publicId}` (envio concluído) → `router.push('/studio/videos')`; link público `${window.location.origin}/watch/{publicId}` no `copy-link-button` (per `### API Contracts → BFF tier`; OQ-5).
4. **Error mapping** — `UPLOAD_NOT_ACTIVE` → banner + link ao painel; `UPLOAD_INCOMPLETE` → reconsultar `GET …/upload` e retentar `complete`, depois banner com retry; `VALIDATION_ERROR`/`CATEGORY_NOT_FOUND` → inline; `THUMBNAIL_INVALID`/`THUMBNAIL_TOO_LARGE` → inline na seção Thumbnail; `STORAGE_UNAVAILABLE` → toast com retry; `processing_error` → mensagem por código (`UNSUPPORTED_FORMAT`, `PROBE_FAILED`, `THUMBNAIL_FAILED`, `OBJECT_MISSING`); 401 → redirect.
5. **Client-side validation mirror** — Zod + react-hook-form (per `phase-02-auth-frontend/TD-04`): `title` 1..100 (trim), `description` ≤ 5000 com contador, `category_id` uuid ou vazio, `visibility ∈ {public, unlisted}`, thumbnail `file` tipo JPEG/PNG/WebP e ≤ 5 MiB; `Save Changes` desabilitado até o form ficar dirty e válido.

**Dependencies:**

- `SI-04.16a` (visual shell must exist before wiring).
- Backend SIs: `SI-04.3` (leitura do dono), `SI-04.4` (`PATCH`/`publish`), `SI-04.6` (thumbnail), `SI-04.9` (`DELETE`).
- BFF `SI-04.12`; uploader/provider `SI-04.14`; shared-types `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/upload/upload-video-form.tsx` | Unit per testing-guide-next-frontend § "Client Components" — submit happy path chama `PATCH /api/videos/{id}` (MSW) com `publish: true`; toast conforme `published`; Error Catalog UX mapping por código; validação pré-submit (title vazio, description > 5000) | `components/upload/__tests__/upload-video-form.test.tsx` |
| `components/upload/upload-status-row.tsx` (wiring) | Unit — com upload em voo mostra `%`; sem upload e `processing` ativa polling (`fetch('/api/videos/{id}')` com fake timers) e para em `ready`; sessão ativa sem upload mostra "Upload interrupted" | `components/upload/__tests__/upload-status-row.wiring.test.tsx` |
| cancelamento | Unit — diálogo abre; confirmar chama `cancel()` + `DELETE /api/videos/{id}/upload` (MSW) e `router.push('/studio/videos')` | `components/upload/__tests__/cancel-upload.test.tsx` |

E2E for the page (auth guard redirects, page-level routing, full user flows) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- Com um upload iniciado em `/studio/upload`, a página mostra "Uploading… {pct}%" com `role="progressbar"` e, após o `complete`, passa a `Processing…` e então `Ready` sem recarga manual.
- `Save Changes` com o vídeo `processing` responde com toast "Changes saved — the video stays a draft…" e o título editado persiste; com o vídeo `ready`, o toast é "Video published" e o status exibido passa a `Published`.
- `Cancel` confirmado durante o envio interrompe os `PUT`, chama `DELETE /api/videos/{publicId}/upload` e volta ao painel sem o rascunho.
- Route guard: sem sessão, `/studio/upload/{publicId}` redireciona para `/login?returnTo=`; vídeo de outro canal → página 404.
- Client-side validation matches BE Validation Rules 1:1.

---

### SI-04.17.0 — Drift audit: Painel de gerenciamento de vídeos (My videos list)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Painel de gerenciamento de vídeos (My videos list)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/icon-button.tsx`, `components/auth/brand-logo.tsx`, `components/ui/separator.tsx`, `components/ui/button.tsx`, `components/ui/badge.tsx`, `components/ui/search-input.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/dialog.tsx`, `components/studio/studio-page-header.tsx`, `components/studio/video-filters.tsx`, `components/studio/video-sort-menu.tsx`, `components/studio/video-list.tsx`, `components/studio/video-list-item.tsx`, `components/studio/video-stats.tsx`, `components/studio/video-row-actions.tsx`, `components/video/video-thumbnail.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`video-list`, `video-list-item`, `video-filters`, `search-input`, `video-sort-menu`, `video-row-actions`, `upload-video-button`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/studio/videos/page.tsx` + `components/studio/video-list.tsx`

   Value-level diff per component, 4-value status enum, Decision per default policy, `prior_decisions` from earlier sections, write `## Screen: painel-de-videos — audited at SI-04.17.0 ({YYYY-MM-DD})` to `frontend-drift-report.md`. **No code edits.**

**Dependencies:** SI-04.0.1, SI-04.0.5, SI-04.0.8, SI-04.0.15, SI-04.0.16, SI-04.0.17

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` has section `## Screen: painel-de-videos` with the current run's date; one row per Reused DS component with a populated Decision; every `exception` justified.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.17a — Tela de Painel de gerenciamento de vídeos (visual shell)

**Route:** /studio/videos
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Painel de gerenciamento de vídeos (My videos list)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: painel-de-videos`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; apply each Decision verb mechanically.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824
   - Reused DS components: [lista de SI-04.17.0] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [lista de SI-04.17.0]
   - Target paths: `app/(app)/studio/videos/page.tsx` + `app/(app)/studio/videos/loading.tsx` + `components/studio/video-list.tsx` (cabeçalho "Channel content", barra de filtros, contador "{total} videos", lista com estados `Public`/`Unlisted`/`Draft`/`Processing`/`Failed`, estado vazio e skeleton per UI Contract)

**Dependencies:** SI-04.17.0 + SI-04.0.1, SI-04.0.5, SI-04.0.8, SI-04.0.15, SI-04.0.16, SI-04.0.17, SI-04.11

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches Figma node 152:1824 fidelity within tolerance of DS component set, plus the derived empty/loading states.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.17b — Tela de Painel de gerenciamento de vídeos (lógica & wiring)

**Test Specs:** see `next-frontend/specs/studio-videos.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Painel de gerenciamento de vídeos (My videos list)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Authenticated+Owner`: sessão pelo layout do estúdio (SI-04.11); `GET /channels/me/videos` lista só o canal do usuário autenticado (ownership no upstream).
2. **Rendering strategy application** — `app/(app)/studio/videos/page.tsx` RSC lê `searchParams` (`status`, `visibility`, `processing_status`, `q`, `sort`, `from`, `to`, `cursor`) e chama `upstream.GET('/channels/me/videos', { params: { query } })` com o token da sessão; Client Components: `video-filters`, `video-sort-menu`, `video-row-actions`, botão "Load more" (`router.replace` com `cursor=next_cursor`), e o hook `useProcessingPoll(idsEmVoo)` nas linhas `uploading|processing` (per `### Frontend Runtime`).
3. **Endpoint wiring** — `video-row-actions` callbacks: Publish → `POST /api/videos/{id}/publish`; Unpublish → `POST /api/videos/{id}/unpublish`; Delete → `DELETE /api/videos/{id}`; após sucesso `router.refresh()`; "Upload video" → `<Link href="/studio/upload">`; Edit → `<Link href="/studio/videos/{id}/edit">` (per `### API Contracts → BFF tier`; tipos de `@/lib/api/contracts`).
4. **Error mapping** — `VIDEO_NOT_PUBLISHABLE` → toast com link para a edição; `VIDEO_FORBIDDEN`/`VIDEO_NOT_FOUND` → toast + `router.refresh()`; `STORAGE_UNAVAILABLE` → toast com retry; `VALIDATION_ERROR` em filtros/cursor → ignorar parâmetro e recarregar; 401 → redirect `/login?returnTo=/studio/videos`.
5. **Client-side validation mirror** — `q` ≤ 100 chars; `from ≤ to` antes de aplicar; `limit` fixo em 20 (não exposto).

**Dependencies:**

- `SI-04.17a` (visual shell must exist before wiring).
- Backend SIs: `SI-04.8` (listagem do dono), `SI-04.4` (publish/unpublish), `SI-04.9` (delete), `SI-04.5` (thumbnail_url).
- BFF `SI-04.12`; shared-types `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/(app)/studio/videos/page.tsx` | _(async RSC — Vitest cannot render it; coberto pelo spec E2E)_ | — |
| `components/studio/video-row-actions.tsx` (wiring) | Unit per testing-guide-next-frontend § "Client Components" — callbacks chamam `POST …/publish|unpublish` e `DELETE …` (MSW) e `router.refresh()`; mapeamento de `VIDEO_NOT_PUBLISHABLE` em toast | `components/studio/__tests__/video-row-actions.wiring.test.tsx` |
| `hooks/use-processing-poll.ts` | Unit (`renderHook`, fake timers) — não dispara com ids terminais; `fetch('/api/videos/{id}')` a cada 3 s; `router.refresh()` uma vez ao virar `ready`; cleanup | `hooks/__tests__/use-processing-poll.test.ts` |
| "Load more" | Unit — clique chama `router.replace` com `cursor` preservando os filtros | `components/studio/__tests__/load-more.test.tsx` |

E2E for the page (auth guard redirects, page-level routing, full user flows) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `/studio/videos` renderiza a lista vinda de `GET /channels/me/videos` com `{total} videos`; `?status=draft&q=aula` reflete os filtros na lista e nos controles.
- "Publish" em uma linha `ready` muda o badge para `Public`/`Unlisted` sem recarga manual; "Delete" confirmado remove a linha.
- Uma linha `processing` passa a `Public`/`Draft` (status final) automaticamente quando o processamento termina (polling + refresh).
- Route guard redirects correctly for all principal types enumerated in Authorization Matrix (anônimo → `/login?returnTo=`).
- Client-side validation matches BE Validation Rules 1:1 (`q` ≤ 100, `from ≤ to`).

---

### SI-04.18.0 — Drift audit: Edição de vídeo (Edit/Publish video)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição de vídeo (Edit/Publish video)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/card.tsx`, `components/ui/label.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/radio-group.tsx`, `components/ui/button.tsx`, `components/ui/section-header.tsx`, `components/studio/video-config-card.tsx`, `components/studio/video-preview.tsx`, `components/studio/copy-link-button.tsx`, `components/studio/thumbnail-preview.tsx`, `components/studio/category-select.tsx`, `components/studio/privacy-option.tsx`, `components/studio/video-checks-status.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`video-edit-form`, `category-select`, `thumbnail-preview`, `thumbnail-upload-button`, `video-preview`, `video-config-card`, `video-checks-status`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/studio/videos/[publicId]/edit/page.tsx` + `components/studio/video-edit-form.tsx`

   Value-level diff per component, 4-value status enum, Decision per default policy, `prior_decisions` from earlier sections (as telas de upload compartilham componentes — CONFLICT detection relevante), write `## Screen: edicao-de-video — audited at SI-04.18.0 ({YYYY-MM-DD})` to `frontend-drift-report.md`. **No code edits.**

**Dependencies:** SI-04.0.1, SI-04.0.6, SI-04.0.9, SI-04.0.13, SI-04.0.14

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` has section `## Screen: edicao-de-video` with the current run's date; one row per Reused DS component with a populated Decision; every `exception` justified.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.18a — Tela de Edição de vídeo (visual shell)

**Route:** /studio/videos/{publicId}/edit
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição de vídeo (Edit/Publish video)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: edicao-de-video`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; apply each Decision verb mechanically.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790
   - Reused DS components: [lista de SI-04.18.0] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [lista de SI-04.18.0]
   - Target paths: `app/(app)/studio/videos/[publicId]/edit/page.tsx` + `app/(app)/studio/videos/[publicId]/edit/{loading,not-found}.tsx` + `components/studio/video-edit-form.tsx` (título "Edit video" per OQ-9; Details, Thumbnail, Category, Visibility, CardVideoConfig, rodapé com status + Cancel/Save Changes; estados de status `uploading|processing|ready|published|failed` per UI Contract)

**Dependencies:** SI-04.18.0 + SI-04.0.1, SI-04.0.6, SI-04.0.9, SI-04.0.13, SI-04.0.14, SI-04.11

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches Figma node 156:2790 fidelity within tolerance of DS component set, with the derived status variants.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.18b — Tela de Edição de vídeo (lógica & wiring)

**Test Specs:** see `next-frontend/specs/studio-video-edit.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição de vídeo (Edit/Publish video)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Authenticated+Owner`: sessão pelo layout do estúdio (SI-04.11); a página RSC lê `upstream.GET('/videos/{publicId}')` com o token — `404` (inclui rascunho de terceiro) → `notFound()`.
2. **Rendering strategy application** — página RSC carrega `video`, `categories` (`GET /categories`) e, quando `processing_status = ready`, `playback` (`GET /videos/{publicId}/playback`) e passa por props; `components/studio/video-edit-form.tsx` com `"use client"` (react-hook-form + Zod, `defaultValues` do vídeo); `video-checks-status` usa `useProcessingPoll([publicId])` enquanto não terminal (per `### Frontend Runtime`; `phase-02-auth-frontend/TD-04`).
3. **Endpoint wiring** — `Save Changes` → `PATCH /api/videos/{publicId}` (`UpdateVideoInput & { publish: true }`) → toast conforme `published` → `router.refresh()`; `Change Thumbnail` → `PUT /api/videos/{publicId}/thumbnail` (`FormData` com `file`) com estado "Uploading…" → `router.refresh()`; "Remove custom thumbnail" (visível quando `has_custom_thumbnail`) → `DELETE /api/videos/{publicId}/thumbnail` → `router.refresh()`; `Cancel` → `router.push('/studio/videos')` com confirmação se dirty; `copy-link-button` com `${origin}/watch/{publicId}` (per `### API Contracts → BFF tier`; OQ-5).
4. **Error mapping** — `VALIDATION_ERROR` → inline (`components/auth/field-error.tsx`); `CATEGORY_NOT_FOUND` → inline no select; `THUMBNAIL_INVALID` → "Use a JPEG, PNG or WebP image of at least 640×360"; `THUMBNAIL_TOO_LARGE` → "Max 5 MB"; `VIDEO_FORBIDDEN`/`VIDEO_NOT_FOUND` → redirect ao painel com toast; `STORAGE_UNAVAILABLE` → toast com retry; 401 → redirect.
5. **Client-side validation mirror** — `title` required 1..100 (trim); `description` ≤ 5000 com contador; `category_id` uuid de categoria listada ou vazio; `visibility ∈ {public, unlisted}`; thumbnail `file` tipo JPEG/PNG/WebP e ≤ 5 MiB; `Save Changes` desabilitado até dirty e válido.

**Dependencies:**

- `SI-04.18a` (visual shell must exist before wiring).
- Backend SIs: `SI-04.1` (categorias), `SI-04.3` (leitura do dono + playback), `SI-04.4` (`PATCH`/`publish`), `SI-04.6` (thumbnail).
- BFF `SI-04.12`; shared-types `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/studio/video-edit-form.tsx` | Unit per testing-guide-next-frontend § "Client Components" — submit happy path (`PATCH /api/videos/{id}` via MSW, `publish: true`) com toast por `published`; `Save` desabilitado até dirty; validação pré-submit (title vazio, description > 5000); Error Catalog UX mapping (`CATEGORY_NOT_FOUND`, `VALIDATION_ERROR`) | `components/studio/__tests__/video-edit-form.test.tsx` |
| `components/studio/thumbnail-upload-button.tsx` | Unit — rejeita > 5 MiB e tipos não suportados antes do envio; `PUT` com `FormData` (MSW); mapeamento de `THUMBNAIL_INVALID`/`THUMBNAIL_TOO_LARGE`; "Remove" chama `DELETE` | `components/studio/__tests__/thumbnail-upload-button.test.tsx` |

E2E for the page (auth guard redirects, page-level routing, full user flows) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- Abrir `/studio/videos/{publicId}/edit` do próprio rascunho mostra o formulário pré-preenchido (`title`, `description`, categoria, visibilidade) e as categorias de `GET /categories`.
- Editar o título e salvar num vídeo `ready` persiste o título e publica (status exibido `Published`); num vídeo `processing`, persiste e mantém `Draft` com o aviso.
- Enviar uma imagem PNG válida troca a thumbnail exibida (URL com `?v=` novo); "Remove custom thumbnail" volta à automática.
- Abrir a edição de um vídeo de outro canal mostra a página 404; sem sessão redireciona para `/login?returnTo=`.
- Client-side validation matches BE Validation Rules 1:1.

---

### SI-04.19.0 — Drift audit: Edição do canal (Channel Settings)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição do canal (Channel Settings)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/card.tsx`, `components/ui/avatar.tsx`, `components/ui/label.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/button.tsx`, `components/icons/groups-icon.tsx`, `components/icons/videocam-icon.tsx`, `components/icons/alarm-icon.tsx`, `components/channel/channel-header-card.tsx`, `components/channel/channel-banner.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`channel-header-card`, `channel-settings-form`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/studio/channel/page.tsx` + `components/channel/channel-settings-form.tsx`

   Value-level diff per component, 4-value status enum, Decision per default policy, `prior_decisions` from earlier sections, write `## Screen: edicao-do-canal — audited at SI-04.19.0 ({YYYY-MM-DD})` to `frontend-drift-report.md`. **No code edits.**

**Dependencies:** SI-04.0.1, SI-04.0.7, SI-04.0.10

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` has section `## Screen: edicao-do-canal` with the current run's date; one row per Reused DS component with a populated Decision; every `exception` justified.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.19a — Tela de Edição do canal (visual shell)

**Route:** /studio/channel
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição do canal (Channel Settings)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: edicao-do-canal`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; apply each Decision verb mechanically.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367
   - Reused DS components: [lista de SI-04.19.0] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [lista de SI-04.19.0]
   - Target paths: `app/(app)/studio/channel/page.tsx` + `app/(app)/studio/channel/loading.tsx` + `components/channel/channel-settings-form.tsx` (título "Channel Settings"; cabeçalho com banner/avatar placeholder e "{video_count} videos" — contador de inscritos oculto; campos handle com prefixo visual `@`, "Display name" com o nome do canal per OQ-9, descrição; "Last updated"; rodapé Cancel/Save Changes)

**Dependencies:** SI-04.19.0 + SI-04.0.1, SI-04.0.7, SI-04.0.10, SI-04.11

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches Figma node 154:1367 fidelity within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.19b — Tela de Edição do canal (lógica & wiring)

**Test Specs:** see `next-frontend/specs/studio-channel.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Edição do canal (Channel Settings)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Authenticated+Owner`: sessão pelo layout do estúdio (SI-04.11); `GET /channels/me` já é o canal do usuário autenticado.
2. **Rendering strategy application** — `app/(app)/studio/channel/page.tsx` RSC lê `upstream.GET('/channels/me')` e passa `initialChannel` por props; `components/channel/channel-settings-form.tsx` com `"use client"` (react-hook-form + Zod; `defaultValues` do canal; `@` como prefixo visual fora do valor) (per `phase-02-auth-frontend/TD-04`; `TD-12`).
3. **Endpoint wiring** — `Save Changes` → `PATCH /api/channel` (`UpdateChannelInput` só com os campos dirty) → toast "Channel updated" → `router.refresh()` (o BFF já reescreveu `channelSlug` na sessão; o header/menus passam a usar o novo nickname); `Cancel` → descarta e `router.push('/studio/videos')` (per `### API Contracts → PATCH /api/channel`; `TD-08`).
4. **Error mapping** — `NICKNAME_TAKEN` → erro inline no handle ("This handle is already taken"); `VALIDATION_ERROR` → inline por campo (inclui reservado); 401 → redirect `/login?returnTo=/studio/channel`; fallback genérico em toast.
5. **Client-side validation mirror** — `nickname` `^[a-z0-9_]{3,50}$` sem `@` e fora da lista de reservados (`me`, `admin`, `channel`, `channels`, `studio`, `api`, `watch`, `login`, `signup`); `name` required 1..50 (trim); `description` ≤ 1000 com contador; `Save Changes` desabilitado até dirty e válido.

**Dependencies:**

- `SI-04.19a` (visual shell must exist before wiring).
- Backend SIs: `SI-04.7` (`GET`/`PATCH /channels/me`).
- BFF `SI-04.12`; shared-types `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/channel/channel-settings-form.tsx` | Unit per testing-guide-next-frontend § "Client Components" — submit happy path (`PATCH /api/channel` via MSW) só com campos dirty; `NICKNAME_TAKEN` inline; validação pré-submit (handle inválido/reservado, name vazio, description > 1000); `Save` desabilitado até dirty | `components/channel/__tests__/channel-settings-form.test.tsx` |

E2E for the page (auth guard redirects, page-level routing, full user flows) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `/studio/channel` mostra nome, `@nickname`, descrição e "{video_count} videos" vindos de `GET /channels/me`.
- Alterar o handle para um valor livre e salvar atualiza o cabeçalho da página e, após `router.refresh()`, os links do header passam a usar o novo nickname; `/channel/{novo}` responde 200.
- Tentar um handle já em uso mostra o erro inline sem recarregar; handle reservado é barrado antes do envio.
- Route guard: sem sessão, `/studio/channel` redireciona para `/login?returnTo=/studio/channel`.
- Client-side validation matches BE Validation Rules 1:1.

---

### SI-04.20.0 — Drift audit: Página pública do canal (Channel Show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal (Channel Show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/icon-button.tsx`, `components/auth/brand-logo.tsx`, `components/ui/avatar.tsx`, `components/ui/button.tsx`, `components/ui/tabs.tsx`, `components/ui/separator.tsx`, `components/ui/filter-chip.tsx`, `components/channel/channel-banner.tsx`, `components/channel/channel-header.tsx`, `components/channel/channel-info.tsx`, `components/channel/channel-video-sort.tsx`, `components/channel/channel-video-grid.tsx`, `components/videos/video-card.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`channel-info`, `channel-video-grid`, `video-card`, `channel-video-sort`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/channel/[nickname]/page.tsx` + `components/channel/channel-video-grid.tsx`

   Value-level diff per component, 4-value status enum, Decision per default policy, `prior_decisions` from earlier sections (`channel-banner`/`avatar` já auditados na tela de configurações), write `## Screen: pagina-publica-do-canal — audited at SI-04.20.0 ({YYYY-MM-DD})` to `frontend-drift-report.md`. **No code edits.**

**Dependencies:** SI-04.0.1, SI-04.0.4, SI-04.0.10, SI-04.0.11, SI-04.0.12

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` has section `## Screen: pagina-publica-do-canal` with the current run's date; one row per Reused DS component with a populated Decision; every `exception` justified.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-04.20a — Tela de Página pública do canal (visual shell)

**Route:** /channel/{nickname}
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal (Channel Show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: pagina-publica-do-canal`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen; apply each Decision verb mechanically.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926
   - Reused DS components: [lista de SI-04.20.0] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [lista de SI-04.20.0]
   - Target paths: `app/(app)/channel/[nickname]/page.tsx` + `app/(app)/channel/[nickname]/{loading,not-found}.tsx` + `components/channel/channel-video-grid.tsx` (banner + avatar placeholder, info do canal sem contador de inscritos, tabs só com "Videos", chips Latest/Popular/Oldest, grid de `VideoCard` sem linha de canal, estado vazio, "Load more"; botão Subscribe e sino não renderizados nesta fase)

**Dependencies:** SI-04.20.0 + SI-04.0.1, SI-04.0.4, SI-04.0.10, SI-04.0.11, SI-04.0.12

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches Figma node 155:1926 fidelity within tolerance of DS component set, minus the phase-06/07 affordances listed in the UI Contract.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-04.20b — Tela de Página pública do canal (lógica & wiring)

**Test Specs:** see `next-frontend/specs/channel-public.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal (Channel Show)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Anonymous`: nenhuma guarda; a rota vive em `app/(app)/channel/[nickname]/` (fora de `/studio`), renderiza para visitante e para sessão autenticada igualmente (sem variante "dono logado" — OQ-3/OQ-6).
2. **Rendering strategy application** — página RSC `async`: `upstream.GET('/channels/{nickname}')` e `upstream.GET('/channels/{nickname}/videos', { params: { query: { sort, cursor } } })` **sem** token; `generateMetadata` com "{name} (@{nickname}) — StreamTube" e a descrição; `channel-video-sort` (`"use client"`) escreve `?sort=`; "Load more" (`"use client"`) escreve `?cursor=next_cursor` (per `TD-12`, `TD-07`).
3. **Endpoint wiring** — `VideoCardItem[]` de `@/lib/api/contracts` → `VideoCard` com `href="/watch/{public_id}"` (rota da Fase 05; OQ-5); `thumbnail_url` consumido como `<img>`/`next/image` com `unoptimized` para `S3_PUBLIC_ENDPOINT` em dev (TD-10); `video_count` em `channel-info` (per `### API Contracts` backend tier).
4. **Error mapping** — `CHANNEL_NOT_FOUND` → `notFound()` (`not-found.tsx` com link para a home); `VALIDATION_ERROR` em `sort`/`cursor` → renderizar com defaults; falha de upstream → `error.tsx` com retry.
5. **Client-side validation mirror** — `sort ∈ {latest, popular, oldest}` (qualquer outro → `latest`).

**Dependencies:**

- `SI-04.20a` (visual shell must exist before wiring).
- Backend SIs: `SI-04.7` (`GET /channels/{nickname}`), `SI-04.8` (`GET /channels/{nickname}/videos`), `SI-04.5` (thumbnails públicas).
- Shared-types `SI-04.10`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/(app)/channel/[nickname]/page.tsx` | _(async RSC — Vitest cannot render it; coberto pelo spec E2E)_ | — |
| `components/channel/channel-video-sort.tsx` (wiring) | Unit per testing-guide-next-frontend § "Client Components" — chip ativo vindo de `searchParams.sort`; clique chama `router.replace('?sort=popular')` sem `cursor` | `components/channel/__tests__/channel-video-sort.wiring.test.tsx` |
| "Load more" (página pública) | Unit — chama `router.replace` com `cursor` preservando `sort`; oculto quando `next_cursor` é nulo | `components/channel/__tests__/channel-load-more.test.tsx` |

E2E for the page (page-level routing, anonymous rendering, 404, sort, load more) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `GET /channel/{nickname}` sem cookie renderiza nome, `@nickname`, descrição, "{video_count} videos" e a grade com os vídeos `published` + `public` do canal; `<title>` contém "{name} (@{nickname})".
- `?sort=popular` reordena a grade por visualizações; "Load more" acrescenta a próxima página e some quando não há `next_cursor`.
- `/channel/nao_existe` responde 404 com a página `not-found`.
- Cada card aponta para `/watch/{public_id}` e exibe a thumbnail por URL pública (sem `X-Amz-*`).

---

## Technical Specifications

### Data Model

_Entidades novas ou modificadas nesta fase. PK continua UUID (regra de entidades); `public_id` é a chave externa (per `phase-03-upload-processing/TD-08`). Migrations TypeORM em `src/database/migrations/` (`synchronize` off)._

#### Category (nova — per `video-channel-management/TD-01`)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| slug | varchar(32) | unique, not null — `[a-z0-9-]`, chave estável usada em filtros e na seed |
| name | varchar(64) | not null — rótulo de exibição |
| sort_order | smallint | not null — ordem de exibição |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

**Relations:** `Category` has many `Video` (one-to-many, via `videos.category_id`)
**Indexes:** unique on `slug`
**Seed (data migration, per TD-01 Revisions 2026-10-18 — slug → name, nesta ordem):** `music` → Music, `gaming` → Gaming, `education` → Education, `entertainment` → Entertainment, `sports` → Sports, `news` → News, `technology` → Technology, `travel` → Travel, `cooking` → Cooking, `other` → Other. A migration de dados insere as 10 linhas (`sort_order` 1..10) e seu `down` as remove; `migration:run` continua sendo o único bootstrap de banco.

#### Video (modificada — per `video-channel-management/TD-02`, `TD-04`, `TD-05`; base da Fase 03 inalterada)

Colunas acrescentadas à tabela `videos` existente (uma migration):

| Field | Type | Constraints |
|-------|------|-------------|
| title | varchar(100) | not null — preenchido no pré-cadastro com `original_filename` sem extensão (truncado a 100); editável |
| description | text | nullable — máx. 5000 chars (validação) |
| category_id | uuid | nullable, FK → `categories.id` (`ON DELETE SET NULL`) |
| visibility | varchar(16) | not null, default `public` — `public \| unlisted`; editável a qualquer momento, só tem efeito quando `status = published` |
| published_at | timestamp | nullable — gravado na primeira publicação; não é anulado ao despublicar |
| custom_thumbnail_key | varchar(255) | nullable — `thumbnails/{public_id}/custom.jpg`; `thumbnail_key` (automática) permanece intacta |
| view_count | integer | not null, default 0 — incrementado na Fase 05 |
| like_count | integer | not null, default 0 — incrementado na Fase 06 |
| dislike_count | integer | not null, default 0 — incrementado na Fase 06 |
| comment_count | integer | not null, default 0 — incrementado na Fase 06 |

Enum de publicação estendido: `VIDEO_STATUSES = ['draft', 'published']` (`status` já existe, default `draft`). Novo `VIDEO_VISIBILITIES = ['public', 'unlisted']`. Eixo de processamento (`processing_status`) inalterado.

**Transições de `status` (per TD-02 / TD-03):** `draft → published` exige `processing_status = ready` e `title` não vazio; `published → draft` (despublicar) sempre permitido e preserva `visibility`. Edição de `title`/`description`/`category_id`/`visibility` permitida em qualquer `processing_status`.

**Relations:** `Video` belongs to `Category` (many-to-one, nullable); `Video` belongs to `Channel` (existente)
**Indexes:** composite on (`channel_id`, `status`, `published_at DESC`, `id DESC`) — listagens keyset do dono e do canal público (per TD-06); composite on (`status`, `visibility`, `published_at DESC`, `id DESC`) — listagens públicas das Fases 05/07; index on `category_id`

#### Channel (modificada — per `video-channel-management/TD-08`)

Sem coluna nova. Regras adicionadas sobre as colunas existentes:

| Field | Type | Constraints |
|-------|------|-------------|
| nickname | varchar(50) | unique (existente) — passa a ser editável; validação `^[a-z0-9_]{3,50}$` (mesma allowlist de `phase-02-auth/TD-10`) + lista de reservados (`me`, `admin`, `channel`, `channels`, `studio`, `api`, `watch`, `login`, `signup`); conflito → 409 `NICKNAME_TAKEN`; o nickname antigo é liberado imediatamente, sem redirecionamento |
| name | varchar(50) | not null (existente) — editável, 1..50 chars |
| description | text | nullable (existente) — editável, máx. 1000 chars |

**Relations:** inalteradas (`Channel` 1:1 `User`; `Channel` 1:N `Video`)
**Indexes:** inalterados (unique on `nickname`, unique on `user_id`)

#### VideoUpload

Inalterada (Fase 03). A tela de upload em processamento consome `GET /videos/{publicId}` e `GET /videos/{publicId}/upload` existentes.

### API Contracts

_Backend tier (NestJS, `Scope: Backend | Cross-layer`). Envelope de erro herdado: `{ statusCode, error, message }` (per `phase-02-auth/TD-07`). Todas as rotas passam pelo `JwtAuthGuard` global; as marcadas **público (auth opcional)** usam `@Public()` + leitura do `Bearer` quando presente (per `video-channel-management/TD-07`): token ausente → anônimo; token presente e inválido/expirado → 401. Shapes anotados com `@ApiProperty` porque o `openapi.json` é a fonte dos tipos do frontend (per `openapi-docs-nestjs`, `next-frontend-openapi-typing`)._

**Shapes compartilhados:**

- `CategoryResponse`: `{ id: uuid, slug: string, name: string, sort_order: integer }`
- `VideoResponse` (estende o shape da Fase 03): `{ public_id, status: 'draft'|'published', visibility: 'public'|'unlisted', processing_status, processing_error, title, description: string|null, category: CategoryResponse|null, original_filename, content_type, size_bytes, duration_seconds, width, height, container, video_codec, audio_codec, thumbnail_url: string|null, has_custom_thumbnail: boolean, view_count, like_count, dislike_count, comment_count, published_at: string|null, created_at, processed_at }` — `thumbnail_url` é a URL pública estável (per TD-10): `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${custom_thumbnail_key ?? thumbnail_key}?v=${updated_at epoch}`; `null` enquanto não há thumbnail.
- `VideoListItem` (painel do dono): `{ public_id, title, status, visibility, processing_status, processing_error, thumbnail_url, duration_seconds, view_count, like_count, comment_count, published_at, created_at }`
- `VideoCardItem` (listagens públicas): `{ public_id, title, thumbnail_url, duration_seconds, view_count, published_at, channel: { nickname, name } }`
- `ChannelResponse` (dono): `{ id: uuid, nickname, name, description: string|null, video_count: integer, created_at, updated_at }` — `video_count` = vídeos `published` + `public`
- `ChannelPublicResponse`: `{ nickname, name, description: string|null, video_count: integer, created_at }`
- `CursorPage<T>`: `{ items: T[], next_cursor: string|null }`; o painel acrescenta `total: integer` (per TD-06)

#### GET /categories (SI-04.1)

Público (`@Public()`, sem auth).

**Response 200:** `CategoryResponse[]` ordenado por `sort_order`

**Error responses:**
- nenhum erro de domínio

---

#### GET /videos/{publicId} (SI-04.3 — contrato da Fase 03 modificado: passa a ser público com auth opcional)

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Response 200:** `VideoResponse`

**Regra de visibilidade (per TD-07 / TD-02):** dono do canal → qualquer `status`; demais (anônimo ou autenticado não-dono) → somente `status = published` (`public` ou `unlisted`, pois a leitura é por `public_id`); rascunho de terceiro → 404 `VIDEO_NOT_FOUND` (não revela existência).

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho que não pertence ao solicitante
- 503 STORAGE_UNAVAILABLE: (mantido do contrato da Fase 03 — não se aplica mais à thumbnail, que é URL estável)

---

#### GET /videos/{publicId}/playback (SI-04.3 — contrato da Fase 03 modificado: mesma regra de visibilidade)

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Response 200:** `{ stream_url, download_url, thumbnail_url, expires_at }` (shape da Fase 03; `thumbnail_url` passa a ser a URL estável)

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho de terceiro
- 409 VIDEO_NOT_READY: `processing_status ≠ ready`
- 503 STORAGE_UNAVAILABLE

---

#### PATCH /videos/{publicId} (SI-04.4)

Dono. Edição parcial dos campos editoriais; nunca muda `status` (per TD-03).

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: application/json

**Request body:** (todos opcionais; ao menos um)
- title: string — 1..100 chars, trim
- description: string | null — máx. 5000 chars
- category_id: uuid | null — deve existir em `categories`
- visibility: 'public' | 'unlisted'

**Response 200:** `VideoResponse`

**Error responses:**
- 400 VALIDATION_ERROR: corpo inválido ou vazio
- 400 CATEGORY_NOT_FOUND: `category_id` inexistente
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN: não é o dono
- 404 VIDEO_NOT_FOUND

---

#### POST /videos/{publicId}/publish (SI-04.4)

Dono. Ação dedicada (per TD-03). Idempotente: já `published` → 200 sem alteração.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:** `VideoResponse` com `status: 'published'` e `published_at` preenchido (só na primeira publicação)

**Error responses:**
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN
- 404 VIDEO_NOT_FOUND
- 409 VIDEO_NOT_PUBLISHABLE: `processing_status ≠ ready` ou `title` vazio (per TD-02)

---

#### POST /videos/{publicId}/unpublish (SI-04.4)

Dono. Volta a `draft` preservando `visibility` e `published_at`. Idempotente: já `draft` → 200.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:** `VideoResponse` com `status: 'draft'`

**Error responses:**
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN
- 404 VIDEO_NOT_FOUND

---

#### PUT /videos/{publicId}/thumbnail (SI-04.6)

Dono. Envia a thumbnail customizada pela API (per TD-04): validação pelos bytes e re-codificação para JPEG 1280×720 (cover) com `sharp`; grava em `thumbnails/{public_id}/custom.jpg` e `custom_thumbnail_key`; a automática permanece.

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: multipart/form-data

**Request body:**
- file: binary, required — campo `file`; `image/jpeg`, `image/png` ou `image/webp` declarado; máx. 5 MiB (`THUMBNAIL_MAX_BYTES`, default 5 MiB); dimensões mínimas 640×360

**Response 200:** `VideoResponse` (com `thumbnail_url` apontando para a customizada e `has_custom_thumbnail: true`)

**Error responses:**
- 400 VALIDATION_ERROR: campo `file` ausente
- 400 THUMBNAIL_INVALID: bytes não decodificáveis como imagem, tipo não suportado ou dimensões abaixo do mínimo
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN
- 404 VIDEO_NOT_FOUND
- 413 THUMBNAIL_TOO_LARGE: acima de `THUMBNAIL_MAX_BYTES`
- 503 STORAGE_UNAVAILABLE

---

#### DELETE /videos/{publicId}/thumbnail (SI-04.6)

Dono. Remove a customizada (objeto e `custom_thumbnail_key`) e volta à automática. Idempotente.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 204:** No content.

**Error responses:**
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN
- 404 VIDEO_NOT_FOUND
- 503 STORAGE_UNAVAILABLE

---

#### DELETE /videos/{publicId} (SI-04.9)

Dono. Hard delete transacional + job `video.delete` na mesma transação (per TD-09). Se há sessão multipart `active`, ela é abortada no storage antes (reaproveita o abort da Fase 03). Permitido em qualquer `status`/`processing_status`.

**Request headers:**
- Authorization: Bearer <access_token>

**Response 204:** No content.

**Error responses:**
- 401 Unauthorized
- 403 VIDEO_FORBIDDEN
- 404 VIDEO_NOT_FOUND
- 503 STORAGE_UNAVAILABLE: falha ao abortar a sessão multipart ativa

---

#### GET /channels/me (SI-04.7)

Autenticado (canal do próprio usuário).

**Request headers:**
- Authorization: Bearer <access_token>

**Response 200:** `ChannelResponse`

**Error responses:**
- 401 Unauthorized

---

#### PATCH /channels/me (SI-04.7)

Autenticado. Edição parcial (per TD-08).

**Request headers:**
- Authorization: Bearer <access_token>
- Content-Type: application/json

**Request body:** (todos opcionais; ao menos um)
- nickname: string — `^[a-z0-9_]{3,50}$`, não reservado; o valor é enviado sem `@` (o `@` é prefixo visual)
- name: string — 1..50 chars, trim
- description: string | null — máx. 1000 chars

**Response 200:** `ChannelResponse`

**Error responses:**
- 400 VALIDATION_ERROR: formato inválido, corpo vazio ou nickname reservado
- 401 Unauthorized
- 409 NICKNAME_TAKEN: nickname em uso por outro canal (inclui corrida detectada por unique violation)

---

#### GET /channels/{nickname} (SI-04.7)

Público (`@Public()`, sem auth).

**Response 200:** `ChannelPublicResponse`

**Error responses:**
- 404 CHANNEL_NOT_FOUND

---

#### GET /channels/me/videos (SI-04.8)

Autenticado (painel do dono). Paginação cursor keyset (per TD-06) sobre (`created_at DESC, id DESC`) por padrão. Filtros/ordenação/busca como detalhe de contrato (resolução OQ-8).

**Request headers:**
- Authorization: Bearer <access_token>

**Request query parameters:**
- limit: integer, opcional — 1..50, default 20
- cursor: string, opcional — opaco (base64url de `{ created_at|published_at|view_count, id }` conforme `sort`); inválido → 400
- status: 'draft' | 'published', opcional
- visibility: 'public' | 'unlisted', opcional
- processing_status: 'uploading' | 'processing' | 'ready' | 'failed', opcional
- q: string, opcional — busca `ILIKE %q%` em `title`, máx. 100 chars
- sort: 'latest' | 'oldest' | 'views', opcional — default `latest` (`created_at DESC`); `oldest` (`created_at ASC`); `views` (`view_count DESC, id DESC`)
- from, to: date (ISO-8601 `YYYY-MM-DD`), opcionais — filtro por `created_at`

**Response 200:** `CursorPage<VideoListItem> & { total: integer }` — `total` é o `COUNT` dos filtros aplicados (sem o cursor)

**Error responses:**
- 400 VALIDATION_ERROR: parâmetro fora do domínio ou cursor inválido
- 401 Unauthorized

---

#### GET /channels/{nickname}/videos (SI-04.8)

Público (`@Public()`, sem auth). Só vídeos `status = published` e `visibility = public` do canal. Cursor keyset (per TD-06).

**Request query parameters:**
- limit: integer, opcional — 1..50, default 20
- cursor: string, opcional — opaco
- sort: 'latest' | 'popular' | 'oldest', opcional — default `latest` (`published_at DESC, id DESC`); `popular` (`view_count DESC, id DESC`); `oldest` (`published_at ASC, id ASC`)

**Response 200:** `CursorPage<VideoCardItem>`

**Error responses:**
- 400 VALIDATION_ERROR
- 404 CHANNEL_NOT_FOUND

---

#### Validation Rules — vídeos, canal, thumbnail e listagens

- `title`: string, trim, 1..100 chars (obrigatório para publicar; no `PATCH` é opcional mas, se presente, não pode ser vazio)
- `description`: string ou null, máx. 5000 chars
- `category_id`: uuid ou null; precisa existir em `categories` (senão 400 `CATEGORY_NOT_FOUND`)
- `visibility`: `public | unlisted`
- `nickname`: `^[a-z0-9_]{3,50}$`, sem `@`, não reservado (`me`, `admin`, `channel`, `channels`, `studio`, `api`, `watch`, `login`, `signup`)
- `name` (canal): string, trim, 1..50 chars
- `description` (canal): string ou null, máx. 1000 chars
- thumbnail `file`: `image/jpeg | image/png | image/webp` declarado e confirmado pelos bytes (`sharp().metadata()`), ≤ 5 MiB, ≥ 640×360; saída normalizada JPEG 1280×720
- `limit`: inteiro 1..50 (default 20); `cursor`: base64url decodificável, senão 400; `q`: máx. 100 chars; `from`/`to`: datas ISO válidas com `from ≤ to`
- Corpos de `PATCH` vazios (nenhum campo reconhecido) → 400 `VALIDATION_ERROR`; campos desconhecidos → 400 (`forbidNonWhitelisted` global)

> _BFF tier — frontend-exposed contract. The browser calls the FE-facing route; the route proxies the upstream per the project's documented BFF architecture (`next-frontend/CLAUDE.md` § "Talking to the NestJS API": Route Handlers under `app/api/**` + typed `upstream` client sobre `openapi.json` → `lib/api/types.gen.ts`). Leituras de página (painel, edição, canal, categorias, página pública) acontecem em RSC via `upstream` com o token da sessão `iron-session` — sem rota BFF (per `video-channel-management/TD-12`); o BFF cobre só o que o navegador chama: fluxo de upload, polling, mutações. O token é lido da sessão e injetado como `Authorization: Bearer` pelo helper de refresh single-flight (per `phase-02-auth-frontend/TD-02`, `TD-03`); 401 do upstream aciona o refresh uma vez e, falhando, destrói a sessão e responde 401._

#### POST /api/videos (SI-04.12)

**forwards-to:** `POST /videos` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer — injetado pelo BFF a partir da sessão *(per phase-02-auth-frontend/TD-02)*

**Request body:** `CreateVideoDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 201 (FE-facing):** `VideoCreatedResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR / VIDEO_UNSUPPORTED_MEDIA_TYPE: pass-through *(derived: project contract source)*
- 413 VIDEO_TOO_LARGE: pass-through *(derived: project contract source)*
- 503 STORAGE_UNAVAILABLE: pass-through *(derived: project contract source)*
- 401: sessão ausente ou refresh falhou *(per phase-02-auth-frontend/TD-03)*

---

#### POST /api/videos/{publicId}/upload/parts (SI-04.12)

**forwards-to:** `POST /videos/{publicId}/upload/parts` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `PresignPartsDto` *(derived: project contract source — fields per source; not re-spelled)*

**Response 200 (FE-facing):** `PresignedPartsResponse` — pass-through; as `parts[].url` apontam para `S3_PUBLIC_ENDPOINT` e o navegador faz `PUT` direto nelas (exceção explícita ao Strict BFF, per `phase-03-upload-processing/TD-03`) *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR, 403 VIDEO_FORBIDDEN, 404 VIDEO_NOT_FOUND, 409 UPLOAD_NOT_ACTIVE, 503 STORAGE_UNAVAILABLE: pass-through *(derived: project contract source)*

---

#### GET /api/videos/{publicId}/upload (SI-04.12)

**forwards-to:** `GET /videos/{publicId}/upload` *(derived: project contract source)*

**Response 200 (FE-facing):** `UploadStateResponse` — pass-through (retomada via `uploaded_parts`) *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 403, 404, 409 UPLOAD_NOT_ACTIVE, 503: pass-through *(derived: project contract source)*

---

#### POST /api/videos/{publicId}/upload/complete (SI-04.12)

**forwards-to:** `POST /videos/{publicId}/upload/complete` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `CompleteUploadDto` *(derived: project contract source — fields per source; not re-spelled)*

**Response 202 (FE-facing):** `UploadCompletedResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400, 403, 404, 409 UPLOAD_NOT_ACTIVE, 413 VIDEO_TOO_LARGE, 422 UPLOAD_INCOMPLETE, 503: pass-through *(derived: project contract source)*

---

#### DELETE /api/videos/{publicId}/upload (SI-04.12)

**forwards-to:** `DELETE /videos/{publicId}/upload` *(derived: project contract source)*

**Response 204 (FE-facing):** No content — pass-through *(derived: project contract source)*

**Error responses (FE-facing):**
- 403, 404, 409 UPLOAD_NOT_ACTIVE, 503: pass-through *(derived: project contract source)*

---

#### GET /api/videos/{publicId} (SI-04.12)

Usado pelo polling de processamento (per TD-12) na tela de upload em processamento e no painel.

**forwards-to:** `GET /videos/{publicId}` *(derived: project contract source)*

**Response 200 (FE-facing):** `VideoResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### PATCH /api/videos/{publicId} (SI-04.12)

"Save Changes" das telas de edição de vídeo e de upload em processamento.

**forwards-to:** `PATCH /videos/{publicId}` e, condicionalmente, `POST /videos/{publicId}/publish` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `UpdateVideoDto` *(derived: project contract source — fields per source; not re-spelled)* + campo FE-only `publish: boolean` (opcional, default `true`) *(per video-channel-management/TD-03, Revisions 2026-10-18)*

**Response 200 (FE-facing):** `{ video: VideoResponse, published: boolean }` — `video` é o estado final; `published: true` quando o BFF encadeou `publish` com sucesso (o `PATCH` respondeu `status = draft`, `processing_status = ready` e `title` não vazio e o corpo trazia `publish !== false`); `published: false` quando apenas salvou — a UI então informa que o vídeo continua rascunho e será publicado num novo "Save" após o processamento *(per video-channel-management/TD-03, Revisions 2026-10-18 — resolução IC-1/OQ-2)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR / CATEGORY_NOT_FOUND, 403 VIDEO_FORBIDDEN, 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 409 VIDEO_NOT_PUBLISHABLE do `publish` encadeado: convertido em `published: false` com 200 (o salvamento já aconteceu) *(per video-channel-management/TD-03, Revisions 2026-10-18)*

---

#### POST /api/videos/{publicId}/publish (SI-04.12)

**forwards-to:** `POST /videos/{publicId}/publish` *(derived: project contract source)*

**Response 200 (FE-facing):** `VideoResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 403, 404, 409 VIDEO_NOT_PUBLISHABLE: pass-through *(derived: project contract source)*

---

#### POST /api/videos/{publicId}/unpublish (SI-04.12)

**forwards-to:** `POST /videos/{publicId}/unpublish` *(derived: project contract source)*

**Response 200 (FE-facing):** `VideoResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 403, 404: pass-through *(derived: project contract source)*

---

#### DELETE /api/videos/{publicId} (SI-04.12)

**forwards-to:** `DELETE /videos/{publicId}` *(derived: project contract source)*

**Response 204 (FE-facing):** No content — pass-through *(derived: project contract source)*

**Error responses (FE-facing):**
- 403, 404, 503: pass-through *(derived: project contract source)*

---

#### PUT /api/videos/{publicId}/thumbnail (SI-04.12)

**forwards-to:** `PUT /videos/{publicId}/thumbnail` *(derived: project contract source)*

**Request headers:**
- Content-Type: multipart/form-data — o Route Handler repassa o `FormData` recebido sem bufferizar além do limite *(derived: project contract source)*

**Request body:** campo `file` (binário) *(derived: project contract source — constraints per source; not re-spelled)*

**Response 200 (FE-facing):** `VideoResponse` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR / THUMBNAIL_INVALID, 403, 404, 413 THUMBNAIL_TOO_LARGE, 503: pass-through *(derived: project contract source)*

---

#### DELETE /api/videos/{publicId}/thumbnail (SI-04.12)

**forwards-to:** `DELETE /videos/{publicId}/thumbnail` *(derived: project contract source)*

**Response 204 (FE-facing):** No content — pass-through *(derived: project contract source)*

**Error responses (FE-facing):**
- 403, 404, 503: pass-through *(derived: project contract source)*

---

#### PATCH /api/channel (SI-04.12)

"Save Changes" da tela de configurações do canal.

**forwards-to:** `PATCH /channels/me` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `UpdateChannelDto` *(derived: project contract source — fields per source; not re-spelled)*

**Response 200 (FE-facing):** `ChannelResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** quando a resposta traz `nickname` diferente do `channelSlug` da sessão, o Route Handler reescreve `session.channelSlug` e salva o cookie `iron-session` *(per video-channel-management/TD-08; phase-02-auth-frontend/TD-02)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR, 409 NICKNAME_TAKEN: pass-through *(derived: project contract source)*

### Authorization Matrix

_"Owner" = usuário autenticado cujo `Channel` (`channels.user_id`) é o `channel_id` do vídeo (ou o próprio canal em `/channels/me`). "Authenticated" = qualquer JWT válido não-dono. Rotas públicas com auth opcional (per `video-channel-management/TD-07`): sem token → anônimo; token inválido → 401. Rotas de escrita continuam exigindo JWT + `VideosOwnership` (403 `VIDEO_FORBIDDEN` ao não-dono)._

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| GET /categories | ✓ | ✓ | ✓ |
| GET /videos/{publicId} | ✓ só `published` (public ou unlisted); draft → 404 | ✓ só `published`; draft → 404 | ✓ qualquer status |
| GET /videos/{publicId}/playback | ✓ só `published` + `ready` | ✓ só `published` + `ready` | ✓ qualquer status (`ready`) |
| POST /videos | ✗ (401) | ✓ cria no próprio canal | ✓ |
| POST /videos/{publicId}/upload/parts, GET …/upload, POST …/upload/complete, DELETE …/upload (Fase 03) | ✗ | ✗ (403) | ✓ |
| PATCH /videos/{publicId} | ✗ | ✗ (403) | ✓ |
| POST /videos/{publicId}/publish | ✗ | ✗ (403) | ✓ |
| POST /videos/{publicId}/unpublish | ✗ | ✗ (403) | ✓ |
| PUT /videos/{publicId}/thumbnail | ✗ | ✗ (403) | ✓ |
| DELETE /videos/{publicId}/thumbnail | ✗ | ✗ (403) | ✓ |
| DELETE /videos/{publicId} | ✗ | ✗ (403) | ✓ |
| GET /channels/me | ✗ | ✓ (próprio canal) | ✓ |
| PATCH /channels/me | ✗ | ✓ (próprio canal) | ✓ |
| GET /channels/me/videos | ✗ | ✓ (próprio canal; todos os status) | ✓ |
| GET /channels/{nickname} | ✓ | ✓ | ✓ |
| GET /channels/{nickname}/videos | ✓ só `published` + `public` | ✓ só `published` + `public` | ✓ só `published` + `public` (o dono usa o painel para o resto) |

_Páginas do frontend: `/studio/**` exige sessão (layout do estúdio redireciona para `/login?returnTo=` sem sessão); `/channel/{nickname}` é anônima (RSC via `upstream` sem token). Thumbnails em `thumbnails/*` são legíveis anonimamente no storage por bucket policy (per `video-channel-management/TD-10`); `videos/*` continua privado._

### Error Catalog

_Envelope `{ statusCode, error, message }` herdado de `phase-02-auth/TD-07` (`DomainExceptionFilter`); códigos novos entram em `VIDEO_ERROR_CODES` / `CHANNEL_ERROR_CODES` e nas exceções de domínio dos módulos. Códigos da Fase 03 reutilizados sem mudança: `VIDEO_NOT_FOUND`, `VIDEO_FORBIDDEN`, `VIDEO_NOT_READY`, `UPLOAD_NOT_ACTIVE`, `UPLOAD_INCOMPLETE`, `VIDEO_TOO_LARGE`, `VIDEO_UNSUPPORTED_MEDIA_TYPE`, `STORAGE_UNAVAILABLE`, `VALIDATION_ERROR`._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| CATEGORY_NOT_FOUND | 400 | `PATCH /videos/{publicId}` com `category_id` inexistente |
| VIDEO_NOT_PUBLISHABLE | 409 | `POST /videos/{publicId}/publish` com `processing_status ≠ ready` ou `title` vazio (per TD-02) |
| THUMBNAIL_INVALID | 400 | `PUT …/thumbnail`: bytes não são imagem decodificável, tipo fora de JPEG/PNG/WebP ou dimensões < 640×360 (per TD-04) |
| THUMBNAIL_TOO_LARGE | 413 | `PUT …/thumbnail` com arquivo acima de `THUMBNAIL_MAX_BYTES` (5 MiB) |
| NICKNAME_TAKEN | 409 | `PATCH /channels/me` com nickname já usado por outro canal (pré-checagem ou unique violation `23505`) (per TD-08) |
| CHANNEL_NOT_FOUND | 404 | `GET /channels/{nickname}` ou `GET /channels/{nickname}/videos` com nickname inexistente |
| VIDEO_NOT_FOUND | 404 | além da Fase 03: rascunho de terceiro lido por rota pública (não revela existência — per TD-07) |
| VALIDATION_ERROR | 400 | `ValidationPipe` global; inclui nickname reservado, `PATCH` vazio, cursor inválido, `from > to` |

### Events/Messages

_Fila pg-boss no PostgreSQL (schema `pgboss`), consumida pelo `video-worker` (per `phase-03-upload-processing/TD-04`, `TD-05`). Os jobs `video.process` e `upload.expire` da Fase 03 permanecem inalterados; esta fase acrescenta um job._

#### video.delete

**Payload:**

```json
{ "videoId": "uuid", "publicId": "dQw4w9WgXcQ", "storageKey": "videos/dQw4w9WgXcQ/source", "thumbnailKeys": ["thumbnails/dQw4w9WgXcQ/auto.jpg", "thumbnails/dQw4w9WgXcQ/custom.jpg"] }
```

_O payload carrega as chaves porque a linha de `videos` já foi removida quando o job roda (hard delete, per `video-channel-management/TD-09`); `thumbnailKeys` lista só as chaves não nulas no momento da exclusão._

**Producer:** `VideosService.deleteVideo` — `queue.send('video.delete', payload, { singletonKey: 'video-delete:<videoId>', retryLimit: 3, retryBackoff: true })` na **mesma transação** do `DELETE` da linha (opção `db` do pg-boss, como no `complete` da Fase 03) (per `video-channel-management/TD-09`, `phase-03-upload-processing/TD-11`)
**Consumer:** `VideoDeletionWorker` em `src/worker/video-deletion.worker.ts`, registrado no `WorkerModule` (per `phase-03-upload-processing/TD-05`)
**Trigger:** `DELETE /videos/{publicId}` confirmado (COMMIT); se existia sessão multipart `active`, o `AbortMultipartUpload` ocorre antes, de forma síncrona, na própria requisição
**Delivery semantics:** at-least-once; handler idempotente — `deleteObject` tolera `NoSuchKey`; outros erros de storage relançam para o retry do pg-boss; na última tentativa loga `video.delete failed` com as chaves restantes (a lifecycle do bucket não cobre objetos completos — fica como pendência operacional documentada no `nestjs-project/CLAUDE.md`) (per `video-channel-management/TD-09`)

### UI Contracts

_Fonte: `docs/inventories/screen-inventory-phase-04-video-channel-management.md` (5 telas validadas) + a tela de escolha do arquivo derivada por resolução de OQ-1 (não inventariada — cota do Figma MCP). Rotas do estúdio confirmadas (OQ-4). Rendering strategy transversal: RSC lê via `upstream` com o token da sessão; Client Components só nos formulários, no uploader e no polling; mutações por Route Handler + `fetch` + `router.refresh()` (per `video-channel-management/TD-12`, `phase-02-auth-frontend/TD-04..TD-06`). Shell compartilhado (TopNav/SideNav do Figma) entra nesta fase como o `AppHeader` existente com links de estúdio (OQ-3) + layout do estúdio; a navbar completa e o menu lateral são Fase 07. Textos de UI em inglês como no design; títulos corrigidos per OQ-9._

#### Screen: Painel de gerenciamento de vídeos (My videos list)

**Route:** `/studio/videos`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824 (node `0RBoWy5FbrK8SHEz1eK6gb:152:1824`)
**Purpose:** "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)"

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `GET /channels/me/videos`, `DELETE /videos/{publicId}`, `POST …/publish|unpublish`)_

**Rendering strategy:** Server Component (RSC) para a página e a lista — `upstream.GET('/channels/me/videos')` com os `searchParams` (`status`, `visibility`, `q`, `sort`, `from`, `to`, `cursor`) como estado de filtro na URL; Client Components: barra de filtros/busca/ordenação (escrevem `searchParams` via `router.replace`), menu kebab + diálogo de confirmação (mutações via BFF + `router.refresh()`), hook de polling para linhas `uploading|processing` _(source: video-channel-management/TD-12)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav (152:1827) — header compartilhado (escopo fase 07); nesta fase ganha links "Meus vídeos"/"Meu canal" (OQ-3)
- `components/ui/icon-button.tsx` — Menu trigger, Voice search, IconButton "add" — escopo fase 07; o "+" do header abre `/studio/upload`
- `components/auth/brand-logo.tsx` — BrandLogo / Size=sm — herdado da fase 02
- `components/layout/global-search.tsx (new)` — Search global — escopo fase 07 (home/busca); nesta fase apenas navega (shell)
- `components/ui/avatar.tsx (new)` — Avatar da conta — abre o menu do usuário; escopo fase 07
- `components/layout/side-nav.tsx (new)` — SideNav — menu lateral compartilhado (escopo fase 07)
- `components/layout/side-nav-item.tsx (new)` — SideNav items — links `<Link>`; "Your videos" aponta para esta tela
- `components/layout/side-nav-subscriptions.tsx (new)` — Lista de canais inscritos — placeholder (dados fase 06)
- `components/ui/separator.tsx (new)` — Divisores
- `components/studio/studio-page-header.tsx (new)` — cabeçalho da página — título + subtítulo + ação primária
- `components/ui/button.tsx` — Button "Upload video" (primary), "Filter" (secondary), chips "Public"/"Date"
- `components/studio/video-filters.tsx (new)` — Filters — altera a consulta da lista paginada (TD-06)
- `components/ui/search-input.tsx (new)` — Search "Search your videos" — ícone + limpar; compõe `components/ui/input.tsx`
- `components/studio/video-sort-menu.tsx (new)` — Sort actions — compõe `components/ui/dropdown-menu.tsx (new)`; opções não desenhadas
- `components/studio/video-list.tsx (new)` — container das linhas — lista paginada por cursor (TD-06)
- `components/studio/video-list-item.tsx (new)` — VideoList — linha 1088×160; dados do backend
- `components/video/video-thumbnail.tsx (new)` — thumb + duração — 256×144; URL estável (TD-10)
- `components/studio/video-stats.tsx (new)` — linha de métricas — contadores (TD-05) + tempo de publicação (`published_at`, TD-02)
- `components/ui/badge.tsx (new)` — Status — só "Public" desenhado; variantes `draft`/`unlisted`/`processing`/`failed` derivadas
- `components/studio/video-row-actions.tsx (new)` — button kebab — Editar / Publicar / Despublicar / Excluir com confirmação; compõe `components/ui/dropdown-menu.tsx (new)` e `components/ui/dialog.tsx (new)`

**Server-connected components:**
- `Lista de vídeos / VideoList` — verbs: Exibir lista paginada de vídeos do canal com thumbnail, título, métricas, tempo de publicação e status | endpoint: RSC → `GET /channels/me/videos` (§API Contracts backend tier; leitura direta via `upstream`, sem rota BFF) | reuse: `components/studio/video-list.tsx (new)`, `components/studio/video-list-item.tsx (new)`
- `Button "Upload video"` — verbs: Iniciar upload de vídeo novo | endpoint: navegação para `/studio/upload` (o `POST /api/videos` acontece na tela de upload) | reuse: `components/ui/button.tsx`
- `Filters / Button "Public" / Button "Date"` — verbs: Filtrar vídeos do canal por visibilidade; Filtrar vídeos do canal por data | endpoint: `GET /channels/me/videos?visibility=&status=&from=&to=` via `searchParams` (RSC) | reuse: `components/studio/video-filters.tsx (new)`
- `Search "Search your videos"` — verbs: Buscar vídeos do próprio canal por texto | endpoint: `GET /channels/me/videos?q=` via `searchParams` (RSC) | reuse: `components/ui/search-input.tsx (new)`
- `Sort actions` — verbs: Ordenar a lista de vídeos do canal | endpoint: `GET /channels/me/videos?sort=` via `searchParams` (RSC) | reuse: `components/studio/video-sort-menu.tsx (new)`
- `button kebab` — verbs: Acessar a edição de um vídeo a partir do painel; Publicar ou despublicar um vídeo a partir do painel; Excluir um vídeo do canal (com confirmação) | endpoint: `<Link>` para `/studio/videos/{publicId}/edit`; `POST /api/videos/{publicId}/publish`, `POST /api/videos/{publicId}/unpublish`, `DELETE /api/videos/{publicId}` (§API Contracts → BFF tier) + `router.refresh()` | reuse: `components/studio/video-row-actions.tsx (new)`
- `polling de processamento` — verbs: (suporte) manter status das linhas `uploading`/`processing` atualizado | endpoint: `GET /api/videos/{publicId}` (§API Contracts → BFF tier) via `useProcessingPoll` (§Frontend Runtime) | reuse: hook em `hooks/use-processing-poll.ts (new)`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` do segmento com skeleton de 6 linhas (não desenhado — derivado, OQ-7)
- Empty: estado vazio "No videos yet" + botão "Upload video" quando `items` vazio e sem filtros; com filtros ativos, "No videos match your filters" + limpar filtros (não desenhado — derivado)
- Success: cabeçalho "Channel content" + subtítulo, barra de filtros, contador "{total} videos", lista; cada linha com thumbnail (duração sobreposta), título (1 linha, ellipsis), descrição (ellipsis), métricas (views/likes/comentários com rótulo acessível), tempo de publicação relativo (`published_at`, ou "Draft" quando nulo) e badge de status: `Public` (success), `Unlisted` (neutral), `Draft` (muted), `Processing` (info, com polling), `Failed` (destructive, com `processing_error`)
- Error: upstream 401 após refresh → redirect `/login?returnTo=/studio/videos`; demais falhas de leitura → `error.tsx` do segmento com retry; falhas de mutação → toast com mensagem do envelope

*Interactions:*
- `Filters` chips / `Search` (debounce 300 ms) / `Sort actions` → `router.replace` com novos `searchParams` (reset de `cursor`) → RSC refaz a lista
- `button kebab` → abre `dropdown-menu`; "Editar" → navega; "Publicar"/"Despublicar" → BFF → `router.refresh()`; "Excluir" → abre `dialog` de confirmação → `DELETE` → `router.refresh()`
- "Load more" (não desenhado — derivado de TD-06) → `router.replace` com `cursor=next_cursor` acrescentando itens (ou nova página); mecanismo exato fica no SI da tela
- linhas `uploading`/`processing` → `useProcessingPoll` → ao mudar para `ready|failed`, `router.refresh()`

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VALIDATION_ERROR` (filtros/cursor) | Ignorar parâmetro inválido e recarregar sem ele; toast discreto |
| `VIDEO_NOT_PUBLISHABLE` | Toast "Video is still processing or has no title — edit it before publishing" com link para a edição |
| `VIDEO_FORBIDDEN` / `VIDEO_NOT_FOUND` (mutação em linha obsoleta) | Toast + `router.refresh()` |
| `STORAGE_UNAVAILABLE` (exclusão) | Toast com retry |
| `UNAUTHORIZED` (401 pós-refresh) | Redirect para `/login?returnTo=` |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_
- `q`: máx. 100 chars (input `maxLength`)
- `from`/`to`: datas válidas com `from ≤ to` antes de aplicar

**Accessibility notes:**
- Botões icon-only (menu, busca, mic, "+", avatar, kebab) com `aria-label`
- Duração sobreposta na thumbnail precisa de fundo escurecido para contraste
- Status não só por cor: texto + variante visual por estado; métricas com rótulo ("124K views", "5.2K likes", "432 comments") em vez de ícone mudo
- Kebab: `aria-haspopup="menu"`, navegação por teclado do `dropdown-menu`; diálogo de exclusão com foco preso e `aria-describedby`

#### Screen: Edição de vídeo (Edit/Publish video)

**Route:** `/studio/videos/{publicId}/edit`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790 (node `0RBoWy5FbrK8SHEz1eK6gb:156:2790`)
**Purpose:** "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada"

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `PATCH /videos/{publicId}`, `PUT …/thumbnail`, `GET /videos/{publicId}` como dono)_

**Rendering strategy:** RSC carrega `GET /videos/{publicId}` (dono) e `GET /categories` via `upstream` e passa `initialVideo` + `categories` por props; Client Component `video-edit-form` (react-hook-form + Zod, per `phase-02-auth-frontend/TD-04`) submete `PATCH /api/videos/{publicId}` e `PUT/DELETE /api/videos/{publicId}/thumbnail`; `router.refresh()` após sucesso _(source: video-channel-management/TD-12)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav (156:2792) — shell (fase 07)
- `components/ui/icon-button.tsx` — Menu trigger, Voice search, IconButton "add"
- `components/auth/brand-logo.tsx` — BrandLogo / Size=sm
- `components/layout/global-search.tsx (new)` — Search field — shell (fase 07)
- `components/ui/avatar.tsx (new)` — Avatar do usuário — shell (fase 07)
- `components/layout/side-nav.tsx (new)`, `components/layout/side-nav-item.tsx (new)`, `components/layout/side-nav-subscriptions.tsx (new)` — SideNav — shell (fase 07)
- `components/studio/video-edit-form.tsx (new)` — Channel card (156:2796) — formulário completo (Details, Thumbnail, Category, Visibility, rodapé)
- `components/ui/card.tsx` — Card — herdado da fase 02
- `components/ui/label.tsx` — FormLabel "Title"/"Description" — herdado
- `components/ui/input.tsx` — TextField "Title" — herdado
- `components/ui/textarea.tsx (new)` — Textarea "Description" — primitivo shadcn
- `components/studio/video-config-card.tsx (new)` — CardVideoConfig — preview, link público, nome do arquivo, qualidade (somente leitura)
- `components/studio/video-preview.tsx (new)` — Video preview — poster + play; `<video>` com `stream_url` quando `ready` (player completo é fase 05)
- `components/studio/copy-link-button.tsx (new)` — Copy link icon — clipboard, sem I/O
- `components/ui/section-header.tsx (new)` — SectionHeader Thumbnail/Category/Visibility
- `components/studio/thumbnail-preview.tsx (new)` — ThumbUpload — thumbnail atual (customizada ou automática)
- `components/ui/button.tsx` — "Change Thumbnail" (outline), "Cancel" (outline), "Save Changes" (primary) — herdado; `components/studio/thumbnail-upload-button.tsx (new)` envolve `<input type="file">`
- `components/ui/select.tsx (new)` — Category select — primitivo; `components/studio/category-select.tsx (new)` recebe as categorias por props
- `components/studio/privacy-option.tsx (new)` — PrivacyOption Public/Unlisted — baseado em `components/ui/radio-group.tsx (new)`
- `components/studio/video-checks-status.tsx (new)` — Status (2771:2088) — reflete `processing_status` (só sucesso desenhado)

**Server-connected components:**
- `Edit/Publish video (página)` — verbs: Carregar dados atuais do vídeo para edição (título, descrição, categoria, thumbnail, visibilidade, status) | endpoint: RSC → `GET /videos/{publicId}` + `GET /categories` (§API Contracts backend tier via `upstream`) | reuse: `app/(app)/studio/videos/[publicId]/edit/page.tsx (new)`
- `video-edit-form` — verbs: Editar título e descrição do vídeo; Escolher categoria do vídeo; Alterar visibilidade do vídeo entre público e unlisted; Salvar alterações das informações do vídeo; Publicar vídeo ao salvar um rascunho pronto (sair do estado de rascunho) | endpoint: `PATCH /api/videos/{publicId}` com `publish: true` (§API Contracts → BFF tier — encadeia `publish` per TD-03 Revisions) | reuse: `components/studio/video-edit-form.tsx (new)`
- `Category select` — verbs: Listar categorias disponíveis para escolha | endpoint: `GET /categories` lido no RSC e passado por props (sem fetch cliente) | reuse: `components/studio/category-select.tsx (new)`
- `ThumbUpload` — verbs: Exibir thumbnail atual do vídeo | endpoint: `thumbnail_url` de `VideoResponse` (URL estável, TD-10) | reuse: `components/studio/thumbnail-preview.tsx (new)`
- `Button "Change Thumbnail"` — verbs: Enviar thumbnail customizada | endpoint: `PUT /api/videos/{publicId}/thumbnail` (§API Contracts → BFF tier); reverter → `DELETE /api/videos/{publicId}/thumbnail` | reuse: `components/studio/thumbnail-upload-button.tsx (new)`
- `CardVideoConfig › Video preview` — verbs: Exibir preview do vídeo a partir da playback URL | endpoint: RSC → `GET /videos/{publicId}/playback` quando `processing_status = ready` (§API Contracts backend tier) | reuse: `components/studio/video-preview.tsx (new)`
- `CardVideoConfig` — verbs: Exibir metadados do arquivo (link público, nome do arquivo, qualidade) | endpoint: campos de `VideoResponse`; link público `${origin}/watch/{publicId}` (OQ-5) | reuse: `components/studio/video-config-card.tsx (new)`
- `Status` — verbs: Exibir status de processamento do vídeo que condiciona a publicação | endpoint: `processing_status`/`processing_error` de `VideoResponse`; `useProcessingPoll` enquanto não `ready|failed` (§Frontend Runtime) | reuse: `components/studio/video-checks-status.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton do formulário (derivado)
- Empty: not applicable (vídeo inexistente/de terceiro → `notFound()` 404)
- Success: título "Edit video" (OQ-9), formulário pré-preenchido; `Save Changes` desabilitado até o form ficar dirty; status: `uploading`/`processing` → "Processing… you can save, publishing happens when ready"; `ready` + `draft` → "Checks complete. Saving will publish this video."; `published` → "Published on {published_at}"; `failed` → "Processing failed: {processing_error}"
- Error: 404 → `not-found.tsx`; erros de campo (`VALIDATION_ERROR`, `CATEGORY_NOT_FOUND`) inline via `components/auth/field-error.tsx`; thumbnail inválida/grande → mensagem na seção Thumbnail; `STORAGE_UNAVAILABLE` → toast com retry

*Interactions:*
- `PrivacyOption` click → marca a opção (radiogroup); valor só vai ao servidor no Save
- `Change Thumbnail` → abre seletor de arquivo (`accept="image/jpeg,image/png,image/webp"`) → `PUT` imediato com estado "Uploading…" → atualiza preview com `thumbnail_url` (cache-busting `?v=`); "Remove custom thumbnail" (derivado) → `DELETE` → volta à automática
- `Copy link` → `navigator.clipboard.writeText` + feedback "Copied" 2 s
- `Save Changes` → `PATCH /api/videos/{publicId}` (`publish: true`) → se `published: true`, toast "Video published" + `router.refresh()`; se `published: false`, toast "Changes saved — the video stays a draft until processing finishes" + `router.refresh()`
- `Cancel` → volta a `/studio/videos` descartando alterações (confirmação se dirty — derivado)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VALIDATION_ERROR` | Erro inline no campo (title/description) |
| `CATEGORY_NOT_FOUND` | Erro inline no select de categoria + recarregar categorias |
| `VIDEO_NOT_PUBLISHABLE` | Não chega à UI: o BFF converte em `published: false` (toast informativo) |
| `THUMBNAIL_INVALID` | Mensagem inline na seção Thumbnail ("Use a JPEG, PNG or WebP image of at least 640×360") |
| `THUMBNAIL_TOO_LARGE` | Mensagem inline ("Max 5 MB") |
| `VIDEO_FORBIDDEN` / `VIDEO_NOT_FOUND` | `not-found.tsx` / redirect ao painel com toast |
| `STORAGE_UNAVAILABLE` | Toast com retry |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_
- `title`: required, trim, 1..100 chars
- `description`: máx. 5000 chars (contador de caracteres — derivado)
- `category_id`: uuid de uma categoria listada ou vazio
- `visibility`: `public | unlisted`
- thumbnail `file`: tipo `image/jpeg | image/png | image/webp`, ≤ 5 MiB (checagem pré-envio); dimensões mínimas validadas no servidor

**Accessibility notes:**
- `PrivacyOption`: `role="radiogroup"`/`role="radio"`, navegação por setas, `aria-checked`
- "Change Thumbnail" como `<label>` ligado a `<input type="file">`; imagem da thumbnail com `alt` descritivo
- Select de categoria com `<Label>` associado (o SectionHeader não é label)
- Ícones de copiar link, busca por voz, "+" e menu com `aria-label`; mensagem de status com `aria-live="polite"`; contraste do texto de status (muted 12px) a verificar

#### Screen: Edição do canal (Channel Settings)

**Route:** `/studio/channel`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367 (node `0RBoWy5FbrK8SHEz1eK6gb:154:1367`)
**Purpose:** "Edição das informações do canal: nickname, nome e descrição"

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `GET /channels/me`, `PATCH /channels/me`)_

**Rendering strategy:** RSC carrega `GET /channels/me` via `upstream` e passa `initialChannel` por props; Client Component `channel-settings-form` (react-hook-form + Zod) submete `PATCH /api/channel`; após sucesso `router.refresh()` (o BFF já reescreveu `channelSlug` na sessão) _(source: video-channel-management/TD-12; TD-08)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav (154:1369) — shell (fase 07)
- `components/ui/icon-button.tsx` — Menu trigger, Voice search, IconButton add
- `components/auth/brand-logo.tsx` — BrandLogo
- `components/layout/global-search.tsx (new)`, `components/ui/avatar.tsx (new)`, `components/layout/side-nav.tsx (new)`, `components/layout/side-nav-item.tsx (new)`, `components/layout/side-nav-subscriptions.tsx (new)` — shell (fase 07)
- `components/channel/channel-header-card.tsx (new)` — Channel card (154:1486) — banner, avatar, nome, nickname e contadores
- `components/ui/card.tsx` — Card (154:1509, 154:1513) — herdado
- `components/channel/channel-banner.tsx (new)` — banner — gradiente estático (placeholder, OQ-6)
- `components/ui/avatar.tsx (new)` — Avatar 2xl — iniciais do nome (placeholder, OQ-6)
- `components/icons/groups-icon.tsx (new)`, `components/icons/videocam-icon.tsx (new)`, `components/icons/alarm-icon.tsx (new)` — ícones das metas e do "Last updated"
- `components/channel/channel-settings-form.tsx (new)` — Canal (154:1512) — formulário (validação local + submissão)
- `components/ui/label.tsx` — FormLabel "Channel handle"/"Display name" — herdado
- `components/ui/input.tsx` — TextField handle / display name — herdado; helper texts como `<p>`
- `components/ui/textarea.tsx (new)` — Textarea description
- `components/ui/button.tsx` — "Cancel" (outline/sm), "Save Changes" (default/sm) — herdado

**Server-connected components:**
- `Channel card` — verbs: Exibir as informações atuais do canal (nome, nickname) no cabeçalho; Exibir contador de vídeos do canal | endpoint: RSC → `GET /channels/me` (§API Contracts backend tier) | reuse: `components/channel/channel-header-card.tsx (new)`
- `Canal (formulário)` — verbs: Carregar os valores atuais do canal (nickname, nome, descrição e data da última atualização) no formulário; Salvar alterações das informações do canal (nickname, nome e descrição) | endpoint: valores por props do RSC; `PATCH /api/channel` (§API Contracts → BFF tier — reescreve `channelSlug` na sessão) | reuse: `components/channel/channel-settings-form.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton (derivado)
- Empty: not applicable
- Success: título "Channel Settings"; cabeçalho com banner/avatar placeholder, nome, `@nickname`, "{video_count} videos" (contador de inscritos oculto — fase 06); formulário com `@` como prefixo visual fixo do handle, "Display name" = nome do canal (OQ-9), descrição, "Last updated: {updated_at}"; `Save Changes` desabilitado até dirty; sucesso → toast "Channel updated" e `router.refresh()`
- Error: `NICKNAME_TAKEN` → erro inline no handle ("This handle is already taken"); `VALIDATION_ERROR` → inline por campo (inclui reservado); 401 → redirect `/login?returnTo=/studio/channel`

*Interactions:*
- `Cancel` → descarta alterações não salvas e volta a `/studio/videos`
- `Save Changes` → `PATCH /api/channel` → sucesso: `router.refresh()` (header/menus passam a usar o novo nickname); links `/channel/{nickname}` antigos quebram (TD-08)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VALIDATION_ERROR` | Erro inline no campo (handle: formato/reservado; name; description) |
| `NICKNAME_TAKEN` | Erro inline no handle com sugestão de variação |
| `UNAUTHORIZED` | Redirect `/login?returnTo=` |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_
- `nickname`: `^[a-z0-9_]{3,50}$` (sem `@`), não reservado
- `name`: required, trim, 1..50 chars
- `description`: máx. 1000 chars (contador — derivado)

**Accessibility notes:**
- `Textarea` sem `FormLabel` no Figma: usar `aria-labelledby` apontando para o heading "Description" ou converter o heading em `<Label>`
- Helper texts ligados por `aria-describedby`; ícones decorativos (groups, videocam, alarm) com `aria-hidden`
- Contraste de "Last updated" (12px muted) a verificar

#### Screen: Página pública do canal (Channel Show)

**Route:** `/channel/{nickname}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (node `0RBoWy5FbrK8SHEz1eK6gb:155:1926`)
**Purpose:** "Página pública do canal com informações e listagem de vídeos"

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `GET /channels/{nickname}`, `GET /channels/{nickname}/videos`)_

**Rendering strategy:** Server Component (RSC) completo — `upstream.GET('/channels/{nickname}')` + `upstream.GET('/channels/{nickname}/videos', { sort, cursor })` sem token; `generateMetadata` com nome/descrição do canal; único Client Component: grupo de chips de ordenação (escreve `?sort=` via `router.replace`) e "Load more" (`?cursor=`) _(source: video-channel-management/TD-12; TD-07)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav (155:1928) — shell (fase 07); para visitante mostra "Entrar"/"Criar conta"
- `components/ui/icon-button.tsx` — Menu trigger / IconButton add / IconButton notifications (sino — fase 06, oculto)
- `components/auth/brand-logo.tsx` — BrandLogo
- `components/layout/global-search.tsx (new)`, `components/ui/avatar.tsx (new)`, `components/layout/side-nav.tsx (new)`, `components/layout/side-nav-item.tsx (new)`, `components/layout/side-nav-subscriptions.tsx (new)` — shell (fase 07)
- `components/layout/app-shell.tsx (new)` — Body — layout SideNav + Main content
- `components/channels/channel-banner.tsx (new)` — channel banner (156:3511) — placeholder (OQ-6); mesmo componente de `components/channel/channel-banner.tsx (new)` — implementar uma vez em `components/channel/`
- `components/ui/avatar.tsx (new)` — Avatar 2xl — iniciais (placeholder)
- `components/channels/channel-header.tsx (new)` — channel header row — container info + ações (implementar em `components/channel/`)
- `components/channels/channel-info.tsx (new)` — channel info — nome, `@nickname`, "{video_count} videos", descrição (contador de inscritos oculto — fase 06)
- `components/ui/button.tsx` — Button Subscribe — fase 06: não renderizar nesta fase
- `components/ui/tabs.tsx (new)` — Tabs "Videos"/"About" — aba About sem conteúdo (fora do escopo, OQ-7): renderizar só "Videos"
- `components/ui/separator.tsx (new)` — Divider
- `components/channels/channel-video-sort.tsx (new)` — Filter chips Latest/Popular/Oldest — Server-connected (TD-06)
- `components/ui/filter-chip.tsx (new)` — FilterChip — toggle; reporta seleção ao pai
- `components/channels/channel-video-grid.tsx (new)` — Video grid — grid responsivo; sem estado vazio desenhado
- `components/videos/video-card.tsx (new)` — VideoCard — thumbnail 16:9, título 2 linhas, views, tempo de publicação; variante sem linha de canal nesta página; link para `/watch/{publicId}` (rota da fase 05 — `<Link>` para rota ainda inexistente, OQ-5)

**Server-connected components:**
- `channel info` — verbs: Exibir informações públicas do canal (nome, nickname e descrição) a partir do nickname da rota; Exibir total de vídeos públicos do canal | endpoint: RSC → `GET /channels/{nickname}` (§API Contracts backend tier) | reuse: `components/channels/channel-info.tsx (new)`
- `Video grid + VideoCard` — verbs: Exibir listagem de vídeos públicos do canal; Exibir thumbnail, título, visualizações e tempo de publicação de cada vídeo | endpoint: RSC → `GET /channels/{nickname}/videos?sort=&cursor=` (§API Contracts backend tier) | reuse: `components/channels/channel-video-grid.tsx (new)`, `components/videos/video-card.tsx (new)`
- `Filter chips` — verbs: Reordenar a listagem de vídeos do canal (mais recentes / populares / mais antigos) | endpoint: `GET /channels/{nickname}/videos?sort=latest|popular|oldest` via `searchParams` (RSC) | reuse: `components/channels/channel-video-sort.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton de cabeçalho + 8 cards (derivado)
- Empty: "This channel has no public videos yet" (derivado, OQ-7)
- Success: banner + avatar placeholder, nome (`<h1>`), `@nickname`, "{video_count} videos", descrição; tabs com "Videos" ativa; chips com "Latest" ativo; grid de cards; "Load more" quando `next_cursor` não nulo
- Error: nickname inexistente → `notFound()` (`not-found.tsx` com link para a home); falha de upstream → `error.tsx`

*Interactions:*
- chip click → `router.replace('?sort=…')` → RSC refaz a listagem (reset de cursor)
- "Load more" → `router.replace('?sort=…&cursor=…')` (mecanismo exato no SI da tela)
- card click → navega para `/watch/{publicId}` (404 até a fase 05)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `CHANNEL_NOT_FOUND` | `not-found.tsx` da rota |
| `VALIDATION_ERROR` (sort/cursor) | Ignorar parâmetro e renderizar com defaults |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_
- `sort`: um de `latest | popular | oldest` (qualquer outro → default)

**Accessibility notes:**
- Tabs com `role="tablist"`/`role="tab"`/`aria-selected` e navegação por setas; chips como radiogroup (`aria-checked`) ou `aria-pressed`
- Thumbnails com `alt` = título (ou `alt=""` quando o título já é o texto do link); banner decorativo `alt=""`; avatar com `alt` = nome do canal
- Títulos truncados em 2 linhas mantêm o texto completo acessível (`title`)
- "Load more" como botão real; `generateMetadata` com título "{name} (@{nickname}) — StreamTube"

#### Screen: Upload de vídeo (escolha do arquivo)

**Route:** `/studio/upload`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1724 (node `0RBoWy5FbrK8SHEz1eK6gb:154:1724`) — _não inventariada (cota do Figma MCP); contrato derivado da capability e da tela de processamento (resolução OQ-1); extension run de `/screen-inventory 4` pendente_
**Purpose:** "Painel de gerenciamento de vídeos do canal (…)" — UI de upload adiada da Fase 03 ("a UI de upload entra na Fase 04 com o painel do canal")

**Auth requirement:** Authenticated _(source: §Authorization Matrix — `POST /videos` cria no próprio canal)_

**Rendering strategy:** página RSC mínima (título "Upload video") + Client Component `upload-dropzone` que, ao escolher o arquivo, chama `POST /api/videos` e entrega o `File` ao `UploadProvider` do estúdio (§Frontend Runtime / TD-11) e navega para `/studio/upload/{publicId}` _(source: video-channel-management/TD-11, TD-12)_

**Reused DS components:**
- `components/layout/app-header.tsx` — shell
- `components/ui/card.tsx` — container do dropzone — herdado
- `components/upload/upload-dropzone.tsx (new)` — dropzone/seletor de arquivo (derivado) — `accept="video/mp4,video/webm"`, arrastar-e-soltar, estados idle/dragging/erro
- `components/ui/button.tsx` — "Select file" — herdado

**Server-connected components:**
- `upload-dropzone` — verbs: Iniciar upload de vídeo novo (selecionar arquivo e abrir a sessão multipart) | endpoint: `POST /api/videos` (§API Contracts → BFF tier) → `UploadProvider.start(file, VideoCreatedResponse)` → `router.push('/studio/upload/{publicId}')` | reuse: `components/upload/upload-dropzone.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: not applicable (página estática)
- Empty: estado idle com instruções "Drag and drop a video file or select one — MP4 or WebM, up to 10 GB"
- Success: arquivo aceito → "Creating upload…" → navegação para a tela de processamento com o envio já em andamento
- Error: tipo não aceito ou > 10 GiB → mensagem inline antes de qualquer chamada; `VIDEO_UNSUPPORTED_MEDIA_TYPE`/`VIDEO_TOO_LARGE` → mensagem inline; `STORAGE_UNAVAILABLE` → toast com retry

*Interactions:*
- drag enter/leave → estado `dragging`; drop/seleção → validação local → `POST /api/videos` → `UploadProvider.start` → `router.push`

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VIDEO_UNSUPPORTED_MEDIA_TYPE` | Inline: "Only MP4 and WebM files are supported" |
| `VIDEO_TOO_LARGE` | Inline: "Files must be 10 GB or smaller" |
| `STORAGE_UNAVAILABLE` | Toast com retry |
| `UNAUTHORIZED` | Redirect `/login?returnTo=/studio/upload` |

**Client-side validation mirror:** _(source: contrato de `POST /videos` da Fase 03 — `phase-03-upload-processing/TD-03`, `TD-14`)_
- `content_type`: `video/mp4 | video/webm`
- `size_bytes`: 1..10 GiB
- `original_filename`: 1..255 chars

**Accessibility notes:**
- Dropzone com `<input type="file">` real e `<label>`; instruções e erros com `aria-live="polite"`; foco visível no botão "Select file"

#### Screen: Upload em processamento (Upload video processing)

**Route:** `/studio/upload/{publicId}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110 (node `0RBoWy5FbrK8SHEz1eK6gb:156:2110`)
**Purpose:** "Painel de gerenciamento de vídeos do canal (…)" — etapa de progresso/processamento do upload adiado da Fase 03

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `GET /videos/{publicId}` como dono, `PATCH /videos/{publicId}`, `DELETE …/upload`)_

**Rendering strategy:** RSC carrega `GET /videos/{publicId}` (dono) + `GET /categories` via `upstream`; Client Components: `upload-status-row` lendo o progresso do `UploadProvider` (TD-11) e, após o `complete`, `useProcessingPoll` (TD-12); o formulário reutiliza `video-edit-form` da tela de edição (mesmos componentes Figma) submetendo `PATCH /api/videos/{publicId}` com `publish: true` _(source: video-channel-management/TD-11, TD-12)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav (156:2112) — shell
- `components/ui/icon-button.tsx`, `components/auth/brand-logo.tsx`, `components/layout/global-search.tsx (new)`, `components/ui/avatar.tsx (new)`, `components/layout/side-nav.tsx (new)`, `components/layout/side-nav-item.tsx (new)`, `components/layout/side-nav-subscriptions.tsx (new)` — shell (fase 07)
- `components/upload/upload-video-form.tsx (new)` — Channel card (156:2136) — mesmo formulário de `components/studio/video-edit-form.tsx (new)`: implementar uma vez (studio) e compor aqui com a linha de status
- `components/ui/card.tsx` — Card — herdado
- `components/upload/upload-status-row.tsx (new)` — upload info row — nome do arquivo + "Uploading… 84%" + rótulo de status
- `components/icons/video-file-icon.tsx (new)` — ícone video_file
- `components/upload/upload-status-badge.tsx (new)` — Status label — `uploading | processing | ready | failed` (só `uploading` desenhado)
- `components/ui/progress.tsx (new)` — ProgressLinear — progresso do envio multipart e, depois, indeterminado durante `processing`
- `components/ui/label.tsx`, `components/ui/input.tsx` — Title — herdados
- `components/ui/textarea.tsx (new)` — Description
- `components/upload/video-config-card.tsx (new)`, `components/upload/video-preview.tsx (new)`, `components/upload/copy-link-button.tsx (new)` — CardVideoConfig — mesmos componentes de `components/studio/*` da tela de edição: implementar uma vez em `components/studio/`
- `components/ui/section-header.tsx (new)` — SectionHeader
- `components/upload/thumb-upload.tsx (new)`, `components/upload/duration-badge.tsx (new)` — ThumbUpload + duração (overlay no canto inferior direito) — mesmo `components/studio/thumbnail-preview.tsx (new)`
- `components/ui/button.tsx` — "Change Thumbnail", "Cancel", "Save Changes" — herdado
- `components/ui/select.tsx (new)` — Category select
- `components/upload/privacy-option.tsx (new)` — PrivacyOption — mesmo `components/studio/privacy-option.tsx (new)`
- `components/upload/processing-checks-status.tsx (new)` — Status "Checks complete…" — mesmo `components/studio/video-checks-status.tsx (new)`

**Server-connected components:**
- `ProgressLinear + upload info row` — verbs: Acompanhar progresso do envio e do processamento do vídeo | endpoint: `POST /api/videos/{publicId}/upload/parts` → `PUT` direto em `S3_PUBLIC_ENDPOINT` → `POST /api/videos/{publicId}/upload/complete`; retomada via `GET /api/videos/{publicId}/upload` (§API Contracts → BFF tier; orquestração em `lib/upload/multipart-uploader.ts (new)`, TD-11) | reuse: `components/upload/upload-status-row.tsx (new)`, `components/ui/progress.tsx (new)`
- `Status label "Uploading"` — verbs: Exibir status do processamento do vídeo (uploading → processing → ready / failed) | endpoint: progresso local (uploader) e `GET /api/videos/{publicId}` por `useProcessingPoll` após o `complete` (§Frontend Runtime) | reuse: `components/upload/upload-status-badge.tsx (new)`
- `Status "Checks complete. No issues found."` — verbs: Exibir resultado das verificações do arquivo enviado (formato, probe, thumbnail) | endpoint: `processing_status`/`processing_error` de `VideoResponse` (polling) | reuse: `components/upload/processing-checks-status.tsx (new)`
- `CardVideoConfig (Video preview, Duration badge)` — verbs: Exibir metadados extraídos do vídeo (nome do arquivo, qualidade, duração) e pré-visualização | endpoint: `VideoResponse` (placeholders até `ready`); preview via `GET /videos/{publicId}/playback` só quando `ready` (RSC em `router.refresh()`) | reuse: `components/upload/video-config-card.tsx (new)`
- `ThumbUpload` — verbs: Exibir a thumbnail atual do vídeo (gerada no processamento ou customizada) | endpoint: `thumbnail_url` (null até o worker gerar) | reuse: `components/upload/thumb-upload.tsx (new)`
- `Button "Change Thumbnail"` — verbs: Substituir a thumbnail por uma imagem customizada | endpoint: `PUT /api/videos/{publicId}/thumbnail` (§API Contracts → BFF tier) | reuse: `components/ui/button.tsx`
- `Channel card (TextField Title, Textarea Description)` — verbs: Preencher título e descrição enquanto o vídeo processa e salvar as alterações; Salvar o rascunho enquanto processa e publicá-lo ao salvar quando estiver pronto | endpoint: `PATCH /api/videos/{publicId}` com `publish: true` (§API Contracts → BFF tier; `published: false` enquanto não `ready`) | reuse: `components/upload/upload-video-form.tsx (new)`
- `Category select` — verbs: Listar as categorias disponíveis e selecionar a categoria do vídeo | endpoint: `GET /categories` no RSC, por props | reuse: `components/ui/select.tsx (new)`
- `PrivacyOption (Public / Unlisted)` — verbs: Definir a visibilidade do vídeo como público ou unlisted | endpoint: campo `visibility` do `PATCH` | reuse: `components/upload/privacy-option.tsx (new)`
- `CardVideoConfig (Video link)` — verbs: Exibir o link público do vídeo para compartilhamento | endpoint: `${origin}/watch/{publicId}` (OQ-5) | reuse: `components/upload/copy-link-button.tsx (new)`
- `Button "Cancel"` — verbs: Cancelar o upload em andamento (abortar o envio e descartar o rascunho) | endpoint: `UploadProvider.cancel()` + `DELETE /api/videos/{publicId}/upload` (sessão ativa) ou `DELETE /api/videos/{publicId}` (envio já concluído — descarta o rascunho) após diálogo de confirmação (§API Contracts → BFF tier) | reuse: `components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton (derivado)
- Empty: not applicable
- Success: título "Upload video" (OQ-9); linha de status com barra: `uploading` ("Uploading… {pct}%", azul), `processing` ("Processing…", barra indeterminada), `ready` ("Ready", success) ou `failed` ("Failed: {processing_error}", destructive); formulário editável durante todo o fluxo; rodapé: status de verificações (`pending` até `ready`, ok em `ready`, falha em `failed`) + Cancel/Save Changes; `Save Changes` com vídeo não pronto → "Changes saved — the video stays a draft until processing finishes"
- Error: recarga da página com upload em voo perdido (estado só no provider) → linha de status mostra "Upload interrupted — select the file again to resume" com `GET /api/videos/{publicId}/upload` para retomar as partes já enviadas (TD-03 da Fase 03); `UPLOAD_NOT_ACTIVE` → mensagem e link ao painel; `processing_error` → mensagem por código (`UNSUPPORTED_FORMAT`, `PROBE_FAILED`, `THUMBNAIL_FAILED`, `OBJECT_MISSING`)

*Interactions:*
- `UploadProvider` emite progresso → `ProgressLinear` + "Uploading… {pct}%" (`aria-live`)
- `complete` 202 → `useProcessingPoll` a cada 3 s até `ready|failed` → `router.refresh()` (habilita preview/thumbnail automática)
- `Change Thumbnail` → `PUT` → preview atualiza (`?v=`)
- `Save Changes` → `PATCH` (`publish: true`) → toast conforme `published`
- `Cancel` → diálogo "Cancel upload? The file and this draft will be discarded." → abort/delete → volta ao painel
- `beforeunload` enquanto `uploading` → aviso do navegador (TD-11)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `UPLOAD_NOT_ACTIVE` | Banner "This upload session has expired or was cancelled" + link ao painel |
| `UPLOAD_INCOMPLETE` | Retentar `complete` após reconsultar `GET …/upload`; se persistir, banner com retry |
| `VIDEO_TOO_LARGE` | Inline (pré-validado no dropzone) |
| `VALIDATION_ERROR` / `CATEGORY_NOT_FOUND` | Inline nos campos |
| `VIDEO_NOT_PUBLISHABLE` | Não chega à UI (`published: false`) |
| `THUMBNAIL_INVALID` / `THUMBNAIL_TOO_LARGE` | Inline na seção Thumbnail |
| `STORAGE_UNAVAILABLE` | Toast com retry (partes: o uploader retenta com backoff antes de exibir) |
| `UNAUTHORIZED` | Redirect `/login?returnTo=` |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_
- `title`: trim, 1..100 chars (obrigatório para publicar; vazio mantém o default do pré-cadastro)
- `description`: máx. 5000 chars
- `category_id`: uuid de uma categoria listada ou vazio
- `visibility`: `public | unlisted`
- thumbnail `file`: `image/jpeg | image/png | image/webp`, ≤ 5 MiB

**Accessibility notes:**
- `ProgressLinear` com `role="progressbar"`, `aria-valuenow/min/max`; texto "Uploading… 84%" em `aria-live="polite"`
- Rótulo de status com texto/ícone por estado, não só cor
- `PrivacyOption` como `fieldset`/`legend` com `<input type="radio">` reais; "Change Thumbnail" ligado a `<input type="file">` acessível; `check_circle` com `aria-hidden`; copiar link com nome acessível e feedback "Copied"
- Diálogo de cancelamento com foco preso

### Frontend Runtime

#### video-channel-management/TD-12 — Estratégia de dados do frontend — RSC, polling e invalidação

**Pattern:** as necessidades desta fase são estreitas (um polling condicional e invalidação por recarga de rota), o padrão já existe desde a Fase 02 e a documentação do TanStack recomenda não adotá-lo em apps RSC sem necessidade concreta. Reavaliar na Fase 06 (likes/comentários otimistas), quando a Option B passa a pagar seu custo; a migração é aditiva (Provider + hooks), não substitui os Route Handlers. Concretamente: páginas leem no servidor com `upstream` (token da sessão quando houver); mutações continuam em Route Handlers (`phase-02-auth-frontend/TD-05`); após sucesso, `router.refresh()`; um hook `useProcessingPoll` faz `fetch('/api/videos/{publicId}')` a cada poucos segundos **só** enquanto houver vídeos fora de `ready|failed`, e chama `router.refresh()` quando mudam. Sem `cacheComponents`: `fetch` não é cacheado por padrão no Next 16 e páginas que leem `cookies()` são dinâmicas, então `router.refresh()` sempre reexecuta o RSC.

**Setup:** canonical shape — F2-load-bearing only. The implementer pastes this verbatim and extends with derivable boilerplate.

```tsx
// next-frontend/hooks/use-processing-poll.ts
const POLL_INTERVAL_MS = 3_000;
const TERMINAL = new Set(["ready", "failed"]);
// polls only the ids still in flight; stops by itself when every id is terminal
const res = await fetch(`/api/videos/${publicId}`);           // BFF route, never upstream
const { processing_status } = (await res.json()) as VideoResponse;
if (TERMINAL.has(processing_status)) router.refresh();        // RSC re-renders with fresh data
```

```tsx
// next-frontend/components/upload/upload-provider.tsx   (TD-11 — upload state outlives navigation inside /studio)
<UploadProvider>{children}</UploadProvider>   // mounted once in app/(app)/studio/layout.tsx
window.addEventListener("beforeunload", warnWhileUploading);  // only while an upload is in flight
```

**Aplicação:**
- **Adopts the pattern:** todas as páginas de `/studio/**` e `/channel/{nickname}` leem via `upstream` em RSC (per `## UI Inventory → ### Server-connected Components`: listas, formulários pré-preenchidos, cabeçalhos de canal, categorias); todas as mutações dos componentes Server-connected (`video-edit-form`, `channel-settings-form`, `video-row-actions`, `thumbnail-upload-button`, `upload-dropzone`, `Button "Cancel"` da tela de upload) usam Route Handlers do BFF + `router.refresh()`; `useProcessingPoll` é adotado por `Status label "Uploading"`, `Status "Checks complete…"` (tela de upload) e pelas linhas `uploading|processing` de `VideoList` (painel).
- **Excludes / boundaries:**
  - `ProgressLinear + upload info row` — o progresso do envio multipart vem do `UploadProvider` (estado cliente, TD-11), não de polling; o polling começa só depois do `complete` 202.
  - `Filter chips`, `Filters`, `Search`, `Sort actions` — estado de filtro vive nos `searchParams` da URL (RSC refaz a leitura); nenhum fetch cliente.
  - `Category select` — recebe as categorias por props do RSC; sem fetch cliente.
  - Nenhum componente usa TanStack Query, SWR ou cache cliente nesta fase (reavaliar na Fase 06).

**Migração:**

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/components/layout/app-header.tsx` | Header mínimo da Fase 02 (logo + e-mail + Sair) | Acrescentar, para sessão autenticada, links "Meus vídeos" (`/studio/videos`) e "Meu canal" (`/studio/channel`) (OQ-3) | SI-04.13 |
| `next-frontend/lib/api/contracts.ts` | Aliases só de auth | Acrescentar aliases de vídeos, canal, categorias e listagens (per `next-frontend-openapi-typing/TD-04`) | SI-04.10 |
| `next-frontend/mocks/handlers/index.ts` | Barrel só com `auth` | Registrar `videos.ts`, `channels.ts`, `categories.ts` (per `next-frontend-msw-foundation/TD-01`) | SI-04.10 |

**Verificação:**
- **Unit:** `useProcessingPoll` (`renderHook`, timers falsos): não dispara quando todos os ids são terminais; dispara `fetch('/api/videos/{id}')` a cada 3 s para ids em voo; chama `router.refresh()` exatamente uma vez quando um id vira `ready|failed`; limpa o timer no unmount. `UploadProvider`: `start` registra o upload, `cancel` aborta, `beforeunload` é registrado só enquanto `uploading`.
- **Integration:** Route Handlers do BFF como funções + MSW (`*.integration.test.ts`): `PATCH /api/videos/{id}` encadeia `publish` só quando `draft` + `ready` + título, e converte `VIDEO_NOT_PUBLISHABLE` em `published: false`; `PATCH /api/channel` reescreve `channelSlug` na sessão.
- **E2E:** Playwright com MSW server-side: painel renderiza a lista vinda do RSC sem fetch cliente (nenhuma chamada a `/api/videos` enquanto todas as linhas são `ready`); tela de upload em processamento sai de `processing` para `ready` após o fixture mudar (polling + `router.refresh()`).
- **Regression guards:** `components/layout/__tests__/app-header.test.tsx` (header da Fase 02) e os `*.integration.test.ts` de `app/api/auth/**` continuam passando; `lib/auth/__tests__/refresh.integration.test.ts` prova que o refresh single-flight segue cobrindo as novas rotas.

### UI ↔ API Traceability Matrix

_Endpoints de leitura de página são consumidos em RSC via `upstream` (sem rota BFF — TD-12) e aparecem com o path do backend tier; endpoints chamados pelo navegador aparecem na forma `{fe-facing} → forwards-to {upstream}` do BFF tier._

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Exibir lista paginada de vídeos do canal com thumbnail, título, métricas, tempo de publicação e status | Lista de vídeos / VideoList | /studio/videos | GET /channels/me/videos (RSC) | video-channel-management/TD-05, TD-06, TD-12 |
| Iniciar upload de vídeo novo | Button "Upload video" | /studio/videos | navegação → /studio/upload (POST /api/videos → forwards-to POST /videos na tela de upload) | video-channel-management/TD-11 |
| Filtrar vídeos do canal por visibilidade | Button "Public" em Filters | /studio/videos | GET /channels/me/videos?visibility= (RSC) | video-channel-management/TD-06 |
| Filtrar vídeos do canal por data | Button "Date" em Filters | /studio/videos | GET /channels/me/videos?from=&to= (RSC) | video-channel-management/TD-06 |
| Buscar vídeos do próprio canal por texto | Search "Search your videos" | /studio/videos | GET /channels/me/videos?q= (RSC) | video-channel-management/TD-06 |
| Ordenar a lista de vídeos do canal | Sort actions | /studio/videos | GET /channels/me/videos?sort= (RSC) | video-channel-management/TD-06 |
| Acessar a edição de um vídeo a partir do painel | VideoList — linha/título ou menu kebab | /studio/videos | navegação → /studio/videos/{publicId}/edit | video-channel-management/TD-12 |
| Publicar ou despublicar um vídeo a partir do painel | button kebab em VideoList | /studio/videos | POST /api/videos/{publicId}/publish → forwards-to POST /videos/{publicId}/publish; POST /api/videos/{publicId}/unpublish → forwards-to POST /videos/{publicId}/unpublish | video-channel-management/TD-02, TD-03 |
| Excluir um vídeo do canal (com confirmação) | button kebab em VideoList | /studio/videos | DELETE /api/videos/{publicId} → forwards-to DELETE /videos/{publicId} | video-channel-management/TD-09 |
| Carregar dados atuais do vídeo para edição (título, descrição, categoria, thumbnail, visibilidade, status) | Edit/Publish video | /studio/videos/{publicId}/edit | GET /videos/{publicId} + GET /categories (RSC) | video-channel-management/TD-07, TD-12 |
| Editar título e descrição do vídeo | Channel card › video-edit-form | /studio/videos/{publicId}/edit | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} | video-channel-management/TD-03 |
| Salvar alterações das informações do vídeo | Button "Save Changes" | /studio/videos/{publicId}/edit | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} (+ POST …/publish encadeado) | video-channel-management/TD-03 |
| Alterar visibilidade do vídeo entre público e unlisted | Button "Save Changes" (valor escolhido em PrivacyOption) | /studio/videos/{publicId}/edit | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} | video-channel-management/TD-02 |
| Publicar vídeo ao salvar um rascunho pronto (sair do estado de rascunho) | Button "Save Changes" | /studio/videos/{publicId}/edit | PATCH /api/videos/{publicId} → forwards-to POST /videos/{publicId}/publish (encadeado) | video-channel-management/TD-02, TD-03 |
| Listar categorias disponíveis para escolha | Category select | /studio/videos/{publicId}/edit | GET /categories (RSC, por props) | video-channel-management/TD-01 |
| Escolher categoria do vídeo | Category select + Button "Save Changes" | /studio/videos/{publicId}/edit | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} | video-channel-management/TD-01 |
| Exibir thumbnail atual do vídeo | ThumbUpload | /studio/videos/{publicId}/edit | `thumbnail_url` de GET /videos/{publicId} (RSC) | video-channel-management/TD-04, TD-10 |
| Enviar thumbnail customizada | Button "Change Thumbnail" | /studio/videos/{publicId}/edit | PUT /api/videos/{publicId}/thumbnail → forwards-to PUT /videos/{publicId}/thumbnail | video-channel-management/TD-04 |
| Exibir preview do vídeo a partir da playback URL | CardVideoConfig › Video preview | /studio/videos/{publicId}/edit | GET /videos/{publicId}/playback (RSC, só `ready`) | video-channel-management/TD-07 |
| Exibir metadados do arquivo (link público, nome do arquivo, qualidade) | CardVideoConfig | /studio/videos/{publicId}/edit | GET /videos/{publicId} (RSC) | video-channel-management/TD-12 |
| Exibir status de processamento do vídeo que condiciona a publicação | Status | /studio/videos/{publicId}/edit | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} (polling) | video-channel-management/TD-02, TD-12 |
| Exibir as informações atuais do canal (nome, nickname) no cabeçalho | Channel card | /studio/channel | GET /channels/me (RSC) | video-channel-management/TD-08 |
| Exibir contador de vídeos do canal | Channel card › videos meta | /studio/channel | GET /channels/me (RSC) — `video_count` | video-channel-management/TD-08 |
| Carregar os valores atuais do canal (nickname, nome, descrição e data da última atualização) no formulário | Canal | /studio/channel | GET /channels/me (RSC, por props) | video-channel-management/TD-08 |
| Salvar alterações das informações do canal (nickname, nome e descrição) | Button "Save Changes" em Canal | /studio/channel | PATCH /api/channel → forwards-to PATCH /channels/me | video-channel-management/TD-08 |
| Exibir informações públicas do canal (nome, nickname e descrição) a partir do nickname da rota | channel info | /channel/{nickname} | GET /channels/{nickname} (RSC) | video-channel-management/TD-07, TD-08 |
| Exibir total de vídeos públicos do canal | Videos count em channel info | /channel/{nickname} | GET /channels/{nickname} (RSC) — `video_count` | video-channel-management/TD-08 |
| Exibir listagem de vídeos públicos do canal | Video grid + VideoCard | /channel/{nickname} | GET /channels/{nickname}/videos (RSC) | video-channel-management/TD-06, TD-07 |
| Exibir thumbnail, título, visualizações e tempo de publicação de cada vídeo | VideoCard | /channel/{nickname} | GET /channels/{nickname}/videos (RSC) — `VideoCardItem` | video-channel-management/TD-05, TD-10 |
| Reordenar a listagem de vídeos do canal (mais recentes / populares / mais antigos) | Filter chips | /channel/{nickname} | GET /channels/{nickname}/videos?sort= (RSC) | video-channel-management/TD-06 |
| Iniciar upload de vídeo novo (selecionar arquivo e abrir a sessão multipart) | upload-dropzone | /studio/upload | POST /api/videos → forwards-to POST /videos | video-channel-management/TD-11 |
| Acompanhar progresso do envio e do processamento do vídeo | ProgressLinear + upload info row | /studio/upload/{publicId} | POST /api/videos/{publicId}/upload/parts → forwards-to POST /videos/{publicId}/upload/parts; PUT direto no storage; POST /api/videos/{publicId}/upload/complete → forwards-to POST /videos/{publicId}/upload/complete; GET /api/videos/{publicId}/upload → forwards-to GET /videos/{publicId}/upload | video-channel-management/TD-11 |
| Exibir status do processamento do vídeo (uploading → processing → ready / failed) | Status label "Uploading" | /studio/upload/{publicId} | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} (polling) | video-channel-management/TD-12 |
| Exibir resultado das verificações do arquivo enviado (formato, probe, thumbnail) | Status "Checks complete. No issues found." | /studio/upload/{publicId} | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} (polling) | video-channel-management/TD-12 |
| Exibir metadados extraídos do vídeo (nome do arquivo, qualidade, duração) e pré-visualização | CardVideoConfig (Video preview, Duration badge) | /studio/upload/{publicId} | GET /videos/{publicId} + GET /videos/{publicId}/playback (RSC após `ready`) | video-channel-management/TD-07, TD-12 |
| Exibir a thumbnail atual do vídeo (gerada no processamento ou customizada) | ThumbUpload | /studio/upload/{publicId} | `thumbnail_url` de GET /videos/{publicId} | video-channel-management/TD-04, TD-10 |
| Substituir a thumbnail por uma imagem customizada | Button "Change Thumbnail" | /studio/upload/{publicId} | PUT /api/videos/{publicId}/thumbnail → forwards-to PUT /videos/{publicId}/thumbnail | video-channel-management/TD-04 |
| Preencher título e descrição enquanto o vídeo processa e salvar as alterações | Channel card (TextField Title, Textarea Description) via Button "Save Changes" | /studio/upload/{publicId} | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} | video-channel-management/TD-03 |
| Listar as categorias disponíveis e selecionar a categoria do vídeo | Category select | /studio/upload/{publicId} | GET /categories (RSC, por props) + PATCH /api/videos/{publicId} | video-channel-management/TD-01 |
| Definir a visibilidade do vídeo como público ou unlisted | PrivacyOption (Public / Unlisted) via Channel card | /studio/upload/{publicId} | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} | video-channel-management/TD-02 |
| Exibir o link público do vídeo para compartilhamento | CardVideoConfig (Video link) | /studio/upload/{publicId} | — (derivado de `public_id`: `${origin}/watch/{publicId}`, OQ-5) | video-channel-management/TD-02 |
| Salvar o rascunho enquanto processa e publicá-lo ao salvar quando estiver pronto | Button "Save Changes" | /studio/upload/{publicId} | PATCH /api/videos/{publicId} → forwards-to PATCH /videos/{publicId} (+ POST …/publish encadeado quando `ready`) | video-channel-management/TD-02, TD-03 |
| Cancelar o upload em andamento (abortar o envio e descartar o rascunho) | Button "Cancel" | /studio/upload/{publicId} | DELETE /api/videos/{publicId}/upload → forwards-to DELETE /videos/{publicId}/upload (sessão ativa) ou DELETE /api/videos/{publicId} → forwards-to DELETE /videos/{publicId} | video-channel-management/TD-09, TD-11 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix (nenhuma nesta fase)._

---

## Dependency Map

```
Bootstrap (frontend primitives e componentes apresentacionais)
SI-04.0.1 (root — shadcn install)
├── SI-04.0.2 — depends on SI-04.0.1 (tests batch 1)
├── SI-04.0.3 — depends on SI-04.0.1 (tests batch 2)
├── SI-04.0.8 — depends on SI-04.0.1 (badge)
├── SI-04.0.9 — depends on SI-04.0.1 (select) + SI-04.0.6 (section-header)
├── SI-04.0.10 — depends on SI-04.0.1 (avatar, separator)
├── SI-04.0.11 — depends on SI-04.0.1 (progress, badge) + SI-04.0.7 (video-file-icon)
├── SI-04.0.14 — depends on SI-04.0.1 (radio-group)
├── SI-04.0.16 — depends on SI-04.0.1 (dropdown-menu, dialog)
└── SI-04.0.17 — depends on SI-04.0.1 (dropdown-menu)
SI-04.0.4 (root — filter-chip)
└── SI-04.0.12 — depends on SI-04.0.4
SI-04.0.5 (root — search-input)
└── SI-04.0.15 — depends on SI-04.0.5
SI-04.0.6 (root — section-header)   SI-04.0.7 (root — icons)   SI-04.0.13 (root — copy-link-button)

Backend
SI-04.1 (root — categorias)
└── SI-04.2 — depends on SI-04.1 (FK category_id)
    ├── SI-04.3 — depends on SI-04.2 (status/visibility no modelo)
    │   └── SI-04.4 — depends on SI-04.1, SI-04.2, SI-04.3
    ├── SI-04.5 — depends on SI-04.2 (custom_thumbnail_key, updated_at)
    │   └── SI-04.6 — depends on SI-04.2, SI-04.5
    │       └── SI-04.9 — depends on SI-04.2, SI-04.6 (payload com thumbnails)
    └── SI-04.7 — depends on SI-04.2 (video_count)
        └── SI-04.8 — depends on SI-04.2, SI-04.5, SI-04.7
SI-04.10 — depends on SI-04.1 … SI-04.9 (export do contrato final)

Frontend runtime, BFF e uploader
SI-04.11 (root — Frontend Runtime Setup: layout do estúdio, UploadProvider, useProcessingPoll)
├── SI-04.13 — depends on SI-04.11 (Migration: links do AppHeader)
└── SI-04.14 — depends on SI-04.11, SI-04.12 (uploader usa provider + rotas BFF)
SI-04.12 — depends on SI-04.10 (Route Handlers BFF tipados pelos aliases)

Telas (audit → shell → wiring; wiring depende dos endpoints)
SI-04.15.0 — depends on SI-04.0.1
└── SI-04.15a — depends on SI-04.15.0 + SI-04.0.1, SI-04.11
    └── SI-04.15b — depends on SI-04.15a + SI-04.10, SI-04.12, SI-04.14
SI-04.16.0 — depends on SI-04.0.1, SI-04.0.6, SI-04.0.7, SI-04.0.9, SI-04.0.11, SI-04.0.13, SI-04.0.14
└── SI-04.16a — depends on SI-04.16.0 + bootstrap acima + SI-04.11
    └── SI-04.16b — depends on SI-04.16a + SI-04.3, SI-04.4, SI-04.6, SI-04.9, SI-04.10, SI-04.12, SI-04.14
SI-04.17.0 — depends on SI-04.0.1, SI-04.0.5, SI-04.0.8, SI-04.0.15, SI-04.0.16, SI-04.0.17
└── SI-04.17a — depends on SI-04.17.0 + bootstrap acima + SI-04.11
    └── SI-04.17b — depends on SI-04.17a + SI-04.4, SI-04.5, SI-04.8, SI-04.9, SI-04.10, SI-04.12
SI-04.18.0 — depends on SI-04.0.1, SI-04.0.6, SI-04.0.9, SI-04.0.13, SI-04.0.14
└── SI-04.18a — depends on SI-04.18.0 + bootstrap acima + SI-04.11
    └── SI-04.18b — depends on SI-04.18a + SI-04.1, SI-04.3, SI-04.4, SI-04.6, SI-04.10, SI-04.12
SI-04.19.0 — depends on SI-04.0.1, SI-04.0.7, SI-04.0.10
└── SI-04.19a — depends on SI-04.19.0 + bootstrap acima + SI-04.11
    └── SI-04.19b — depends on SI-04.19a + SI-04.7, SI-04.10, SI-04.12
SI-04.20.0 — depends on SI-04.0.1, SI-04.0.4, SI-04.0.10, SI-04.0.11, SI-04.0.12
└── SI-04.20a — depends on SI-04.20.0 + bootstrap acima
    └── SI-04.20b — depends on SI-04.20a + SI-04.5, SI-04.7, SI-04.8, SI-04.10
```

_Ordem de execução sugerida: bootstrap (0.1 → 0.17) em paralelo com o backend (1 → 9); depois 10 → 12 → 11 → 13 → 14; telas na ordem 20 (pública, sem BFF) → 17 → 18 → 19 → 15 → 16, cada uma `.0` → `a` → `b`._

---

## Deliverables

- [ ] SI-04.0.1 — Infra: install batch shadcn primitives
- [ ] SI-04.0.2 — Tests shadcn batch 1 (≤5 files)
- [ ] SI-04.0.3 — Tests shadcn batch 2 (≤5 files)
- [ ] SI-04.0.4 — Custom-ui: filter-chip.tsx
- [ ] SI-04.0.5 — Custom-ui: search-input.tsx
- [ ] SI-04.0.6 — Custom-ui: section-header.tsx
- [ ] SI-04.0.7 — Custom-business simple group: alarm-icon + groups-icon + video-file-icon + videocam-icon
- [ ] SI-04.0.8 — Custom-business simple group: studio-page-header + video-list + video-list-item + video-stats + video-thumbnail
- [ ] SI-04.0.9 — Custom-business simple group: category-select + thumbnail-preview + video-checks-status + video-config-card + video-preview
- [ ] SI-04.0.10 — Custom-business simple group: channel-banner + channel-header + channel-header-card + channel-info + channel-video-grid
- [ ] SI-04.0.11 — Custom-business simple group: upload-status-badge + upload-status-row + video-card
- [ ] SI-04.0.12 — Custom-business complex: channel-video-sort
- [ ] SI-04.0.13 — Custom-business complex: copy-link-button
- [ ] SI-04.0.14 — Custom-business complex: privacy-option
- [ ] SI-04.0.15 — Custom-business complex: video-filters
- [ ] SI-04.0.16 — Custom-business complex: video-row-actions
- [ ] SI-04.0.17 — Custom-business complex: video-sort-menu
- [ ] SI-04.1 — Criar catálogo de categorias
- [ ] SI-04.2 — Estender modelo do vídeo com publicação, visibilidade, categoria e contadores
- [ ] SI-04.3 — Implementar autenticação opcional e regra de leitura pública
- [ ] SI-04.4 — Endpoints PATCH /videos/{publicId}, POST …/publish e POST …/unpublish
- [ ] SI-04.5 — Entrega pública de thumbnails com URL estável
- [ ] SI-04.6 — Endpoints PUT e DELETE /videos/{publicId}/thumbnail
- [ ] SI-04.7 — Endpoints GET/PATCH /channels/me e GET /channels/{nickname}
- [ ] SI-04.8 — Endpoints de listagem GET /channels/me/videos e GET /channels/{nickname}/videos
- [ ] SI-04.9 — Endpoint DELETE /videos/{publicId} e job video.delete
- [ ] SI-04.10 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- [ ] SI-04.11 — Estratégia de dados do frontend — RSC, polling e invalidação (Setup)
- [ ] SI-04.12 — Route Handlers BFF de vídeos, upload e canal
- [ ] SI-04.13 — `components/layout/app-header.tsx` → Estratégia de dados do frontend (links do estúdio)
- [ ] SI-04.14 — Implementar cliente de upload multipart no navegador
- [ ] SI-04.15.0 — Drift audit: Upload de vídeo (escolha do arquivo)
- [ ] SI-04.15a — Tela de Upload de vídeo (escolha do arquivo) (visual shell)
- [ ] SI-04.15b — Tela de Upload de vídeo (escolha do arquivo) (lógica & wiring)
- [ ] SI-04.16.0 — Drift audit: Upload em processamento (Upload video processing)
- [ ] SI-04.16a — Tela de Upload em processamento (visual shell)
- [ ] SI-04.16b — Tela de Upload em processamento (lógica & wiring)
- [ ] SI-04.17.0 — Drift audit: Painel de gerenciamento de vídeos (My videos list)
- [ ] SI-04.17a — Tela de Painel de gerenciamento de vídeos (visual shell)
- [ ] SI-04.17b — Tela de Painel de gerenciamento de vídeos (lógica & wiring)
- [ ] SI-04.18.0 — Drift audit: Edição de vídeo (Edit/Publish video)
- [ ] SI-04.18a — Tela de Edição de vídeo (visual shell)
- [ ] SI-04.18b — Tela de Edição de vídeo (lógica & wiring)
- [ ] SI-04.19.0 — Drift audit: Edição do canal (Channel Settings)
- [ ] SI-04.19a — Tela de Edição do canal (visual shell)
- [ ] SI-04.19b — Tela de Edição do canal (lógica & wiring)
- [ ] SI-04.20.0 — Drift audit: Página pública do canal (Channel Show)
- [ ] SI-04.20a — Tela de Página pública do canal (visual shell)
- [ ] SI-04.20b — Tela de Página pública do canal (lógica & wiring)

**Per-screen deliverables** _(ui_in_scope: true)_:

- [ ] Screen Painel de gerenciamento de vídeos (`/studio/videos`) is routable
- [ ] Screen Painel de gerenciamento de vídeos (`/studio/videos`) renders loading, success, empty and error states
- [ ] Screen Painel de gerenciamento de vídeos (`/studio/videos`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Edição de vídeo (`/studio/videos/{publicId}/edit`) is routable
- [ ] Screen Edição de vídeo (`/studio/videos/{publicId}/edit`) renders loading, success, 404 and error states
- [ ] Screen Edição de vídeo (`/studio/videos/{publicId}/edit`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Edição do canal (`/studio/channel`) is routable
- [ ] Screen Edição do canal (`/studio/channel`) renders loading, success, and error states
- [ ] Screen Edição do canal (`/studio/channel`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Página pública do canal (`/channel/{nickname}`) is routable
- [ ] Screen Página pública do canal (`/channel/{nickname}`) renders loading, success, empty, 404 and error states
- [ ] Screen Página pública do canal (`/channel/{nickname}`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Upload de vídeo (`/studio/upload`) is routable
- [ ] Screen Upload de vídeo (`/studio/upload`) renders idle, dragging and error states
- [ ] Screen Upload de vídeo (`/studio/upload`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Upload em processamento (`/studio/upload/{publicId}`) is routable
- [ ] Screen Upload em processamento (`/studio/upload/{publicId}`) renders uploading, processing, ready, failed and error states
- [ ] Screen Upload em processamento (`/studio/upload/{publicId}`) passes component tests (per testing-guide-next-frontend layers)

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Type/compilation checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`; `cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`; `cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev"` then on the host `npx playwright test` — on Windows `node node_modules/@playwright/test/cli.js test`)
- [ ] OpenAPI contract chain is in sync (`docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` → `docker compose exec next-frontend npm run openapi:types` → `git diff --exit-code nestjs-project/openapi.json next-frontend/openapi.json next-frontend/lib/api/types.gen.ts`)
