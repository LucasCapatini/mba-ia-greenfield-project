---
kind: task
name: task-saneamento-fase-02-e-infra
status: clean
issue_count: 0
sources_mtime:
  docs/tasks/task-saneamento-fase-02-e-infra/context.md: "2026-10-17T10:22:25-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-17T10:20:43-04:00"
issues:
  - id: IC-1
    status: resolved
    summary: "Topologia Docker (TD-01) pode contradizer a premissa de independência de next-frontend-openapi-typing/TD-02"
    resolved_by: clarification
  - id: IC-2
    status: resolved
    summary: "TD-04 tem Scope: Frontend mas o UI Inventory está deferido — TD órfã no artefato final"
    resolved_by: saneamento-fase-02-e-infra/TD-04
  - id: IC-3
    status: resolved
    summary: "TD-05 tem Scope: Frontend mas o UI Inventory está deferido — TD órfã no artefato final"
    resolved_by: saneamento-fase-02-e-infra/TD-05
  - id: AMB-1
    status: resolved
    summary: "Entregável de 'criar branch dev e adotar Git Flow' não está definido"
    resolved_by: saneamento-fase-02-e-infra/TD-07
  - id: AMB-2
    status: resolved
    summary: "Botão de logout exige chrome autenticado que não existe; posicionamento indefinido"
    resolved_by: saneamento-fase-02-e-infra/TD-05
  - id: AMB-3
    status: resolved
    summary: "Telas de confirmação de conta e reset de senha sem fonte de design (ausentes no Figma)"
    resolved_by: saneamento-fase-02-e-infra/TD-04
  - id: AMB-4
    status: resolved
    summary: "scope_description omite o item (3) do escopo original: correção de whiteboard.png no README"
    resolved_by: clarification
  - id: MD-1
    status: resolved
    summary: "Topologia Docker (compose de raiz vs rede compartilhada vs separado) sem TD"
    resolved_by: saneamento-fase-02-e-infra/TD-01
  - id: OQ-1
    status: resolved
    summary: "TD-03 pending — idempotência da confirmação de conta frente a prefetch"
    resolved_by: saneamento-fase-02-e-infra/TD-03
  - id: OQ-2
    status: resolved
    summary: "TD-01 pending — topologia Docker Compose entre os subprojetos"
    resolved_by: saneamento-fase-02-e-infra/TD-01
  - id: OQ-3
    status: resolved
    summary: "TD-02 pending — destino dos links de e-mail (confirmação e reset)"
    resolved_by: saneamento-fase-02-e-infra/TD-02
  - id: OQ-4
    status: resolved
    summary: "TD-04 pending — fonte visual e estados das telas de confirmação e reset"
    resolved_by: saneamento-fase-02-e-infra/TD-04
  - id: OQ-5
    status: resolved
    summary: "TD-05 pending — host do botão de logout na interface autenticada"
    resolved_by: saneamento-fase-02-e-infra/TD-05
  - id: OQ-6
    status: resolved
    summary: "TD-06 pending — escopo e ambiente do workflow de CI openapi-freshness"
    resolved_by: saneamento-fase-02-e-infra/TD-06
  - id: OQ-7
    status: resolved
    summary: "TD-07 pending — entregável concreto da adoção do Git Flow"
    resolved_by: saneamento-fase-02-e-infra/TD-07
---

# task-saneamento-fase-02-e-infra — Validation

## Findings

### Inconsistencies

_None._ _(TD-01 Option A mantém os compose files independentes, preservando a premissa de `next-frontend-openapi-typing/TD-02`; nenhuma TD com `Scope: Frontend` restante, então o check de TD órfã não dispara.)_

### Ambiguities

_None._

### Missing Decisions

_None._

### Dependency Gaps

_None._ _(DG-N never fires in task mode.)_

### Inherited Constraint Conflicts

_None._ _(TD-02 segue a convenção herdada de config namespaced + Joi; TD-03 não altera a revogabilidade de `phase-02-auth/TD-04`; TD-05 reutiliza `phase-02-auth-frontend/TD-06`; TD-06 implementa exatamente `next-frontend-openapi-typing/TD-03`.)_

### Unresolved Open Questions

_None._ _(All 7 TDs decided.)_

### UI Coverage Gaps

_None._ _(UI Inventory deferred — UIG-N skipped.)_

## Resolved Issues

