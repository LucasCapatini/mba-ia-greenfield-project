---
kind: phase
name: phase-03-videos
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-10-18T14:44:17-04:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-18T14:40:55-04:00"
issues:
  - id: AMB-1
    status: resolved
    summary: "Regra de autorização de playback/download de rascunhos na Fase 03 não definida"
    resolved_by: clarification
  - id: MD-1
    status: resolved
    summary: "Nenhum TD decide formatos de vídeo aceitos e onde a rejeição acontece"
    resolved_by: phase-03-videos/TD-14
  - id: OQ-1
    status: resolved
    summary: "TD-01 pending — Serviço de object storage S3-compatível"
    resolved_by: phase-03-videos/TD-01
  - id: OQ-2
    status: resolved
    summary: "TD-02 pending — SDK de acesso ao storage"
    resolved_by: phase-03-videos/TD-02
  - id: OQ-3
    status: resolved
    summary: "TD-03 pending — Protocolo de upload de até 10 GB com retomada"
    resolved_by: phase-03-videos/TD-03
  - id: OQ-4
    status: resolved
    summary: "TD-04 pending — Fila de processamento em segundo plano"
    resolved_by: phase-03-videos/TD-04
  - id: OQ-5
    status: resolved
    summary: "TD-05 pending — Onde vive o worker de vídeo"
    resolved_by: phase-03-videos/TD-05
  - id: OQ-6
    status: resolved
    summary: "TD-06 pending — Integração com FFmpeg/ffprobe"
    resolved_by: phase-03-videos/TD-06
  - id: OQ-7
    status: resolved
    summary: "TD-07 pending — Modelo de dados do vídeo e eixos de estado"
    resolved_by: phase-03-videos/TD-07
  - id: OQ-8
    status: resolved
    summary: "TD-08 pending — Identificador público único do vídeo"
    resolved_by: phase-03-videos/TD-08
  - id: OQ-9
    status: resolved
    summary: "TD-09 pending — Entrega de streaming e download"
    resolved_by: phase-03-videos/TD-09
  - id: OQ-10
    status: resolved
    summary: "TD-10 pending — Topologia Docker Compose e bootstrap do bucket"
    resolved_by: phase-03-videos/TD-10
  - id: OQ-11
    status: resolved
    summary: "TD-11 pending — Contrato do job de processamento e idempotência"
    resolved_by: phase-03-videos/TD-11
  - id: OQ-12
    status: resolved
    summary: "TD-12 pending — Limpeza de uploads órfãos e rascunhos abandonados"
    resolved_by: phase-03-videos/TD-12
  - id: OQ-13
    status: resolved
    summary: "TD-13 pending — Estratégia de testes para storage, fila e worker"
    resolved_by: phase-03-videos/TD-13
  - id: OQ-14
    status: resolved
    summary: "TD-14 pending — Formatos de vídeo aceitos e ponto de validação"
    resolved_by: phase-03-videos/TD-14
---

# phase-03-videos — Validation

## Findings

### Inconsistencies

_None._

_(Checked against the 14 decided TDs: every `Capability:` cites bullets present in `## Scope`; no two decisions imply mutually exclusive runtime behavior — TD-04 (pg-boss) ↔ TD-10 (no `redis` service) ↔ TD-11 (`send` in the same transaction) are coherent, TD-03/TD-09 (browser → storage via presigned URLs) ↔ TD-10 (`storage-init` sets bucket CORS) are coherent, TD-14 (allowlist + `ffprobe`) ↔ TD-06 (`ffprobe` over internal presigned URL) ↔ TD-07 (`processing_error` column) are coherent; `## UI Inventory` is absent and no TD has `Scope: Frontend`, so the Scope-Subsection orphan check does not fire — the three `Cross-layer` TDs (03, 09, 14) render in API Contracts.)_

### Ambiguities

_None._

