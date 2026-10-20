# phase-05-watch-page — Screen Inventory Progress

**Status:** completed
**Screens:** 1/1 completed

## Reconciled screen list

| # | Screen name                                        | URL (fileKey:nodeId)            | Status    |
|---|----------------------------------------------------|---------------------------------|-----------|
| 1 | Página de visualização do vídeo (`/watch/{publicId}`) | 0RBoWy5FbrK8SHEz1eK6gb:152:2219 | completed |

Figma URL (screen 1): https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219

## Screens removed as out-of-scope

- ~~Watch page — variante deslogada~~ — user: "a página deslogada seja a mesma apenas com a indicação de não haver conta no canto direito superior" (frame único; diferença registrada no TopNav da tela 1)
- ~~Estados "vídeo não encontrado / rascunho alheio" (404) e "vídeo ainda processando"~~ — user: "Não existem frames" (registrado em `## Open questions`)

## Decisions log

- ✓ [DECISION: "Acesso anônimo à visualização de vídeos" — frame separado para o visitante deslogado?] — resolved: frame único (152:2219); o estado deslogado muda só o canto superior direito do header.
- ✓ [DECISION: estados da watch page — existem frames para 404 / rascunho alheio e "vídeo ainda processando"?] — resolved: não existem frames; vão para `## Open questions`.
- ✓ [DECISION: o "Video preview" do CardVideoConfig (estúdio, Fase 04) passa a usar o player da Fase 05?] — resolved: sim — reuso do `VideoPlayer` em `components/studio/video-preview.tsx`, sem tela nova.
- ✓ Extração bloqueada em 2026-10-19 (Figma MCP remota no limite do plano Starter; servidor desktop indisponível e pago) — resolved: inventário feito a partir dos PNGs exportados pelo usuário em `docs/inventories/assets/phase-05/` (frame "Video show"); node ids dos componentes `—`; drift de tokens não verificado.
- ✓ [DECISION: controles do player — o frame traz próximo, capítulos, autoplay, CC, configurações/HD, miniplayer, teatro e tela cheia] — resolved: só os da capability (play/pause, volume, progresso, tempo) + tela cheia; extras não renderizados; `watch-page/TD-05` = B mantido.
- ✓ [DECISION: download não aparece no frame] — resolved: item "Download" no menu "⋮" ao lado do Share.
- ✓ [DECISION: chips de filtro da sidebar] — resolved: fora do escopo da Fase 05 (Open question para a Fase 07).
- ✓ [DECISION: elementos de outras fases no frame — Subscribe, Like/Dislike, comentários, busca, Share] — resolved: omitidos; Share entra como Local-interactive copiando o link `/watch/{publicId}`.