- **AMB-1** _(resolved_by saneamento-fase-02-e-infra/TD-07)_ — Entregável de "criar branch dev e adotar Git Flow" não está definido. `/research` converteu a ambiguidade na TD-07 com três entregáveis candidatos.
- **AMB-2** _(resolved_by saneamento-fase-02-e-infra/TD-05)_ — Botão de logout exige chrome autenticado que não existe; posicionamento indefinido. `/research` converteu a ambiguidade na TD-05 (header mínimo / página provisória / fora do escopo).
- **AMB-3** _(resolved_by saneamento-fase-02-e-infra/TD-04)_ — Telas de confirmação de conta e reset de senha sem fonte de design. `/research` converteu a ambiguidade na TD-04 (derivar de `/forgot-password` / Figma + inventário / páginas mínimas).
- **MD-1** _(resolved_by saneamento-fase-02-e-infra/TD-01)_ — Topologia Docker sem TD. `/research` criou a TD-01 com quatro opções; a decisão em si é rastreada por OQ-2.
- **IC-1** _(resolved_by clarification)_ — Topologia Docker vs premissa de independência de stacks em `next-frontend-openapi-typing/TD-02`. Resolvida por escolha (a): TD-01 decidida como Option A (rede nomeada compartilhada, stacks separadas), então os compose files continuam sem referenciar um ao outro e `openapi-typing/TD-02` permanece intacta, sem `**Revisions:**` nem supersede.
- **IC-2** _(resolved_by saneamento-fase-02-e-infra/TD-04)_ — TD-04 `Scope: Frontend` com UI Inventory deferido. Resolvida por escolha (a): `**Scope:**` reclassificado para `Cross-layer` no doc de decisões, porque os estados `invalid`/`expired` da tela derivam das exceções `InvalidToken`/`TokenExpired` publicadas no `openapi.json` (a TD informa o contrato de erro consumido). UI Inventory permanece deferido por decisão explícita de TD-04 Option A.
- **IC-3** _(resolved_by saneamento-fase-02-e-infra/TD-05)_ — TD-05 `Scope: Frontend` com UI Inventory deferido. Resolvida por escolha (a): `**Scope:**` reclassificado para `Cross-layer` no doc de decisões, porque o botão define o contrato de invalidação de sessão BFF (`destroySession`) + upstream (`POST /auth/logout`).
- **AMB-4** _(resolved_by clarification)_ — Item (3) do escopo original (correção de `whiteboard.png` → `whiteboard.svg` no README) ausente do `scope_description`. Resolvida por escolha (a): item reincluído no `scope_description` do doc de decisões e no `## Scope` do `context.md`. Sem TD (correção trivial de uma linha).
- **OQ-1** _(resolved_by saneamento-fase-02-e-infra/TD-03)_ — TD-03 decidida como Option A: `confirm` idempotente no backend (token já usado + usuário confirmado = sucesso; inexistente = `InvalidToken`; expirado e não usado = `TokenExpired`); RSC confirma no carregamento, `phase-02-auth-frontend/TD-07` intacta.
- **OQ-2** _(resolved_by saneamento-fase-02-e-infra/TD-01)_ — TD-01 decidida como Option A: rede Docker nomeada `streamtube` criada pelo compose do backend e declarada `external` no do frontend; `API_URL=http://nestjs-api:3000`; `extra_hosts` removido.
- **OQ-3** _(resolved_by saneamento-fase-02-e-infra/TD-02)_ — TD-02 decidida como Option A: nova variável `FRONTEND_URL` (Joi `uri`, obrigatória) no namespace `app`; links `${FRONTEND_URL}/confirm-email?token=` e `${FRONTEND_URL}/reset-password?token=`.
- **OQ-4** _(resolved_by saneamento-fase-02-e-infra/TD-04)_ — TD-04 decidida como Option A: telas derivam da composição de `/forgot-password`; estados fechados (confirmação: `success`/`invalid`/`expired`; reset: `form`/`success`/`error`).
- **OQ-5** _(resolved_by saneamento-fase-02-e-infra/TD-05)_ — TD-05 decidida como Option A: `AppHeader` session-aware no layout das rotas de aplicação (fora de `(auth)`), com `router.push("/")` + `router.refresh()` após logout; home boilerplate substituída por placeholder.
- **OQ-6** _(resolved_by saneamento-fase-02-e-infra/TD-06)_ — TD-06 decidida como Option A: job único (sync → gen → diff) em `pull_request`/`push` para `dev` e `main`, `setup-node` v7 com cache dos dois lockfiles, sem banco. Options B (re-export do backend) e C (gates de qualidade) registradas como tasks futuras `ci-backend-openapi-export` e `ci-quality-gates`.
- **OQ-7** _(resolved_by saneamento-fase-02-e-infra/TD-07)_ — TD-07 decidida como Option A: criar `dev` a partir de `main` e publicar; executar esta task em `feature/saneamento-fase-02-e-infra` a partir de `dev`; documentar o fluxo de branches no README; merge via PR em `dev`.