_(AMB-1 — authorization rule for playback/download in this phase — was resolved by clarification in `/plan-resolve 3` and is recorded in TD-09's `**Decision:**`; see `## Resolved Issues`. No other capability bullet requires a question before SI decomposition.)_

### Missing Decisions

_None._

_(All 9 capability bullets map to ≥1 TD in `## Capability Coverage`; error response format inherited from `phase-02-auth/TD-07`; Decisão #29 shared-types check does not fire because `## UI Inventory` is absent.)_

### Dependency Gaps

_None._

_(Prerequisites from prior phases are delivered — auth guards and `@Public()` (phase-02-auth), `Channel` per user (phase-02-auth/TD-10), `registerAs` + Joi config (phase-01), shared Docker network `streamtube` (saneamento/TD-01). Within-phase ordering is documented in the decisions doc's dependency note: storage (TD-01/02) → upload (TD-03) → queue (TD-04) → worker (TD-05/06) → data model (TD-07/08) → delivery (TD-09) → compose (TD-10) → job/cleanup/formats (TD-11/12/14) → tests (TD-13).)_

### Inherited Constraint Conflicts

_None._

_(Checked each decided TD against `## Inherited Conventions` and `## Inherited Decisions Detail`: TD-03 and TD-09 let the browser talk to `S3_PUBLIC_ENDPOINT` with URLs minted by the API through the BFF — the inherited Strict BFF model (`phase-02-auth-frontend/TD-01`, `next-frontend-config-base/TD-03`) constrains browser ↔ `nestjs-api`, which remains untouched; the decisions doc frames the storage hop as an explicit, bounded exception. TD-02 follows the inherited `registerAs` + Joi config pattern (phase-01/TD-01..04) for the new `S3_*`/`UPLOAD_*` keys. TD-04 (pg-boss) adds a self-migrated `pgboss` schema alongside TypeORM migrations — not an inherited-TD contradiction, but a documented operational caveat for `nestjs-project/CLAUDE.md`. TD-08 reuses the SAVEPOINT retry pattern of `phase-02-auth/TD-10`. TD-10 keeps the separate-stacks topology of `saneamento-fase-02-e-infra/TD-01`.)_

### Unresolved Open Questions

_None._

_(All 14 TDs are `decided`; no inventory open questions because UI is not in scope.)_

### UI Coverage Gaps

_None._ _(UI not in scope — `## UI Inventory` absent; UIG-N does not apply.)_

## Resolved Issues

- **AMB-1** _(resolved_by clarification, `/plan-resolve 3` em 2026-10-18)_ — Regra de autorização de playback/download de rascunhos na Fase 03: **somente o dono do canal autenticado** obtém `streamUrl`/`downloadUrl` enquanto o vídeo é rascunho; regras de público/unlisted e acesso anônimo ficam para as Fases 04/05 sem mudar o mecanismo (TD-09). Registrado também no `**Decision:**` de TD-09.
- **MD-1** _(resolved_by phase-03-videos/TD-14)_ — Nenhum TD decide formatos de vídeo aceitos e onde a rejeição acontece. Addressed by the `/research 3` run of 2026-10-18 that added TD-14 (Cross-layer) to the existing slice.
- **OQ-1** _(resolved_by phase-03-videos/TD-01)_ — TD-01 decidido: A (RustFS 1.0.x com tag pinada; Garage como fallback).
- **OQ-2** _(resolved_by phase-03-videos/TD-02)_ — TD-02 decidido: A (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).
- **OQ-3** _(resolved_by phase-03-videos/TD-03)_ — TD-03 decidido: A (S3 multipart pré-assinado direto no storage; exceção limitada ao Strict BFF).
- **OQ-4** _(resolved_by phase-03-videos/TD-04)_ — TD-04 decidido: C (pg-boss sobre PostgreSQL).
- **OQ-5** _(resolved_by phase-03-videos/TD-05)_ — TD-05 decidido: A (segundo entrypoint `src/worker.ts` no `nestjs-project`).
- **OQ-6** _(resolved_by phase-03-videos/TD-06)_ — TD-06 decidido: A (ffmpeg do apt + `execFile` sobre URL pré-assinada interna).
- **OQ-7** _(resolved_by phase-03-videos/TD-07)_ — TD-07 decidido: B (`Video` + `VideoUpload`).
- **OQ-8** _(resolved_by phase-03-videos/TD-08)_ — TD-08 decidido: A (ID de 11 chars via `node:crypto`).
- **OQ-9** _(resolved_by phase-03-videos/TD-09)_ — TD-09 decidido: A (URLs GET pré-assinadas pela API; autorização conforme AMB-1).
- **OQ-10** _(resolved_by phase-03-videos/TD-10)_ — TD-10 decidido: A (serviços no compose do backend + `storage-init`; sem `redis`).
- **OQ-11** _(resolved_by phase-03-videos/TD-11)_ — TD-11 decidido: A (enfileirar no `complete`, chave singleton por vídeo, transições guardadas).
- **OQ-12** _(resolved_by phase-03-videos/TD-12)_ — TD-12 decidido: A (job atrasado por upload, `UPLOAD_TTL` 24 h).
- **OQ-13** _(resolved_by phase-03-videos/TD-13)_ — TD-13 decidido: A (serviços reais do compose + `aws-sdk-client-mock` em unit).
- **OQ-14** _(resolved_by phase-03-videos/TD-14)_ — TD-14 decidido: A (dupla validação: allowlist MP4/WebM + `ffprobe` no worker).
