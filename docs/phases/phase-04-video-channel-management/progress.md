# phase-04-video-channel-management — Progress

**Status:** completed
**SIs:** 49/49 completed

### SI-04.0.1 — Infra: install batch shadcn primitives
- **Status:** completed
- **Tests:** no tests (Infra)
- **Observations:**
  - **Tooling:** shadcn CLI 4.22.1 rewrote the `cn` helper import as `from "cn"` (instead of `@/lib/utils`) in all 10 generated files and added a bogus `cn` npm dependency; imports fixed back to `@/lib/utils` and `cn` uninstalled (package.json/lockfile back to original).
  - Generated `dialog`, `dropdown-menu` and `select` imported `lucide-react` (not installed, forbidden by `next-frontend-ui.md`); replaced with new custom icons `components/icons/{x,chevron-down,chevron-up,chevron-right}-icon.tsx` + existing `check-icon.tsx`, per the Phase 02 pattern.
  - `dialog.tsx` close button used size `icon-sm`, absent from the project's `Button`; changed to `icon`. `button.tsx` was NOT overwritten (CLI overwrite prompt answered "no").
  - Not done here (out of scope for an Infra SI): Figma reconciliation of the new primitives' base classes (rule `next-frontend-ui.md` § shadcn) — happens through the drift audits (`SI-04.X.0`) / visual shells. `badge.tsx` ships shadcn's default variants only (no `success`); SI-04.0.2's badge test row mentions `success` — to be reconciled there.

### SI-04.0.2 — Tests shadcn batch 1 (≤5 files)
- **Status:** completed
- **Tests:** 25 passing (5 files: avatar 3, badge 7, dialog 6, dropdown-menu 5, progress 4); tsc 0; lint 0
- **Observations:**
  - Tokens `--success`/`--success-foreground`/`--success-text` já existiam em `:root` e no bloco dark, mas não estavam mapeados em `@theme inline`; adicionado o mapeamento `--color-success*` em `app/globals.css` para que `bg-success`/`text-success-text` funcionem.
  - Adicionada a variante `success` em `components/ui/badge.tsx` (`bg-success/10 text-success-text`), exigida pelo badge de status "Public" do inventário.
  - Corrigido bug do gerador shadcn em `components/ui/progress.tsx`: `value` era desestruturado e não repassado ao `ProgressPrimitive.Root`, o que deixava `aria-valuenow` ausente e o estado sempre indeterminate.
  - Teste do Avatar substitui `Image` global por um stub (`vi.stubGlobal`) porque o jsdom nunca dispara `load`, e o Radix só monta `AvatarImage` após o carregamento.

### SI-04.0.3 — Tests shadcn batch 2 (≤5 files)
- **Status:** completed
- **Tests:** 26 passing (5 files: radio-group 5, select 6, separator 4, tabs 6, textarea 5); tsc 0; lint 0
- **Observations:**
  - O Select do Radix depende de `hasPointerCapture`, `releasePointerCapture` e `scrollIntoView`, ausentes no jsdom; os stubs ficam no `beforeAll` do próprio `select.test.tsx` (não em `vitest.setup.ts`) para não ampliar o escopo da SI.
  - O teste de setas do RadioGroup segura a tecla (`{ArrowDown>}` + `waitFor` do foco) porque o Radix move o foco em `setTimeout` e só marca o radio enquanto a seta está pressionada; sem isso o user-event solta a tecla antes e a seleção não acontece.
  - Nenhum primitivo deste lote precisou de correção de código.

### SI-04.0.4 — Custom-ui: filter-chip.tsx
- **Status:** completed
- **Tests:** 8 passing (filter-chip.test.tsx); tsc 0; lint 0
- **Observations:**
  - **Desvio do Figma (revisar):** o FilterChip 158:2651 preenche o estado `active` com `--background` e o `default` com `--card`, ambos `#ffffff` no tema claro; na tela do canal (2737:2145) o chip ativo "Latest" fica indistinguível dos demais. Geometria e tipografia seguem o Figma (h-9, px-3 py-2, gap-2, `--radius-2`, `text-body-lg`), mas `active` usa `bg-secondary text-secondary-foreground` e `default` fica transparente com hover `bg-accent/50`, conforme a descrição do componente ("active (filled)"). Se o design for corrigido no Figma, só as duas classes da variante `state` mudam.
  - API: prop `active`; standalone expõe `aria-pressed`; com `role="radio"` (uso previsto em SI-04.0.12, radiogroup Latest/Popular/Oldest) expõe `aria-checked` e omite `aria-pressed`. O chip não guarda estado: só reporta o clique ao pai.
  - A variante com ícone "+" do Figma não ganhou asset nem `plus-icon`: nenhuma tela da fase usa chip com ícone. O chip aceita qualquer SVG filho, dimensionado em 16px pelo seletor descendente.

### SI-04.0.5 — Custom-ui: search-input.tsx
- **Status:** completed
- **Tests:** 9 passing (search-input.test.tsx); tsc 0; lint 0
- **Observations:**
  - Novo ícone `components/icons/search-icon.tsx`, convertido do asset do Figma (lupa 18×18 dentro do frame 72×44, traço 1.5) e recentrado num viewBox 24×24.
  - Layout segue o Figma 158:4007: pílula `h-11`, `pl-5`, `bg-secondary`, `border-border`, placeholder `text-body-md` em `muted-foreground`, slot à direita de 72×44. A descrição do Figma fala em lupa à esquerda e limpar à direita, mas o desenho só tem a lupa à direita; o slot direito mostra a lupa com o campo vazio e o botão "Clear search" (`XIcon`) quando há texto.
  - Compõe `Input` sobrescrevendo borda, fundo, padding e anel de foco via `cn`; o anel de foco passa para o wrapper (`focus-within`). O botão nativo de cancelar do `type="search"` é escondido para não duplicar o limpar.
  - Suporta modo controlado (`value` + `onValueChange`) e não controlado (`defaultValue`); `aria-label` é obrigatório no tipo porque o placeholder não é nome acessível. O debounce de 300 ms fica no consumidor (`video-filters`, SI que depende desta).
  - Sem verificação visual no navegador: o componente ainda não é usado por nenhuma rota; a conferência visual fica para a tela do painel.

### SI-04.0.6 — Custom-ui: section-header.tsx
- **Status:** completed
- **Tests:** 5 passing (section-header.test.tsx); tsc 0; lint 0
- **Observations:**
  - Figma 2390:2258 mapeia direto para tokens existentes: título `text-h2 text-foreground` (Inter SemiBold 20/28), descrição `text-body-md text-muted-foreground` (14/20), `gap-1`. A descrição do componente no Figma cita Roboto Bold/H-3, mas os estilos aplicados são Inter/Heading/H2; segui os estilos aplicados.
  - `id` vai para o heading (`aria-labelledby`) e a descrição recebe `${id}-description` (`aria-describedby`), útil para o radiogroup de visibilidade e o Select de categoria, já que o SectionHeader não é um `<label>`.
  - Heading padrão `h2` com `as="h3"` opcional; Server Component (sem `"use client"`).

### SI-04.0.7 — Custom-business simple group: alarm-icon + groups-icon + video-file-icon + videocam-icon
- **Status:** completed
- **Tests:** no tests (static SVG icons, per plan); tsc 0; lint 0
- **Observations:**
  - `alarm-icon` (viewBox 12×12), `video-file-icon` e `videocam-icon` (24×24) usam os paths exportados do Figma (156:2106, 157:1933, 107:928), com `fill` fixo trocado por `currentColor`.
  - **`groups-icon` sem export do Figma:** a cota do Figma MCP (plano Starter) esgotou na chamada do nó 2450:2302. Usado o path do Material Symbols Outlined `groups` 24px (Apache-2.0, repositório google/material-design-icons), mantido no viewBox original `0 -960 960 960`. A origem foi validada: o `videocam_24px` da mesma fonte, reescalado, coincide ponto a ponto com o export do Figma 107:928. Conferir visualmente contra o Figma quando a cota voltar.
  - **Cota do Figma esgotada:** as próximas SIs que dependem de `get_design_context` (audits `.0` e shells das telas) terão de usar o inventário e os paths já exportados até a cota ser restabelecida.
  - Sem testes, conforme o plano (ícones são SVG estáticos).

### SI-04.0.8 — Custom-business simple group: studio-page-header + video-list + video-list-item + video-stats + video-thumbnail
- **Status:** completed
- **Tests:** 60 passing (video-list-item 16, video-stats 6, video-thumbnail 8, format 22, badge 8); tsc 0; lint 0 (2 warnings pré-existentes em components/auth)
- **Observations:**
  - **Fonte visual sem nova cota do Figma:** medidas, tipografia e ícones vieram do `get_design_context` da tela 152:1824 já gravado no transcript do subagente do screen-inventory (cabeçalho 152:2137, lista 158:3198, linha 158:3096); assets dos ícones de métricas baixados das URLs ainda válidas dessa resposta.
  - Novos ícones `views-icon` (13.5×12), `thumb-up-icon` e `comment-icon` (12×12) para a linha de métricas — não listados nas Technical actions, mas exigidos pelo design de `video-stats`.
  - Novo `lib/format.ts` (`formatCompactNumber` via `Intl.NumberFormat` compact, `formatDuration` m:ss/h:mm:ss, `formatRelativeTime` via `Intl.RelativeTimeFormat` com `now` injetável) com `lib/__tests__/format.test.ts` (22 testes); reutilizável pelos cards da página pública.
  - Tokens: `--warning`, `--warning-foreground`, `--warning-text` e `--overlay` existiam em `:root` mas sem mapeamento em `@theme inline` (mesma falha do `success` em SI-04.0.2); mapeados. Badge ganhou a variante `warning` (estado Processing); teste do badge estendido.
  - Mapa de status (`getVideoStatusBadge`): `failed` → Failed/destructive (com `processing_error` em `title` e sr-only); `uploading|processing` → Processing/warning; `draft` → Draft/outline; `unlisted` → Unlisted/secondary; senão Public/success. O Figma desenha o status como texto verde solto; segui o contrato (Badge).
  - **Inconsistência do plano:** o shape `VideoListItem` (API Contracts → Shapes) não tem `description`, mas o Figma e o UI Contract mostram a descrição na linha. O componente aceita `description` opcional e só renderiza quando presente; incluir o campo no DTO é decisão da SI-04.4/04.8.
  - Props da linha usam um tipo local `VideoListItemData` em snake_case espelhando o `VideoListItem` planejado, porque o tipo gerado só existe após a SI-04.10; trocar por `Pick` do alias de `@/lib/api/contracts` nessa SI.
  - `VideoThumbnail` usa `next/image` com `unoptimized`: o endpoint público do S3 (`S3_PUBLIC_ENDPOINT`) só é acessível pelo navegador, o otimizador do Next no container não alcança; assim também não é preciso `remotePatterns`. Duração sobre `bg-overlay` para contraste (nota de acessibilidade).
  - Nunca publicado mostra "Draft" no lugar do tempo e também o badge Draft, conforme o UI Contract; a repetição pode ser revista na tela (SI-04.15).

### SI-04.0.9 — Custom-business simple group: category-select + thumbnail-preview + video-checks-status + video-config-card + video-preview
- **Status:** completed
- **Tests:** 57 passing (category-select 7, video-checks-status 11, video-config-card 10, video-preview 5, format 24); tsc 0; lint 0
- **Observations:**
  - Fonte visual: `get_design_context` das telas 156:2790 (edição) e 156:2110 (upload) recuperado dos transcripts dos subagentes do screen-inventory (CardVideoConfig 156:3122, ThumbUpload 156:2612, Category select 2096:2238, Status 2771:2088); assets dos ícones baixados das URLs ainda válidas. Sem nova chamada ao Figma (cota esgotada).
  - Novos ícones: `check-circle-icon`, `play-icon`, `image-icon` (paths do Figma) e `error-outline-icon`, `schedule-icon` (Material Icons Outlined 24px, Apache-2.0 — mesma família: o `check_circle_outline` 24px reduzido à metade coincide com o `check_circle` 12px do Figma). O ícone de copiar (97ffd) fica para a SI-04.0.13 (copy-link-button).
  - `video-checks-status`: estados `pending` (uploading) / `processing` / `ready` (rascunho pronto) / `published` / `failed`, textos do UI Contract da edição; `processing_error` mapeado por código do worker (UNSUPPORTED_FORMAT, PROBE_FAILED, THUMBNAIL_FAILED, OBJECT_MISSING — confirmados em `nestjs-project/src/videos/videos.constants.ts`) com fallback; `role=status` + `aria-live=polite`. A tela de upload desenha "Checks complete. No issues found.", mas como o Save também publica ali, o mesmo texto da edição serve às duas.
  - `category-select`: Radix Select não aceita `""` como item, então "No category" usa um sentinel e devolve `null`; `<Label>` associado ao trigger, visualmente oculto porque o SectionHeader titula a seção; aceita `aria-invalid`/`aria-describedby` para os erros `CATEGORY_NOT_FOUND`.
  - `video-config-card`: link interno `/watch/{publicId}` (`next/link`) exibido como `{host}/watch/{publicId}` sem protocolo; qualidade `{height}p` (+ " HD" a partir de 720p) só em `ready`, senão "Available after processing" / "Unavailable" (failed). Slots `preview` e `copyAction`.
  - `thumbnail-preview` usa `aspect-video w-66.5` (266×~150; o Figma tem 266×151, quase 16:9) e o badge de duração dentro da caixa (no Figma ele está fora do bounding box, conforme o inventário). `video-preview` vira `<video controls>` com `streamUrl`; sem ele mostra poster, glifos e duração (ou "0:00").
  - `lib/format.ts` ganhou `formatDate` (medium, UTC para SSR/CSR idênticos). Testes extras além do plano: `video-preview.test.tsx` (VideoPreview + ThumbnailPreview) e casos de `formatDate`.
  - Tipos locais `CategoryOption` e props em camelCase até o alias gerado existir (SI-04.10).

