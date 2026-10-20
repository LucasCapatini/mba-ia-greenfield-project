---
kind: phase
name: phase-05-watch-page
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-05-watch-page/context.md: "2026-10-19T19:52:47-04:00"
  docs/decisions/technical-decisions-watch-page.md: "2026-10-19T19:51:33-04:00"
issues:
  - id: IC-1
    status: resolved
    summary: "TD-05 reavaliação disparada pelo Figma (controles extras) sem registro no TD"
    resolved_by: watch-page/TD-05
  - id: AMB-1
    status: resolved
    summary: "TD-02: 'janela de 24 h' — balde fixo por dia ou janela deslizante?"
    resolved_by: watch-page/TD-02
  - id: AMB-2
    status: resolved
    summary: "TD-03: TRUST_PROXY 'restrito ao serviço next-frontend' — formato do valor"
    resolved_by: watch-page/TD-03
  - id: AMB-3
    status: resolved
    summary: "TD-03: como o BFF obtém o IP do visitante no Next 16 (sem request.ip)"
    resolved_by: watch-page/TD-03
  - id: MD-1
    status: resolved
    summary: "Capability 'Descrição do vídeo com expansão/recolhimento' sem TD"
    resolved_by: watch-page/TD-09
  - id: MD-2
    status: resolved
    summary: "Capability 'Botão de download do vídeo' sem TD"
    resolved_by: watch-page/TD-08
  - id: ICC-1
    status: resolved
    summary: "TD-04 lista fechada sem cursor vs envelope de listagens (vcm/TD-06)"
    resolved_by: watch-page/TD-04
  - id: OQ-1
    status: resolved
    summary: "VideoResponse sem dados do canal exibidos na watch page"
    resolved_by: clarification
  - id: OQ-2
    status: resolved
    summary: "UI dos estados sem frame: 404, 409 VIDEO_NOT_READY, 503"
    resolved_by: clarification
  - id: OQ-3
    status: resolved
    summary: "Descrição recolhida: linhas visíveis e rótulos do controle"
    resolved_by: clarification
  - id: OQ-4
    status: resolved
    summary: "Timestamps e URLs da descrição: texto puro ou links?"
    resolved_by: clarification
  - id: OQ-5
    status: resolved
    summary: "Chips de filtro da sidebar fora da Fase 05 — reavaliar na Fase 07?"
    resolved_by: clarification
  - id: OQ-6
    status: resolved
    summary: "/implement da watch page sem Figma MCP: referência visual pelo PNG"
    resolved_by: clarification
advisories: []
---

# phase-05-watch-page — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

_None._

### Missing Decisions

_None._

### Dependency Gaps

_None._

### Inherited Constraint Conflicts

_None._

### Unresolved Open Questions

_None._

### UI Coverage Gaps

_None._

## Resolved Issues

_(MD-1/MD-2 resolvidas pelo `/research` incremental de 2026-10-19; demais resolvidas em `/plan-resolve 5`, 2026-10-19 — respostas do usuário via AskUserQuestion; preservadas como trilha de auditoria)_

- **MD-1** _(resolved_by watch-page/TD-09)_ — Capability "Descrição do vídeo com expansão/recolhimento" sem TD. TD-09 acrescentado ao decisions doc em 2026-10-19 (Option A: texto completo + `line-clamp` e alternância local), a partir da resposta do usuário; `/plan-context 5` reagregado.
- **MD-2** _(resolved_by watch-page/TD-08)_ — Capability "Botão de download do vídeo" sem TD. TD-08 acrescentado ao decisions doc em 2026-10-19 (Option A: quem pode assistir pode baixar, inclusive anônimo), a partir da resposta do usuário; `/plan-context 5` reagregado.
- **IC-1** _(resolved_by watch-page/TD-05 — Append revision, Option B mantida)_ — O frame trouxe controles extras; escopo do player fixado em play/pause, volume (mudo + slider), barra de progresso com busca, tempo e tela cheia; extras não renderizados. Revisão registrada em TD-05.
- **AMB-1** _(resolved_by watch-page/TD-02 — Append revision, Option B mantida)_ — Janela de dedup = balde fixo por dia UTC (`window_start` = data UTC, alinhado ao salt diário); job diário do pg-boss apaga linhas com mais de 2 dias. Revisão registrada em TD-02.
- **AMB-2** _(resolved_by watch-page/TD-03 — Append revision, Option A mantida)_ — `TRUST_PROXY` = IP fixo do `next-frontend` (sub-rede fixa na rede `streamtube` + `ipv4_address`); ausente → sem confiança em proxy. Revisão registrada em TD-03.
- **AMB-3** _(resolved_by watch-page/TD-03 — Append revision, Option A mantida)_ — A SI verifica que `next start` preenche `x-forwarded-for`; se faltar, o BFF não encaminha e a API usa o IP do BFF, registrando a view normalmente. Revisão registrada em TD-03.
- **ICC-1** _(resolved_by watch-page/TD-04 — Append revision, Option A mantida)_ — `GET /videos/{publicId}/related` responde `{ items }` (`VideoCardItem[]`) sem `next_cursor`, como lista fechada; exceção explícita ao cursor keyset de `video-channel-management/TD-06`. Revisão registrada em TD-04.
- **OQ-1** _(resolved_by clarification)_ — `VideoResponse` (`GET /videos/{publicId}`) ganha um objeto `channel` com o mesmo shape do `VideoCardChannel` do `VideoCardItem` (dados públicos do canal: nickname, nome e avatar quando houver); uma chamada só na watch page. Mudança de contrato → cadeia OpenAPI completa na mesma SI.
- **OQ-2** _(resolved_by clarification)_ — Estados sem frame: 404 `VIDEO_NOT_FOUND` → `not-found` da rota; 409 `VIDEO_NOT_READY` (dono com vídeo processando/falho) → página normal com placeholder no lugar do player mostrando o status; 503 `STORAGE_UNAVAILABLE` → placeholder de erro com ação "tentar novamente".
- **OQ-3** _(resolved_by clarification)_ — Descrição recolhida mostra 3 linhas; controles "…more" (expandir) e "Show less" (recolher), em inglês como o Figma e as telas do estúdio; o controle só aparece quando o texto excede as 3 linhas (TD-09).
- **OQ-4** _(resolved_by clarification)_ — Timestamps e URLs da descrição ficam como texto puro nesta fase, com quebras de linha preservadas; sem links nem seek.
- **OQ-5** _(resolved_by clarification)_ — Chips de filtro da sidebar adiados para a Fase 07 (reavaliar junto com o filtro por categoria da home); não renderizados na Fase 05.
- **OQ-6** _(resolved_by clarification)_ — O `/implement` da watch page usa `docs/inventories/assets/phase-05/Video show.png` como referência visual e os tokens de `app/globals.css`; a checagem de drift de tokens Figma ↔ `globals.css` roda quando a cota da Figma MCP for restabelecida.
