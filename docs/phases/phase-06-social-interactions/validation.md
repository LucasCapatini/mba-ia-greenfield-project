---
kind: phase
name: phase-06-social-interactions
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-06-social-interactions/context.md: "2026-10-20T00:26:36-04:00"
  docs/decisions/technical-decisions-social-interactions.md: "2026-10-20T00:25:26-04:00"
issues:
  - id: AMB-1
    status: resolved
    summary: "Como a UI sabe que o espectador é o autor do comentário (menu Edit/Delete)"
    resolved_by: social-interactions/TD-06
  - id: AMB-2
    status: resolved
    summary: "Controles sociais na watch page de vídeo não publicado aberto pelo dono"
    resolved_by: social-interactions/TD-03
  - id: OQ-1
    status: resolved
    summary: "Implementação sem Figma MCP: PNGs de phase-06 como referência visual"
    resolved_by: clarification
  - id: OQ-2
    status: resolved
    summary: "Visual dos estados sem frame (likes ativos, Subscribed, composer, vazios…)"
    resolved_by: clarification
  - id: OQ-3
    status: resolved
    summary: "Lista de inscrições do menu lateral: limite e ordenação"
    resolved_by: social-interactions/TD-08
  - id: OQ-4
    status: resolved
    summary: "Ícones ausentes (thumb-down, home, subscriptions, your videos, preenchidos)"
    resolved_by: clarification
  - id: OQ-5
    status: resolved
    summary: "VideoCard com avatar para o feed e dados do canal no VideoCardItem"
    resolved_by: clarification
advisories: []
---

# phase-06-social-interactions — Validation

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

- **AMB-1** _(resolved_by social-interactions/TD-06)_ — Como a UI sabe que o espectador é o autor do comentário. Revision 2026-10-20 em TD-06: o item de comentário (raiz e resposta) ganha `viewer_is_author: boolean` por espectador (anônimo → `false`), como `viewer_reaction`; a UI mostra o menu "⋮" só quando `true` e a API continua validando a autoria (403).
- **AMB-2** _(resolved_by social-interactions/TD-03)_ — Controles sociais em vídeo não publicado aberto pelo dono. Revision 2026-10-20 em TD-03: listar comentários também exige `published` (rascunho/processamento → 404, inclusive para o dono); a watch page não renderiza o par like/dislike nem a seção de comentários enquanto o vídeo não estiver publicado — canal e contagem de inscritos continuam.
- **OQ-1** _(resolved_by clarification)_ — Implementação sem Figma MCP: o `/implement` usa os PNGs de `docs/inventories/assets/phase-06/` como referência visual e os tokens de `app/globals.css`; a checagem de drift de tokens fica para quando o acesso à MCP voltar (mesmo procedimento da Fase 05).
- **OQ-2** _(resolved_by clarification)_ — Estados sem frame derivados dos primitivos existentes (`Button`, `IconButton`, `DropdownMenu`, `Dialog`) e tokens de `app/globals.css`, no padrão das plataformas de referência: reação ativa = ícone preenchido; "Subscribed" = pill secundária; composer focado mostra "Cancel"/"Comment"; "(edited)" em texto muted; confirmação de exclusão em `Dialog`; "Show more comments/replies" como botão ghost; estados vazios com texto muted (comentários: convite a comentar; menu lateral: sem lista; feed: texto + link para a home). O `/plan-build` fixa cada estado nos UI Contracts.
- **OQ-3** _(resolved_by social-interactions/TD-08)_ — Lista de inscrições do menu lateral. Revision 2026-10-20 em TD-08: `GET /me/subscriptions` ordenado por nome do canal (alfabético, desempate por id) em cursor keyset; o menu mostra 7 e "Show more" carrega/expande o restante.
- **OQ-4** _(resolved_by clarification)_ — Ícones ausentes (thumb-down, home, subscriptions, your videos e as variantes preenchidas de thumb-up/down) são desenhados em `components/icons/` a partir do Material Symbols, como os anteriores; reconciliar com o Figma quando a MCP voltar.
- **OQ-5** _(resolved_by clarification)_ — Feed com card com avatar: o `VideoCard` ganha uma variante com avatar de iniciais (`ChannelAvatar` a partir de `channel.name`, link para `/channel/{nickname}`); o `VideoCardItem` já traz `channel: { nickname, name }`, então não há mudança de contrato.