### SI-04.0.10 — Custom-business simple group: channel-banner + channel-header + channel-header-card + channel-info + channel-video-grid
- **Status:** completed
- **Tests:** 21 passing (channel-info 8, channel-video-grid 6, channel-header 7); tsc 0; lint 0
- **Observations:**
  - Fonte visual: `get_design_context` das telas 155:1926 (canal público) e 154:1367 (configurações) recuperado dos transcripts dos subagentes do screen-inventory; sem chamada nova ao Figma.
  - **Pendência da SI-04.0.7 resolvida:** o asset do ícone `groups` (2450:2302) estava na resposta da tela de configurações; é o Material Symbols `groups` 24px reduzido a 16px, a mesma geometria do `groups-icon.tsx` já criado. Nenhuma troca necessária.
  - Tokens novos em `app/globals.css`: `--banner-from`/`--banner-via`/`--banner-to` (gradiente do placeholder do banner, 154:1487) mapeados como `--color-banner-*`; mesmo valor nos dois temas por ser decorativo. O texto "Channel Banner" do Figma é rótulo de placeholder e não foi renderizado.
  - Componente extra `components/channel/channel-avatar.tsx` (Avatar 128px com iniciais via `getInitials`, `role=img` + `aria-label` com o nome do canal), compartilhado por `channel-header` e `channel-header-card` (avatar placeholder, OQ-6).
  - `channel-video-grid` recebe os cards como filhos (cada um vira `<li>`) em vez de importar `VideoCard`, que só nasce na SI-04.0.11 — a dependência declarada desta SI é só a SI-04.0.1. Layout do Figma: `flex-wrap`, `gap-y-10 gap-x-6`, `px-6`, card `w-66.5` entre `min-w-60` e `max-w-90`; estado vazio derivado (OQ-7) e slot `footer` para "Load more".
  - Contador de inscritos (Figma 156:3521 e 154:1497) não renderizado em `channel-info` nem em `channel-header-card` (fase 06); por isso o `groups-icon` ainda não tem consumidor nesta fase.
  - `channel-header` reproduz o posicionamento do Figma (avatar `top-70 left-8` sobre o banner de 320px, linha de info com `pl-46 pr-8 pt-6`); só layout desktop, sem variante mobile desenhada. `channel-header-card` usa `h2` (a página tem o título "Channel Settings" como h1).
  - Teste extra além do plano: `channel-header.test.tsx` (iniciais, banner decorativo, avatar nomeado, card sem inscritos).

### SI-04.0.11 — Custom-business simple group: upload-status-badge + upload-status-row + video-card
- **Status:** completed
- **Tests:** 38 passing (upload-status-row 14, video-card 7, progress 6, video-checks-status 11); suíte completa 296/296; tsc 0; lint 0 (2 warnings pré-existentes)
- **Observations:**
  - Fonte visual: `upload info row` (157:1931) da tela 156:2110 e `VideoCard` (156:3591) da tela 155:1926, recuperados dos transcripts do screen-inventory; sem chamada nova ao Figma.
  - `Progress` (primitivo) ganhou estado indeterminado real: com `value` nulo o indicador vira uma faixa de 1/3 animada (`animate-progress-indeterminate`, keyframes em `@theme inline` no `globals.css`; `motion-reduce` desliga a animação). Antes o indicador ficava fora da trilha e a barra parecia vazia. Teste do progress estendido.
  - Token `--progress-track` existe mas não foi adotado: no tema escuro ele é `#ffffff`, igual ao indicador `primary`, e a barra ficaria invisível. Mantido `bg-muted` (igual ao track no tema claro). Corrigir o token é decisão de design fora do escopo.
  - `upload-status-badge` segue o Figma como texto caption colorido (não um Badge com fundo): Uploading/link, Processing/warning-text, Ready/success-text, Failed/destructive; palavra distinta por estado.
  - `upload-status-row`: porcentagem arredondada e limitada a 0–100; barra determinada em `uploading`, indeterminada em `processing`, completa em `ready`, oculta em `failed`; linha de status com `aria-live=polite`; prop `message` para o caso "Upload interrupted" do contrato.
  - `describeProcessingError` saiu de `components/studio/video-checks-status.tsx` para `lib/processing-error.ts`, porque passou a ser usado também por `components/upload/` (evita dependência entre features).
  - `video-card`: o card inteiro é `<Link href=/watch/{publicId}>`, thumbnail com `alt=""` (o título nomeia o link), título `h3` com `line-clamp-2` e `title`; linha do canal opcional (`showChannel`, desligada na página do próprio canal); selo de verificado do Figma não renderizado (sem conceito no domínio). Tipo local `VideoCardData` até o alias gerado (SI-04.10). Pasta `components/videos/` conforme o plano (a thumbnail da SI-04.0.8 está em `components/video/`).
  - **Correção de acessibilidade em SIs anteriores:** itens inline em contêineres flex estavam sem espaço de texto entre si, e o texto lido saía colado ("124K views5.2K"). Inseridos espaços em `video-stats` (SI-04.0.8) e `channel-info` (SI-04.0.10), com asserção de texto completo nos testes.
  - Suíte completa do frontend executada: 50 arquivos, 296 testes passando.

### SI-04.0.12 — Custom-business complex: channel-video-sort
- **Status:** completed
- **Tests:** 13 passing (channel-video-sort.test.tsx); tsc 0; lint 0
- **Observations:**
  - `channel-video-sort` lê a ordem de `useSearchParams().get("sort")` (valor inválido → `latest`, por `parseChannelVideoSort`) e, ao trocar, faz `router.replace(pathname?…)` preservando os outros parâmetros, removendo `cursor` e com `{ scroll: false }` (opções conferidas na doc do Next 16 em `node_modules/next/dist/docs`).
  - Chip ativo atualiza na hora via `useOptimistic` dentro de `startTransition`; `aria-busy` no radiogroup enquanto a navegação está pendente; clicar no chip já ativo não navega.
  - Radiogroup com tabindex rotativo: só o chip ativo entra no Tab; setas (com volta ao início/fim), Home e End movem foco e seleção juntos, como num grupo de radios. Layout do Figma 2737:2145: `gap-4 pl-6`.
  - A doc do Next recomenda envolver componentes com `useSearchParams` em `<Suspense>` quando a rota é pré-renderizada; a página do canal é dinâmica (lê `searchParams` no RSC), mas a SI da tela deve avaliar o boundary ao compor.
  - Sem avisos do React na execução dos testes.

### SI-04.0.13 — Custom-business complex: copy-link-button
- **Status:** completed
- **Tests:** 7 passing (copy-link-button.test.tsx); tsc 0; lint 0
- **Observations:**
  - Novo ícone `components/icons/copy-icon.tsx` com o path do Figma (I156:3122;156:3110), baixado na SI-04.0.9 e reservado para esta SI.
  - `copy-link-button` compõe `IconButton` (ghost, sm) com `aria-label="Copy link"`; após copiar troca para `CheckIcon` (success) e escreve "Copied" num `role=status`/`aria-live=polite` visível ao lado, por 2 s. Novo clique reinicia a janela; o timer é limpo ao desmontar.
  - Falha de clipboard (promessa rejeitada ou `navigator.clipboard` ausente fora de contexto seguro) mostra "Couldn't copy" em destructive — estado não previsto no contrato, derivado para não silenciar o erro.
  - Recebe a URL absoluta pronta (`url`); o `video-config-card` monta o texto exibido a partir de `origin`, então a tela deve passar `/watch/{publicId}` aos dois.
  - Testes com `fireEvent` + fake timers e `navigator.clipboard` definido por `Object.defineProperty` (o `userEvent.setup()` substitui o clipboard por um stub próprio).

### SI-04.0.14 — Custom-business complex: privacy-option
- **Status:** completed
- **Tests:** 9 passing (privacy-option.test.tsx); tsc 0; lint 0
- **Observations:**
  - Fonte visual: PrivacyOption 156:2822 (selecionado) / 156:2821 (normal) da tela 156:2790, recuperado do transcript do screen-inventory; ícones `public-icon` e `link-icon` (14×14) criados com os paths do Figma (assets baixados das URLs ainda válidas).
  - Textos seguem o Figma: "Public — Everyone can see your video" e "Unlisted — Anyone with the video link can watch your video" (as Technical actions trazem uma paráfrase: "anyone can find and watch" / "only people with the link").
  - Estrutura: `<fieldset>` + `<legend>` (visualmente oculta, porque o SectionHeader "Visibility" titula a seção) envolvendo o `RadioGroup` do Radix com `aria-labelledby` na legend; cada card é o `<label>` do seu radio (card inteiro clicável), com `aria-labelledby` no título e `aria-describedby` na descrição. Isso atende o contrato da edição (`role=radio`/`aria-checked`, setas) e o da tela de upload (`fieldset`/`legend`); o upload pedia `<input type="radio">` nativos, mas o plano manda compor sobre `components/ui/radio-group.tsx` (Radix, `button role=radio`).
  - Estilo do Figma: card `max-w-xl` (576px), `p-4 gap-4`, `radius-1`; selecionado = `bg-input-background` + `border-primary` e radio em anel com ponto `bg-primary` (sobrescrito no `RadioGroupItem` via classes, sem tocar o primitivo); normal = `bg-card` + `border-border`.
  - API para react-hook-form: `value`, `onChange`, `onBlur`, `name`, `disabled`; o valor só vai ao servidor no Save Changes.

### SI-04.0.15 — Custom-business complex: video-filters
- **Status:** completed
- **Tests:** 15 passing (video-filters.test.tsx); tsc 0; lint 0
- **Observations:**
  - Layout do Figma 152:2163 ("videos filter row"): botões `Button` `secondary`/`md` (radius-4, px-6 py-2, label-lg — coincide com o Figma), busca `w-65` (~259px) à direita, `px-6 py-4` com borda inferior. Ícone do botão "Filter" é o glifo Material `stars` exportado do Figma (novo `stars-icon.tsx`).
  - **Interação derivada (menus não desenhados no Figma):** "Filter" abre dropdown de status (All statuses/Published/Draft); o segundo botão abre dropdown de visibilidade (All/Public/Unlisted) e mostra a escolha ("Public" no Figma, "Visibility" sem filtro); "Date" abre um `Dialog` com `From`/`To` (`<input type="date">`), Apply e Clear dates. Botão com filtro ativo fica `default` (preenchido) e com o rótulo do valor ("Status: Draft", "Oct 1, 2026 – Oct 19, 2026").
  - Toda mudança faz `router.replace` preservando parâmetros alheios (ex.: `sort`), removendo `cursor` e com `{ scroll: false }`; sem filtros restantes navega para o pathname puro. Valores inválidos na URL (enum desconhecido, data fora de `YYYY-MM-DD`) são ignorados, como pede o contrato.
  - Busca: debounce de 300 ms (timer reiniciado a cada tecla, limpo ao desmontar), texto aparado, vazio remove `q`; o botão de limpar da busca navega na hora e cancela o debounce pendente; `maxLength=100`.
  - Datas: `from > to` bloqueia o Apply com `role=alert` e `aria-invalid` nos campos; inputs também recebem `min`/`max` cruzados; intervalo aberto (só `from` ou só `to`) é aceito.
  - "Clear filters" (`Button` link) só aparece com algum filtro ativo; remove status/visibility/q/from/to e esvazia a busca local. O texto da busca é estado local inicializado de `searchParams` (como pede o plano); navegação de histórico externa não ressincroniza o campo.

### SI-04.0.16 — Custom-business complex: video-row-actions
- **Status:** completed
- **Tests:** 14 passing (video-row-actions.test.tsx); tsc 0; lint 0
- **Observations:**
  - Novo `components/icons/more-vertical-icon.tsx` (Material Icons Outlined `more_vert` 24px, Apache-2.0): o kebab do Figma (I158:3096;108:332) tem um frame 4×16 vazio, sem asset; os pontos desse glifo ocupam exatamente essa caixa. Trigger é `IconButton` ghost/sm (32px, maior que os 20×40 do Figma para alvo de toque).
  - Menu (não desenhado, decisão do usuário em 2026-10-18): "Edit" (`DropdownMenuItem asChild` + `next/link` para `/studio/videos/{publicId}/edit`), "Publish" ou "Unpublish" conforme `status`, separador e "Delete" (variante destructive). Publish fica desabilitado com rótulo "Publish (available when processing finishes)" enquanto `processing_status ≠ ready` (TD-02); Unpublish é sempre permitido.
  - Mutations são callbacks injetados (`onPublish`/`onUnpublish`/`onDelete`, síncronos ou Promise); o componente não chama o BFF. Enquanto a Promise está pendente, o kebab fica `disabled` + `aria-busy`; erro rejeitado só encerra o estado ocupado (o toast é da tela).
  - Exclusão: `Dialog` controlado "Delete video?" com a descrição citando o título; Cancel não chama nada; confirmar chama `onDelete`, mostra "Deleting…" com os dois botões desabilitados e só fecha no sucesso (falha mantém o diálogo aberto para nova tentativa). O diálogo não fecha por Escape/overlay durante a exclusão.
  - `DropdownMenu modal={false}`: abrir um Dialog a partir de um item de menu modal pode deixar o `body` com `pointer-events: none` herdado do menu (problema conhecido do Radix).

