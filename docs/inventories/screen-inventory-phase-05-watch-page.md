# phase-05-watch-page — Screen Inventory

> **Phase:** Fase 05 — Página de Visualização do Vídeo
> **Status:** Validated
> **Date:** 2026-10-19
> **Screens in scope:** 1

_Extração por imagem:_ a Figma MCP (plugin remoto) atingiu o limite do plano Starter e o servidor desktop não está disponível, então esta tela foi inventariada a partir do PNG exportado pelo usuário (`docs/inventories/assets/phase-05/Video show.png`, 2880×2966) e das classificações já feitas na Fase 04 — sem `get_design_context`. Consequências: os node ids dos componentes ficam `—` (apenas o frame `152:2219` é conhecido), e a checagem de drift de tokens Figma ↔ `globals.css` não foi executada.

---

## Screen: Página de visualização do vídeo (Video show)

**Route:** `/watch/{publicId}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (node `0RBoWy5FbrK8SHEz1eK6gb:152:2219`)
**Referência visual:** `docs/inventories/assets/phase-05/Video show.png`
**Purpose (from project-plan.md):** "Layout da página: vídeo principal + informações + sidebar com sugestões"

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| Watch page — RSC da rota (152:2219) | Server-connected | ✗ | new | Raiz da rota: lê o vídeo pelo `publicId` com autenticação opcional (anônimo vê `published`, dono vê qualquer status) e compõe player, informações e sidebar; layout duas colunas (conteúdo ~2/3 + sidebar de sugestões). O frame não mostra SideNav — só o hambúrguer do header |
| TopNav (—) | Local-interactive | ✓ | `components/layout/app-header.tsx` | Header compartilhado (escopo de navegação completo é da Fase 07). Na Fase 05 vale o comportamento atual: autenticado → avatar/menu da conta; anônimo → indicação "sem conta" (link de login) no canto superior direito — frame único, conforme o usuário. Busca, microfone, "+" e hambúrguer não entram nesta fase |
| Avatar da conta no header (—) | Local-interactive | ✓ | `components/ui/avatar.tsx` | Só no estado autenticado; abre o menu da conta (frame "Account User Menu", escopo Fase 07). Promovido de `(new)` na Fase 04 — o arquivo já existe |
| VideoPlayer (—) | Server-connected | ✗ | `components/watch/video-player.tsx (new)` | `<video>` nativo com `stream_url` + controles próprios (`video-channel-management`/TD-12; `watch-page/TD-05` = B). Rebusca `/playback` pelo BFF quando a URL assinada expira e retoma do `currentTime`; dispara o registro de visualização após o limiar (`watch-page/TD-01`). Poster = `thumbnail_url`. Cantos arredondados (radius grande) no frame |
| PlayerControls — barra inferior (—) | Local-interactive | ✗ | `components/watch/player-controls.tsx (new)` | Agrupa play/pause, volume, tempo e tela cheia sobre gradiente escuro na base do vídeo; nenhum I/O |
| Botão play/pause (—) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Alterna `play()`/`pause()`; ícone play (`components/icons/play-icon.tsx`) ↔ pause |
| Ícone pause (—) | Presentational | ✗ | `components/icons/pause-icon.tsx (new)` | — |
| Barra de progresso / seek (—) | Local-interactive | ✗ | `components/ui/slider.tsx (new)` | Primitivo `Slider` do `radix-ui` (já instalado, ainda sem wrapper em `components/ui`); trilho branco com thumb circular; mostra o buffer. O frame desenha segmentos de capítulos — fora do escopo (ver Observations) |
| Botão de volume / mudo (—) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Alterna `muted`; ao lado, slider de volume reutilizando `components/ui/slider.tsx (new)` (no frame o slider não está aberto — ver Observations) |
| Ícone volume (—) | Presentational | ✗ | `components/icons/volume-icon.tsx (new)` | — |
| Ícone volume mudo (—) | Presentational | ✗ | `components/icons/volume-off-icon.tsx (new)` | — |
| Tempo atual / duração "0:20 / 4:56" (—) | Presentational | ✗ | new | Formatado com `formatDuration` de `lib/format.ts`; o sufixo "• Intro" (capítulo) não entra |
| Botão tela cheia (—) | Local-interactive | ✓ | `components/ui/icon-button.tsx` | Fullscreen API no contêiner do player |
| Ícone tela cheia / sair da tela cheia (—) | Presentational | ✗ | `components/icons/fullscreen-icon.tsx (new)` | Par entrar/sair no mesmo arquivo |
| Título do vídeo (—) | Presentational | ✗ | new | `<h1>` em heading bold, até 2 linhas no frame |
| Canal do vídeo — avatar + nome (—) | Server-connected | ✗ | `components/watch/video-channel-link.tsx (new)` | Avatar (`components/channel/channel-avatar.tsx`) + nome do canal com link para `/channel/{nickname}`; o `VideoResponse` atual não traz o canal (ver Open questions). Contagem de inscritos e botão Subscribe são Fase 06 — não renderizados |
| Botão Share (—) | Local-interactive | ✓ | `components/studio/copy-link-button.tsx` | Decisão do usuário: entra na Fase 05 copiando `${origin}/watch/{publicId}` (útil para unlisted). Precisa da variante "pill" com rótulo "Share" do frame e de ser movido/exportado para uso fora do estúdio |
| Ícone share (—) | Presentational | ✗ | `components/icons/share-icon.tsx (new)` | — |
| Menu "⋮" de ações do vídeo (—) | Local-interactive | ✓ | `components/ui/dropdown-menu.tsx` | Gatilho `IconButton` com `components/icons/more-vertical-icon.tsx`; decisão do usuário: o download fica como item deste menu |
| Item "Download" no menu "⋮" (—) | Server-connected | ✗ | `components/watch/download-menu-item.tsx (new)` | Abre `download_url` (URL assinada com `Content-Disposition: attachment`, `phase-03-videos/TD-09`); disponível a quem pode ler o vídeo, inclusive anônimo; o item não aparece no frame (menu fechado) |
| Ícone download (—) | Presentational | ✗ | `components/icons/download-icon.tsx (new)` | — |
| Bloco de descrição (—) | Server-connected | ✗ | `components/watch/video-description.tsx (new)` | Caixa com fundo/borda sutil: linha "10K views • 3 weeks ago" (`formatCompactNumber` + `formatRelativeTime` de `lib/format.ts`) seguida do texto da descrição com quebras de linha preservadas. O frame mostra apenas o estado expandido |
| Alternância "mais / menos" da descrição (—) | Local-interactive | ✗ | `components/watch/video-description.tsx (new)` | Estado local de expansão/recolhimento dentro do bloco de descrição; o estado recolhido e o rótulo do controle não estão desenhados |
| Sidebar de sugestões (—) | Server-connected | ✗ | `components/watch/related-videos.tsx (new)` | Lista vertical de até 12 sugestões (`watch-page/TD-04`: mesma categoria + preenchimento por públicos recentes); unlisted nunca aparece. Os chips de filtro do topo da sidebar ficam fora do escopo (decisão do usuário) |
| Card de sugestão horizontal (—) | Server-connected | ✓ | `components/videos/video-card.tsx` | Mesmo `VideoCard` da Fase 04 (DS 143:2505) numa variante horizontal compacta: thumbnail 16:9 à esquerda com duração ("12:31") via `components/video/video-thumbnail.tsx`, título em 2 linhas, nome do canal, "N views • tempo"; link para `/watch/{publicId}`. O selo de verificado continua sem conceito de domínio (não renderizado) |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Carregar o vídeo pelo `publicId` da URL e renderizar a página para visitante anônimo | Watch page — RSC da rota | "Acesso anônimo à visualização de vídeos" |
| Abrir vídeo unlisted somente pelo link direto, sem listá-lo nas sugestões | Watch page — RSC da rota; Sidebar de sugestões | "Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)" |
| Reproduzir o vídeo a partir da URL de stream com play/pause, volume e busca na barra de progresso | VideoPlayer | "Player de vídeo com controles: play/pause, volume e barra de progresso" |
| Renovar a URL de reprodução expirada e retomar do mesmo ponto | VideoPlayer | "Player de vídeo com controles: play/pause, volume e barra de progresso" |
| Registrar uma visualização após o limiar de reprodução | VideoPlayer | "Contagem de visualizações" |
| Exibir a contagem de visualizações e o tempo de publicação | Bloco de descrição | "Contagem de visualizações" |
| Exibir a descrição do vídeo recolhida ou expandida | Bloco de descrição | "Descrição do vídeo com expansão/recolhimento" |
| Exibir título e canal do vídeo (avatar, nome e link para o canal) abaixo do player | Canal do vídeo — avatar + nome | "Layout da página: vídeo principal + informações + sidebar com sugestões" |
| Exibir sugestões de vídeos da mesma categoria na sidebar | Sidebar de sugestões; Card de sugestão horizontal | "Sugestões de vídeos da mesma categoria na sidebar" |
| Baixar o arquivo do vídeo | Item "Download" no menu "⋮" | "Botão de download do vídeo" |

### Observations

- Extração por imagem (MCP indisponível): node ids dos componentes ausentes; classificações derivadas do PNG + das linhas já inventariadas na Fase 04 (`TopNav`, `VideoCard`, avatar). Drift de tokens não verificado.
- Escopo do player (decisão do usuário): somente os controles da capability — play/pause, volume, barra de progresso, tempo e tela cheia. Os demais controles desenhados no frame **não são renderizados**: próximo vídeo, rótulo/segmentos de capítulo ("• Intro"), toggle de autoplay, legendas (CC), configurações com badge HD, miniplayer e modo teatro. Mantém `watch-page/TD-05` = B (o gatilho de reavaliação para o Video.js 10 não se aplica).
- Fora de fase (decisão do usuário), não renderizados na Fase 05: botão Subscribe e "9.88K subscribers", Like/Dislike com contagem (Fase 06); seção de comentários com ordenação, campo "Add a comment…" e respostas (Fase 06); chips de filtro da sidebar ("All", "From {canal}", categorias); busca, microfone e "+" do header (Fase 07).
- Download (decisão do usuário): fica como item do menu "⋮" ao lado do Share, não como botão visível — o frame não mostra o menu aberto, então o visual do item segue o `dropdown-menu` existente.
- Reuso: o `VideoPlayer` desta fase substitui o preview estático do `CardVideoConfig` (`components/studio/video-preview.tsx`, telas de edição e de upload em processamento da Fase 04), conforme o usuário. No estúdio o dono não gera visualização (`watch-page/TD-01`), então o registro de visualização precisa ser desligável no player.
- Reuso: o `VideoCard` da Fase 04 hoje é vertical (grid do canal); a sidebar pede a variante horizontal com badge de duração — o `VideoThumbnail` já suporta `durationSeconds`, mas o `VideoCardItem` só traz `duration_seconds` e o card atual não o exibe.
- Interação: o volume aparece só como ícone no frame; o slider de volume (hover/foco) não está desenhado — seguir o padrão do Slider do design system.
- Interação: a descrição contém timestamps ("0:00", "15:30"…) e URLs em azul, sugerindo links clicáveis (seek no player e links externos) — não pedido pelas capabilities (ver Open questions).
- Rota: o Figma (`CardVideoConfig` da Fase 04) exibe `streamtube.com/v/{id}`; a rota adotada é `/watch/{publicId}` (`watch-page/TD-06` = A).
- a11y: os controles do player precisam de rótulos acessíveis (play/pause, mute/unmute, enter/exit fullscreen) e teclado no slider de progresso (o Radix Slider cobre setas/Home/End); o estado "tocando/pausado" deve ser anunciado pelo rótulo do botão.

---

## Reconciliation summary

| Capability (project-plan.md) | Covered by | Screens |
|------------------------------|------------|---------|
| "Player de vídeo com controles: play/pause, volume e barra de progresso" | VideoPlayer, PlayerControls (play/pause, volume, barra de progresso, tempo, tela cheia) | `/watch/{publicId}` |
| "Layout da página: vídeo principal + informações + sidebar com sugestões" | Watch page — RSC da rota, título, Canal do vídeo, Sidebar de sugestões | `/watch/{publicId}` |
| "Descrição do vídeo com expansão/recolhimento" | Bloco de descrição + alternância "mais / menos" | `/watch/{publicId}` |
| "Contagem de visualizações" | VideoPlayer (registro após limiar), Bloco de descrição (exibição) | `/watch/{publicId}` |
| "Sugestões de vídeos da mesma categoria na sidebar" | Sidebar de sugestões, Card de sugestão horizontal | `/watch/{publicId}` |
| "Acesso anônimo à visualização de vídeos" | Watch page — RSC da rota, TopNav (estado anônimo) | `/watch/{publicId}` |
| "Botão de download do vídeo" | Menu "⋮" → Item "Download" | `/watch/{publicId}` |
| "Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)" | Watch page — RSC da rota (abre pelo link), Sidebar de sugestões (não lista unlisted), Botão Share (copia o link) | `/watch/{publicId}` |

## Open questions

- O `VideoResponse` (`GET /videos/{publicId}`) não traz o canal (nickname, nome, avatar) que a watch page exibe abaixo do título e usa no link para `/channel/{nickname}`. Como a página obtém esses dados — incluir um objeto `channel` (como o `VideoCardChannel` do `VideoCardItem`) na resposta do vídeo, ou uma segunda chamada? Afeta o contrato OpenAPI.
- Estados sem frame no Figma (confirmado pelo usuário): vídeo inexistente ou rascunho alheio (404 `VIDEO_NOT_FOUND`), dono abrindo o próprio vídeo ainda em processamento ou com falha (`GET /playback` → 409 `VIDEO_NOT_READY`) e falha ao assinar as URLs (503 `STORAGE_UNAVAILABLE`). Qual UI cada estado usa (página `not-found`, placeholder no lugar do player, mensagem de erro)?
- Estado recolhido da descrição não desenhado: quantas linhas ficam visíveis recolhidas, e quais rótulos/controle usar para expandir e recolher ("…more" / "Show less" ou equivalente em português)?
- Timestamps e URLs dentro da descrição (azuis no frame): renderizar como texto puro nesta fase, ou transformar em links (timestamp → seek no player; URL → link externo com `rel="noopener noreferrer"`)?
- Os chips de filtro da sidebar ("All", "From {canal}", categorias) ficaram fora da Fase 05 — reavaliar junto com a home/filtro por categoria da Fase 07?
- Sem acesso à Figma MCP até a renovação do plano, o `/implement` desta tela não terá `get_design_context`: usar `docs/inventories/assets/phase-05/Video show.png` como referência visual e os tokens já existentes em `app/globals.css`, e rodar a checagem de drift de tokens quando o acesso voltar.
