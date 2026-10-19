---
kind: task
name: task-saneamento-fase-04
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-saneamento-fase-04/context.md: "2026-10-19T20:33:45Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T20:33:01Z"
issues:
  - id: AMB-1
    status: resolved
    summary: "Quais casts dos BFFs de auth saem: só os do upstream ou também o parse do corpo"
    resolved_by: clarification
  - id: AMB-2
    status: resolved
    summary: "Meta do lint do backend: 0 erros (exit 0) ou 0 problemas, incluindo os 54 warnings"
    resolved_by: saneamento-fase-04/TD-01
advisories: []
---

# task-saneamento-fase-04 — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

_None._

### Missing Decisions

_None._

### Inherited Constraint Conflicts

_None._

### Unresolved Open Questions

_None._

### UI Coverage Gaps

_None._

## Resolved Issues

- **AMB-1** _(resolved_by clarification)_ — Quais casts dos BFFs de auth saem. Resolvida por escolha (b): saem os casts para o shape do upstream (`body as never`, `error as ApiErrorEnvelope`) **e** o parse `(await request.json()) as XDto`, que passa a usar `readJson`/`invalidBody` de `lib/api/bff.ts` (JSON inválido → 400 `VALIDATION_ERROR`, coberto por testes de integração). Sem TD (alinhamento ao padrão da Fase 04); a clarificação foi incorporada ao `scope_description` do doc de decisões e ao `## Scope` do `context.md`.
- **AMB-2** _(resolved_by saneamento-fase-04/TD-01)_ — Meta do lint do backend. Resolvida por escolha (c): 0 erros e 0 warnings, com `--max-warnings 0` no script `lint`. Registrada como `**Revisions:**` da TD-01 (mesma Option A; parâmetro de meta) e incorporada ao `scope_description` e ao `## Scope`.