### SI-04.0.17 — Custom-business complex: video-sort-menu
- **Status:** completed
- **Tests:** 12 passing (video-sort-menu.test.tsx); suíte completa 366/366; tsc 0; lint 0
- **Observations:**
  - Novo `components/icons/sort-icon.tsx`: glifo de ordenação do Figma (I158:3311;158:3309, seta para baixo + barras decrescentes, 13.65×10.76) centralizado num viewBox 16×16 por offset. A mesma instância "Filter list" empilha uma camada "Share" (seta de compartilhar, asset 58950) que é sobra de troca de ícone; não foi desenhada — conferir com o design quando a cota do Figma voltar.
  - Trigger é o próprio `DropdownMenuTrigger` (botão) com "Sort by: {label}" em `text-caption text-muted-foreground` e `gap-2` (Figma 2726:2139); opções não desenhadas seguem a API do `GET /channels/me/videos`: Latest (`latest`), Oldest (`oldest`), Most viewed (`views`) — valor desconhecido cai em `latest`.
  - Escolha faz `router.replace` com `sort`, sem `cursor`, preservando filtros (status/q/…) e com `{ scroll: false }`; rótulo atualiza na hora via `useOptimistic` (mesmo padrão do `channel-video-sort`); escolher a ordem atual não navega.
  - Fim do bloco de componentes da Fase 04 (SI-04.0.1–0.17): suíte completa do frontend com 56 arquivos e 366 testes passando; lint sem erros (2 warnings pré-existentes em `components/auth`).

### SI-04.1 — Criar catálogo de categorias
- **Status:** completed
- **Tests:** 14 passing nas suítes da SI (category.entity 5, categories.service 3, categories.module 1, migrations 5) + 1 e2e (categories); backend completo 330/330 + e2e 81/81; tsc 0; lint 0
- **Observations:**
  - Entidade `Category` (`slug` varchar(32) unique, `name` varchar(64), `sort_order` smallint, timestamps) registrada em `src/database/entities.ts`; migration de schema gerada pelo CLI (`1792416126626-CreateCategories`) e data migration criada com `migration:create` e SQL manual (`1792416144429-SeedCategories`): 10 linhas `music`…`other`, `sort_order` 1..10, `down` remove por `slug`. Lista literal na migration (histórico imutável, sem importar constantes).
  - Seed com `ON CONFLICT ("slug") DO NOTHING` (reexecutável): as suítes de integração/e2e usam DataSources com `synchronize: true` sobre o banco compartilhado, então os testes que dependem do catálogo rodam o `up` da seed no `beforeAll` sem risco de duplicata; a spec da entidade deixa o catálogo semeado no `afterAll`. `cleanAllTables` não apaga `categories` (dado de referência).
  - `CategoriesService` segue o padrão do projeto (recebe `DataSource`, como o `ChannelsService`): `findAll()` por `sort_order` e `findById()` → `null` quando não existe. `CategoriesController` `GET /categories` `@Public()` devolve `CategoryResponse[]` (`id`, `slug`, `name`, `sort_order` — sem timestamps); DTO anotado com `@ApiProperty`. `CategoriesModule` exporta o serviço para a validação de `category_id` (SI-04.2/04.4) e foi registrado no `AppModule`.
  - `src/database/migrations.integration-spec.ts` atualizado: `categories` em `MANAGED_TABLES`, as duas migrations novas na lista, teste da seed (10 linhas, índice unique em `slug`) e reversão em cadeia (seed → tabela → vídeos), já que a última migration deixou de ser a de vídeos.
  - Teste extra além do plano: `test/categories.e2e-spec.ts` cobre o critério de aceite `GET /categories` sem token → 200 com 10 itens ordenados e o shape exato.
  - `npm run migration:run` aplicado no banco de desenvolvimento (10 categorias conferidas via psql).
  - Cadeia OpenAPI (export → sync → `types.gen.ts`) não executada aqui: o plano concentra a regeneração na SI-04.10, depois de todos os endpoints da fase. O `openapi.json` commitado ainda não tem `/categories`.
  - Suíte completa do backend: 48 suítes / 330 testes (unit + integration, `--runInBand`) e 9 suítes / 81 testes e2e passando.

### SI-04.2 — Estender modelo do vídeo com publicação, visibilidade, categoria e contadores
- **Status:** completed
- **Tests:** backend completo 351/351 (unit+integration) + e2e 82/82; novos: video-title.util 8, video.entity +5, videos.service.spec +5, migrations +3, e2e +1; tsc 0; ESLint 0 nos arquivos da SI (npm run lint do projeto já falha no HEAD — dívida pré-existente)
- **Observations:**
  - `Video` ganhou `title` (varchar(100), default ''), `description`, `category_id` + `ManyToOne(Category, { onDelete: 'SET NULL' })` (com o lado `OneToMany` em `Category`), `visibility` (default public), `published_at`, `custom_thumbnail_key` e os 4 contadores (default 0); índices compostos `(channel_id, status, published_at, id)` e `(status, visibility, published_at, id)` (ascendentes — o Postgres percorre o B-tree ao contrário para `DESC, DESC`) e índice em `category_id`. Migration gerada pelo CLI (`1792416589954-ExtendVideosForPublishing`) com backfill manual do `title`; aplicada no banco de desenvolvimento.
  - **Desvio do plano (backfill):** as Technical actions sugerem `split_part(original_filename, '.', 1)`, que transformaria "Minha aula.final.mp4" em "Minha aula" e contradiz o critério de aceite ("Minha aula.final"). Usada a mesma regra do pré-cadastro: remove só a última extensão, cai no nome inteiro quando nada sobra (".mp4"), trunca a 100. A regra vive em `src/videos/video-title.util.ts` (`deriveVideoTitle`, por code point para não partir emoji) e é replicada em SQL na migration.
  - Teste de backfill ficou em `src/database/migrations.integration-spec.ts` (desfaz a migration, insere rascunhos "da Fase 03" por SQL, reaplica e confere os títulos), não na spec da entidade como o plano indica: os DataSources de teste usam `synchronize`, então só o runner de migrations exercita o `UPDATE`. A spec de migrations também passou a validar colunas, índices e a FK `SET NULL`, e a reversão em cadeia ganhou o passo da migration nova.
  - `video.entity.integration-spec.ts`: defaults (status, visibility, title '', contadores 0, nulos), título > 100 rejeitado, relação `category`, `ON DELETE SET NULL` e FK inválida rejeitada. `videos.service.spec.ts` (unit) estendido: título derivado e truncado no `createUpload`; campos editoriais, `has_custom_thumbnail`, `published_at` e categoria (da relação ou buscada por id) no `getVideo`.
  - Constantes: `VIDEO_STATUSES = ['draft','published']`, `VIDEO_VISIBILITIES`, `VIDEO_TITLE_MAX_LENGTH` e códigos `CATEGORY_NOT_FOUND`, `VIDEO_NOT_PUBLISHABLE`, `THUMBNAIL_INVALID`, `THUMBNAIL_TOO_LARGE` (as exceções de domínio entram nas SIs que os lançam).
  - Resposta: `VideoResponse` ganhou `visibility`, `title`, `description`, `category` (`CategoryResponse | null`), `has_custom_thumbnail`, contadores e `published_at`; novos `VideoListItem`, `VideoCardItem` (+ `VideoCardChannel`) para as SIs de listagem. `VideosOwnership.loadOwned` carrega `category`; `getVideo` busca a categoria por id quando a relação não veio. `VideosModule` importa `CategoriesModule`; `thumbnail_url` continua pré-assinada (URL estável do TD-10 é de outra SI).
  - Critério de aceite 1 coberto por um cenário novo em `test/videos-create.e2e-spec.ts` (`POST /videos` com "Minha aula.final.mp4" → `GET` com título e defaults).
  - **Incidente corrigido:** um `prettier --write` em pastas inteiras reescreveu ~20 arquivos da Fase 03 (inclusive migrations já executadas) só com troca CRLF→LF; todos restaurados com `git checkout` após conferir que o diff era só de espaço. Registrado em memória: Prettier apenas nos arquivos tocados.
  - **Dívida de lint pré-existente (fora de escopo):** `npm run lint` do backend já falha no HEAD com 223 erros / 54 warnings em 14 arquivos das Fases 02/03 (`no-unsafe-member-access` em specs e e2e, entre outros). Os arquivos desta SI e da SI-04.1 passam no ESLint; `test/videos-create.e2e-spec.ts` segue com os mesmos 21 erros do HEAD. O "lint 0" registrado na SI-04.1 refere-se aos arquivos tocados, não ao projeto inteiro. Sugerir tarefa separada de saneamento.
  - Suítes completas: 49 suítes / 351 testes (unit + integration) e 9 suítes / 82 testes e2e passando; tsc 0.

### SI-04.3 — Implementar autenticação opcional e regra de leitura pública
- **Status:** completed
- **Tests:** backend completo 362/362 (unit+integration) + e2e 87/87; novos: jwt-auth.guard +6, videos-ownership +6, openapi-export +2, videos-playback e2e +5; tsc 0; ESLint 0 nos arquivos de código da SI
- **Observations:**
  - `JwtAuthGuard`: sem header `Authorization` → rota `@Public()` segue anônima e a protegida dá 401; header presente é verificado igual nas duas (esquema não-Bearer, token inválido ou expirado → 401) e popula `request.user`. Novo `@OptionalUser()` (`JwtPayload | undefined`).
  - `VideosOwnership.loadReadable(user, publicId)`: `published` (public ou unlisted) é legível por todos sem consultar canais; outro status só pelo dono; rascunho alheio ou inexistente → 404 `VIDEO_NOT_FOUND` (nunca 403). `loadOwned` foi refatorado para reaproveitar `findByPublicId`/`isOwner`, sem mudar o comportamento.
  - Controller: `GET /videos/{publicId}` e `GET /videos/{publicId}/playback` viraram `@Public()` + `@OptionalUser()` + `loadReadable`; 403 saiu da documentação dessas duas e o 401 passou a ser "token presente mas inválido". `@ApiBearerAuth` saiu do nível da classe e foi para cada rota protegida (regra: rota `@Public()` não carrega `@ApiBearerAuth`); as duas leituras documentam o header opcional com `@ApiHeader({ required: false })`.
  - **Mudança de comportamento da Fase 03 (prevista pelo plano):** rascunho lido sem token deixou de dar 401 e lido por não-dono deixou de dar 403 — ambos agora 404. Atualizados: `test/videos-playback.e2e-spec.ts` (3.1), `test/videos-upload-flow.e2e-spec.ts` ("keeps a draft private") e `src/openapi-export.integration-spec.ts` (as duas leituras saíram da tabela de rotas protegidas e ganharam um caso de contrato público com header opcional).
  - Critérios de aceite cobertos por cenários novos em `test/videos-playback.e2e-spec.ts` (seção 4): publicado legível sem token, unlisted legível pelo link, `Bearer invalido` → 401 mesmo publicado, playback publicado + ready sem token → 200 com `stream_url` (e Range 206 no storage), publicado não pronto → 409.
  - **Risco registrado:** toda rota `@Public()` passa a validar um Bearer presente — hoje nenhuma chamada do BFF envia `Authorization` a rotas públicas (só o logout, que é protegido, e o refresh usa o corpo). Se um cliente futuro anexar o access token expirado a `/auth/refresh` ou `/auth/login`, receberá 401; os BFFs das próximas SIs não devem enviar Bearer a rotas de autenticação.
  - `thumbnail_url` do playback continua pré-assinada (a URL estável do TD-10 é de outra SI).
  - Lint: arquivos de código da SI passam; os e2e tocados ficaram com o mesmo número de problemas do HEAD (dívida pré-existente registrada na SI-04.2).
  - Suítes completas: 49 suítes / 362 testes (unit + integration) e 9 suítes / 87 testes e2e passando; tsc 0.

### SI-04.4 — Endpoints PATCH /videos/{publicId}, POST …/publish e POST …/unpublish
- **Status:** completed
- **Tests:** backend completo 384/384 (unit+integration) + e2e 92/92; novos: videos.service.spec +13, non-empty-body.pipe 7, videos.service.integration +2, videos-edit-publish e2e 5; tsc 0; ESLint 0 nos arquivos da SI
- **Observations:**
  - Rotas novas (só o dono, `loadOwned`): `PATCH /videos/:publicId` (200), `POST /videos/:publicId/publish` (200) e `POST /videos/:publicId/unpublish` (200), com `@ApiBearerAuth` e as respostas do `### API Contracts`.
  - `UpdateVideoDto`: `title` com trim e 1..100, `description` até 5000 ou `null`, `category_id` UUID ou `null`, `visibility` `public|unlisted`. `title`/`visibility` usam `@ValidateIf(valor !== undefined)` em vez de `@IsOptional()`, porque `IsOptional` também deixaria passar `null` em colunas não nulas. Campos não editáveis (ex.: `status`) caem no `forbidNonWhitelisted` global.
  - "Ao menos um campo" virou `src/common/pipes/non-empty-body.pipe.ts` (`NonEmptyBodyPipe` no `@Body`), que roda depois do `ValidationPipe` global e lança `BadRequestException` → 400 `VALIDATION_ERROR` pelo filtro existente; `null` explícito conta como campo presente. Reaproveitável no `PATCH /channels/me` (SI-04.7). Unit spec própria.
  - Exceções novas: `CategoryNotFoundException` (400) e `VideoNotPublishableException` (409). `VideosService`: `updateVideo` (valida categoria antes de escrever, grava só os campos presentes, nunca `status`), `publish` (já publicado → devolve sem escrever; senão exige `ready` e título não vazio após trim; `published_at` só se nulo) e `unpublish` (já rascunho → sem escrita; preserva `visibility`/`published_at`). Escritas por `repository.update` + atualização do objeto em memória para a resposta.
  - Testes: unit (`videos.service.spec.ts` +13: categoria inexistente sem escrita, categoria válida/null, publish bloqueado em uploading/processing/failed e título em branco, `published_at` gravado só na primeira vez, idempotência, unpublish preserva campos); integration com banco real (+2: ciclo publish → unpublish → publish mantém `published_at`; publish bloqueado não altera a linha); e2e `test/videos-edit-publish.e2e-spec.ts` gerado da spec (5 cenários, incluindo 400 de `{}`, `title: ''`, `status` e `CATEGORY_NOT_FOUND`, 409, idempotência e 401/403/404).
  - Suítes completas: 50 suítes / 384 testes (unit + integration) e 10 suítes / 92 testes e2e passando; tsc 0; ESLint 0 nos arquivos da SI.

