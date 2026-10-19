# phase-04-video-channel-management — Screen Inventory Progress

**Status:** completed
**Screens:** 5/5 completed

## Reconciled screen list

| # | Screen name                                          | URL (fileKey:nodeId)              | Status  |
|---|------------------------------------------------------|-----------------------------------|---------|
| 1 | Painel de gerenciamento de vídeos (My videos list)   | 0RBoWy5FbrK8SHEz1eK6gb:152:1824   | completed |
| 2 | Edição de vídeo (Edit/Publish video)                 | 0RBoWy5FbrK8SHEz1eK6gb:156:2790   | completed |
| 3 | Edição do canal (Channel Settings)                   | 0RBoWy5FbrK8SHEz1eK6gb:154:1367   | completed |
| 4 | Página pública do canal (Channel Show)               | 0RBoWy5FbrK8SHEz1eK6gb:155:1926   | completed |
| 6 | Upload em processamento (Upload video processing)    | 0RBoWy5FbrK8SHEz1eK6gb:156:2110   | completed |

## Screens removed as out-of-scope

- ~~Upload de vídeo (Upload Video) — 0RBoWy5FbrK8SHEz1eK6gb:154:1724~~ — extração rejeitada pela cota do Figma MCP (Starter) em 2026-10-18; usuário optou por validar o inventário com 5 telas. Reincluir via extension run de `/screen-inventory 4` quando a cota for restabelecida (tela de escolha do arquivo).
- ~~Account User Menu (150:1267)~~ — componente compartilhado (menu do usuário no header), não é tela; navegação é bullet da Fase 07. Registrado como pergunta aberta (ponto de entrada do estúdio).
- ~~Left Menu (150:959)~~ — componente compartilhado (navegação lateral), não é tela; inventariado dentro das telas que o renderizam.
- ~~Video show (152:2219)~~ — página de visualização do vídeo, Fase 05.
- ~~Home / Catalog Show (143:948)~~ — página inicial, Fase 07.
- ~~Create user account (140:333), Reset Password (140:289), User Login (138:179)~~ — Fase 02, já inventariadas em `screen-inventory-phase-02-auth-frontend.md`.

## Decisions log

- ✓ [DECISION: "Edição das informações do vídeo" — página própria ou modal/drawer dentro do painel?] — resolved: página própria (user, 2026-10-18)
- ✓ [DECISION: UI de upload — tela própria, modal/dropzone no painel, ou ambos?] — resolved: tela própria; dois frames distintos (escolha do arquivo 154:1724 e progresso/processamento 156:2110) inventariados como duas telas (user, 2026-10-18)
- ✓ [DECISION: "Edição das informações do canal" — tela própria ou aba de configurações no painel?] — resolved: tela própria (user, 2026-10-18)
- ✓ [DECISION: Página pública do canal tem variante "dono logado" (botão "Gerenciar canal")?] — resolved: não existe variante desenhada (user, 2026-10-18); vira pergunta aberta para o plan-validate
- ℹ File key do Figma mudou em relação à Fase 02 (`Doz7n3FsRhfvelYrPhTZAG` → `0RBoWy5FbrK8SHEz1eK6gb`); node ids das telas de auth coincidem, tratado como o mesmo arquivo. Drift de tokens: sem divergência de valores; tamanhos de fonte usam `--text-N` no Figma e `--font-size-N` no CSS (diferença de nome já existente na Fase 02).
- ✗ Tela 5 "Upload de vídeo" (154:1724): extração bloqueada — `get_design_context`/`get_screenshot` rejeitados com "You've reached the Figma MCP tool call limit on the Starter plan" (2026-10-18). Reexecutar `/screen-inventory 4` quando a cota for restabelecida; o resume retoma só esta tela.
- ✓ [DECISION: Filter chips (2737:2145, Channel Show) Server-connected ou Local-interactive?] — resolved: Server-connected por TD-06 (paginação keyset no servidor; reordenar = nova consulta); verbo mapeado a "Página pública do canal com informações e listagem de vídeos"
- ✓ [DECISION: Voice search (I155:1928;62:1883) e verified badge (I156:3591;156:3819) — caminho ou omitir?] — resolved: omitir (sem capability em nenhuma fase; "verificação de canal" não existe no domínio); `Reuse?: new`
- ✓ [DECISION: Verbos de Fase 06/07 na Channel Show (inscritos, inscrever-se, notificações, busca, avatar de sessão, lista de inscrições)] — resolved: removidos da tabela de verbos e registrados em Observations como shell/placeholder
- ✓ [DECISION: Status "Checks complete" (2771:2088, Edit video) — status de processamento ou verificação pré-publicação?] — resolved: `processing_status` do worker (Fase 03), pré-condição de publicação por TD-02; capability "Fluxo de rascunho → publicação"
- ✓ [DECISION: SideNav subscriptions list (I154:1368;62:1672, Channel Settings) Server-connected ou placeholder?] — resolved: Presentational placeholder nesta fase (dados da Fase 06), igual às demais telas
- ✓ [DECISION: Button "Cancel" (154:1713, Channel Settings) descarta ou navega?] — resolved: descarta alterações não salvas e volta ao painel (mesmo comportamento do Cancel da edição de vídeo)
- ✓ [DECISION: Contador de vídeos (154:1502, Channel Settings) — capability?] — resolved: "Página pública do canal com informações e listagem de vídeos" (mesmo total de vídeos públicos do cabeçalho público); contador de inscritos (154:1497) sem verbo (Fase 06)
- ✓ [DECISION: Kebab por linha do painel (I158:3096;108:331) — menu só com "Editar" (Local-interactive) ou com ações que mutam (publicar/despublicar, visibilidade, excluir — Server-connected)? Conteúdo do menu não desenhado] — resolved: Editar + Publicar/Despublicar + Excluir com confirmação (Server-connected) (user, 2026-10-18)
- ✓ [DECISION: Publicação na edição de vídeo (156:2790) e no upload em processamento (156:2110) — "Save Changes" publica implicitamente ou existe botão Publish/Unpublish dedicado não desenhado? (TD-03 decidiu ações dedicadas na API)] — resolved: "Save Changes" publica implicitamente quando rascunho e ready; despublicar fica no kebab do painel; BFF compõe PATCH + ação dedicada de TD-03 (user, 2026-10-18) — coerência com TD-03 registrada em Open questions
- ✓ [DECISION: Avatar e banner do canal (Channel Settings 154:1486; Channel Show 156:3511/2405:2283) — placeholder estático nesta fase ou campos persistidos (fora dos bullets da Fase 04)?] — resolved: placeholder estático nesta fase, sem campo no domínio (user, 2026-10-18)
- ✓ [DECISION: Button "Cancel" (156:2772, Upload em processamento) — aborta o upload multipart e remove o rascunho (Server-connected) ou só descarta a edição e volta ao painel (Local-interactive)?] — resolved: aborta o upload multipart com confirmação e remove o rascunho (Server-connected) (user, 2026-10-18)
