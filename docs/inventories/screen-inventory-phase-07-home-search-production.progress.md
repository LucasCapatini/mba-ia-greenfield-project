# phase-07-home-search-production — Screen Inventory Progress

**Status:** completed
**Screens:** 2/2 completed

## Reconciled screen list

| # | Screen name                                         | URL (fileKey:nodeId)            | Status  |
|---|-----------------------------------------------------|---------------------------------|---------|
| 1 | Página inicial (Home / Catalog Show) — `/`          | 0RBoWy5FbrK8SHEz1eK6gb:143:948  | completed |
| 2 | Resultados da busca — `/results?q=`                 | 0RBoWy5FbrK8SHEz1eK6gb:143:948  | completed |

Figma URLs:
- Tela 1: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (PNG `docs/inventories/assets/phase-07/Home (Catalog Show).png`; menu da conta em `Account User Menu.png`, frame 150:1267; menu lateral em `Left Menu.png`, frame 150:959)
- Tela 2: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (sem frame próprio — base visual: grid da Home sem os chips)

## Screens removed as out-of-scope

- ~~Header/navbar (TopNav 152:1827)~~ — componente compartilhado, não é tela; inventariado dentro da tela 1 e referenciado na tela 2.
- ~~Account User Menu (150:1267)~~ — overlay do header (painel lateral direito), não é rota; inventariado dentro da tela 1.
- ~~Left Menu (150:959) — estados mini e drawer~~ — componente compartilhado; sem frames próprios; inventariado dentro da tela 1.
- ~~"Layout responsivo para dispositivos móveis"~~ — capability transversal (sem tela própria); coberta pelos componentes de shell da tela 1.
- ~~"Testes dos fluxos principais da plataforma", "Ambiente de produção e deploy"~~ — capabilities sem UI (`home-search-production/TD-06..TD-11`).

## Decisions log

- ✓ Extração: a partir dos PNGs exportados em `docs/inventories/assets/` (copiados para `assets/phase-07/`), sem `get_design_context` — o MCP do Figma respondeu a `get_metadata` (lista de páginas) e em seguida devolveu o limite de chamadas do plano Starter; node ids de componentes herdados dos inventários das Fases 04/06 quando conhecidos, senão `—`; drift de tokens não verificado (2026-10-20).
- ✓ [DECISION: página de resultados de busca (`/results?q=`, `home-search-production/TD-02`) não tem frame — qual referência visual?] — resolved: grid da Home (143:948) sem os chips, título com o termo e o termo preenchido no campo do header; estado vazio próprio (user, 2026-10-20).
- ✓ [DECISION: estados mini (lg+) e drawer (< lg e watch page) do menu lateral (`home-search-production/TD-05`) têm frames?] — resolved: não; derivar do Left Menu 150:959 e da Home — mini com ícones + rótulo curto (Home, Subscriptions, You), drawer = o mesmo Left Menu num Dialog lateral esquerdo (user, 2026-10-20).
- ✓ [DECISION: menu da conta — painel lateral do Figma (150:1267) ou dropdown no avatar?] — resolved: seguir o Figma — painel lateral direito aberto pelo avatar com nome + @nickname do canal, "Edit Channel" → `/studio/channel` e "Sign Out" (user, 2026-10-20).
- ✓ [DECISION: botões "+" (criar) e microfone do header, sem capability própria] — resolved: "+" vira atalho para `/studio/upload`, só com sessão; microfone não renderizado (user, 2026-10-20).