### SI-04.5 — Entrega pública de thumbnails com URL estável
- **Status:** completed
- **Tests:** backend completo 394/394 (unit+integration) + e2e 93/93; novos: storage.service.spec +2, videos.service.spec +5, storage.service.integration +3, videos-playback e2e +1; tsc 0; ESLint 0 nos arquivos de código
- **Observations:**
  - `storage-init` (compose.yaml) ganhou `put-bucket-policy` com GET anônimo só em `thumbnails/*` (log "storage-init: policy pública de thumbnails aplicada"); reaplicado com `docker compose up storage-init` (exit 0). **TD-10 verificado no RustFS 1.0.3** com curl anônimo: thumbnail existente 200, thumbnail inexistente 404, `videos/*` 403 e listagem do bucket 403 — o plano B de URL pré-assinada não foi necessário. Objetos de sondagem removidos depois.
  - `StorageService.publicUrl(key)` → `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${key}` (path-style, barra final do endpoint removida, cada segmento com `encodeURIComponent`). `VideosService.thumbnailUrl(video)` prefere `custom_thumbnail_key` e anexa `?v=<updated_at em ms>` (ms em vez de segundos para que duas trocas no mesmo segundo ainda invalidem o cache); `null` sem chaves. `presignThumbnail` foi removido: `getVideo` e `getPlayback` usam a URL estável.
  - Para o `?v=` da resposta bater com o da próxima leitura, as escritas de `updateVideo`/`publish`/`unpublish` passaram por `applyChanges`, que relê `updated_at` do banco após o `update` (uma consulta extra por escrita). Consequência aceita: qualquer edição do vídeo muda o `?v=`, não só a troca de thumbnail, como pede o plano (`updated_at`).
  - Documentação: descrições de `thumbnail_url` (VideoResponse, VideoListItem, VideoCardItem, PlaybackResponse) e do 503 de `GET /videos/{publicId}` atualizadas; seção "Thumbnails públicas (Fase 04)" no `nestjs-project/CLAUDE.md` com o smoke test via curl e o plano B.
  - Testes: unit `storage.service.spec` (+2 publicUrl), `videos.service.spec` (+5 thumbnailUrl e releitura de `updated_at`; testes de leitura migrados de "assina a thumbnail" para "URL estável sem presign"); integration `storage.service.integration-spec` (+3 contra o RustFS: thumbnail anônima 200, ausente 404, vídeo 403); e2e `videos-playback` (+1 cenário 4.6: `thumbnail_url` sem `X-Amz-`, com `?v=`, estável entre leituras, servida anonimamente e igual no playback).
  - Suítes completas: 50 suítes / 394 testes (unit + integration) e 10 suítes / 93 testes e2e passando; tsc 0; ESLint 0 nos arquivos de código (e2e de playback com os mesmos 29 problemas do HEAD).

### SI-04.6 — Endpoints PUT e DELETE /videos/{publicId}/thumbnail
- **Status:** completed
- **Tests:** backend completo 413/413 (unit+integration) + e2e 96/96; novos: thumbnail.processor 11, thumbnail-upload.interceptor 5, videos.service.integration +2, env.validation +1, videos-thumbnail e2e 3; tsc 0; ESLint 0 nos arquivos da SI
- **Observations:**
  - Dependências: `sharp@0.35.5` (libvips 8.18.7, Node ≥ 20.9; container em Node 25.6) e `@types/multer@^2` (dev) instalados dentro do container; `multer@2.1.1` já vinha com `@nestjs/platform-express`. Documentação consultada via WebFetch (sharp: input/metadata, constructor, operation `autoOrient`; NestJS: file upload) — context7 indisponível neste ambiente.
  - `THUMBNAIL_MAX_BYTES` (default 5 MiB, Joi 1..50 MiB) no namespace `upload`, no `.env.example` e no teste de defaults do schema. `storageKeys` ganhou `customThumbnail` (`thumbnails/{id}/custom.jpg`).
  - **Desvio do plano (upload):** em vez de `FileInterceptor('file', { limits })`, um `ThumbnailUploadInterceptor` próprio sobre o multer, porque o `FileInterceptor` responde um 413 genérico ("File too large", fora do envelope de domínio) e não lê o limite do config injetado. O interceptor converte `LIMIT_FILE_SIZE` → 413 `THUMBNAIL_TOO_LARGE` e qualquer outro erro de multipart (campo inesperado, campo de texto, corpo malformado) → 400 `VALIDATION_ERROR`; `limits: { files: 1, fields: 0 }`. Roda depois do guard JWT. `file` ausente → 400 `VALIDATION_ERROR` no controller.
  - `ThumbnailProcessor` (provider): tipo declarado na lista JPEG/PNG/WebP, bytes decodificáveis (`sharp().metadata()`), formato real na lista (GIF disfarçado de PNG é recusado), dimensões ≥ 640×360 já com a orientação EXIF (`metadata.autoOrient`), saída `autoOrient().resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 })` — sem metadados do original. Falhas → 400 `THUMBNAIL_INVALID`.
  - `VideosService.setCustomThumbnail` grava o objeto antes do banco (falha no banco deixa só um objeto que o próximo envio sobrescreve) e usa `applyChanges` (novo `?v=`); `removeCustomThumbnail` é idempotente e apaga o objeto antes de anular a chave (`DeleteObject` tolera chave ausente). Rotas: `PUT /videos/:publicId/thumbnail` (200, `@ApiConsumes('multipart/form-data')` + `@ApiBody` binário) e `DELETE /videos/:publicId/thumbnail` (204), ambas `loadOwned`.
  - Testes: `thumbnail.processor.spec` (11: PNG→JPEG 1280×720, JPEG/WebP, crop cover, limite exato, 3 tamanhos abaixo, não-imagem, tipo declarado fora da lista, GIF), `thumbnail-upload.interceptor.spec` (5, com multipart montado à mão), `videos.service.integration-spec` (+2 contra RustFS: ciclo custom.jpg criado/normalizado/removido, `thumbnail_url` alterna, rejeição não toca storage nem linha), e2e `videos-thumbnail` gerado da spec (3 cenários; o 413 de 6 MB foi repetido 4× sem instabilidade).
  - `nestjs-project/CLAUDE.md` (seção "Thumbnails públicas") documenta o fluxo da customizada, `THUMBNAIL_MAX_BYTES` e a regra de instalar o `sharp` só no container (binário nativo por plataforma).
  - Suítes completas: 52 suítes / 413 testes (unit + integration) e 11 suítes / 96 testes e2e passando; tsc 0; ESLint 0 nos arquivos da SI.

### SI-04.7 — Endpoints GET/PATCH /channels/me e GET /channels/{nickname}
- **Status:** completed
- **Tests:** backend completo 448/448 (unit+integration) + e2e 100/100; novos: channels.service.spec +6, update-channel.dto.spec 26, channels.service.integration +3, channels-me e2e 4; tsc 0; ESLint 0 nos arquivos novos
- **Observations:**
  - `ChannelsController` novo (`@ApiTags('channels')`): `GET /channels/me` e `PATCH /channels/me` (`@ApiBearerAuth`, declarados antes de `:nickname`) e `GET /channels/:nickname` (`@Public()`). Registrado no `ChannelsModule`, que já entra no grafo do `AppModule` pelos módulos de auth e vídeos.
  - `UpdateChannelDto`: `nickname` com `@Matches(/^[a-z0-9_]{3,50}$/)` + `@IsNotIn(RESERVED_NICKNAMES)` (o `IsNotIn` nativo do class-validator substitui o validador customizado citado no plano), `name` trim + 1..50, `description` até 1000 ou `null`; `nickname`/`name` com `ValidateIf` para recusar `null`; corpo vazio pelo `NonEmptyBodyPipe` (SI-04.4). `channels.constants.ts` (allowlist, reservados, limites, códigos) e `channels.exceptions.ts` (`NicknameTakenException` 409, `ChannelNotFoundException` 404).
  - `ChannelsService`: `findByNickname`, `countPublicVideos` (`published` + `public`), `getOwnChannel`, `getPublicChannel` (sem id/usuário/e-mail) e `updateChannel` (pré-checagem do nickname contra outros canais + unique violation `23505` → `NICKNAME_TAKEN`; mesmo nickname atual não consulta nem escreve; canal ausente → `CHANNEL_NOT_FOUND`). O helper existente `isPgUniqueViolationOnColumn` foi reaproveitado e tipado (`as unknown as { code, detail }` no lugar de `as any`), o que zerou os erros de lint do serviço.
  - Testes: `channels.service.spec` (+6), nova `dto/update-channel.dto.spec.ts` (reservados nunca passam da validação, formatos inválidos, limites, nulos, campo desconhecido, trim — o plano punha o caso "reservado não chega ao banco" na spec do serviço, mas quem barra é o DTO), `channels.service.integration-spec` (+3: troca libera o antigo, conflito, contagem ignora draft/unlisted e shape público), e2e `channels-me` gerado da spec (4 cenários).
  - **Fora de escopo, para tarefa separada:** o `createChannel` da Fase 02 deriva o nickname do prefixo do e-mail sem checar a lista de reservados nem o mínimo de 3 caracteres — um cadastro `admin@…` ou `ab@…` gera um canal com nickname que o `PATCH` recusaria e, no caso `me`, inalcançável por `GET /channels/me` público.
  - Lint: arquivos novos e o serviço passam; `channels.service.spec.ts` ficou com os mesmos 20 problemas do HEAD. Novo incidente de Prettier em pasta inteira (`src/channels`), corrigido com `git checkout` dos 5 arquivos só com troca de fim de linha.
  - Suítes completas: 53 suítes / 448 testes (unit + integration) e 12 suítes / 100 testes e2e passando; tsc 0.

