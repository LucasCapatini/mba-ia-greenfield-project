---
kind: phase
name: phase-07-home-search-production
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-07-home-search-production/context.md: "2026-10-20T13:27:44-04:00"
  docs/decisions/technical-decisions-home-search-production.md: "2026-10-20T13:27:43-04:00"
issues:
  - id: AMB-1
    status: resolved
    summary: "Ambiente de produção: artefatos + runbook ou provisionamento e deploy real?"
    resolved_by: home-search-production/TD-11
  - id: AMB-2
    status: resolved
    summary: "TD-04: restaurar páginas/rolagem via sessionStorage ao voltar — sim ou não?"
    resolved_by: home-search-production/TD-04
  - id: AMB-3
    status: resolved
    summary: "TD-09: provedor do object storage (AWS S3 ou R2) em aberto na Recommendation"
    resolved_by: home-search-production/TD-09
  - id: ICC-1
    status: resolved
    summary: "TD-05 menu lateral para anônimo × social-interactions/TD-08 (só com sessão)"
    resolved_by: social-interactions/TD-08
  - id: OQ-1
    status: resolved
    summary: "Menu da conta precisa do @nickname; sessão só guarda channelName"
    resolved_by: home-search-production/TD-05
  - id: OQ-2
    status: resolved
    summary: "Slug de categoria desconhecido (404): not-found ou volta para All?"
    resolved_by: home-search-production/TD-01
  - id: OQ-3
    status: resolved
    summary: "q vazio/curto/longo em /results: redirecionar, estado vazio ou bloquear?"
    resolved_by: home-search-production/TD-02
  - id: OQ-4
    status: resolved
    summary: "Escopo do responsivo: todas as telas ou só as públicas (estúdio sem frame)?"
    resolved_by: home-search-production/TD-05
  - id: OQ-5
    status: resolved
    summary: "Idioma dos textos sem frame: inglês (Figma) ou português (header atual)?"
    resolved_by: home-search-production/TD-05
  - id: OQ-6
    status: resolved
    summary: "/implement sem get_design_context: PNGs como referência + drift depois"
    resolved_by: clarification
  - id: UIG-1
    status: resolved
    summary: "'Layout responsivo para dispositivos móveis' sem verbo no inventário"
    resolved_by: non_ui_capability
  - id: UIG-2
    status: resolved
    summary: "'Testes dos fluxos principais da plataforma' sem verbo no inventário"
    resolved_by: non_ui_capability
  - id: UIG-3
    status: resolved
    summary: "'Ambiente de produção e deploy' sem verbo no inventário"
    resolved_by: non_ui_capability
advisories: []
---

# phase-07-home-search-production — Validation

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

- **AMB-1** _(resolved_by home-search-production/TD-11)_ — Ambiente de produção: a fase entrega os artefatos (Dockerfiles, `deploy/compose.yaml`, Caddyfile, workflow de deploy, `.env.example` de produção) e um runbook, validados subindo o compose de produção localmente; provisionamento e deploy real ficam como tarefa operacional do usuário. Revision 2026-10-20 em TD-11.
- **AMB-2** _(resolved_by home-search-production/TD-04)_ — Scroll infinito restaura itens, cursor e rolagem por URL via `sessionStorage` ao voltar da watch page. Revision 2026-10-20 em TD-04.
- **AMB-3** _(resolved_by home-search-production/TD-09)_ — Object storage de produção: AWS S3, mantendo a política por prefixo de `video-channel-management/TD-10`. Revision 2026-10-20 em TD-09.
- **ICC-1** _(resolved_by social-interactions/TD-08)_ — Menu lateral visível também para o anônimo (Home + convite para entrar; inscrições só com sessão). Revisions 2026-10-20 em `social-interactions/TD-08` e em `home-search-production/TD-05`.
- **OQ-1** _(resolved_by home-search-production/TD-05)_ — @nickname do menu da conta vem de `channelNickname` na sessão, atualizado ao mudar o nickname em `/studio/channel`. Revision 2026-10-20 em TD-05.
- **OQ-2** _(resolved_by home-search-production/TD-01)_ — Slug de categoria desconhecido: a home cai para "All" com aviso discreto. Revision 2026-10-20 em TD-01.
- **OQ-3** _(resolved_by home-search-production/TD-02)_ — `q` inválido: o header não envia vazio e limita a 100; `/results` com `q` vazio redireciona para `/`, com 1 caractere mostra o estado vazio com a regra sem chamar a API. Revision 2026-10-20 em TD-02.
- **OQ-4** _(resolved_by home-search-production/TD-05)_ — Responsivo em todas as telas (públicas, auth e estúdio; estúdio com lista empilhada e coluna única abaixo de `md`). Revision 2026-10-20 em TD-05.
- **OQ-5** _(resolved_by home-search-production/TD-05)_ — Textos sem frame em inglês, como o Figma; o header atual em português é substituído. Revision 2026-10-20 em TD-05.
- **OQ-6** _(resolved_by clarification)_ — Sem cota da Figma MCP, o `/implement` das telas usa os PNGs de `docs/inventories/assets/phase-07/` e os tokens existentes em `app/globals.css`; a checagem de drift de tokens fica pendente até a cota voltar.
- **UIG-1** _(resolved_by non_ui_capability)_ — "Layout responsivo para dispositivos móveis" marked non-ui. Rationale: _[manual — edit context.md to add details]_.
- **UIG-2** _(resolved_by non_ui_capability)_ — "Testes dos fluxos principais da plataforma" marked non-ui. Rationale: backend_service.
- **UIG-3** _(resolved_by non_ui_capability)_ — "Ambiente de produção e deploy" marked non-ui. Rationale: backend_service.
