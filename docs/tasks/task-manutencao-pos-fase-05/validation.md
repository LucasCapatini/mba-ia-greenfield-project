---
kind: task
name: task-manutencao-pos-fase-05
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-manutencao-pos-fase-05/context.md: "2026-10-20T02:56:48Z"
issues:
  - id: AMB-1
    status: resolved
    summary: "Token --text-overlay: renomear (com qual nome) ou remover não está fechado"
    resolved_by: clarification
  - id: AMB-2
    status: resolved
    summary: "Volume nomeado do db: o que fazer com os dados do armazenamento atual"
    resolved_by: clarification
advisories: []
---

# task-manutencao-pos-fase-05 — Validation

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

- **AMB-1** _(resolved_by clarification)_ — Token `--text-overlay`: renomear para `--text-overlay-md` (classe `text-overlay-md`, 16px/20px/400 inalterados), preservando a contrapartida do estilo de texto "Inter/Overlay" do Figma. O nome novo é registrado no grupo de tamanho de fonte do `extendTailwindMerge` em `lib/utils.ts` e substitui `text-overlay` na lista de estilos de texto de `.claude/rules/next-frontend-ui.md`. O token de cor `--color-overlay` (`bg-overlay`) não muda.
- **AMB-2** _(resolved_by clarification)_ — Volume nomeado do `db`: aceitar que o PostgreSQL suba uma única vez com o banco vazio na troca (dados de desenvolvimento são descartáveis); documentar no `nestjs-project/CLAUDE.md` o passo único `npm run migration:run` após a troca. Nenhuma migração de dados na task.