### SI-04.8 — Endpoints de listagem GET /channels/me/videos e GET /channels/{nickname}/videos
- **Status:** completed
- **Tests:** backend completo 468/468 (unit+integration) + e2e 104/104; novos: cursor.spec + videos-listing.service.integration (20), channels-videos e2e 4; tsc 0; ESLint 0 nos arquivos da SI
- **Observations:**
  - `src/common/pagination/cursor.ts`: cursor opaco base64url de `[sort, valor, id]`. **Decisão de precisão:** o valor da coluna de ordenação vai como TEXTO lido do banco (`col::text` via `getRawAndEntities`) e volta com `CAST(:v AS timestamp|integer)`; um timestamp do Postgres tem microssegundos e o `Date` do JS só ms, então um cursor em ms pularia linhas no mesmo milissegundo (coberto por teste de integração com linhas diferindo só em µs). O cursor também carrega a ordenação: cursor de outra ordenação, corrompido ou adulterado → 400 `VALIDATION_ERROR` (`InvalidCursorException`).
  - `cursor-page.dto.ts` com as interfaces `CursorPage<T>`/`CountedCursorPage<T>` e os limites; classes Swagger concretas `OwnerVideosPage` (com `total`) e `ChannelVideosPage` em `src/videos/dto/video-pages.dto.ts` (o plugin do Swagger não documenta genéricos).
  - DTOs de query num só arquivo `src/videos/dto/list-videos.dto.ts` (`ListOwnerVideosDto`, `ListChannelVideosDto` sobre uma base `limit`/`cursor`), em vez dos dois arquivos citados no plano. `from`/`to` exigem `YYYY-MM-DD` e o novo validador reutilizável `@IsNotBefore('from')` (`src/common/validation`) garante `from ≤ to`.
  - `VideosListingService`: keyset `(coluna, id)` com `limit + 1`; dono ordena por `created_at` (latest/oldest) ou `view_count` (views); público por `published_at` (latest/oldest) ou `view_count` (popular), só `published` + `public` + `published_at` não nulo. Filtros do dono: status, visibility, processing_status, `q` (ILIKE com `%`, `_` e `\` escapados), `from`/`to` inclusivos sobre `created_at`; `total` = `COUNT` dos filtros sem o cursor. `thumbnail_url` via `VideosService.thumbnailUrl`.
  - Rotas no novo `src/videos/channel-videos.controller.ts` (`@Controller('channels')` dentro do `VideosModule`, a forma preferida pelo plano, sem `forwardRef`): `GET /channels/me/videos` (dono; canal ausente → 404) e `GET /channels/:nickname/videos` (`@Public()`; nickname inexistente → 404 `CHANNEL_NOT_FOUND`).
  - Testes: `cursor.spec` (round-trip, valor numérico, ordenação divergente, 6 formas inválidas), `videos-listing.service.integration-spec` (25 vídeos em 20 + 5 sem deslocamento após inserção, empate exato de timestamp, empate só em µs, filtros/busca com curingas literais, visibilidade/processamento, intervalo de datas inclusivo, views com `total` estável, isolamento por canal, cursor de outra ordenação; público exclui draft/unlisted/despublicado e ordena popular/oldest entre páginas), e2e `channels-videos` gerado da spec (4 cenários).
  - Suítes completas: 55 suítes / 468 testes (unit + integration) e 13 suítes / 104 testes e2e passando; tsc 0; ESLint 0 nos arquivos da SI.

### SI-04.9 — Endpoint DELETE /videos/{publicId} e job video.delete
- **Status:** completed
- **Tests:** backend completo 479/479 (unit+integration) + e2e 107/107; novos: videos.service.spec +6, videos.service.integration +2, video-deletion.worker.integration 3, videos-delete e2e 3; tsc 0; ESLint 0 nos arquivos da SI
- **Observations:**
  - Fila `video.delete` em `queue.constants.ts` (`VideoDeletePayload` com `videoId`, `publicId`, `storageKey`, `thumbnailKeys`; `singletonKeys.videoDelete` = `video-delete:<videoId>`; 3 tentativas, backoff, `retryDelay` 30 s, `expireInSeconds` 300). O `QueueService` cria a fila automaticamente por iterar `QUEUE_NAMES` (política `exclusive`).
  - `VideosService.deleteVideo`: sessão `active` → `abortMultipartUpload` antes de qualquer escrita (falha → 503 e o banco não muda); depois, numa transação, `DELETE` da linha (a sessão cai em cascata) + `queue.send` com o `EntityManager` adaptado à opção `db` (mesmo padrão do `completeUpload`) — o job só existe se o DELETE confirmar. `thumbnailKeys` leva só as chaves não nulas. Rota `DELETE /videos/:publicId` (204, `loadOwned`, qualquer status).
  - `VideoDeletionWorker` (registrado no `WorkerModule`, lotes de 5): `DeleteObject` em cada chave, tentando todas mesmo se uma falhar; relança o último erro para o retry; na última tentativa (`retryCount ≥ retryLimit`) loga `video.delete failed` com as chaves restantes. `DeleteObject` em chave ausente não falha no RustFS (verificado em teste).
  - `nestjs-project/CLAUDE.md`: pipeline de `video.delete` e a pendência operacional (objetos completos sem lifecycle → limpeza manual pelas chaves do log), incluindo a corrida conhecida com um `video.process` em andamento que pode gravar `auto.jpg` depois da exclusão.
  - Testes: unit `videos.service.spec` (+6: transação com payload completo, só a automática, lista vazia, abort antes do DELETE, falha do abort não toca o banco, sem sessão não aborta); integration `videos.service.integration-spec` (+2 com DB + pg-boss + RustFS: multipart abortado, linha e sessão removidas, job com a singleton key; rollback quando o `send` falha); `video-deletion.worker.integration-spec` (3 contra RustFS: remove tudo, chaves ausentes não falham, falha parcial continua as demais e loga na última tentativa); e2e `videos-delete` gerado da spec com o `WorkerModule` no processo de teste (3 cenários, inclusive o job `completed`).
  - Ambiente local: o `video-worker` do compose não recarregou sozinho (o `node --watch` não viu as mudanças pelo bind mount do Windows) e só escutava as filas da Fase 03; reiniciado com `docker compose restart video-worker` (stop gracioso) e confirmado o log `Listening on video.delete`. O servidor de desenvolvimento da API não estava rodando (padrão do projeto).
  - Suítes completas: 56 suítes / 479 testes (unit + integration) e 14 suítes / 107 testes e2e passando; tsc 0; ESLint 0 nos arquivos da SI.

### SI-04.10 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- **Status:** completed
- **Tests:** frontend `tsc --noEmit` 0, lint 0 erros (2 warnings pré-existentes), Vitest 56 arquivos / 366 passando; backend `tsc` 0, 56 suítes / 479 passando (`--runInBand`), `openapi-export.integration-spec` 21 passando; cadeia export → sync → types rerodada com hashes idênticos (estável); smoke descartável dos handlers (paginação, filtros, polling, triggers, reset) conferido e removido
- **Observations:**
  - **Causa-raiz no export:** `openapi:export` rodava via `ts-node`, que não aplica o plugin CLI do `@nestjs/swagger`; DTOs sem `@ApiProperty` explícito saíam vazios (inclusive `RegisterDto`/`LoginDto` da Fase 02 e `CreateVideoDto`/`PresignPartsDto`/`CompleteUploadDto` da Fase 03) e nullables sem tipo viravam `Record<string, never>`. O script passou a `nest build && node dist/openapi-export.js`; os DTOs das Fases 02/03 agora aparecem completos no contrato. Documentado em `nestjs-project/CLAUDE.md`.
  - Query DTOs (`ListOwnerVideosDto`/`ListChannelVideosDto`): o plugin não infere enum de união de literais (saía `Object`) e marcava `sort`/`limit` (com default) como obrigatórios — anotados com `@ApiPropertyOptional({ enum, default })`, exceção prevista em `nestjs-dtos.md`. Nenhum schema `Object` restante.
  - `contracts.ts`: aliases da Fase 04 (`Category`, `Video`, `UpdateVideoInput`, `VideoPlayback`, `Channel`, `UpdateChannelInput`, `ChannelPublic`, `OwnerVideosPage`/`OwnerVideosQuery`, `VideoListItem`, `ChannelVideosPage`/`ChannelVideosQuery`, `VideoCardItem`) e os de upload da Fase 03 (`CreateVideoInput`, `VideoCreated`, `UploadSession`, `PresignPartsInput`, `PresignedParts`, `UploadState`, `CompleteUploadInput`, `UploadCompleted`).
  - Fixtures com estado (exigidos pelos specs `studio-*`): `mocks/store.ts` (vídeos + canal) resetado pelo handler de login e no `afterEach` de `mocks/setup.ts`; seed em `mocks/factories/videos.ts`; helpers em `mocks/handlers/_http.ts` (`apiError` tipado como `Response` para o MSW não inferir o corpo de sucesso a partir do envelope). Triggers documentados em `next-frontend/CLAUDE.md` § E2E architecture e o “Current state” de `next-frontend-msw-mocks.md` atualizado.
  - Além dos triggers do plano (`notfound-id`, `forbidden-id`, `processing-id`, `taken_nick`): `other-channel-01` (404 na leitura, 403 na mutação, como o backend) e `tech_mastery` (canal público fixo). Handlers também cobrem upload (Fase 03) e playback, porque os specs de upload os exigem.
  - `npx prettier` no frontend instalou o Prettier ad hoc (o subprojeto não o tem) e reformatou `mocks/handlers/auth.ts`; arquivo restaurado e só o reset do store reaplicado. Formatador não é mais usado no frontend.
  - **Fora de escopo (tarefa separada):** o comentário em `components/auth/signup-form.tsx` (“RegisterDto has no declared properties…”) e os casts para o shape upstream nos BFFs de auth ficaram obsoletos agora que os DTOs de auth são tipados.

### SI-04.11 — Estratégia de dados do frontend — RSC, polling e invalidação (Setup)
- **Status:** completed
- **Tests:** sem testes próprios (Setup SI); smoke em runtime com `MSW_ENABLED=true`: anônimo em `/studio/videos` → 307 `/login?returnTo=/studio/videos` (query preservada e codificada), cookie adulterado → mesmo redirect, sessão via `POST /api/auth/login` → layout renderiza (página temporária, removida); frontend `tsc` 0, lint 0 erros (2 warnings pré-existentes), Vitest 56 arquivos / 366 passando (guards de regressão `app-header` e BFF de auth inclusos)
- **Observations:**
  - **Desvio do plano:** o redirect com `returnTo` ficou num `proxy.ts` (Next 16 Proxy, matcher `/studio/:path*`, checagem otimista decifrando o cookie do iron-session) — layouts do App Router não recebem pathname nem re-renderizam na navegação (docs do Next 16 em `node_modules/next/dist/docs`: `layout.md` § Pathname e `authentication.md` § Layouts and auth checks). O `app/(app)/studio/layout.tsx` mantém `getSession()` como defesa em profundidade (sem sessão → `/login`, sem `returnTo`) e monta o `<UploadProvider>`.
  - `returnTo` mantém `/` legível (válido em query) e codifica o resto, para casar literalmente com o AC/spec (`returnTo=/studio/videos`).
  - `UploadProvider` entregue como casca: contexto `uploads: Map<publicId, { file, progress, status, error }>` + `beforeunload` só com envio `uploading`; `start`/`cancel`/`resume`, o uploader e `useUpload` ficam para a SI-04.14, como o plano define.
  - `useProcessingPoll(ids)`: linhas do Setup verbatim; extensões deriváveis — chave estável dos ids, `Promise.allSettled` por ciclo, remoção do id terminal do conjunto em voo antes do `router.refresh()` (refresh uma vez por id) e parada do timer quando nada resta.
  - O login da Fase 02 ainda volta para `/` (não lê `returnTo`); o plano não atribui isso a nenhuma SI desta fase — tarefa separada se o retorno pós-login for desejado.
  - Reinícios do dev server corromperam o artefato gerado `.next/dev/types/validator.ts` (escritas concorrentes de dois `next dev`), quebrando o `tsc`; removido o diretório gerado, regenerável pelo dev server.

### SI-04.12 — Route Handlers BFF de vídeos, upload e canal
- **Status:** completed
- **Tests:** 38 novos testes de integração (Route Handler como função + MSW) em 6 arquivos — `app/api/videos/[publicId]/__tests__/route.integration.test.ts` (11: encadeia publish em rascunho pronto, só salva em `processing`, `publish: false` não encadeia e não vaza o campo ao upstream, `VIDEO_NOT_PUBLISHABLE` → `published: false`, 403 pass-through, 401 → refresh single-flight → retry com token novo, 401 sem sessão sem tocar o upstream, 400 para corpo não-JSON, nenhum token no corpo, GET 200/404), `actions` (7), `app/api/videos/__tests__` (3), `upload` (6), `thumbnail` (6: multipart com `file` e boundary, 413 pass-through, 400 sem `file`), `app/api/channel` (5: reescreve `channelSlug` e reemite o cookie, não mexe quando o nickname não muda, 409 pass-through); suíte completa 62 arquivos / 404 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - Helper `lib/api/bff.ts` (`withSession`, `passThrough`, `readJson`, `invalidBody`, `PublicIdContext`): o `openapi-fetch` 0.13.8 consome o corpo da resposta (sucesso via `json()`, erro via `text()`), então o resultado tipado é reserializado como `Response` com o mesmo status antes de passar pelo `withRefresh` da Fase 02; o token é relido da sessão a cada tentativa (pega o access token renovado). Sem sessão → 401 sem chamar o upstream.
  - Aliases de reshape do BFF em `contracts.ts`: `UpdateVideoRequest` (`UpdateVideoInput & { publish?: boolean }`) e `VideoUpdateResult` (`{ video, published }`). O BFF remove `publish` antes de repassar (o upstream rejeita campos fora do DTO).
  - Erros do `publish` encadeado que não sejam `409 VIDEO_NOT_PUBLISHABLE` (ex.: 503) passam adiante com o status do upstream, mesmo com o salvamento já feito.
  - Thumbnail: só o campo `file` é repassado num `FormData` novo; sem `file` (ou corpo não-multipart) o BFF responde 400 `VALIDATION_ERROR` sem chamar o upstream. O tipo gerado descreve o multipart como `{ file: string }`, daí o cast na chamada.
  - Rotas usam `{ params: Promise<{ publicId }> }` explícito em vez do `RouteContext` global, que depende do typegen do `next dev`/`build` (o `tsc` isolado não o enxerga).
  - Rotas documentadas em `next-frontend/CLAUDE.md` § Project Structure (inclusive `lib/api/bff.ts`).

### SI-04.13 — `components/layout/app-header.tsx` → Estratégia de dados do frontend (links do estúdio)
- **Status:** completed
- **Tests:** `components/layout/__tests__/app-header.test.tsx` 6 passando (4 pré-existentes + 2 novos: com sessão, links "Meus vídeos" → `/studio/videos` e "Meu canal" → `/studio/channel` antes de "Sair"; sem sessão, nenhum link `/studio`); suíte completa 62 arquivos / 406 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - Links como `Button asChild` variante `ghost` (o "Sair" segue `default`), entre o e-mail e o "Sair". O E2E `logout.e2e-spec.ts` só verifica o botão "Sair" — não é afetado.

### SI-04.14 — Implementar cliente de upload multipart no navegador
- **Status:** completed
- **Tests:** `lib/upload/__tests__/multipart-uploader.test.ts` 9 passando (12 MiB → partes 5/5/2 MiB e `complete` com as 3 ETags → 202; pool ≤ 4 com 10 partes; 500 transitório retentado sem reenviar partes aceitas; 403 repede o lote; retries esgotados rejeitam sem `complete`; `cancel()` aborta os PUT em voo e chama `DELETE …/upload`; retomada pula `uploaded_parts`; arquivo de tamanho diferente e sessão inativa recusados); `components/upload/__tests__/upload-provider.test.tsx` 8 passando (entrada com `progress 0`, progresso em %, conclusão em 100, `beforeunload` só durante `uploading`, cancel, falha com mensagem, resume, erro fora do provider); suíte completa 64 arquivos / 423 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - **AC divergente do contrato:** o AC diz que após `cancel()` o `GET …/upload` responde `409 UPLOAD_NOT_ACTIVE`, mas o `abortUpload` do backend (Fase 03) marca a sessão `aborted` **e apaga o vídeo** na mesma transação — o GET passa a responder `404 VIDEO_NOT_FOUND`. Implementado e testado conforme o backend real (o fake do teste também apaga). O `cancel()` tolera `409` no `DELETE` (sessão já não ativa).
  - Progresso agregado por parte concluída (`fetch` não expõe progresso de upload); `UploadHandle = { done, progress(), cancel() }`; `startUpload({ file, created })` e `resumeUpload({ file, publicId })` (retomada valida `state = active` e `expected_bytes = file.size`, erro `UPLOAD_FILE_MISMATCH`). Backoff configurável (`retryDelayMs`, padrão 1 s × 2^tentativa).
  - Teste do uploader em jsdom (URLs relativas `/api/**` resolvidas pelo MSW) com o arquivo criado via `File` de `node:buffer`: o `File` do jsdom não é um corpo aceito pelo `fetch` do Node (viraria texto). O BFF e o storage são falsos locais ao arquivo (`server.use` com estado), como prevê a tabela de testes.
  - Provider: `start(file, created)`, `resume(publicId, file)`, `cancel(publicId)`; hook `useUpload(publicId)` → `{ upload, start, resume, cancel }`; fora do provider lança erro explicativo.
  - AC de navegação (`/studio/upload/{id}` ↔ `/studio/videos` sem interromper) é garantido pelo provider no layout do estúdio (SI-04.11); a verificação em navegador fica com os E2E `studio-upload*` das telas (SIs seguintes).
  - Cliente registrado em `next-frontend/CLAUDE.md` § Architecture como exceção explícita ao Strict BFF (só os `PUT` de partes vão ao storage).

### SI-04.15.0 — Drift audit: Upload de vídeo (escolha do arquivo)
- **Status:** completed
- **Tests:** no tests (audit-only); `frontend-drift-report.md` criado com a seção `## Screen: upload-de-video` (3 componentes: 1 alinhado, 1 drift menor, 1 drift relevante, 0 ausente); estado do `next-frontend` (status + hash do diff) idêntico antes/depois da SI
- **Observations:**
  - **Figma indisponível:** `get_design_context` do frame 154:1724 voltou a falhar pela cota do plano Starter, e não há leitura anterior desse frame. Seguindo o fallback do plano, os componentes em disco foram auditados contra a tela irmã do mesmo fluxo (Upload video processing, 156:2110), cujo `get_design_context` está no transcript do subagente do inventário. A fonte está registrada numa linha `**Source:**` da seção (fora do schema, para não perder a rastreabilidade).
  - O skill `figma:figma-implement-design` não está registrado nesta sessão (plugin figma 2.2.157 expõe só as ferramentas MCP); usei as ferramentas MCP diretamente, carregando antes a orientação `figma-design-to-code`.
  - Decisões: AppHeader → `exception` (o TopNav/SideNav do Figma são a navbar da Fase 07); Card → `exception` (container alinhado; padding 32/gap 24 composto pela tela, sem retunar o padrão usado pelos cards da Fase 02); Button → `skip` (o primário bate com `size sm`/`default`).
  - Para a SI-04.16.0: na tela 156:2110, os botões contornados (Cancel, Change Thumbnail) usam `border-[var(--border)]`, enquanto a variante `outline` do DS usa `border-foreground` — drift a classificar no audit dessa tela, que é dona da demanda.
  - O AC literal `git diff --name-only HEAD -- next-frontend` vazio não se aplica nesta branch (a fase inteira está sem commit); a verificação equivalente foi o snapshot antes/depois.

### SI-04.15a — Tela de Upload de vídeo (escolha do arquivo) (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell; unit na SI-04.15b, E2E no spec `studio-upload`); `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke em runtime com `MSW_ENABLED=true`: `/studio/upload` com sessão → 200 com "Upload video", "MP4 or WebM, up to 10 GB", "Select file" e `accept="video/mp4,video/webm"`; anônimo → 307 `/login?returnTo=/studio/upload`; screenshot 1280×720 conferido
- **Observations:**
  - Drift decisions aplicadas: AppHeader `exception`, Card `exception`, Button `skip` → nenhum arquivo do DS alterado.
  - Shell gerado do UI Contract + tela irmã 156:2110 (Figma 154:1724 sem cota): `main` com `px-6 pt-8 pb-6 gap-6` e título `text-h1`; `UploadDropzone` = `Card` tracejado `p-8 gap-6` (o padding vem por `className`, como decidido no audit), `VideoFileIcon` (asset do mesmo fluxo; não há ícone de upload exportado do Figma), instrução `text-h3` + "MP4 or WebM, up to 10 GB" `text-body-md` muted e `Button` primário como `<label>` de um `<input type="file" accept="video/mp4,video/webm">` real (`sr-only`).
  - Estados visuais via prop `state` (`idle` | `dragging` | `creating` | `error`): dragging → `border-primary bg-muted/40`; error → `border-destructive` + mensagem; creating → "Creating upload…" com input desabilitado. Região de status `aria-live="polite"` sempre presente (reserva a altura, sem salto de layout). `inputProps` repassa os handlers que a SI-04.15b liga.
  - Import fora da lista de DS reutilizados: só o ícone (`components/icons/video-file-icon.tsx`), que é asset estático, não componente.

### SI-04.15b — Tela de Upload de vídeo (escolha do arquivo) (lógica & wiring)
- **Status:** completed
- **Tests:** `components/upload/__tests__/upload-dropzone.test.tsx` 9 passando (instruções + input rotulado com `accept`; mp4 válido → `POST /api/videos` com o corpo exato, `start(file, created)` e `push(/studio/upload/new-upload-id)`; `.mov` e > 10 GiB barrados sem fetch; `VIDEO_TOO_LARGE`/`VIDEO_UNSUPPORTED_MEDIA_TYPE` → mensagem inline sem retry; `STORAGE_UNAVAILABLE` → "Try again" que repete; 401 → `/login?returnTo=/studio/upload`; drag-over + drop); `lib/auth/__tests__/return-to.test.ts` 11; `login-form.wiring.test.tsx` +1 (`returnTo`); E2E `tests/studio-upload.e2e-spec.ts` (do spec `studio-upload.plan.md`) 3/3 passando; suíte E2E completa 26 passando; Vitest 66 arquivos / 444 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - **Escopo ampliado (exigido pelo spec, cenário 2.1 passo 2):** o login da Fase 02 passa a voltar para `?returnTo=`. A página lê `searchParams`, sanitiza com `lib/auth/return-to.ts` (só caminho relativo do próprio site; `//host`, `/host`, esquemas e relativos sem `/` → `/`, para não virar open redirect) e passa ao `LoginForm`, cujo padrão continua `/` (testes e E2E de auth inalterados e verdes).
  - **Sem primitivo de toast no projeto** (nenhum `sonner`/toast instalado): `STORAGE_UNAVAILABLE` e falhas genéricas viram mensagem inline com botão "Try again" no próprio dropzone, em vez do toast do UI Contract. As telas seguintes (painel: "toast com retry"/erros de mutação) vão esbarrar no mesmo ponto — decidir se instala o primitivo de toast (ex.: shadcn `sonner`) numa tarefa própria.
  - `useUploads()` exportado pelo provider (o dropzone ainda não tem `publicId`); `validateVideoFile` e `MAX_VIDEO_BYTES` espelham o `POST /videos` (tipo, 1..10 GiB, nome 1..255). Arquivo vazio → "The selected file is empty" e nome longo → "File names must be 255 characters or fewer" (mensagens não previstas no catálogo).
  - Lint do React Compiler barrou ler `ref` no render: o arquivo a retentar vive no estado da falha (`retryFile`).
  - E2E: o arquivo roda em `mode: "serial"` porque o store do MSW é único no dev server (o login o reseta); o `page.route` atende só a origem do storage (`http://localhost:9000/**`, inclusive o preflight CORS do `PUT`), nunca `/api/**`. O `/studio/upload/new-upload-id` ainda é 404 (tela da SI-04.16) — o cenário 1.1 só verifica a URL e o primeiro `PUT`.
  - **Armadilha do dev server:** `POST …/upload/parts` e `…/upload/complete` respondiam 404 do Next mesmo após vários restarts — manifest de rotas desatualizado no volume `.next`; criar e remover uma rota de teste forçou o rescan. Vale para as próximas SIs com rotas novas: confirmar com `curl` (405 em GET) antes do E2E.

### SI-04.16.0 — Drift audit: Upload em processamento (Upload video processing)
- **Status:** completed
- **Tests:** no tests (audit-only); seção `## Screen: upload-em-processamento` anexada ao `frontend-drift-report.md` (19 componentes: 12 alinhado, 3 drift menor, 4 drift relevante, 0 ausente); estado do `next-frontend` idêntico antes/depois
- **Observations:**
  - Figma novo indisponível (cota Starter); a demanda é a resposta completa do `get_design_context` de 156:2110 gravada no transcript do `/screen-inventory`, a mesma fonte usada nas SIs 04.0.x. Registrado na linha `**Source:**` da seção.
  - `auto-Edit` para a SI-04.16a: `textarea.tsx` (scaffold shadcn sem reconciliação: borda, fundo, raio, padding, texto + drop de `dark:bg-input/30` e `dark:disabled:bg-input/80`), `select.tsx` (trigger: mesmas classes que o `category-select` sobrescreve, + `h-9` e drop de `dark:bg-input/30`/`dark:hover:bg-input/50` — hoje o fundo do `category-select` sai errado no tema escuro por especificidade), `input.tsx` (`pr-2`) e `button.tsx` (variante `outline`: `border-foreground` → `border-border`; consumidores só da Fase 04).
  - `exception`: AppHeader e Card (mesmas razões da SI-04.15.0, registradas como Prior) e Progress (`--progress-track` escuro = `#ffffff`, igual ao indicador — mantém `bg-muted` até a correção do token).
  - O nome da variante de botão no Figma não vem na resposta em cache; a variante `outline` foi escolhida pelo papel visual (sem fundo, borda de 1px, texto foreground) — anotado no `_Note:` do componente.

### SI-04.16a — Tela de Upload em processamento (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell); testes dos primitivos tocados + category-select/privacy-option 17 arquivos / 103 passando; Vitest completo 66 / 444 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke com `MSW_ENABLED=true`: `/studio/upload/{ready-draft-01, processing-01, failed-01, new-upload-id}` → 200 e `notfound-id` → 404; screenshots 1440px conferidos nos quatro estados (uploading com %, processing com barra indeterminada, ready, failed com mensagem por código)
- **Observations:**
  - Updated existing DS: `components/ui/textarea.tsx` (retune border/background/radius/padding/text + drop `dark:bg-input/30`, `dark:disabled:bg-input/80`), `components/ui/select.tsx` (trigger: retune border/background/radius/padding/gap/text/`h-9` + drop `dark:bg-input/30`, `dark:hover:bg-input/50`), `components/ui/input.tsx` (retune padding `pr-2`), `components/ui/button.tsx` (+variant `outline` (retuned): `border-foreground` → `border-border`).
  - Guard de variantes pós-edição: `placeholder:text-muted-foreground` (textarea) e `data-placeholder:text-muted-foreground` (select) não estavam no Drift Report — usuário escolheu **manter** (placeholder distinguível do valor).
  - **Desvio de ordem do plano:** criado o shell `components/studio/video-edit-form.tsx` (Details, Thumbnail, Category, Visibility, CardVideoConfig, rodapé com `VideoChecksStatus` + Cancel/Save Changes) agora, porque o UI Contract manda implementar o formulário uma vez em `studio/` e compô-lo aqui; a SI-04.18a/b reaproveita e liga o mesmo arquivo. `components/upload/upload-video-form.tsx` = `Card` `p-8 gap-6` com `UploadStatusRow` + `VideoEditForm`.
  - Página `app/(app)/studio/upload/[publicId]/page.tsx`: RSC lê vídeo (token da sessão) e categorias via `upstream`, origem pelo `host`/`x-forwarded-*` para o link `/watch/{id}`; sem vídeo → `notFound()` (o mapeamento fino 403/404 fica na SI-04.16b). Título "Upload video" (OQ-9) no lugar do "Channel Settings" do Figma.
  - Ícone do "Change Thumbnail": o asset `4f295.svg` (URL do cache ainda válida) é o glyph Material "stars" — reaproveitado o `StarsIcon` existente (mesmo glyph, viewBox 24; o `size sm` do botão dimensiona a 20px como no Figma).
  - Radix Select só preenche o `SelectValue` após a hidratação (o HTML do servidor vem vazio; depois mostra "Music") — comportamento da biblioteca, sem correção nesta SI.

### SI-04.16b — Tela de Upload em processamento (lógica & wiring)
- **Status:** completed
- **Tests:** `upload-video-form.test.tsx` 10 (Save desabilitado até dirty; `PATCH` com `publish: true` e corpo exato; toasts por `published`; título vazio e descrição > 5000 barrados inline sem fetch; `CATEGORY_NOT_FOUND`/`VALIDATION_ERROR` inline; outros erros em toast; 401 → login com `returnTo`; thumbnail > 5 MiB barrada); `upload-status-row.wiring.test.tsx` 6 (progresso + `progressbar` sem polling; refresh ao completar; polling com fake timers que para em `ready`; sem polling em `ready`; retomada após recarga; banner de `UPLOAD_NOT_ACTIVE`); `cancel-upload.test.tsx` 4; uploader +1 (`UPLOAD_INCOMPLETE` → ressincroniza e reenvia só a parte faltante); provider +1 (`errorCode`); rotas de upload +2 (despacho do catch-all); E2E `tests/studio-upload-processing.e2e-spec.ts` (spec `studio-upload-processing.plan.md`) 5/5; suíte E2E completa 31 passando contra `next start`; Vitest 69 arquivos / 468 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - **Toast (decisão do usuário):** instalado `sonner` 2.0.8 via `npx shadcn add sonner`; o componente gerado foi reconciliado — `next-themes` removido (o tema segue `prefers-color-scheme`, `theme="system"`), ícones `lucide` trocados por `CheckCircleIcon`/`ErrorOutlineIcon`, tokens do DS (popover, border, `radius-2`); `<Toaster position="bottom-right" closeButton />` no layout raiz. API conferida nas tipagens instaladas (context7 indisponível; o registry npm não traz o README).
  - **Bug do `next dev` (decisões do usuário):** `/api/videos/{id}/upload/{parts,complete}` respondiam 404 do Next no `next dev` (Turbopack e webpack, inclusive com `.next` limpo) e normalmente no `next build`. (1) `upload/route.ts` + `upload/parts/` + `upload/complete/` viraram um único `upload/[[...action]]/route.ts` (mesmas URLs e contrato; 405/404 para método/ação inválidos); (2) como o dev seguiu intermitente, os E2E passaram a rodar contra `npm run build` + `MSW_ENABLED=true npm run start` (`next-frontend/CLAUDE.md` § E2E prerequisites e o `CLAUDE.md` raiz atualizados; memória registrada). Tarefa separada: investigar/reportar o bug do `next dev` no bind mount.
  - `playwright.config.ts`: `workers: 1` — o store do MSW é único por servidor e o login o reseta; specs `studio-*` em paralelo corriam um sobre o outro.
  - **Desvio do plano:** `Save Changes` fica desabilitado só até o form ficar dirty (não até ficar válido) — o spec 2.1 clica em Save com o título vazio e espera o erro inline; com o botão desabilitado o clique nunca aconteceria.
  - `VideoEditForm` agora é o formulário real (react-hook-form + Zod: título 1..100 com trim, descrição ≤ 5000 com contador, categoria uuid ou nenhuma, visibilidade), com troca de thumbnail (JPEG/PNG/WebP ≤ 5 MiB validados antes do `PUT`; `THUMBNAIL_INVALID`/`THUMBNAIL_TOO_LARGE` inline) e slot `cancelAction`; o padrão vai para `/studio/videos` (tela de edição). `useWatch` no contador para não somar aviso do React Compiler.
  - `UploadStatusRowLive` (em `upload-status-row.tsx`, agora `"use client"`): progresso do provider; `router.refresh()` quando o envio completa; `useProcessingPoll` só em `processing`; recarga com sessão ativa → "Upload interrupted — select the file again to resume" + seletor para retomar; `UPLOAD_NOT_ACTIVE` → banner com link ao painel. `UploadEntry` ganhou `errorCode`; o uploader trata `UPLOAD_INCOMPLETE` ressincronizando via `GET …/upload` e repetindo o `complete` uma vez.
  - `CancelUploadButton` (diálogo "Cancel upload?" / "Keep uploading"): envio em voo → `cancel()` do provider (que aborta os PUT e chama `DELETE …/upload`); sessão aberta sem envio → `DELETE …/upload`; envio concluído → `DELETE /api/videos/{id}`; depois `/studio/videos`.
  - Página: 401 do upstream → `/login?returnTo=/studio/upload/{id}`; 403/404 → `notFound()` (o 4.1 confirma 404 para `other-channel-01`).
  - `FieldError` (Fase 02) passou a aceitar props de `<p>` (`id` para `aria-describedby`) — mudança retrocompatível.
  - E2E 3.1 confere a URL `/studio/videos` e a ausência de link para `new-upload-id`; a lista do painel ainda não existe (SI-04.17).

### SI-04.17.0 — Drift audit: Painel de gerenciamento de vídeos (My videos list)
- **Status:** completed
- **Tests:** no tests (audit-only); seção `## Screen: painel-de-videos` anexada ao `frontend-drift-report.md` (17 componentes: 12 alinhado, 1 drift menor, 4 drift relevante, 0 ausente); estado do `next-frontend` idêntico antes/depois
- **Observations:**
  - Fonte: a resposta gravada do `get_design_context` de 152:1824 (a cota do Figma segue esgotada), a mesma das SIs 04.0.x que criaram os componentes do estúdio.
  - CONFLICT no `button.tsx`: o "Upload video" é primário `size sm` em pílula, mas o mesmo tamanho é `radius-3` em 156:2110 (aceito nas 04.15.0/04.16.0); verb body `exception` (raio aplicado na chamada, sem retunar o `sm`).
  - `auto-Edit` para a SI-04.17a: `badge.tsx` (tipografia do scaffold `text-xs font-medium` → `text-caption`, a 12/18/400 do Figma; o chip permanece por decisão do UI Contract).
  - `exception`: AppHeader (Prior SI-04.15.0), IconButton ("+" pílula do TopNav da Fase 07) e BrandLogo (tamanho "sm" do TopNav). DropdownMenu e Dialog sem demanda no frame (não desenhados) → `skip` com nota.

### SI-04.17a — Tela de Painel de gerenciamento de vídeos (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell); Vitest completo 69 / 468 passando (badge incluso); `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke no build de produção com MSW: `/studio/videos` → 200 com 20 linhas e "22 videos", `?q=zzz` → estado vazio filtrado; screenshot 1440px conferido
- **Observations:**
  - Updated existing DS: `components/ui/badge.tsx` (retune text: `text-xs font-medium` → `text-caption`). Guard de variantes: só `hover:text-muted-foreground` (cor, não tamanho) — sem conflito.
  - CONFLICT do `button.tsx` aplicado como `exception`: "Upload video" com `className="rounded-[var(--radius-full)]"` na chamada (e no CTA do estado vazio).
  - Página `app/(app)/studio/videos/page.tsx` (RSC): repassa ao `GET /channels/me/videos` só as chaves de filtro conhecidas dos `searchParams`; 401 → `/login?returnTo=/studio/videos`; outra falha → `throw` (o `error.tsx` com retry fica na SI-04.17b). Cabeçalho "Channel content" / "Manage your videos and content", `VideoFilters`, contador "{total} videos" + `VideoSortMenu`, lista e botão "Load more" (inerte até a SI-04.17b).
  - `components/studio/owner-video-row.tsx` (novo, client): `VideoListItem` + `VideoRowActions` com callbacks vazios — a SI-04.17b liga publish/unpublish/delete. `VideoListEmpty` em `video-list.tsx` (sem filtros: "No videos yet" + Upload; com filtros: "No videos match your filters" + Clear filters). `loading.tsx`: skeleton de cabeçalho, filtros e 6 linhas.
  - Smoke rodou no build de produção (convenção nova de E2E); os `<Link>` prefetcham rotas ainda inexistentes (edição e canal, SIs 04.18/04.19).

### SI-04.17b — Tela de Painel de gerenciamento de vídeos (lógica & wiring)
- **Status:** completed
- **Tests:** `components/studio/__tests__/video-row-actions.wiring.test.tsx` 7 (publish/unpublish via BFF atualizam o badge + `router.refresh()`; delete confirmado remove a linha; `VIDEO_NOT_PUBLISHABLE` → toast com ação "Edit video"; `VIDEO_NOT_FOUND` remove a linha + refresh; 401 → login; acúmulo de páginas e reset por filtro); `hooks/__tests__/use-processing-poll.test.ts` 5; `components/studio/__tests__/load-more.test.tsx` 2; E2E `tests/studio-videos.e2e-spec.ts` (spec `studio-videos.plan.md`) 5/5; suíte E2E completa 36 passando (build de produção com MSW); Vitest 72 arquivos / 482 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - `components/studio/owner-video-list.tsx` (novo, client): acumula as páginas do "Load more" (mesmo `resetKey` de filtros + sort → anexa, mesclando por id; filtro novo ou primeira página → substitui), aplica as mutações do kebab via BFF com toasts (`sonner`) e mapeamento do Error Catalog (`VIDEO_NOT_PUBLISHABLE` com link para a edição, `VIDEO_FORBIDDEN`/`VIDEO_NOT_FOUND` + refresh, `STORAGE_UNAVAILABLE` com retry, 401 → login), atualiza a linha localmente com o `VideoResponse` e faz `router.refresh()`; `useProcessingPoll` nas linhas `uploading|processing`. Callbacks rejeitam em falha para o menu/diálogo do `VideoRowActions` não fecharem.
  - `components/studio/load-more.tsx`: `router.replace` com `cursor=next_cursor` preservando os filtros (scroll mantido).
  - `VALIDATION_ERROR` de filtros/cursor: a página redireciona para `/studio/videos?notice=invalid-filters` e o `FiltersNotice` mostra o toast discreto e tira o parâmetro da URL. `app/(app)/studio/videos/error.tsx` com "Try again" (`reset()`) para as demais falhas de leitura.
  - `OwnerVideoRow` passa `data-public-id` à linha (seletor estável nos E2E). O badge da linha tem `data-slot="video-status"`.
  - Teste: o mock de `useRouter` precisa devolver o mesmo objeto entre renders (como o App Router); um objeto novo reinicia o efeito do `useProcessingPoll`.

### SI-04.18.0 — Drift audit: Edição de vídeo (Edit/Publish video)
- **Status:** completed
- **Tests:** no tests (audit-only); seção `## Screen: edicao-de-video` anexada ao `frontend-drift-report.md` (16 componentes: 13 alinhado, 1 drift menor, 2 drift relevante, 0 ausente); estado do `next-frontend` idêntico antes/depois
- **Observations:**
  - Fonte: resposta gravada de 156:2790 (cota do Figma esgotada). Diff automático das classes de todas as camadas nomeadas contra 156:2110: demanda idêntica — os componentes compartilhados ficam `alinhado` com Prior "honored" das decisões aplicadas na SI-04.16a.
  - Novo nesta audit: `radio-group.tsx` (scaffold shadcn não reconciliado) → `auto-Edit` com 6 itens (borda 2px `border-border`, marcado sem fundo, ponto `bg-primary`, e drop de `dark:bg-input/30`, `dark:data-checked:bg-primary` e do `not-data-checked:border-input` de field-label) — hoje o `privacy-option` compensa na chamada, mas os `dark:` do primitivo vencem no tema escuro.
  - `exception`: AppHeader e Card (mesmas razões das audits anteriores, registradas como Prior).

### SI-04.18a — Tela de Edição de vídeo (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell); radio-group + privacy-option 14 passando; Vitest completo verde; `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke no build de produção com MSW: `/studio/videos/{ready-draft-01, published-01, processing-01, failed-01}/edit` com o status de verificações correto por estado e `other-channel-01` → página "Video not found"; screenshot 1440px conferido
- **Observations:**
  - Updated existing DS: `components/ui/radio-group.tsx` (retune border `border-2 border-border`; `data-checked:bg-primary` → `data-checked:bg-transparent`; ponto `bg-primary`; drop `dark:bg-input/30`, `dark:data-checked:bg-primary` e o `not-data-checked:border-input` de field-label). Guard de variantes: só utilitários de estado coerentes com o Figma (`aria-*`, `focus-visible`, `data-checked:border-primary`).
  - Páginas: `app/(app)/studio/videos/[publicId]/edit/page.tsx` (RSC: vídeo como dono + categorias + `playback` quando `ready`; título "Edit video" (OQ-9); `Card p-8 gap-6` com o `VideoEditForm` compartilhado da SI-04.16), `loading.tsx` (skeleton do formulário) e `not-found.tsx` ("Video not found" + volta ao painel). 401 → login com `returnTo`; 403/404 → `notFound()`.
  - Com o `loading.tsx` (streaming), o `notFound()` da página responde HTTP 200 com a UI de não encontrado e `<meta name="robots" content="noindex">` — comportamento documentado do Next (`loading.md` § Status Codes). O spec 3.1 pede só a página de não encontrado; o skeleton é exigido pelo UI Contract. (A tela de upload, sem `loading.tsx`, segue respondendo 404.)
  - O `privacy-option.tsx` mantém suas classes de chamada (agora redundantes com o primitivo reconciliado) — sem limpeza cosmética nesta SI.

### SI-04.18b — Tela de Edição de vídeo (lógica & wiring)
- **Status:** completed
- **Tests:** `components/studio/__tests__/video-edit-form.test.tsx` 10 (pré-preenchido + link público + Save desabilitado; save com `publish: true` → "Video published"; processing → aviso de rascunho; validação ao digitar com Save desabilitado; `CATEGORY_NOT_FOUND`/`VALIDATION_ERROR` inline; `VIDEO_NOT_FOUND` → painel + toast; `STORAGE_UNAVAILABLE` com retry; Cancel direto sem alterações e confirmação "Discard changes?" quando dirty); `thumbnail-upload-button.test.tsx` 7 (PUT com `FormData` `file` sem Content-Type manual; > 5 MiB e tipo inválido barrados antes do envio; `THUMBNAIL_INVALID`/`THUMBNAIL_TOO_LARGE` inline; Remove → `DELETE`); `upload-video-form.test.tsx` 11 (ajustado + caso de `VIDEO_FORBIDDEN`); E2E `tests/studio-video-edit.e2e-spec.ts` (spec `studio-video-edit.plan.md`) 6/6; suíte E2E completa 42 passando (build de produção com MSW); Vitest 74 arquivos / 500 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - **Conflito entre specs resolvido a favor do plano:** o spec da edição (1.3) exige "Save Changes" desabilitado com o título vazio — o plano pede "desabilitado até dirty e válido" nas duas telas. O `VideoEditForm` (compartilhado) passou a validar `onChange` e desabilitar Save até dirty **e** válido; o desvio da SI-04.16b foi revertido e o E2E 2.1 de `studio-upload-processing` agora verifica o erro inline + Save desabilitado (em vez de clicar).
  - `components/studio/thumbnail-upload-button.tsx` (novo): extraído do form; valida JPEG/PNG/WebP ≤ 5 MiB, `PUT` multipart, "Remove custom thumbnail" (`DELETE`) quando `has_custom_thumbnail`, mensagens do UI Contract ("Max 5 MB", "Use a JPEG, PNG or WebP image of at least 640×360"), `STORAGE_UNAVAILABLE` com retry, `router.refresh()` após sucesso.
  - `VideoEditForm`: `VIDEO_FORBIDDEN`/`VIDEO_NOT_FOUND` no save → toast + `/studio/videos`; `STORAGE_UNAVAILABLE` → toast com retry; Cancel com diálogo "Discard changes?" quando dirty; `useProcessingPoll` próprio (prop `pollProcessing`, desligada na tela de upload, onde a linha de status já faz o polling).
  - O select de categorias lista também "No category" (decisão da SI-04.0.x); o E2E 1.1 confere as 10 categorias da seed de Music a Other descontando essa opção.
  - Teste do botão de thumbnail: o `FormData` do jsdom não é serializado pelo `fetch` do Node, então o teste unitário inspeciona o corpo passado ao `fetch` (spy); o multipart real é coberto pelo E2E 2.1 e pela integração da rota BFF.

### SI-04.19.0 — Drift audit: Edição do canal (Channel Settings)
- **Status:** completed
- **Tests:** no tests (audit-only); seção `## Screen: edicao-do-canal` anexada ao `frontend-drift-report.md` (12 componentes: 9 alinhado, 1 drift menor, 2 drift relevante, 0 ausente); estado do `next-frontend` idêntico antes/depois
- **Observations:**
  - Fonte: resposta gravada de 154:1367 (cota do Figma esgotada), a mesma das SIs 04.0.x que criaram os componentes de canal. Campos (TextField `pl-4 pr-2 py-1.5`, Textarea `px-4 py-3`) e botões (outline `border-border`, primário `radius-3`) reproduzem o que a SI-04.16a aplicou → Prior "honored".
  - Nenhum `auto-Edit` nesta tela. `exception`: AppHeader e Card (razões das audits anteriores) e Avatar (128px "2xl" composto na chamada pelo `ChannelAvatar` com `size-32`; o primitivo não ganha tamanho por uma tela só, ele também servirá ao menu da conta da Fase 07).

### SI-04.19a — Tela de Edição do canal (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell); Vitest completo verde; `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke no build de produção com MSW: `/studio/channel` → 200 com "Channel Settings"; screenshot 1440px conferido
- **Observations:**
  - Drift Report sem `auto-Edit` nesta tela (AppHeader/Card/Avatar `exception`, demais `skip`) → nenhum arquivo do DS alterado.
  - `components/channel/channel-settings-form.tsx` (novo, client): `Card` com "Basic Information" (handle com `@` visual fixo + display name lado a lado a 20px, helpers em `text-helper` 12/16 como no Figma), "Description" (h2 que rotula a textarea via `aria-labelledby`), rodapé com `AlarmIcon` + "Last updated: {data}" e Cancel/Save Changes. Campos não controlados no shell — a SI-04.19b liga react-hook-form, `PATCH /api/channel` e os erros.
  - Página `app/(app)/studio/channel/page.tsx` (RSC): `GET /channels/me` com o token; 401 → login com `returnTo`; título "Channel Settings"; `ChannelHeaderCard` (banner/avatar placeholder, nome, `@nickname`, "{video_count} videos", sem inscritos); `loading.tsx` com skeleton do cabeçalho e do formulário.

### SI-04.19b — Tela de Edição do canal (lógica & wiring)
- **Status:** completed
- **Tests:** `components/channel/__tests__/channel-settings-form.test.tsx` 11 (pré-preenchido com `@` fora do valor e Save desabilitado; PATCH só com campos dirty + toast + refresh; descrição vazia → `null`; `NICKNAME_TAKEN` inline; `VALIDATION_ERROR` no campo citado; handles `admin`/`Ab`/`@canal` barrados sem envio; nome obrigatório e descrição ≤ 1000 com contador; Cancel → painel; 401 → login); E2E `tests/studio-channel.e2e-spec.ts` (spec `studio-channel.plan.md`) 4 passando + 1 `fixme`; suíte E2E completa 46 passando / 1 skipped (build de produção com MSW); Vitest 75 arquivos / 511 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - `ChannelSettingsForm` com react-hook-form + Zod espelhando o `UpdateChannelDto` (handle `^[a-z0-9_]{3,50}$` fora de `me/admin/channel/channels/studio/api/watch/login/signup`; nome 1..50 com trim; descrição ≤ 1000 com contador); validação `onChange`, Save desabilitado até dirty e válido; `PATCH /api/channel` só com os campos alterados; sucesso → toast "Channel updated" + `reset` + `router.refresh()` (cabeçalho com o novo `@nickname`); Cancel → `/studio/videos`.
  - **E2E parcial (pendente da SI-04.20b):** os passos 2–3 do cenário 1.2 visitam a página pública `/channel/{nickname}`, que ainda não existe; ficaram no `test.fixme("1.2b …")` — a SI-04.20b deve trocá-lo por `test` e executá-lo. O passo 1 (PATCH só com `nickname` + toast + cabeçalho) roda no `1.2`.
  - A lista de reservados do front espelha `RESERVED_NICKNAMES` do backend (`channels.constants.ts`) — duplicação de regra de validação inevitável sem tipo exportado no contrato OpenAPI (o `pattern` está no schema, a lista só na descrição).

### SI-04.20.0 — Drift audit: Página pública do canal (Channel Show)
- **Status:** completed
- **Tests:** no tests (audit-only); seção `## Screen: pagina-publica-do-canal` anexada ao `frontend-drift-report.md` (14 componentes: 9 alinhado, 1 drift menor, 4 drift relevante, 0 ausente); estado do `next-frontend` idêntico antes/depois
- **Observations:**
  - Fonte: resposta gravada de 155:1926 (cota do Figma esgotada), a mesma das SIs 04.0.x que criaram os componentes de canal, o `filter-chip` e o `video-card`.
  - `auto-Edit` para a SI-04.20a: `tabs.tsx` (scaffold shadcn sem consumidor) → variante `line` no estilo sublinhado do Figma: lista de 48px em largura total com divisor `border-border`, abas `px-4` em `text-body-md` (inativa `muted-foreground`, ativa `foreground`) e indicador de 3px na base. A variante `line` foi escolhida pelo papel visual (o nome da variante no Figma não vem na resposta).
  - `exception` com Prior: AppHeader (15.0), IconButton e BrandLogo (17.0 — sino é Fase 06 e fica oculto), Avatar (19.0). Button: Subscribe não renderizado nesta fase (Fase 06), pílula segue a decisão de chamada da 17.0.

### SI-04.20a — Tela de Página pública do canal (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell); tabs 6 passando; Vitest completo verde; `tsc` 0; lint 0 erros (2 warnings pré-existentes); smoke no build de produção com MSW (anônimo): `/channel/tech_mastery` → 200, título "Tech Mastery", 20 cards; `/channel/nao_existe` → "Channel not found"; screenshots 1440px conferidos
- **Observations:**
  - Updated existing DS: `components/ui/tabs.tsx` — variante `line` (+variant `line` (retuned): lista `w-full justify-start gap-0 border-b border-border p-0` com `h-12`; trigger `px-4 text-body-md text-muted-foreground`; indicador `after:inset-x-0.5 after:bottom-0 after:h-0.75`). Guard de variantes: `dark:text-muted-foreground` no trigger, não coberto pelo relatório — usuário decidiu **remover** (redundante com o token).
  - Página `app/(app)/channel/[nickname]/page.tsx` (RSC anônimo): `GET /channels/{nickname}` deduplicado com `cache()` entre `generateMetadata` (título/descrição do canal) e a página; `GET /channels/{nickname}/videos` com `sort` validado (`latest|popular|oldest`, senão `latest`) e `cursor`; inexistente → `notFound()`. Layout do Figma: `main` `gap-6 py-6`, `ChannelHeader` (banner, avatar, info; ações de Subscribe/sino não renderizadas — Fase 06), `Tabs` `line` só com "Videos" (`TabsTrigger` com `flex-none` na chamada — a aba tem a largura do conteúdo), `ChannelVideoSort`, `ChannelVideoGrid` com `VideoCard showChannel={false}` e "Load more" inerte (SI-04.20b). `loading.tsx` (banner, avatar, abas, chips e 8 cards) e `not-found.tsx` ("Channel not found" + link para a home).
  - Com o `loading.tsx` (streaming), o `notFound()` responde HTTP 200 com a UI de não encontrado + `noindex` (mesmo comportamento documentado da SI-04.18a).

### SI-04.20b — Tela de Página pública do canal (lógica & wiring)
- **Status:** completed
- **Tests:** `components/channel/__tests__/channel-video-sort.wiring.test.tsx` 3 (chip ativo de `?sort=`; valor inválido → Latest; troca de ordem sem `cursor`); `components/channel/__tests__/channel-load-more.test.tsx` 3 (`cursor` preservando `sort`; oculto sem `next_cursor`; acúmulo de páginas + reset ao trocar a ordem); E2E `tests/channel-public.e2e-spec.ts` (spec `channel-public.plan.md`) 3/3 + `studio-channel` 1.2b reativado; suíte E2E completa **50 passando, 0 skipped** (build de produção com MSW); Vitest 77 arquivos / 517 passando; `tsc` 0; lint 0 erros (2 warnings pré-existentes)
- **Observations:**
  - **404 real para canal inexistente:** com o `loading.tsx`, um `notFound()` na página saía HTTP 200 (streaming). A verificação foi para `app/(app)/channel/[nickname]/layout.tsx`, fora da fronteira de Suspense do `loading.tsx` — o 404 é decidido antes do primeiro byte (Next `loading.md` § Status Codes) — e o `not-found.tsx` subiu para `app/(app)/channel/not-found.tsx`. `lib/channel/get-channel.ts` (`cache()`) faz uma única leitura por request para layout, `generateMetadata` e página.
  - Página: título "{name} (@{nickname}) — StreamTube" + descrição; `sort` validado (inválido → `latest`); `VALIDATION_ERROR` do upstream (cursor) → refaz com os padrões; outras falhas → `error.tsx` com retry. `components/channel/channel-video-list.tsx` (client) acumula as páginas do "Load more" para a mesma ordem; `channel-load-more.tsx` reaproveita o `LoadMore` do estúdio e some sem `next_cursor`.
  - **Divergência do spec (1.1 passo 2):** o spec pede `alt` com o título na imagem do card; o `VideoCard` usa `alt=""` porque o título já é o texto do link — opção prevista no próprio UI Contract ("ou `alt=\"\"` quando o título já é o texto do link") e que evita nome duplicado no leitor de tela. O E2E confere o nome acessível do link e o `src` público (sem `X-Amz-*`).
  - `studio-channel` 1.2b (pendência da SI-04.19b) reativado: `/channel/novo_canal` mostra "Studio Canal" e o nickname antigo responde 404.
  - Estabilidade: `use-processing-poll.test.ts` passou a usar fake timers puros (com `shouldAdvanceTime` a fronteira de 3 s falhava sob carga); `studio-videos` 2.1 espera o menu anterior (não modal) fechar antes de abrir o próximo kebab.

## Final verification (2026-10-19)

- **Backend tests:** `npm test -- --runInBand` → 56 suítes / 479 testes passando.
- **Backend E2E:** `npm run test:e2e` → 14 suítes / 107 testes passando.
- **Type checks:** `npx tsc --noEmit` → 0 no `nestjs-project` e 0 no `next-frontend`.
- **Lint:**
  - `next-frontend`: 0 erros (2 warnings pré-existentes em `components/auth`).
  - `nestjs-project`: `npm run lint` **continua falhando por dívida anterior à fase**, com 217 erros em 13 arquivos de specs/e2e das Fases 02/03. No HEAD eram cerca de 223 erros em 14 arquivos. Nenhum arquivo novo da Fase 04 tem erro, e os arquivos tocados mantêm ou reduzem as contagens do HEAD.
- **Frontend tests:** `npm test` → 77 arquivos / 517 testes passando.
- **Frontend build:** `npm run build` → compilado com sucesso.
- **Frontend E2E:** `npx playwright test` contra `npm run build` + `MSW_ENABLED=true npm run start` (nova convenção, SI-04.16b) → **50/50 passando em duas execuções consecutivas**, 0 skipped.
  - O comando da checklist (`npm run dev`) foi substituído por essa convenção, porque o `next dev` serve rotas profundas de forma intermitente neste bind mount.
- **Cadeia OpenAPI:** `openapi:export` → `sync-openapi.sh` → `openapi:types` rerodada; os hashes de `nestjs-project/openapi.json`, `next-frontend/openapi.json` e `lib/api/types.gen.ts` ficaram idênticos (estável), e as duas cópias do spec são iguais. O `git diff --exit-code` contra o HEAD não se aplica enquanto a fase não for commitada.
- **Entregáveis por tela:** as seis rotas (`/studio/upload`, `/studio/upload/{id}`, `/studio/videos`, `/studio/videos/{id}/edit`, `/studio/channel`, `/channel/{nickname}`) respondem e renderizam os estados previstos.
  - Loading, sucesso, vazio, 404 e erro foram cobertos por E2E, testes de componente e smokes registrados por SI.
  - Exceção conhecida: em `/studio/videos/{id}/edit`, o 404 é a UI de não encontrado com HTTP 200 (streaming do `loading.tsx`, comportamento documentado do Next). Já `/channel/{nickname}` responde 404 real.
- **Ajustes de estabilidade feitos na própria verificação:**
  - A primeira execução completa do E2E teve falhas intermitentes: `fill()` antes da hidratação gerou "Aula prontaAula final", e `main` não estava pronto em 5 s.
  - Criado `waitForHydration(page, selector)` em `tests/fixtures.ts`. Ele espera as chaves `__reactFiber…` no nó, porque `networkidle` não funciona em páginas com polling ou `<video>`. Os specs do estúdio passaram a usá-lo depois do login e das navegações que precedem interações.
  - Corrigido o `progress.md`: uma edição da SI-04.19b tinha duplicado o arquivo inteiro dentro de uma observação (`` $` `` no texto de substituição do `String.replace`). O bloco duplicado foi removido por índices e o conteúdo da SI-04.19b foi restaurado.
