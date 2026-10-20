# phase-06-social-interactions — Screen Inventory Progress

**Status:** completed
**Screens:** 3/3 completed

## Reconciled screen list

| # | Screen name                                                  | URL (fileKey:nodeId)            | Status    |
|---|--------------------------------------------------------------|---------------------------------|-----------|
| 1 | Página de visualização do vídeo — interações (`/watch/{publicId}`) | 0RBoWy5FbrK8SHEz1eK6gb:152:2219 | completed |
| 2 | Página pública do canal — inscrição e menu lateral (`/channel/{nickname}`) | 0RBoWy5FbrK8SHEz1eK6gb:155:1926 | completed |
| 3 | Feed das inscrições (`/feed/subscriptions`)                  | 0RBoWy5FbrK8SHEz1eK6gb:143:948  | completed |

Figma URLs:
- Tela 1: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (PNG `docs/inventories/assets/phase-06/Video show.png`)
- Tela 2: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (PNG `Channel Show.png`; menu lateral também em `Left Menu.png`, frame 150:959)
- Tela 3: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (PNG `Home (Catalog Show).png` como base visual — sem frame próprio)

## Screens removed as out-of-scope

- ~~Left Menu (150:959)~~ — componente compartilhado (menu lateral), não é tela; inventariado dentro das telas 2 e 3.
- ~~Account User Menu (150:1267)~~ — menu da conta no header, Fase 07.
- ~~Home / Catalog Show (143:948) como página inicial~~ — Fase 07; nesta fase o frame serve só de base visual do feed (tela 3).
- ~~Create user account, User Login, Reset password, My videos list, Publish video, Upload video, Upload video processing, Channel Settings~~ — telas das Fases 02/04 sem mudança de verbo nesta fase (o menu lateral passa a aparecer no estúdio — ver Observations da tela 2).

## Decisions log

- ✓ Extração: a partir dos PNGs exportados em `docs/inventories/assets/phase-06/` (mesmo método da Fase 05) — node ids de componentes reaproveitados do inventário da Fase 04 quando conhecidos, senão `—`; drift de tokens não verificado (user, 2026-10-20).
- ✓ [DECISION: o feed de inscrições (`/feed/subscriptions`, `social-interactions/TD-08`) não tem frame próprio — qual referência visual?] — resolved: frame Home (Catalog Show) 143:948, mesmo grid de cards com avatar do canal, sem os chips de categoria (user, 2026-10-20).
- ✓ [DECISION: a watch page já foi inventariada na Fase 05 (mesmo frame 152:2219) — reinventariar ou só deltas?] — resolved: só os componentes da Fase 06 e seus pontos de encaixe; o resto referencia `screen-inventory-phase-05-watch-page.md` (user, 2026-10-20).
- ✓ [DECISION: em quais rotas o menu lateral aparece?] — resolved: em todas as rotas `(app)` com sessão, exceto a watch page (frame sem SideNav); colapso pelo "≡" fica para a Fase 07 (user, 2026-10-20).
- ✓ [DECISION: botão Subscribe quando o espectador é o dono do canal (auto-inscrição → 422 por `social-interactions/TD-03`)] — resolved: ocultar o botão para o dono; a contagem de inscritos continua visível (user, 2026-10-20).
- ✓ [DECISION: paginação dos comentários e do feed (frames não mostram; o Home mostra spinner de scroll infinito)] — resolved: botão "Show more"/"Load more" por cursor keyset; scroll infinito fica para a Fase 07 (user, 2026-10-20).
