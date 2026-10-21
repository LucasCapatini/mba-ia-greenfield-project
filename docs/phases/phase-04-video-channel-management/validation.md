---
kind: phase
name: phase-04-video-channel-management
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-04-video-channel-management/context.md: "2026-10-18T22:27:36-04:00"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-18T22:25:15-04:00"
issues:
  - id: IC-1
    status: resolved
    summary: "'Save Changes' publica implicitamente (inventário) vs. TD-03 (ação dedicada, PATCH sem efeito de estado)"
    resolved_by: video-channel-management/TD-03
  - id: AMB-1
    status: resolved
    summary: "UI de upload (escolha de arquivo + processamento) não é bullet da Fase 04; só nota de status da Fase 03"
    resolved_by: clarification
  - id: AMB-2
    status: resolved
    summary: "Exclusão de vídeos (TD-09, kebab 'Excluir') não é bullet da Fase 04; escopo implícito"
    resolved_by: clarification
  - id: AMB-3
    status: resolved
    summary: "Lista inicial de categorias (slugs/nomes) para a data migration de TD-01 não está definida"
    resolved_by: video-channel-management/TD-01
  - id: OQ-1
    status: resolved
    summary: "Tela 'Upload Video' (154:1724) não inventariada — cota do Figma MCP"
    resolved_by: clarification
  - id: OQ-2
    status: resolved
    summary: "Publicação implícita no 'Save Changes' vs. TD-03 — coerência e feedback quando não ready"
    resolved_by: video-channel-management/TD-03
  - id: OQ-3
    status: resolved
    summary: "Ponto de entrada do estúdio e da edição do canal no header/navegação desta fase"
    resolved_by: clarification
  - id: OQ-4
    status: resolved
    summary: "Rotas do estúdio propostas pelo inventário (/studio/...) a confirmar no plan-build"
    resolved_by: clarification
  - id: OQ-5
    status: resolved
    summary: "Path do link público do vídeo (/v/ vs. /watch/) depende da Fase 05"
    resolved_by: clarification
  - id: OQ-6
    status: resolved
    summary: "Avatar e banner do canal como placeholder estático nesta fase"
    resolved_by: clarification
  - id: OQ-7
    status: resolved
    summary: "Estados não desenhados no Figma (status, erros, vazio/404, menus, diálogos, aba About)"
    resolved_by: clarification
  - id: OQ-8
    status: resolved
    summary: "Parâmetros de filtro, ordenação e busca do painel fora de TD-06"
    resolved_by: clarification
  - id: OQ-9
    status: resolved
    summary: "Títulos divergentes no Figma ('Channel Settings' em edição/upload; handle em Display name)"
    resolved_by: clarification
advisories: []
---

# phase-04-video-channel-management — Validation

_Revisão 2 (2026-10-18, após `/plan-resolve 4`): as sete checagens reemitem os mesmos 13 achados da revisão 1 (mesma tupla categoria + resumo), todos já resolvidos — descartados no merge. As revisões apensadas a TD-01 (lista inicial de categorias) e TD-03 (encadeamento `PATCH` + `publish` no BFF) não introduzem inconsistência nova com o escopo nem conflito com TDs herdados. Check 8 suprimido (fase com uma única fatia)._

## Findings

### Inconsistencies

_None._ — o verbo "Publicar vídeo ao salvar um rascunho pronto" (inventário) e `TD-03` (ações dedicadas) passam a ser coerentes pela revisão de 2026-10-18 em TD-03 (BFF encadeia `PATCH` + `publish`; API inalterada).

### Ambiguities

_None._ — UI de upload e exclusão de vídeos clarificadas como implícitas sob "Painel de gerenciamento de vídeos do canal (…)"; lista inicial de categorias fixada na revisão de TD-01.

### Missing Decisions

