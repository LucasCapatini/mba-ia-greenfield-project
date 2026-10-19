# phase-04-video-channel-management — Screen Inventory

> **Phase:** 04 — Gerenciamento de Vídeos e Canal
> **Status:** Validated
> **Date:** 2026-10-18
> **Screens in scope:** 5

---

## Screen: Painel de gerenciamento de vídeos (My videos list)

**Route:** `/studio/videos`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-1824 (node `0RBoWy5FbrK8SHEz1eK6gb:152:1824`)
**Purpose (from project-plan.md):** "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| TopNav (152:1827) | Local-interactive | ✓ | `components/layout/app-header.tsx` | Header compartilhado (escopo fase 07). O arquivo existente cobre só logo + ações de auth; menu, busca, mic, "+" e avatar do TopNav não existem nele ainda |
| Menu trigger / Frame (I152:1827;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Hambúrguer que colapsa/expande o SideNav; escopo fase 07 |
| BrandLogo / Size=sm (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | Herdado da fase 02 |
| Search global (I152:1827;62:1879 + botão 62:1881) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | Busca global da plataforma — escopo fase 07 (home/busca); nesta fase apenas navega |
| Voice search / Auto Layout Horizontal (I152:1827;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | Nenhuma capability em nenhuma fase cobre busca por voz; decorativo |
| IconButton "add" (I152:1827;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Botão "Create" do header (descrição Figma do TopNav); escopo fase 07 — nesta fase o ponto de entrada do upload é o Button "Upload video" (152:2154) |
| Avatar da conta (I152:1827;62:1892 / 62:1893) | Local-interactive | ✗ | `components/ui/avatar.tsx (new)` | Abre o menu do usuário; escopo fase 07 |
| SideNav (152:1825) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | Menu lateral compartilhado (escopo fase 07); variantes colapsado/expandido na descrição Figma |
| SideNav items "Home" / "Subscriptions" / "Your videos" / "Liked videos" (I152:1825;62:1620, 62:1630, 62:1653, 62:1664) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | Links de navegação (Next `<Link>`); "Your videos" aponta para esta tela; escopo fase 07 |
| Títulos de seção "You" / "Subscriptions" (I152:1825;62:1638, 62:1671) | Presentational | ✗ | new | Texto estático do SideNav |
| Lista de canais inscritos (I152:1825;62:1672, itens 62:1673…62:1693) | Presentational | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | Avatar + nome por canal; a fonte de dados (inscrições) pertence às fases 06/07 — nesta fase recebe props/placeholder |
| Divisores (I152:1825;62:1635, 62:1697) | Presentational | ✗ | `components/ui/separator.tsx (new)` | — |
| videos table — cabeçalho da página (152:2137) | Presentational | ✗ | `components/studio/studio-page-header.tsx (new)` | Container título + subtítulo + ação primária |
| Título "Channel content" (152:2151) | Presentational | ✗ | new | `<h1>` (Inter/Heading/H1) |
| Subtítulo "Manage your videos and content" (152:2152) | Presentational | ✗ | new | `<p>` muted |
| Button "Upload video" (152:2154) | Server-connected | ✓ | `components/ui/button.tsx` | Variant default (primary); inicia o fluxo de upload (UI de upload adiada da fase 03 para esta fase) |
| videos filter row / Filters (152:2163 / 2528:2187) | Server-connected | ✗ | `components/studio/video-filters.tsx (new)` | Barra de filtros + busca do painel; altera a consulta da lista paginada (TD-06: cursor keyset, lista vem do servidor) |
| Button "Filter" (152:2183) | Local-interactive | ✓ | `components/ui/button.tsx` | Variant secondary com ícone; abre as opções de filtro — o conteúdo do menu não está desenhado |
| Button "Public" (158:2949) | Server-connected | ✓ | `components/ui/button.tsx` | Chip de filtro por visibilidade |
| Button "Date" (158:2954) | Server-connected | ✓ | `components/ui/button.tsx` | Chip de filtro por data; o seletor que ele abre não está desenhado |
| Search "Search your videos" (158:4013) | Server-connected | ✗ | `components/ui/search-input.tsx (new)` | Componente DS "Search" (158:4007: ícone + limpar); pode compor `components/ui/input.tsx` |
| Contador "24 videos" (158:3060) | Presentational | ✗ | new | Recebe o `total` da listagem (TD-06 prevê `total` só no painel) |
| Sort actions / "Sort by: Latest" + ícone Filter list (2726:2139 / 158:3301 / 158:3311) | Server-connected | ✗ | `components/studio/video-sort-menu.tsx (new)` | Reordenar implica nova consulta (TD-06: "mudar a ordem = novo cursor"); compõe `components/ui/dropdown-menu.tsx (new)`; opções de ordenação não desenhadas |
| Lista de vídeos — container das linhas (158:3198) | Server-connected | ✗ | `components/studio/video-list.tsx (new)` | Lista paginada por cursor (TD-06) |
| VideoList (158:3096; instâncias 158:3130, 158:3164, 158:3199, 158:3233, 158:3267) | Server-connected | ✗ | `components/studio/video-list-item.tsx (new)` | Componente DS "VideoList" (115:358) — linha 1088×160; exibe dados vindos do backend |
| thumb + img + duração (I158:3096;108:323 / 108:324 / 108:325) | Presentational | ✗ | `components/video/video-thumbnail.tsx (new)` | 256×144, duração sobreposta; URL estável de thumbnail conforme TD-10 |
| Título do vídeo (I158:3096;108:329) | Presentational | ✗ | new | Uma linha com ellipsis |
| Descrição do vídeo (I158:3096;108:335) | Presentational | ✗ | new | Texto muted com ellipsis |
| Linha de métricas: views / likes / comentários / "2 days ago" (I158:3096;108:336 — 108:337, 108:342, 108:347, 108:353) | Presentational | ✗ | `components/studio/video-stats.tsx (new)` | Contadores denormalizados (TD-05) + tempo de publicação (`published_at`, TD-02) |
| Status "Public" (I158:3096;108:355) | Presentational | ✗ | `components/ui/badge.tsx (new)` | Só o estado "Public" (success-text) está desenhado |
| button kebab (I158:3096;108:331 / svg 108:332 / Frame 108:333) | Server-connected | ✗ | `components/studio/video-row-actions.tsx (new)` | Único affordance de ação por linha (menu não desenhado no Figma). Decisão do usuário (2026-10-18): menu com "Editar" (navega para a edição), "Publicar"/"Despublicar" (ações dedicadas de TD-03, com pré-condições de TD-02) e "Excluir" com confirmação (hard delete + job de TD-09). Compõe `components/ui/dropdown-menu.tsx (new)` e `components/ui/dialog.tsx (new)` |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Exibir lista paginada de vídeos do canal com thumbnail, título, métricas, tempo de publicação e status | Lista de vídeos (158:3198) / VideoList (158:3096) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Iniciar upload de vídeo novo | Button "Upload video" (152:2154) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Filtrar vídeos do canal por visibilidade | Button "Public" (158:2949) em Filters | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Filtrar vídeos do canal por data | Button "Date" (158:2954) em Filters | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Buscar vídeos do próprio canal por texto | Search "Search your videos" (158:4013) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Ordenar a lista de vídeos do canal | Sort actions (2726:2139) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Acessar a edição de um vídeo a partir do painel | VideoList (158:3096) — linha/título ou menu kebab (108:331) | "Edição de vídeos a partir do painel" |
| Publicar ou despublicar um vídeo a partir do painel | button kebab (I158:3096;108:331) em VideoList | "Fluxo de rascunho → publicação" |
| Excluir um vídeo do canal (com confirmação) | button kebab (I158:3096;108:331) em VideoList | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |

### Observations

- **Saída do Figma truncada:** a resposta de `get_design_context` foi cortada após o bloco "Component descriptions" e o screenshot; se havia um mapa Code Connect depois disso, ele não foi lido. O único componente emitido como código reutilizável foi `BrandLogo`, já herdado da fase 02. Os caminhos `(new)` acima são propostas por convenção do repositório, não Code Connect.
- **Kebab invisível:** o `button` (I158:3096;108:331) existe no tree de cada linha mas seu `Frame` (108:333) não tem asset e não aparece no screenshot — nem o menu nem suas ações estão desenhados. Decisão do usuário (2026-10-18): o menu contém "Editar", "Publicar"/"Despublicar" e "Excluir" (com diálogo de confirmação), cobrindo nesta tela as capabilities "Fluxo de rascunho → publicação" e a exclusão decidida em TD-09; o conteúdo visual do menu e do diálogo não existe no Figma e precisa ser derivado dos primitivos shadcn (`dropdown-menu`, `dialog`).
- **Estados não desenhados:** só o status "Public" aparece (texto verde). Não há variantes para `draft`, `unlisted`, `processing`, `failed` (TD-02 define `status` + `visibility`; TD-12 prevê polling que leva o painel de `processing` a `ready`), nem estado vazio ("nenhum vídeo ainda"), nem estado de carregamento/erro.
- **Paginação:** o frame mostra 6 linhas de "24 videos" e termina cortado; não há controle de paginação nem "carregar mais". TD-06 decidiu cursor keyset com `total` no painel — o mecanismo de UI (botão "carregar mais" vs. scroll infinito) fica para plan-build.
- **Filtros/ordenação/busca sem contrato:** TD-06 define apenas `limit`/`cursor` (+ `total`); os parâmetros de filtro por visibilidade, filtro por data, busca textual e ordenação ("Sort by: Latest") não constam de nenhuma TD. Os verbos foram mapeados à capability do painel por serem sub-funções dele; o conteúdo dos menus "Filter" e "Date" e as opções de "Sort by" não estão desenhados.
- **Header/menu lateral compartilhados (fase 07):** TopNav (152:1827) e SideNav (152:1825) são componentes compartilhados cujo escopo (menu, busca global, mic, "+", avatar/menu do usuário, lista de inscrições) pertence à fase 07; nesta fase só precisam existir como shell. `components/layout/app-header.tsx` existe mas é a versão da fase 02 (logo + "Entrar"/"Criar conta"). O IconButton "add" do header duplica semanticamente o Button "Upload video" — definir se ambos abrem o mesmo fluxo.
- **Componentes vistos no screenshot mas ausentes do `get_design_context`:** nenhum — todos os elementos visíveis têm nós correspondentes. O inverso ocorre com o kebab (nó presente, render ausente), já registrado acima.
- **Acessibilidade:** os botões do header (menu, busca, mic, "+", avatar) e o kebab são icon-only sem rótulo textual — exigem `aria-label`; a duração "10:30" sobreposta na thumbnail (branco sobre imagem) pode falhar contraste sem fundo escurecido; o status apenas por cor verde precisa do texto (já presente) e de variantes com ícone/texto para os demais estados; a linha de métricas usa ícones sem texto alternativo (views/likes/comentários) — o `<img alt="">` gerado deve virar ícones com rótulo ou texto visível ("124K views" já tem texto, "5.2K" e "432" não indicam o que são).

---

## Screen: Edição de vídeo (Edit/Publish video)

**Route:** `/studio/videos/{publicId}/edit`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2790 (node `0RBoWy5FbrK8SHEz1eK6gb:156:2790`)
**Purpose (from project-plan.md):** "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| Edit/Publish video (156:2790) | Server-connected | ✗ | `app/studio/videos/[publicId]/edit/page.tsx (new)` | Frame raiz = página; precisa carregar os dados atuais do vídeo (título, descrição, categoria, thumbnail, visibilidade, status) antes de renderizar o formulário. Nenhum Code Connect emitido pelo Figma — todos os caminhos abaixo são propostas. |
| TopNav (156:2792) | Local-interactive | ✓ | `components/layout/app-header.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Menu trigger (I156:2792;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| BrandLogo / Size=sm (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Search field (I156:2792;62:1879) + search button (I156:2792;62:1881) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Voice search button (I156:2792;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| IconButton "add" (I156:2792;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Avatar do usuário (I156:2792;62:1892) | Local-interactive | ✗ | `components/ui/avatar.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Body (2734:2196) | Presentational | ✗ | new | Wrapper flex SideNav + Main content. |
| SideNav (156:2791) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav › Subscriptions list (I156:2791;62:1669) | Presentational | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Main content (2734:2195) | Presentational | ✗ | new | Coluna principal com padding; puro DOM. |
| Page title "Channel Settings" (156:2794) | Presentational | ✗ | new | `<h1>`. Texto no Figma diz "Channel Settings" embora a tela seja de edição de vídeo — ver Observations. |
| Channel card (156:2796) | Server-connected | ✗ | `components/studio/video-edit-form.tsx (new)` | Formulário completo (validação local + submissão ao servidor → Server-connected por regra). Agrupa Details, Thumbnail, Category, Visibility e rodapé de ações. |
| Card (156:2797) | Presentational | ✓ | `components/ui/card.tsx` | Herdado da fase 02; fundo/borda do formulário. |
| Content row (2777:2085) | Presentational | ✗ | new | Grid duas colunas: campos à esquerda, CardVideoConfig à direita. |
| Details column (156:2813) + heading "Details" (156:2814) | Presentational | ✗ | new | `<h2>` + stack de campos. |
| Title field group (2774:2091) | Presentational | ✗ | new | Wrapper label + input. |
| FormLabel "Title" (2175:297) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02. |
| TextField "Title" (156:2815) | Local-interactive | ✓ | `components/ui/input.tsx` | Herdado da fase 02. Valor inicial vem do servidor via o formulário; o campo em si é controlado localmente. |
| Description field group (2774:2092) | Presentational | ✗ | new | Wrapper label + textarea. |
| FormLabel "Description" (2175:309) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02. |
| Textarea "Description" (156:2816) | Local-interactive | ✗ | `components/ui/textarea.tsx (new)` | Primitivo shadcn ainda inexistente no repo. Figma prevê "Supporting text" opcional (não usado nesta instância). |
| CardVideoConfig (156:3122) | Server-connected | ✗ | `components/studio/video-config-card.tsx (new)` | Painel lateral somente leitura: preview, link público, nome do arquivo original e qualidade — todos derivados do registro do vídeo no servidor. |
| CardVideoConfig › Video preview (I156:3122;156:3089) | Server-connected | ✗ | `components/studio/video-preview.tsx (new)` | Lê a playback URL do vídeo. O player em si é escopo da fase 05 — aqui é só um preview com botão play e "0:00". |
| CardVideoConfig › Video link (I156:3122;156:3107) | Presentational | ✗ | new | Link `streamtube.com/v/tech2024` — exibe a URL pública derivada do publicId; o path `/v/{id}` depende da rota da página de watch (fase 05). |
| CardVideoConfig › Copy link icon (I156:3122;156:3108) | Local-interactive | ✗ | `components/studio/copy-link-button.tsx (new)` | Copia o link para o clipboard; sem I/O com backend. |
| CardVideoConfig › Filename (I156:3122;156:3112) | Presentational | ✗ | new | Nome do arquivo original enviado no upload (metadado fase 03). |
| CardVideoConfig › Video Quality (I156:3122;156:3117) | Presentational | ✗ | new | Qualidade extraída pelo worker (metadado fase 03). |
| SectionHeader "Thumbnail" (2390:2267) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Título H2 + descrição muted; três instâncias na tela. |
| Thumbnail row (2777:2086) | Presentational | ✗ | new | Linha thumbnail + botão. |
| ThumbUpload (156:2612) | Server-connected | ✗ | `components/studio/thumbnail-preview.tsx (new)` | Exibe a thumbnail atual (customizada ou gerada pelo worker) a partir do storage. A descrição Figma diz "placeholder de upload antes do processamento", mas nesta tela mostra a thumbnail efetiva. O badge de duração "15:41" (156:2610) está posicionado fora do bounding box (left 368/top 207 em 266×151) e não aparece no screenshot. |
| Button "Change Thumbnail" (156:2812) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado (Button variante outline, ícone upload). Dispara seleção de arquivo + envio da thumbnail customizada; precisa de wrapper com `<input type="file">` (`components/studio/thumbnail-upload-button.tsx (new)`). |
| SectionHeader "Category" (2390:2270) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | — |
| Category select (2096:2238) | Server-connected | ✗ | `components/ui/select.tsx (new)` | Primitivo Select (estados Default/Focused/Disabled no Figma). A lista de opções vem do servidor (categorias da plataforma); o wrapper `components/studio/category-select.tsx (new)` recebe/consulta as categorias. |
| SectionHeader "Visibility" (2390:2273) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | — |
| PrivacyOption "Public" (156:2822) | Local-interactive | ✗ | `components/studio/privacy-option.tsx (new)` | Item radio com ícone globo, título e descrição; estado selecionado (fundo input + borda primary). Baseado em `components/ui/radio-group.tsx (new)`. A escolha só vai ao servidor via "Save Changes". |
| PrivacyOption "Unlisted" (156:2821) | Local-interactive | ✗ | `components/studio/privacy-option.tsx (new)` | Mesma instância, estado não selecionado (ícone link). |
| publish form (156:2798) | Presentational | ✗ | new | Rodapé com borda superior: status à esquerda, ações à direita. |
| Status (2771:2088) — check_circle (156:2802) + texto (156:2801) | Server-connected | ✗ | `components/studio/video-checks-status.tsx (new)` | "Checks complete. No issues found." — reflete o `processing_status` do vídeo (uploading → processing → ready / failed, fase 03) que condiciona a publicação (TD-02: publicar exige `ready`). Só o estado de sucesso foi desenhado. |
| Actions (2771:2089) | Presentational | ✗ | new | Grupo de botões. |
| Button "Cancel" (156:2800) | Local-interactive | ✓ | `components/ui/button.tsx` | Herdado (outline). Descarta alterações e volta ao painel de vídeos; sem I/O. |
| Button "Save Changes" (156:2799) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado (default/primary). Submete o formulário completo (título, descrição, categoria, visibilidade; thumbnail se já enviada). |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Carregar dados atuais do vídeo para edição (título, descrição, categoria, thumbnail, visibilidade, status) | Edit/Publish video (156:2790) | "Edição de vídeos a partir do painel" |
| Editar título e descrição do vídeo | Channel card (156:2796) › video-edit-form | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Salvar alterações das informações do vídeo | Button "Save Changes" (156:2799) | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Alterar visibilidade do vídeo entre público e unlisted | Button "Save Changes" (156:2799) (valor escolhido em PrivacyOption) | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" |
| Publicar vídeo ao salvar um rascunho pronto (sair do estado de rascunho) | Button "Save Changes" (156:2799) | "Fluxo de rascunho → publicação" |
| Listar categorias disponíveis para escolha | Category select (2096:2238) | "Categorias de vídeo disponíveis na plataforma" |
| Escolher categoria do vídeo | Category select (2096:2238) + Button "Save Changes" (156:2799) | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Exibir thumbnail atual do vídeo | ThumbUpload (156:2612) | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Enviar thumbnail customizada | Button "Change Thumbnail" (156:2812) | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Exibir preview do vídeo a partir da playback URL | CardVideoConfig › Video preview (I156:3122;156:3089) | "Edição de vídeos a partir do painel" |
| Exibir metadados do arquivo (link público, nome do arquivo, qualidade) | CardVideoConfig (156:3122) | "Edição de vídeos a partir do painel" |
| Exibir status de processamento do vídeo que condiciona a publicação | Status (2771:2088) | "Fluxo de rascunho → publicação" |

### Observations

- **Título da página divergente:** o heading (156:2794) diz "Channel Settings", mas a tela edita um vídeo (frame "Edit/Publish video"). Provável herança da tela de configurações do canal; o texto final ("Edit video" ou equivalente) precisa ser decidido no plan-build.
- **Sem botão "Publish"/"Unpublish" e sem "Delete":** apesar do nome do frame, só existem "Cancel" e "Save Changes". Decisão do usuário (2026-10-18): "Save Changes" publica implicitamente quando o vídeo é rascunho e `processing_status = ready` (além de salvar os campos); despublicar e excluir ficam no kebab do painel. No BFF isso se traduz em compor o `PATCH` de campos com a ação dedicada de publicação de TD-03 (a decisão de API não muda; a UI apenas dispara as duas). Registrado em Open questions para o plan-validate conferir a coerência com TD-03 e com as pré-condições de TD-02 (título obrigatório).
- **Status de verificações:** o texto "Checks complete. No issues found." (156:2801) foi mapeado ao `processing_status` do worker (fase 03), que é a pré-condição de publicação decidida em TD-02 (`ready` + título). Precisa de variantes para `processing`, `failed` (com os códigos `UNSUPPORTED_FORMAT`, `PROBE_FAILED`, `THUMBNAIL_FAILED`, `OBJECT_MISSING`) e `uploading` — só o sucesso foi desenhado.
- **Estados não desenhados:** não há variantes para rascunho vs. publicado, processamento em andamento/falha, erros de validação nos campos (Title vazio, Description longa), estado de carregamento/erro do envio de thumbnail, nem estado "salvando" do botão. O Figma de TextField/Textarea prevê "Supporting text" que pode ser usado para erro, mas não está instanciado.
- **Badge de duração fora do frame:** o badge "15:41" (156:2610) dentro de ThumbUpload está posicionado fora do bounding box e não aparece no screenshot — tratar como artefato do componente, não como requisito desta tela.
- **Componentes compartilhados de outras fases:** TopNav (156:2792), SideNav (156:2791) e a lista de inscrições são escopo da fase 07 (navegação) / 06 (inscrições); aparecem aqui apenas como shell. O preview de vídeo em CardVideoConfig depende do player da fase 05 — aqui basta exibir poster + play estático ou `<video>` com a playback URL já existente da fase 03.
- **Link público:** `streamtube.com/v/tech2024` assume rota `/v/{publicId}` para a página de watch; essa rota só se define na fase 05 — a URL exibida/copiada depende dessa decisão.
- **Fonte das categorias e thumbnail:** o Select exige que as categorias venham do servidor (TD-01: tabela `categories` + endpoint); o envio da thumbnail customizada segue TD-04 (pela API, validada e normalizada em processo).
- **Code Connect:** o `get_design_context` não emitiu mapa de Code Connect; todos os caminhos `(new)` são propostas segundo a convenção do repo. Nenhum componente visível no screenshot está ausente da árvore retornada.
- **Acessibilidade:** PrivacyOption precisa de `role="radiogroup"`/`role="radio"` com navegação por teclado e `aria-checked`; "Change Thumbnail" deve ser um `<label>` ligado a um `<input type="file" accept="image/*">`; o Select de categoria precisa de label associado (o SectionHeader não é um `<label>`); os ícones de copiar link, busca por voz, "+" e menu precisam de `aria-label`; a mensagem de status deve usar `aria-live="polite"`; a imagem da thumbnail precisa de `alt` descritivo; o contraste de "Checks complete…" (muted 12px) merece verificação.

---

## Screen: Edição do canal (Channel Settings)

**Route:** `/studio/channel`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=154-1367 (node `0RBoWy5FbrK8SHEz1eK6gb:154:1367`)
**Purpose (from project-plan.md):** "Edição das informações do canal: nickname, nome e descrição"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| TopNav (154:1369) | Local-interactive | ✓ | `components/layout/app-header.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Menu trigger (I154:1369;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| BrandLogo (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Search field (I154:1369;62:1879) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Voice search button (I154:1369;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| IconButton add (I154:1369;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Account avatar (I154:1369;62:1893) | Local-interactive | ✗ | `components/ui/avatar.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav (154:1368) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav › Subscriptions list (I154:1368;62:1672) | Presentational | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Page title "Channel Settings" (154:1372) | Presentational | ✗ | new | `<h1>` (Inter/Heading/H1). |
| Channel card (154:1486) | Server-connected | ✗ | `components/channel/channel-header-card.tsx (new)` | Cabeçalho do canal com banner, avatar, nome, nickname e contadores; depende dos dados atuais do canal carregados do servidor. |
| Card (154:1509) | Presentational | ✓ | `components/ui/card.tsx` | Herdado da fase 02; container do Channel card. |
| banner (154:1487) | Presentational | ✗ | `components/channel/channel-banner.tsx (new)` | Gradiente estático com texto "Channel Banner" (2317:2393); sem affordance de upload no Figma. Banner não está em nenhuma capacidade da fase 04. |
| Avatar (2405:2276) | Presentational | ✗ | `components/ui/avatar.tsx (new)` | Instância `Avatar` 2404:2432, variante 2xl (128px); sem affordance de troca de imagem no Figma. |
| channel info (154:1492) | Presentational | ✗ | new | Nome "TechMaster Studio" (154:1494, H1) e nickname "@techmaster2024" (154:1495, Body/MD muted) — texto puro recebido via props. |
| subscribers meta (154:1497) | Presentational | ✗ | new | Ícone groups (2450:2302 → `components/icons/groups-icon.tsx (new)`) + "1.2M subscribers" (154:1501). Contador de inscritos é fase 06. |
| videos meta (154:1502) | Presentational | ✗ | new | Ícone videocam (107:928 → `components/icons/videocam-icon.tsx (new)`) + "342 videos" (154:1506). |
| Canal (154:1512) | Server-connected | ✗ | `components/channel/channel-settings-form.tsx (new)` | Formulário de edição do canal: validação local + submissão ao servidor (sempre Server-connected). Contém seção 154:1682 e rodapé "channel form" (154:1683). |
| Card (154:1513) | Presentational | ✓ | `components/ui/card.tsx` | Herdado da fase 02; container do formulário. |
| Section heading "Basic Information" (154:1535) | Presentational | ✗ | new | `<h2>` (Inter/Heading/H2). |
| Fields row (2747:2090) | Presentational | ✗ | new | Layout em duas colunas (grid) dos campos handle e display name. |
| Channel handle field (2747:2088) | Local-interactive | ✗ | new | Wrapper label + input + helper. Valor "@techmaster2024". |
| FormLabel "Channel handle" (2175:253) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02. |
| TextField handle (154:1537) | Local-interactive | ✓ | `components/ui/input.tsx` | Herdado da fase 02 (Input). Supporting text "Your unique identifier on StreamTube" (I154:1537;82:6315) é `<p>` helper → new. |
| Display name field (2747:2089) | Local-interactive | ✗ | new | Wrapper label + input + helper. |
| FormLabel "Display name" (2175:263) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02. |
| TextField display name (154:1570) | Local-interactive | ✓ | `components/ui/input.tsx` | Herdado da fase 02 (Input). Supporting text "The name that appears on your channel" (I154:1570;82:6315) → `<p>` helper, new. |
| Section heading "Description" (154:1590) | Presentational | ✗ | new | `<h2>` que serve de rótulo visual do Textarea (ver Observations). |
| Textarea (154:1580) | Local-interactive | ✗ | `components/ui/textarea.tsx (new)` | Instância `Textarea` 2120:224 (multi-linha, altura 120px, auto-grow). Primitivo shadcn-style a adicionar. |
| Status "Last updated" (2749:2088) | Presentational | ✗ | new | Ícone alarm (156:2106 → `components/icons/alarm-icon.tsx (new)`) + "Last updated: January 15, 2024" (154:1688); valor vem dos dados do canal via props. |
| Button "Cancel" (154:1713) | Local-interactive | ✓ | `components/ui/button.tsx` | Herdado da fase 02 (variante outline/sm). Descarta as alterações não salvas e volta ao painel de vídeos (mesmo comportamento do "Cancel" da edição de vídeo); sem I/O. |
| Button "Save Changes" (154:1696) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado da fase 02 (variante default/sm, `type="submit"`); dispara a submissão do formulário Canal. |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Exibir as informações atuais do canal (nome, nickname) no cabeçalho | Channel card (154:1486) | "Edição das informações do canal: nickname, nome e descrição" |
| Exibir contador de vídeos do canal | Channel card (154:1486) › videos meta (154:1502) | "Página pública do canal com informações e listagem de vídeos" |
| Carregar os valores atuais do canal (nickname, nome, descrição e data da última atualização) no formulário | Canal (154:1512) | "Edição das informações do canal: nickname, nome e descrição" |
| Salvar alterações das informações do canal (nickname, nome e descrição) | Button "Save Changes" (154:1696) em Canal (154:1512) | "Edição das informações do canal: nickname, nome e descrição" |

### Observations

- **Componentes compartilhados (fase 07):** `TopNav` (154:1369) e `SideNav` (154:1368) são instâncias dos componentes de navegação globais; sua implementação completa (busca, busca por voz, botão Create, menu do usuário, menu lateral com inscrições) pertence à fase 07. Nesta fase o `AppHeader` existente (`components/layout/app-header.tsx`) é reutilizado sem alterações e a lista de inscrições do SideNav renderiza placeholder (dados da fase 06).
- **Contador de inscritos (154:1497):** "1.2M subscribers" é dado da fase 06 (inscrições); sem verbo nesta fase — renderizar oculto ou placeholder até a fase 06. O contador de vídeos (154:1502) reaproveita o total de vídeos públicos exibido na página pública do canal.
- **Code Connect:** `get_design_context` não emitiu nenhum caminho de Code Connect para esta tela; todos os caminhos acima vêm da lista herdada da fase 02 ou da convenção do repositório (`components/channel/*`, `components/ui/*`, `components/icons/*`).
- **Screenshot vs. árvore:** nenhum elemento visível no screenshot está ausente do retorno de `get_design_context`; a cobertura é completa.
- **Estados visíveis:** o Figma mostra apenas o estado default do formulário. Não há variantes de erro de validação (ex.: nickname já em uso → 409 `NICKNAME_TAKEN` de TD-08, nome vazio, limite de caracteres da descrição), estado de carregamento/pending no botão "Save Changes", feedback de sucesso após salvar, nem estado "dirty" (que justificaria habilitar/desabilitar "Cancel"/"Save Changes"). Esses estados precisarão ser definidos no plan-build reaproveitando `components/auth/field-error.tsx` para erros de campo.
- **Possível erro de conteúdo no Figma:** o TextField "Display name" (154:1570) exibe "@techmaster2024" (mesmo valor do handle); o valor esperado é o nome do canal ("TechMaster Studio"), como aparece no Channel card. Tratar como placeholder de design, não como regra.
- **Nickname com "@":** o Figma mostra o handle com o prefixo "@" dentro do input (154:1537). Falta decidir se o "@" é um prefixo visual fixo ou parte do valor editável — afeta validação e normalização do nickname (TD-08 fixa a allowlist `[a-z0-9_]`, logo o "@" deve ser prefixo visual, não parte do valor).
- **Acessibilidade:** o `Textarea` (154:1580) não possui `FormLabel`; apenas o heading "Description" (154:1590) o rotula visualmente — implementar com `aria-labelledby` ou converter o heading em `<Label>`. Os helper texts dos TextFields devem ser ligados via `aria-describedby`. Os ícones decorativos (groups, videocam, alarm) devem ter `aria-hidden`. O contraste do texto "Last updated" (12px, muted) deve ser verificado contra o fundo do card.
- **Avatar e banner (154:1487, 2405:2276):** decisão do usuário (2026-10-18) — placeholder estático nesta fase (banner com gradiente, avatar com iniciais do nome do canal); nenhum campo no domínio nem affordance de upload. Sem verbo; registrado em Open questions para uma fase futura.
- **Data de última atualização:** "Last updated: January 15, 2024" (154:1688) implica que os dados do canal carregados devem incluir a data da última atualização (`updated_at`); formato/idioma de exibição (en-US no Figma) depende da convenção de localização do projeto (texto da UI está em inglês em todo o design).
- **Textarea sem contador/limite:** o Figma não indica limite de caracteres para a descrição nem contador; o limite virá da regra de validação do backend definida no plan-build.

---

## Screen: Página pública do canal (Channel Show)

**Route:** `/channel/{nickname}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (node `0RBoWy5FbrK8SHEz1eK6gb:155:1926`)
**Purpose (from project-plan.md):** "Página pública do canal com informações e listagem de vídeos"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| Channel Show (155:1926) | Presentational | ✗ | new | Frame raiz da página (`app/channel/[nickname]/page.tsx` como RSC); apenas compõe TopNav + Body |
| TopNav (155:1928) | Local-interactive | ✓ | `components/layout/app-header.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Menu trigger / hamburger (I155:1928;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| BrandLogo / Size=sm (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Search field (I155:1928;62:1879) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Voice search button (I155:1928;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| IconButton add (I155:1928;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Account avatar (I155:1928;62:1893) | Local-interactive | ✗ | `components/ui/avatar.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav (155:1927) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav item Home / Subscriptions / Your videos / Liked videos (I155:1927;62:1620, 62:1630, 62:1653, 62:1664) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav subscriptions list (I155:1927;62:1672) | Presentational | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Body (2737:2153) | Presentational | ✗ | `components/layout/app-shell.tsx (new)` | Layout SideNav + Main content |
| Main content (2737:2152) | Presentational | ✗ | new | Coluna principal (`flex-col gap-24 py-24`) |
| channel banner (156:3511) | Server-connected | ✗ | `components/channels/channel-banner.tsx (new)` | Imagem de capa 320px de altura; nenhuma capacidade da fase 04 cita banner (edição cobre só nickname, nome e descrição) |
| Avatar (2405:2283) | Server-connected | ✗ | `components/ui/avatar.tsx (new)` | Variante `2xl` (128px), sobreposto ao banner (`absolute top-280 left-32`); nenhuma capacidade da fase 04 cita avatar do canal |
| channel header row (156:3513) | Presentational | ✗ | `components/channels/channel-header.tsx (new)` | Container do bloco de informações + ações (`pl-184` para dar espaço ao avatar) |
| channel info (156:3515) | Server-connected | ✗ | `components/channels/channel-info.tsx (new)` | Nome (156:3517, H1 24px), meta row (156:3518) e descrição (156:3525) do canal — dados do servidor |
| Channel name (156:3517) | Presentational | ✗ | new | `<h1>` com nome do canal |
| Nickname (156:3519) | Presentational | ✗ | new | `@TechMasteryPlus` — é o parâmetro da rota |
| Subscribers count (156:3521) | Presentational | ✗ | new | "2.4M subscribers" — dado da fase 06 |
| Videos count (156:3523) | Presentational | ✗ | new | "1.2K videos" — total de vídeos públicos do canal |
| Channel description (156:3525) | Presentational | ✗ | new | `<p>` 14px muted |
| Button Subscribe (156:3536) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado da fase 02 (variante primária, pill); mutação de inscrição pertence à fase 06 |
| IconButton notifications (158:2691) | Server-connected | ✓ | `components/ui/icon-button.tsx` | Sino de notificações do canal (preferência de notificação, fase 06) |
| Tabs (158:2613) | Local-interactive | ✗ | `components/ui/tabs.tsx (new)` | Tab 1 "Video" (ativa, indicador 3px) e Tab 2 "About"; alterna painéis já carregados. Conteúdo da aba About não existe no frame |
| Divider (I158:2613;158:2581) | Presentational | ✗ | `components/ui/separator.tsx (new)` | Linha 1px abaixo das tabs |
| Filter chips (2737:2145) | Server-connected | ✗ | `components/channels/channel-video-sort.tsx (new)` | Grupo de 3 FilterChip (158:2651: variantes active/normal); "Latest" ativo por padrão; reordenar exige nova consulta porque a listagem é paginada no servidor (TD-06, cursor keyset). "Popular" pressupõe contagem de visualizações (TD-05) |
| FilterChip (158:2671 / 158:2674 / 158:2677) | Local-interactive | ✗ | `components/ui/filter-chip.tsx (new)` | Chip toggle (~80×36); o chip em si só reporta seleção ao pai |
| Video grid (156:3590) | Server-connected | ✗ | `components/channels/channel-video-grid.tsx (new)` | Grid `flex-wrap` gap 40/24, px-24; 5 VideoCard; sem estado vazio, loading ou paginação no frame |
| VideoCard (156:3591, 156:3592, 156:3593, 156:3594, 156:3595) | Server-connected | ✗ | `components/videos/video-card.tsx (new)` | Componente DS `VideoCard` (143:2505), variante sem avatar; thumbnail 16:9 radius-16 (I156:3591;156:3805), título 2 linhas com ellipsis (156:3813), nome do canal (156:3816) + ícone verificado (156:3817), views (156:3822), tempo de publicação (156:3823). Card inteiro é link para a watch page (fase 05) |
| VideoCard verified badge (I156:3591;156:3819) | Presentational | ✗ | new | Ícone check 14px ao lado do nome do canal; "verificação de canal" não existe no domínio — não renderizar |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Exibir informações públicas do canal (nome, nickname e descrição) a partir do nickname da rota | channel info (156:3515) | "Página pública do canal com informações e listagem de vídeos" |
| Exibir total de vídeos públicos do canal | Videos count (156:3523) em channel info | "Página pública do canal com informações e listagem de vídeos" |
| Exibir listagem de vídeos públicos do canal | Video grid (156:3590) + VideoCard (156:3591–3595) | "Página pública do canal com informações e listagem de vídeos" |
| Exibir thumbnail, título, visualizações e tempo de publicação de cada vídeo | VideoCard (156:3591) | "Página pública do canal com informações e listagem de vídeos" |
| Reordenar a listagem de vídeos do canal (mais recentes / populares / mais antigos) | Filter chips (2737:2145) | "Página pública do canal com informações e listagem de vídeos" |

### Observations

- **Sem variante "dono logado":** confirmado pelo usuário — este frame não tem variante com botão "Manage channel"/"Edit channel". A navegação do dono para a edição do canal (capacidade "Edição das informações do canal: nickname, nome e descrição") precisa vir de outra tela (painel de gerenciamento / SideNav "Your videos") ou de uma variante ainda não desenhada.
- **Componentes de fase 07 (TopNav 155:1928, Search field, SideNav 155:1927) e fase 06 (Subscribe 156:3536, sino 158:2691, "2.4M subscribers" 156:3521, lista de inscrições da SideNav):** inventariados e classificados, mas sem capacidade na fase 04. Para a fase 04 devem entrar como stubs/placeholders (ou ocultos), reaproveitando `components/layout/app-header.tsx` como header mínimo.
- **Clique no VideoCard navega para a watch page (fase 05):** a rota de destino ainda não existe; na fase 04 o card deve ser um `<Link>` para uma rota stub ou ficar sem navegação até a fase 05.
- **Dados placeholder inconsistentes no VideoCard:** todos os cards mostram canal "Flux Academy" + check de verificado, enquanto o canal da página é "Tech Mastery Plus". Na página do canal a linha de nome do canal é redundante — sugere-se usar a variante compacta/no-avatar do `VideoCard` (143:2505) sem a linha de canal, ou fixar o nome do próprio canal. O ícone de "verificado" não tem capacidade em nenhuma fase (ver marcador na tabela).
- **Visualizações no card ("212K views") e chip "Popular":** dependem de contagem de visualizações; a capacidade do painel da fase 04 lista "visualizações", mas a contabilização de views só faz sentido a partir da watch page (fase 05). Até lá o valor tende a ser 0 — confirmar se o card deve esconder a métrica quando zero.
- **Estados ausentes no Figma:** não há estado vazio (canal sem vídeos públicos), loading/skeleton, paginação ou "carregar mais" para a grade (156:3590), estado de erro/404 (nickname inexistente), conteúdo da aba "About" (158:2613 Tab 2) nem variante colapsada da SideNav. Esses estados precisam ser decididos no plano (mínimo: empty state e 404).
- **Banner (156:3511) e Avatar (2405:2283) do canal:** decisão do usuário (2026-10-18) — placeholder estático nesta fase (gradiente + iniciais do nome do canal); nenhuma capacidade da fase 04 prevê upload/armazenamento dessas imagens. Sem verbo; registrado em Open questions para uma fase futura.
- **Truncamento da resposta do `get_design_context`:** a saída foi cortada pelo limite de tokens logo após a seção "Component descriptions"; nenhum mapeamento Code Connect com caminho de arquivo apareceu na parte recebida (o `BrandLogo` veio inlinado, sem import), portanto todos os caminhos "(new)" acima são propostos pela convenção do repositório, não pelo Code Connect. Nenhum componente visível no screenshot está ausente do código recebido (banner, avatar, info, Subscribe, sino, tabs, chips e os 5 cards estão todos no tree).
- **Acessibilidade:** Tabs (158:2613) precisam de `role="tablist"`/`role="tab"`/`aria-selected` e navegação por setas; os FilterChips (158:2671/2674/2677) devem expor `aria-pressed` ou funcionar como radiogroup; thumbnails devem ter `alt` com o título do vídeo (ou `alt=""` se o título já for o texto do link); banner é decorativo (`alt=""`); avatar deve ter `alt` com o nome do canal; títulos truncados em 2 linhas (`text-ellipsis`) devem manter o título completo acessível (`title`/`aria-label`); o sino (158:2691) e o botão de voz (I155:1928;62:1883) são icon-only e precisam de `aria-label`; o botão Subscribe para visitante anônimo deve redirecionar ao login (fase 06).
- **Verbos fora do escopo da Fase 04 (removidos da tabela de verbos):** exibir contagem de inscritos (156:3521), inscrever-se (156:3536) e alternar notificações do canal (158:2691) são Fase 06; buscar vídeos por termo (I155:1928;62:1879), exibir avatar/estado de sessão no header (155:1928) e lista de canais inscritos no menu lateral (I155:1927;62:1672) são Fase 07. Nesta fase esses componentes entram como shell/placeholder sem verbo.
- **Filter chips (2737:2145):** classificados Server-connected por TD-06 (listagem paginada por cursor no servidor; mudar a ordem = nova consulta).

---

## Screen: Upload em processamento (Upload video processing)

**Route:** `/studio/upload/{publicId}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=156-2110 (node `0RBoWy5FbrK8SHEz1eK6gb:156:2110`)
**Purpose (from project-plan.md):** "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" — a UI de upload foi adiada da Fase 03 para a Fase 04 ("a UI de upload entra na Fase 04 com o painel do canal"); este frame é a etapa de progresso/processamento após a escolha do arquivo.

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| TopNav (156:2112) | Local-interactive | ✓ | `components/layout/app-header.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Menu trigger / hamburger (I156:2112;62:1860) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| BrandLogo (3050:135) | Presentational | ✓ | `components/auth/brand-logo.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Search field (I156:2112;62:1879) | Local-interactive | ✗ | `components/layout/global-search.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Voice search (I156:2112;62:1883) | Presentational | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| IconButton add (I156:2112;70:31) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Avatar (I156:2112;62:1893) | Local-interactive | ✗ | `components/ui/avatar.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav (156:2111) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav item (I156:2111;62:1620, 62:1630, 62:1653, 62:1664) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| SideNav subscriptions list (I156:2111;62:1672) | Presentational | ✗ | `components/layout/side-nav-subscriptions.tsx (new)` | see screen: Painel de gerenciamento de vídeos (My videos list) |
| Page title "Channel Settings" (156:2114) | Presentational | ✗ | new | `<h1>`; texto diverge do contexto de upload (ver Observações) |
| Channel card (156:2136) | Server-connected | ✗ | `components/upload/upload-video-form.tsx (new)` | Formulário completo (título, descrição, thumbnail, categoria, visibilidade) + status do upload; validação local + submissão ao servidor → Server-connected |
| Card (156:2137) | Presentational | ✓ | `components/ui/card.tsx` | Herdado da fase 02; container visual do formulário |
| upload info row (2772:2085) | Server-connected | ✗ | `components/upload/upload-status-row.tsx (new)` | Nome do arquivo + "Uploading... 84%" + rótulo de status à direita; alimentado pelo upload em voo e pelo processing_status |
| video_file icon (157:1933) | Presentational | ✗ | `components/icons/video-file-icon.tsx (new)` | Ícone Material "video_file" |
| Status label "Uploading" (157:1938) | Server-connected | ✗ | `components/upload/upload-status-badge.tsx (new)` | Reflete processing_status (uploading → processing → ready / failed); no design é texto azul (cor `--link`), sem variante para os demais estados |
| ProgressLinear (157:1939) | Server-connected | ✗ | `components/ui/progress.tsx (new)` | Track + Indicator (Material determinate); valor vem do progresso do envio multipart e depois do processamento |
| Details heading (156:3150) | Presentational | ✗ | new | `<h2>` "Details" |
| FormLabel "Title" (2175:273) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02 |
| TextField "Title" (156:3151) | Local-interactive | ✓ | `components/ui/input.tsx` | Herdado da fase 02 (Input); valor submetido pelo formulário |
| FormLabel "Description" (2175:285) | Presentational | ✓ | `components/ui/label.tsx` | Herdado da fase 02 |
| Textarea "Description" (156:3152) | Local-interactive | ✗ | `components/ui/textarea.tsx (new)` | Primitivo shadcn; altura 192px no design |
| CardVideoConfig (156:3170) | Server-connected | ✗ | `components/upload/video-config-card.tsx (new)` | Painel direito: preview, link do vídeo, nome do arquivo, qualidade — dados extraídos pelo worker (probe) após o processamento |
| Video preview (I156:3170;156:3089) | Server-connected | ✗ | `components/upload/video-preview.tsx (new)` | Placeholder preto com play e "0:00"; só reproduz com URL de playback quando status = ready |
| Video link + copy icon (I156:3170;156:3107, I156:3170;156:3108) | Local-interactive | ✗ | `components/upload/copy-link-button.tsx (new)` | Link público `streamtube.com/v/{publicId}` com ação copiar (clipboard); o texto vem do publicId do vídeo |
| SectionHeader (2390:2258, 2390:2261, 2390:2264) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Título + descrição para Thumbnail, Category e Visibility |
| ThumbUpload (156:2612) | Server-connected | ✗ | `components/upload/thumb-upload.tsx (new)` | Thumbnail atual (gerada pelo worker ou customizada); descrição Figma: placeholder mostrado "antes do processamento terminar" |
| Duration badge (156:2610) | Server-connected | ✗ | `components/upload/duration-badge.tsx (new)` | "15:41" dentro de ThumbUpload; duração vem do probe do worker; posicionado fora do recorte no Figma (ver Observações) |
| Button "Change Thumbnail" (156:2616) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado (Button, variante outline + ícone upload); dispara envio de thumbnail customizada |
| Category select (2096:2223) | Server-connected | ✗ | `components/ui/select.tsx (new)` | Trigger com chevron; opções vêm das categorias da plataforma |
| PrivacyOption "Public" (156:2728) | Local-interactive | ✗ | `components/upload/privacy-option.tsx (new)` | Radio estilizado (selecionado); valor submetido pelo formulário |
| PrivacyOption "Unlisted" (156:2717) | Local-interactive | ✗ | `components/upload/privacy-option.tsx (new)` | Mesmo componente, estado não selecionado |
| upload form footer (156:2769) | Presentational | ✗ | new | Rodapé com Status à esquerda e Actions à direita |
| Status "Checks complete. No issues found." (2769:2088) | Server-connected | ✗ | `components/upload/processing-checks-status.tsx (new)` | Ícone check_circle (156:2786) + texto; reflete o resultado das verificações do worker (formato/probe/thumbnail) |
| Button "Cancel" (156:2772) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado (Button outline). Decisão do usuário (2026-10-18): com confirmação, aborta a sessão multipart em andamento (abort do upload da Fase 03, que remove o rascunho) e volta ao painel; se o envio já terminou, apenas descarta a edição |
| Button "Save Changes" (156:2771) | Server-connected | ✓ | `components/ui/button.tsx` | Herdado (Button default/primário); submete o formulário |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Acompanhar progresso do envio e do processamento do vídeo | ProgressLinear + upload info row | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Exibir status do processamento do vídeo (uploading → processing → ready / failed) | Status label "Uploading" | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Exibir resultado das verificações do arquivo enviado (formato, probe, thumbnail) | Status "Checks complete. No issues found." | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Exibir metadados extraídos do vídeo (nome do arquivo, qualidade, duração) e pré-visualização | CardVideoConfig (Video preview, Duration badge) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Exibir a thumbnail atual do vídeo (gerada no processamento ou customizada) | ThumbUpload | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |
| Substituir a thumbnail por uma imagem customizada | Button "Change Thumbnail" | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Preencher título e descrição enquanto o vídeo processa e salvar as alterações | Channel card (TextField Title, Textarea Description) via Button "Save Changes" | "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" |
| Listar as categorias disponíveis e selecionar a categoria do vídeo | Category select | "Categorias de vídeo disponíveis na plataforma" |
| Definir a visibilidade do vídeo como público ou unlisted | PrivacyOption (Public / Unlisted) via Channel card | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" |
| Exibir o link público do vídeo para compartilhamento | CardVideoConfig (Video link) | "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" |
| Salvar o rascunho enquanto processa e publicá-lo ao salvar quando estiver pronto | Button "Save Changes" (156:2771) | "Fluxo de rascunho → publicação" |
| Cancelar o upload em andamento (abortar o envio e descartar o rascunho) | Button "Cancel" (156:2772) | "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" |

### Observations

- **Rota:** `/studio/upload/{publicId}` é proposta; a definição final das rotas de studio fica para o plan-build.
- **Code Connect não verificado:** a resposta de `get_design_context` foi truncada logo após as descrições de componentes, antes do mapa Code Connect. Todos os caminhos `Reuse?` foram resolvidos pela lista do filesystem (herdados) ou propostos pela convenção do repo (`components/upload/*`, `components/ui/*`), nunca pelo Code Connect. `TopNav` → `components/layout/app-header.tsx` é um casamento por nome/função com arquivo existente, não um mapeamento confirmado.
- **Componentes compartilhados (fase 07):** `TopNav` (156:2112) e `SideNav` (156:2111), incluindo busca, busca por voz, botão "+", avatar e lista de inscrições, são componentes compartilhados cujo escopo é a fase 07 (home/busca/navegação); a lista de inscrições depende ainda da fase 06 (social). Nesta fase entram como shell estático.
- **Estados cobertos pelo design:** o frame mostra apenas o estado **`uploading`** (barra a 84%, rótulo "Uploading" em azul, "Uploading... 84%"). Não há variante para **`processing`**, **`ready`** nem **`failed`**, e nenhum dos códigos de erro (`UNSUPPORTED_FORMAT`, `PROBE_FAILED`, `THUMBNAIL_FAILED`, `OBJECT_MISSING`) tem representação visual. Cancelamento existe só como botão "Cancel" (sem diálogo de confirmação nem estado "cancelado").
- **Inconsistência interna do design:** o rodapé exibe "Checks complete. No issues found." enquanto o upload ainda está a 84% — as verificações só podem concluir após o processamento pelo worker. O componente precisa de estados próprios (pendente / ok / falha com código de erro), a definir fora do Figma.
- **Título da página:** o `<h1>` diz "Channel Settings", mas a tela é a etapa de upload/processamento de um vídeo; conflita também com a tela de edição de canal ("Edição das informações do canal"). Nome pendente de decisão (ex.: "Upload video" / "Video details").
- **Publicação:** não há botão "Publish" nem indicação de rascunho no frame. Decisão do usuário (2026-10-18): "Save Changes" salva o rascunho enquanto `uploading`/`processing` e publica implicitamente quando `processing_status = ready` (mesma regra da tela de edição); a API mantém as ações dedicadas de TD-03, compostas pelo BFF.
- **Screenshot vs. get_design_context:** todos os elementos visíveis no screenshot existem na árvore retornada; não há componentes só no screenshot. O inverso ocorre: o **Duration badge "15:41" (156:2610)** está na árvore de `ThumbUpload`, mas posicionado em `left 368px / top 207px`, fora do recorte 266×151, e por isso não aparece no screenshot. No design deve ser tratado como overlay no canto inferior direito da thumbnail.
- **Dados do CardVideoConfig:** link (`streamtube.com/v/tech2024`), nome do arquivo, "Video Quality 1080p HD" e "0:00" dependem do `publicId` e dos metadados extraídos pelo worker (fase 03); antes de `ready` o painel precisa de placeholders. O preview só reproduz quando houver URL de playback.
- **Texto do Textarea:** a descrição de exemplo está cortada ("...reviews of the latest"), sugerindo conteúdo de preenchimento; limite de caracteres e contador não estão no design.
- **Acessibilidade:** `ProgressLinear` deve expor `role="progressbar"` com `aria-valuenow/min/max` e o texto "Uploading... 84%" como `aria-live="polite"`; o rótulo de status é diferenciado apenas por cor (azul) — precisa de texto/ícone por estado; `PrivacyOption` deve ser um `fieldset`/`legend` com `<input type="radio">` reais (no Figma é um radio desenhado com divs); o ícone de copiar link precisa de nome acessível e feedback de "copiado"; `check_circle` do status deve ter `aria-hidden` com o texto adjacente como rótulo; "Change Thumbnail" deve vincular um `<input type="file">` acessível.

---

## Reconciliation summary

| Capability (project-plan.md) | Covered by | Screens |
|---|---|---|
| "Categorias de vídeo disponíveis na plataforma" | Category select (2096:2238; 2096:2223) | `/studio/videos/{publicId}/edit`, `/studio/upload/{publicId}` |
| "Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada" | video-edit-form (156:2796), TextField Title, Textarea Description, Category select, ThumbUpload (156:2612), Button "Change Thumbnail" (156:2812 / 156:2616), Button "Save Changes" (156:2799 / 156:2771), upload-video-form (156:2136) | `/studio/videos/{publicId}/edit`, `/studio/upload/{publicId}` |
| "Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)" | PrivacyOption Public/Unlisted (156:2822/156:2821; 156:2728/156:2717) via Save Changes, CardVideoConfig › Video link (I156:3170;156:3107) | `/studio/videos/{publicId}/edit`, `/studio/upload/{publicId}` |
| "Fluxo de rascunho → publicação" | Button "Save Changes" (156:2799 / 156:2771 — publica rascunho pronto), Status checks (2771:2088), button kebab Publicar/Despublicar (I158:3096;108:331) | `/studio/videos/{publicId}/edit`, `/studio/upload/{publicId}`, `/studio/videos` |
| "Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)" | VideoList (158:3096) + video-list (158:3198), Button "Upload video" (152:2154), Filters (152:2163), Search "Search your videos" (158:4013), Sort actions (2726:2139), button kebab Excluir (I158:3096;108:331); ProgressLinear (157:1939), upload info row (2772:2085), Status label (157:1938), Status checks (2769:2088), CardVideoConfig (156:3170), ThumbUpload (156:2612), Button "Cancel" (156:2772) | `/studio/videos`, `/studio/upload/{publicId}` |
| "Edição de vídeos a partir do painel" | VideoList (158:3096) / button kebab Editar (I158:3096;108:331); Edit/Publish video (156:2790), CardVideoConfig (156:3122), Video preview (I156:3122;156:3089) | `/studio/videos`, `/studio/videos/{publicId}/edit` |
| "Edição das informações do canal: nickname, nome e descrição" | Channel card (154:1486), channel-settings-form Canal (154:1512), TextField handle (154:1537), TextField display name (154:1570), Textarea (154:1580), Button "Save Changes" (154:1696) | `/studio/channel` |
| "Página pública do canal com informações e listagem de vídeos" | channel info (156:3515), Videos count (156:3523 / 154:1502), Video grid (156:3590), VideoCard (156:3591–3595), Filter chips (2737:2145) | `/channel/{nickname}`, `/studio/channel` (contador) |

_Todas as 8 capabilities da Fase 04 têm cobertura. A tela de escolha do arquivo de upload (154:1724) não foi extraída (cota do Figma MCP); sua capability ("Painel… — UI de upload adiada da Fase 03") está coberta pelo botão "Upload video" do painel e pela tela de upload em processamento._

## Open questions

- **Tela "Upload Video" (154:1724) não inventariada:** extração rejeitada pela cota mensal do Figma MCP (plano Starter). O inventário foi validado com 5 telas por decisão do usuário (2026-10-18); a tela de escolha do arquivo (dropzone/seletor, validação de formato MP4/WebM e limite de 10 GB) deve ser derivada da capability e da tela de processamento até um rerun de extensão de `/screen-inventory 4` quando a cota for restabelecida.
- **Publicação implícita no "Save Changes" vs. TD-03:** o usuário decidiu que "Save Changes" (156:2799 / 156:2771) publica o rascunho quando `processing_status = ready`; a API mantém as ações dedicadas `publish`/`unpublish` de TD-03 e o BFF as compõe com o `PATCH`. Conferir coerência com TD-02 (título obrigatório para publicar) e definir o feedback quando o vídeo ainda não está pronto (salvar sem publicar).
- **Ponto de entrada do estúdio e da edição do canal:** a página pública não tem variante "dono logado" e o header atual é mínimo; a navegação para `/studio/videos` e `/studio/channel` precisa de um gatilho nesta fase (menu do usuário / SideNav "Your videos" são Fase 07). Decidir a entrada mínima (ex.: links no header existente para a sessão autenticada).
- **Rotas do estúdio:** `/studio/videos`, `/studio/videos/{publicId}/edit`, `/studio/channel` e `/studio/upload/{publicId}` são propostas deste inventário; confirmar no plan-build. A página pública segue TD-08 (`/channel/{nickname}`).
- **Link público do vídeo (`streamtube.com/v/{publicId}`):** o path da watch page (`/v/` vs. `/watch/`) só se decide na Fase 05; o CardVideoConfig exibe/copia esse link já nesta fase.
- **Avatar e banner do canal:** placeholder estático nesta fase (decisão do usuário); campos persistidos e upload ficam para uma fase futura, sem bullet no plano.
- **Estados não desenhados no Figma:** status do painel além de "Public" (`draft`, `unlisted`, `processing`, `failed`), estados `processing`/`ready`/`failed` da tela de upload, erros de validação dos formulários (inclusive 409 `NICKNAME_TAKEN`), estados vazio/carregando/404 da página pública e do painel, conteúdo dos menus "Filter"/"Date"/"Sort by" e do kebab, diálogo de confirmação de exclusão/cancelamento, conteúdo da aba "About" do canal. O plan-build deve defini-los a partir dos primitivos shadcn.
- **Filtros, ordenação e busca do painel:** os parâmetros (visibilidade, data, texto, ordenação) não constam de TD-06 (que fixa só `limit`/`cursor`/`total`); definir no contrato da listagem do dono.
- **Títulos divergentes no Figma:** as telas de edição de vídeo (156:2794) e de upload (156:2114) exibem "Channel Settings"; a tela de Channel Settings mostra o handle no campo "Display name". Tratar como erros de conteúdo do design.