_None._ — todas as 8 capabilities têm ≥1 TD em `## Capability Coverage`; o formato de erro HTTP é herdado (`phase-02-auth/TD-07`); a estratégia de sincronização de contrato FE↔BE (Decisão #29) está coberta por TD-03 (Cross-layer, "contrato visível (OpenAPI → `types.gen.ts` → MSW)") e pelos TDs herdados `next-frontend-openapi-typing/TD-01..05` — não dispara.

### Dependency Gaps

_None._ — os pré-requisitos das fases anteriores estão entregues: endpoints de upload/estado/playback e thumbnail automática (Fase 03), sessão BFF com `channelSlug` e `router.refresh()` (Fase 02 frontend), guard JWT global com `@Public()` (Fase 02), cadeia OpenAPI (ad-hoc). A ordem interna (categorias → edição de vídeo; modelo de publicação → listagens; autenticação opcional e policy de thumbnails → página pública) é derivável das dependências entre TDs e fica para o `/plan-build`.

### Inherited Constraint Conflicts

_None._ — TD-10 (leitura anônima só do prefixo `thumbnails/*`) não reabre `phase-03-videos/TD-09` (vídeos continuam privados); TD-04 (thumbnail pela API) é exceção explícita ao "nenhum byte de vídeo pela API" de `phase-03/TD-03`, que trata de vídeos; TD-07 estende o `JwtAuthGuard` de `phase-02-auth/TD-02` sem substituí-lo; TD-08 mantém a allowlist de `phase-02-auth/TD-10`; TD-12 segue `phase-02-auth-frontend/TD-06`; TD-01 (data migration manual) é permitido pela convenção de migrations; a revisão de TD-03 mantém `phase-02-auth-frontend/TD-05` (mutações por Route Handler).

### Unresolved Open Questions

_None._ — nenhum TD `pending`; as 9 perguntas abertas do inventário foram resolvidas em `/plan-resolve 4` (ver `## Resolved Issues`).

### UI Coverage Gaps

_None._ — todas as 8 capabilities com cobertura de TD têm ≥1 verbo em `## UI Inventory → UI ↔ Capability Join` (42 verbos em 5 telas).

## Resolved Issues

_(resolvidas em `/plan-resolve 4`, 2026-10-18 — respostas do usuário via AskUserQuestion; preservadas como trilha de auditoria)_

- **IC-1** _(resolved_by video-channel-management/TD-03 — Append revision, Option A mantida)_ — "Save Changes" das telas de edição/upload encadeia no BFF o `PATCH` de campos com a ação dedicada `publish` quando `status = draft`, `processing_status = ready` e título preenchido; `unpublish` só pelo kebab do painel. A API mantém as ações dedicadas. Revisão registrada em TD-03.
- **AMB-1** _(resolved_by clarification)_ — A UI de upload (telas de escolha do arquivo e de processamento, rota `/studio/upload/{publicId}`) fica implícita sob o bullet "Painel de gerenciamento de vídeos do canal (…)", como o inventário e TD-11 já a ancoram; sem edição do `project-plan.md`. O `/plan-build` deve gerar SIs próprias para o fluxo de upload.
- **AMB-2** _(resolved_by clarification)_ — Exclusão de vídeos pelo dono fica implícita sob o bullet do painel ("gerenciar" inclui remover); TD-09 e a ação "Excluir" do kebab permanecem; o `/plan-build` inclui SI de exclusão (endpoint + job `video.delete` + diálogo de confirmação).
- **AMB-3** _(resolved_by video-channel-management/TD-01 — Append revision, Option A mantida)_ — Lista inicial de categorias para a data migration, nesta ordem: music → Music, gaming → Gaming, education → Education, entertainment → Entertainment, sports → Sports, news → News, technology → Technology, travel → Travel, cooking → Cooking, other → Other. Revisão registrada em TD-01.
- **OQ-1** _(resolved_by clarification)_ — A tela "Upload Video" (154:1724) é derivada pelo `/plan-build` da capability e da tela de processamento (dropzone/seletor de arquivo, validação MP4/WebM, limite de 10 GB, formatos de TD-14 da Fase 03); um extension run de `/screen-inventory 4` a inventaria quando a cota do Figma MCP for restabelecida.
- **OQ-2** _(resolved_by video-channel-management/TD-03 — mesma revisão de IC-1)_ — Com o vídeo ainda não `ready`, "Save Changes" apenas salva os campos e informa que o vídeo continua rascunho; a publicação ocorre num novo "Save" após o processamento. Nenhuma decisão nova de backend (sem flag de publicação automática).
- **OQ-3** _(resolved_by clarification)_ — Ponto de entrada mínimo nesta fase: o `AppHeader` existente (`components/layout/app-header.tsx`) ganha, para sessão autenticada, links "Meus vídeos" (`/studio/videos`) e "Meu canal" (`/studio/channel`) além de "Sair". A navbar completa com menu de usuário permanece na Fase 07.
- **OQ-4** _(resolved_by clarification)_ — Rotas do estúdio confirmadas: `/studio/videos`, `/studio/videos/{publicId}/edit`, `/studio/channel`, `/studio/upload/{publicId}`. Página pública em `/channel/{nickname}` (TD-08).
- **OQ-5** _(resolved_by clarification)_ — Link público do vídeo exibido/copiado no CardVideoConfig usa o path `/watch/{publicId}` (`${FRONTEND_URL}/watch/{publicId}`); a Fase 05 herda essa rota para a watch page.
- **OQ-6** _(resolved_by clarification)_ — Avatar e banner do canal são placeholder estático nesta fase (banner com gradiente, avatar com iniciais do nome do canal); nenhum campo no domínio nem upload de imagem do canal. Candidato a fase futura, sem bullet no plano.
- **OQ-7** _(resolved_by clarification)_ — Estados não desenhados no Figma (status do painel além de "Public", estados de processamento/falha da tela de upload, erros de validação inclusive 409 `NICKNAME_TAKEN`, estados vazio/carregando/404, conteúdo dos menus Filter/Date/Sort by e do kebab, diálogos de confirmação) são definidos pelo `/plan-build` a partir dos primitivos shadcn e dos padrões da Fase 02 (`field-error`, badges). A aba "About" da página do canal fica fora do escopo (sem conteúdo desenhado).
- **OQ-8** _(resolved_by clarification)_ — Filtros (visibilidade, data), busca textual e ordenação do painel entram como query params do endpoint de listagem do dono, definidos pelo `/plan-build` como detalhe de contrato (ex.: `visibility`, `status`, `q`, `sort`, `from`/`to`) sobre a paginação cursor keyset de TD-06; sem novo TD.
- **OQ-9** _(resolved_by clarification)_ — Títulos divergentes tratados como erro de conteúdo do design: "Edit video" na tela de edição, "Upload video" na tela de upload; o campo "Display name" das configurações do canal recebe o nome do canal (não o handle). Sem retorno ao Figma.
