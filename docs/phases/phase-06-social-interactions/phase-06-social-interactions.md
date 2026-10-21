---
kind: phase
name: phase-06-social-interactions
test_specs_aware: true
sources_mtime:
  docs/phases/phase-06-social-interactions/context.md: "2026-10-20T00:26:36-04:00"
  docs/decisions/technical-decisions-social-interactions.md: "2026-10-20T00:25:26-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T23:49:39-04:00"
---

# Phase 06 — Interações Sociais (Likes, Comentários, Inscrições)

## Objective

Entregar likes/dislikes funcionando em vídeos e em comentários (usuários autenticados), comentários em vídeos com respostas (comentários aninhados), inscrição em canais (seguir/deixar de seguir) com a contagem de inscritos na página do canal e a área de canais seguidos com acesso rápido aos vídeos (menu lateral + feed das inscrições), com a interface completa de comentários, likes e inscrições — backend NestJS + frontend Next.js (BFF).

---

## Step Implementations

_Bootstrap (`SI-06.0.k`, sintetizadas dos marcadores `(new)` dos UI Contracts) → modelo de dados (`SI-06.1.1`–`SI-06.1.2`) → endpoints (`SI-06.2`–`SI-06.8`) → contrato OpenAPI + MSW (`SI-06.9`) → BFF (`SI-06.10`–`SI-06.11`) → runtime otimista (`SI-06.12`) → componentes com I/O (`SI-06.13`–`SI-06.15`) → telas (`SI-06.16.x` canal + app shell, `SI-06.17.x` watch page, `SI-06.18.x` feed) → verificação do TD-09 (`SI-06.19`). Fora do bootstrap por decisão de escopo: os `(new)` que fazem I/O pelo BFF e carregam a lógica otimista do `social-interactions/TD-09` — `components/channel/subscribe-button.tsx`, `components/watch/video-reaction-buttons.tsx`, `components/comments/comment-reaction-buttons.tsx` (`SI-06.13`), `components/comments/comment-section.tsx`, `components/comments/comment-list.tsx`, `components/comments/comment-replies.tsx` (`SI-06.14`) e `components/layout/side-nav-subscriptions.tsx` (`SI-06.15`), autorados em SIs próprias depois do BFF; os demais `(new)` (sem I/O) entram no bootstrap._

### SI-06.0.1 — Custom-business simple group: thumb-down-icon + app-shell + side-nav + side-nav-item + subscription-video-grid

**Description:** Author os componentes sem estado nem I/O que as telas da fase compõem — ícone de dislike, casca de layout com menu lateral e o grid do feed.

**Technical actions:**

1. Author `components/icons/thumb-down-icon.tsx` per UI Contract — espelho do `thumb-up-icon.tsx`, mesma API de props (`React.ComponentProps<"svg">`).
2. Author `components/layout/app-shell.tsx` per UI Contract — SideNav à esquerda (largura fixa do frame 150:959) + `<main>` com o conteúdo; recebe o menu como slot; sem sessão renderiza só o conteúdo.
3. Author `components/layout/side-nav.tsx` per UI Contract — `<nav aria-label="Main">` com o grupo Home/Subscriptions, divisória, seção "You" (Your videos), divisória e um slot para a seção "Subscriptions"; fixo, sem colapso ("≡"/mobile na Fase 07).
4. Author `components/layout/side-nav-item.tsx` per UI Contract — ícone + rótulo + `<Link>`; recebe `active` e aplica `aria-current="page"` (o item ativo é decidido pelo chamador a partir da rota).
5. Author `components/feed/subscription-video-grid.tsx` per UI Contract — grid de 4 colunas (frame Home 143:948) que renderiza `VideoCard` para cada item recebido.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app-shell.tsx` | Unit per testing-guide-next-frontend § "Client Components" — com menu → nav + main; sem menu → só main | `components/layout/__tests__/app-shell.test.tsx` |
| `side-nav.tsx` | Unit per testing-guide-next-frontend § "Client Components" — landmarks, seções e slot de inscrições | `components/layout/__tests__/side-nav.test.tsx` |
| `side-nav-item.tsx` | Unit per testing-guide-next-frontend § "Client Components" — `href`, rótulo e `aria-current` quando ativo | `components/layout/__tests__/side-nav-item.test.tsx` |
| `subscription-video-grid.tsx` | Unit per testing-guide-next-frontend § "Client Components" — um card por item, na ordem recebida | `components/feed/__tests__/subscription-video-grid.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-06.0.2 — Custom-business simple group: ícones do menu lateral e variantes preenchidas

**Description:** Desenhar os ícones que os UI Contracts usam e que ainda não existem em `components/icons/` (resolução OQ-4: a partir do Material Symbols, como os anteriores).

**Technical actions:**

1. Author `components/icons/home-icon.tsx`, `components/icons/subscriptions-icon.tsx` e `components/icons/your-videos-icon.tsx` (menu lateral, frame 150:959) no padrão dos ícones existentes.
2. Adicionar a variante preenchida (estado ativo da reação) a `components/icons/thumb-up-icon.tsx` e `components/icons/thumb-down-icon.tsx` — prop `filled` ou export irmão, mantendo a API atual do `thumb-up-icon` intacta para os consumidores existentes.

**Tests:** _(empty — icons: testing-guide-next-frontend "Icon → None"; cobertos pelos consumidores)_

**Dependencies:** SI-06.0.1 (`thumb-down-icon.tsx`)

**Acceptance criteria:**

- `home-icon.tsx`, `subscriptions-icon.tsx` e `your-videos-icon.tsx` existem em `components/icons/` e compilam.
- `thumb-up-icon.tsx` e `thumb-down-icon.tsx` renderizam a variante contornada (padrão) e a preenchida.
- Os consumidores existentes de `thumb-up-icon.tsx` (estúdio) continuam compilando sem alteração.

---

### SI-06.0.3 — Custom-business simple group: comment-item + comment-sort-menu

**Description:** Author os blocos de apresentação da seção de comentários — o item de comentário (com slots para ações) e o seletor de ordenação controlado.

**Technical actions:**

1. Author `components/comments/comment-item.tsx` per UI Contract — avatar 48px (`ChannelAvatar`), "@nickname" com link para `/channel/{nickname}`, tempo relativo (`formatRelativeTime`) em muted, texto com quebras preservadas, "(edited)" quando `edited_at`; slots para as reações, o "Reply", o menu "⋮" e as respostas (os componentes com I/O entram pelos slots).
2. Author `components/comments/comment-sort-menu.tsx` per UI Contract — gatilho com `sort-icon` + `DropdownMenu` com Latest/Top; controlado (`value` + `onValueChange`), sem I/O.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `comment-item.tsx` | Unit per testing-guide-next-frontend § "Client Components" — autor, link do canal, "(edited)" só com `edited_at`, slots renderizados | `components/comments/__tests__/comment-item.test.tsx` |
| `comment-sort-menu.tsx` | Unit per testing-guide-next-frontend § "Client Components" — rótulo do valor atual; escolher Top chama `onValueChange("top")` | `components/comments/__tests__/comment-sort-menu.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Unit tests exercise rendering + props.

---

### SI-06.0.4 — Custom-business complex: comment-composer

**Description:** Author `components/comments/comment-composer.tsx` — business component com estado local de formulário (foco, texto, validação, envio pendente) per Notes "Botões "Cancel"/"Comment" ao focar não desenhados. Texto 1–2.000 caracteres (`TD-07`). Mesmo componente para responder e editar".

**Technical actions:**

1. Author `components/comments/comment-composer.tsx` per UI Contract — avatar do usuário + `Textarea` autoexpansível com `<label>` acessível; ao focar mostra "Cancel"/"Comment"; "Comment" habilitado só com 1–2.000 caracteres após `trim` (per `### API Contracts → Validation Rules`); `onSubmit(text)` assíncrono informado pelo pai (sem I/O próprio), com estado pendente e erro de campo; valor inicial opcional (edição e resposta com `@nickname` pré-preenchido); modo anônimo vira o link "Sign in to comment" para `/login?returnTo=` (per `social-interactions/TD-10`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `comment-composer.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline | `components/comments/__tests__/comment-composer.test.tsx` |
| `comment-composer.tsx` | Unit: estado — botões só após foco; "Comment" desabilitado com vazio/só espaços/2.001 caracteres; Cancel limpa e recolhe; `onSubmit` recebe o texto com `trim`; erro de campo exibido; anônimo → link de login com `returnTo` | (same file) |

**Dependencies:** none

**Acceptance criteria:**

- `components/comments/comment-composer.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the signal-driven logic (state transitions do foco/envio e a validação 1–2.000 após `trim`).

---

### SI-06.0.5 — Custom-business complex: comment-actions-menu

**Description:** Author `components/comments/comment-actions-menu.tsx` — business component com estado local (menu aberto, diálogo de confirmação) per Notes "Só para o autor (`TD-07`) … "Edit" troca o texto pelo composer; "Delete" pede confirmação".

**Technical actions:**

1. Author `components/comments/comment-actions-menu.tsx` per UI Contract — `IconButton` icon-only com `aria-label` + `more-vertical-icon` + `DropdownMenu` com "Edit"/"Delete"; "Delete" abre `Dialog` de confirmação que avisa sobre as respostas quando `replyCount > 0`; callbacks `onEdit()`/`onDelete()` informados pelo pai (sem I/O próprio); não renderiza nada quando `viewerIsAuthor` é `false` (per `social-interactions/TD-06`, Revisions 2026-10-20).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `comment-actions-menu.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline | `components/comments/__tests__/comment-actions-menu.test.tsx` |
| `comment-actions-menu.tsx` | Unit: estado — oculto para não autor; Edit chama `onEdit`; Delete só chama `onDelete` após confirmar; aviso de respostas só com `replyCount > 0` | (same file) |

**Dependencies:** none

**Acceptance criteria:**

- `components/comments/comment-actions-menu.tsx` exists and matches the UI Contract.
- Unit tests cover baseline rendering + the signal-driven logic (abrir menu, confirmar/cancelar exclusão, ocultação para não autor).

---

### SI-06.1.1 — Infra: migration das interações sociais (auto-split from SI-06.1 by /plan-build)

_Auto-split rationale: original SI would have 7 Technical actions (migration + 4 entidades + coluna em `Channel` + registro nos helpers de teste); split per "infrastructure vs behavior"._

**Description:** Criar no banco o enum de reação, as quatro tabelas novas e o contador de inscritos do canal, numa única migration reversível.

**Technical actions:**

1. Escrever à mão `src/database/migrations/<timestamp>-CreateSocialInteractions.ts` a partir de `### Data Model` (a SI-06.1.2 confere com `migration:generate` que as entidades não divergem) com: enum `reaction_value ('like','dislike')`; tabelas `video_reactions`, `comments`, `comment_reactions` e `subscriptions` com PKs, FKs `ON DELETE CASCADE` e índices exatamente como em `### Data Model` (incluindo os índices parciais `WHERE parent_id IS NULL` de `comments`); `channels.subscriber_count integer NOT NULL DEFAULT 0` (per `social-interactions/TD-01`, `TD-02`, `TD-05`).
2. Implementar o `down` na ordem inversa (tabelas dependentes primeiro, depois o enum e a coluna) e rodar `migration:run` + `migration:revert` + `migration:run` no container para provar a reversão.

**Tests:** _(empty — Infra; o schema é provado pelos testes de entidade de SI-06.1.2)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose exec nestjs-api npm run migration:run` aplica a migration sem erro num banco com as migrations da Fase 05
- `npm run migration:revert` desfaz a migration e um novo `migration:run` a reaplica sem erro
- `\d comments` mostra `parent_id` nulável com FK para `comments.id` `ON DELETE CASCADE` e os três índices de listagem
- `channels.subscriber_count` existe, é `NOT NULL` e vale 0 para os canais já existentes

---

### SI-06.1.2 — Entidades das interações sociais (auto-split from SI-06.1 by /plan-build)

_Auto-split rationale: original SI would have 7 Technical actions; split per "infrastructure vs behavior"._

**Description:** Mapear no TypeORM as tabelas da SI-06.1.1, cada uma no módulo dono do seu domínio, e deixá-las visíveis aos testes de integração.

**Technical actions:**

1. Criar `src/reactions/entities/video-reaction.entity.ts` e `src/reactions/entities/comment-reaction.entity.ts` com o enum `ReactionValue` (`'like' | 'dislike'`, `enumName: 'reaction_value'` compartilhado) e PK composta `(user_id, video_id)` / `(user_id, comment_id)` (per `### Data Model`; `social-interactions/TD-01`).
2. Criar `src/comments/entities/comment.entity.ts` com `parent_id` nulável (auto-relação `ManyToOne`/`OneToMany` com `onDelete: 'CASCADE'`), contadores `like_count`/`dislike_count`/`reply_count` e `edited_at` nulável (per `### Data Model → Comment`; `TD-05`, `TD-07`).
3. Criar `src/subscriptions/entities/subscription.entity.ts` com PK composta `(user_id, channel_id)` (per `### Data Model → Subscription`).
4. Adicionar `subscriber_count` (integer, default 0) a `src/channels/entities/channel.entity.ts` (per `### Data Model → Channel`).
5. Registrar as quatro entidades em `ALL_ENTITIES` e a limpeza das tabelas novas em `cleanAllTables` (`src/test/create-test-data-source.ts`), na ordem que respeita as FKs.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoReaction` | Integration: PK composta impede duas reações do mesmo usuário ao mesmo vídeo; `value` fora do enum é recusado; apagar o vídeo apaga a reação | `src/reactions/entities/video-reaction.entity.integration-spec.ts` |
| `Comment` | Integration: defaults dos contadores = 0; `edited_at` nulo por padrão; apagar a raiz apaga as respostas; apagar o vídeo apaga os comentários | `src/comments/entities/comment.entity.integration-spec.ts` |
| `CommentReaction` | Integration: PK composta; apagar o comentário apaga a reação | `src/reactions/entities/comment-reaction.entity.integration-spec.ts` |
| `Subscription` | Integration: PK composta impede inscrição duplicada; apagar o canal apaga a inscrição | `src/subscriptions/entities/subscription.entity.integration-spec.ts` |
| `Channel` | Integration: `subscriber_count` nasce 0 | `src/channels/entities/channel.entity.integration-spec.ts` (estender) |

**Dependencies:** SI-06.1.1 (schema)

**Acceptance criteria:**

- Inserir duas linhas em `video_reactions` com o mesmo `(user_id, video_id)` falha por violação de PK
- Apagar um comentário raiz apaga suas respostas e as reações de ambos
- Apagar um vídeo (hard delete) apaga reações, comentários e reações de comentários dele
- Apagar um canal apaga as inscrições nele
- Um canal recém-criado tem `subscriber_count = 0`
- `npm run migration:generate -- src/database/migrations/Check` depois das entidades não produz arquivo (schema e entidades coincidem)

---

### SI-06.2 — Endpoints PUT/DELETE /videos/{publicId}/reaction

**Route:** PUT /videos/{publicId}/reaction, DELETE /videos/{publicId}/reaction
**Test Specs:** see `nestjs-project/specs/videos-reaction.plan.md`
**Authorization:** Autenticado — per `### Authorization Matrix` (dono pode reagir ao próprio vídeo; vídeo não `published` → 404 para todos)

**Description:** Permitir curtir, descurtir e remover a reação a um vídeo com escrita set-state idempotente e contadores corretos sob concorrência.

**Technical actions:**

1. Criar `src/reactions/reaction-transition.ts` (função pura): dado o valor anterior (`null | 'like' | 'dislike'`) e o novo (`null` no `DELETE`), devolve os deltas `{ like, dislike }` (per `### Data Model → Escrita dos contadores`; `social-interactions/TD-02`).
2. Criar `src/reactions/video-reactions.service.ts` com `set(videoId, userId, value)` e `remove(videoId, userId)`: numa transação, `SELECT value … FOR UPDATE`; se não houver linha, `INSERT … ON CONFLICT DO NOTHING RETURNING` e repetir o `SELECT … FOR UPDATE` se perder a corrida; aplicar a mudança e somar os deltas a `videos.like_count`/`dislike_count` com `increment`/`decrement` atômicos; devolver `ReactionStateResponse` (per `TD-02`, `TD-03`).
3. Criar `SetReactionDto` (`value` `@IsIn(['like','dislike'])`) e `ReactionStateResponse` em `src/reactions/dto/` com `@ApiProperty` (per `### API Contracts → Shapes compartilhados`).
4. Criar `src/reactions/video-reactions.controller.ts` (`@Controller('videos')`) com `PUT /:publicId/reaction` e `DELETE /:publicId/reaction` (JWT obrigatório, `@HttpCode(200)`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`); o vídeo é resolvido por `public_id` exigindo `status = published` (senão 404 `VIDEO_NOT_FOUND`, inclusive para o dono); decorators Swagger 200/400/401/404/429 (per `### API Contracts → PUT /videos/{publicId}/reaction`; `TD-03`; `nestjs-controllers.md`).
5. Criar `src/reactions/reactions.module.ts` (entidades via `TypeOrmModule.forFeature`, leitura de `Video` por `public_id` sem importar o `VideosModule`, para o `VideosModule` poder importar este módulo em SI-06.4 sem ciclo) e registrá-lo no `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `reactionTransition` | Unit: todas as transições (nada→like, like→dislike, dislike→nada, mesmo valor) e seus deltas | `src/reactions/reaction-transition.spec.ts` |
| `VideoReactionsService` | Unit (repos mockados): `set` com o mesmo valor não escreve contador; `remove` sem reação não escreve | `src/reactions/video-reactions.service.spec.ts` |
| `VideoReactionsService` | Integration (DB real): like→dislike→remoção deixa `like_count`/`dislike_count` corretos; 10 `set` paralelos do mesmo usuário terminam com contador == `COUNT(*)` da tabela | `src/reactions/video-reactions.service.integration-spec.ts` |
| `ReactionsModule` | Unit: compilation test | `src/reactions/reactions.module.spec.ts` |

**Dependencies:** SI-06.1.2 (entidades)

**Acceptance criteria:**

- `PUT /videos/{publicId}/reaction` com `{ "value": "like" }` num vídeo publicado retorna `200` com `{ viewer_reaction: "like", like_count: 1, dislike_count: 0 }`
- Repetir a mesma chamada retorna `200` com o mesmo corpo e `like_count` não muda
- Em seguida `{ "value": "dislike" }` retorna `200` com `like_count: 0, dislike_count: 1`
- `DELETE /videos/{publicId}/reaction` retorna `200` com `viewer_reaction: null` e os contadores voltam a 0; repetir o `DELETE` retorna o mesmo corpo
- `{ "value": "love" }` retorna `400` com `error: "VALIDATION_ERROR"`; sem `Authorization` retorna `401`
- O dono reagindo ao próprio rascunho recebe `404` com `error: "VIDEO_NOT_FOUND"`
- A 61ª chamada à rota no mesmo minuto, do mesmo visitante, retorna `429`

---

### SI-06.3 — Endpoints PUT/DELETE /channels/{nickname}/subscription

**Route:** PUT /channels/{nickname}/subscription, DELETE /channels/{nickname}/subscription
**Test Specs:** see `nestjs-project/specs/channels-subscription.plan.md`
**Authorization:** Autenticado — per `### Authorization Matrix` (o dono não se inscreve no próprio canal → 422)

**Description:** Permitir seguir e deixar de seguir um canal com escrita idempotente e `subscriber_count` mantido na mesma transação.

**Technical actions:**

1. Criar `src/subscriptions/subscriptions.service.ts` com `subscribe(userId, channel)` e `unsubscribe(userId, channel)`: `subscribe` recusa o próprio canal (`DomainException` `CANNOT_SUBSCRIBE_OWN_CHANNEL`, 422); numa transação, `INSERT … ON CONFLICT DO NOTHING RETURNING` → `subscriber_count + 1` só se a linha entrou; `DELETE … RETURNING` → `subscriber_count - 1` só se a linha saiu; devolve `SubscriptionStateResponse` relendo o contador (per `### Data Model → Escrita dos contadores`; `social-interactions/TD-02`, `TD-03`).
2. Criar `SubscriptionStateResponse` em `src/subscriptions/dto/` com `@ApiProperty` e a constante do código de erro em `src/subscriptions/subscriptions.constants.ts` (per `### API Contracts → Shapes compartilhados`; `### Error Catalog`).
3. Criar `src/subscriptions/channel-subscription.controller.ts` (`@Controller('channels')`) com `PUT /:nickname/subscription` e `DELETE /:nickname/subscription` (JWT obrigatório, `@HttpCode(200)`); canal inexistente → 404 `CHANNEL_NOT_FOUND`; decorators Swagger 200/401/404/422 (per `### API Contracts → PUT /channels/{nickname}/subscription`; `nestjs-controllers.md`).
4. Criar `src/subscriptions/subscriptions.module.ts` (entidade `Subscription` + leitura de `Channel` por nickname sem importar o `ChannelsModule`, para o `ChannelsModule`/`VideosModule` poderem importá-lo em SI-06.4 sem ciclo) e registrá-lo no `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `SubscriptionsService` | Unit (repos mockados): próprio canal → `CANNOT_SUBSCRIBE_OWN_CHANNEL`; `subscribe` já inscrito não incrementa | `src/subscriptions/subscriptions.service.spec.ts` |
| `SubscriptionsService` | Integration (DB real): inscrever/desinscrever ajusta `subscriber_count`; chamadas repetidas e paralelas do mesmo usuário terminam com contador == `COUNT(*)` | `src/subscriptions/subscriptions.service.integration-spec.ts` |
| `SubscriptionsModule` | Unit: compilation test | `src/subscriptions/subscriptions.module.spec.ts` |

**Dependencies:** SI-06.1.2 (entidades)

**Acceptance criteria:**

- `PUT /channels/{nickname}/subscription` de outro usuário retorna `200` com `{ subscribed: true, subscriber_count: 1 }`; repetir retorna o mesmo corpo
- `DELETE /channels/{nickname}/subscription` retorna `200` com `{ subscribed: false, subscriber_count: 0 }`; repetir retorna o mesmo corpo
- `PUT` no próprio canal retorna `422` com `error: "CANNOT_SUBSCRIBE_OWN_CHANNEL"`
- Nickname inexistente retorna `404` com `error: "CHANNEL_NOT_FOUND"`; sem `Authorization` retorna `401`

---

### SI-06.4 — Estado do espectador em GET /videos/{publicId} e GET /channels/{nickname}

**Route:** GET /videos/{publicId}, GET /channels/{nickname}
**Test Specs:** see `nestjs-project/specs/social-viewer-state.plan.md`
**Authorization:** Público com auth opcional — per `### Authorization Matrix` (anônimo recebe `viewer_*` = `null`/`false`; regra de visibilidade inalterada)

**Description:** Entregar nas leituras que as páginas já fazem a reação do espectador, se ele segue o canal e a contagem de inscritos, sem chamadas extras.

**Technical actions:**

1. Exportar de `ReactionsModule` `VideoReactionsService.findViewerReaction(videoId, userId?)` e de `SubscriptionsModule` `SubscriptionsService.isSubscribed(userId?, channelId)` — consultas por PK; sem usuário → `null`/`false` (per `social-interactions/TD-04`).
2. Criar `VideoChannel` (`{ nickname, name, subscriber_count, viewer_subscribed }`) em `src/videos/dto/video-response.dto.ts`, trocar o tipo de `VideoResponse.channel` para ele e adicionar `viewer_reaction: ReactionValue | null`; manter `VideoCardChannel` intacto nas listagens (per `### API Contracts → Shapes compartilhados`).
3. No `VideosService` (montagem do `VideoResponse`), importar `ReactionsModule` + `SubscriptionsModule` no `VideosModule` e preencher `viewer_reaction`, `channel.subscriber_count` e `channel.viewer_subscribed` a partir do usuário opcional já recebido pelo `GET /videos/:publicId` (per `### API Contracts → GET /videos/{publicId}`).
4. Em `GET /channels/:nickname`, passar a ler o usuário opcional (`@OptionalUser()`), adicionar `subscriber_count` e `viewer_subscribed` a `ChannelPublicResponse` e importar `SubscriptionsModule` no `ChannelsModule`; atualizar os decorators Swagger (per `### API Contracts → GET /channels/{nickname}`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService` (montagem do `VideoResponse`) | Integration (DB real): com reação e inscrição do usuário → `viewer_reaction` e `viewer_subscribed` preenchidos; anônimo → `null`/`false`; `subscriber_count` refletindo `channels` | `src/videos/videos.service.integration-spec.ts` (estender) |
| `ChannelsService` (leitura pública) | Integration (DB real): `subscriber_count` e `viewer_subscribed` para inscrito, não inscrito e anônimo | `src/channels/channels.service.integration-spec.ts` (estender) |

**Dependencies:** SI-06.2 (`ReactionsModule`), SI-06.3 (`SubscriptionsModule`)

**Acceptance criteria:**

- `GET /videos/{publicId}` anônimo retorna `viewer_reaction: null` e `channel` com `subscriber_count` e `viewer_subscribed: false`
- Depois de `PUT …/reaction { "value": "like" }` e `PUT /channels/{nickname}/subscription`, o mesmo `GET` com o `Bearer` do usuário retorna `viewer_reaction: "like"` e `channel.viewer_subscribed: true`
- `GET /channels/{nickname}` anônimo retorna `subscriber_count` e `viewer_subscribed: false`; com o `Bearer` de um inscrito, `viewer_subscribed: true`
- As listagens (`GET /channels/{nickname}/videos`, `/related`) continuam devolvendo `channel` como `{ nickname, name }`

---

### SI-06.5 — Endpoints de comentários: GET/POST /videos/{publicId}/comments, PATCH/DELETE /comments/{commentId}

**Route:** GET /videos/{publicId}/comments, POST /videos/{publicId}/comments, PATCH /comments/{commentId}, DELETE /comments/{commentId}
**Test Specs:** see `nestjs-project/specs/comments.plan.md`
**Authorization:** Listagem pública com auth opcional; criar exige sessão; editar/excluir só o autor — per `### Authorization Matrix` (vídeo não `published` → 404 inclusive para o dono)

**Description:** Comentar em vídeos publicados, listar as raízes paginadas por `latest`/`top` e permitir ao autor editar e excluir, mantendo `comment_count`/`reply_count` na mesma transação.

**Technical actions:**

1. Criar `src/comments/comments.service.ts` com `create(video, userId, text)` (raiz; `videos.comment_count + 1`), `update(commentId, userId, text)` (só o autor, senão `COMMENT_FORBIDDEN` 403; grava `edited_at`) e `remove(commentId, userId)` (só o autor; raiz → `comment_count - (1 + reply_count)` e cascata das respostas; resposta → `comment_count - 1` e `reply_count - 1` na raiz), tudo transacional; comentário de vídeo não `published` → `COMMENT_NOT_FOUND` (per `### Data Model → Escrita dos contadores`; `social-interactions/TD-02`, `TD-07`).
2. Em `CommentsService.listRoots(video, { sort, cursor, limit }, viewerId?)`: keyset com `encodeCursor`/`decodeCursor` (nomes de ordenação `latest` e `top`; `top` = `like_count DESC, created_at DESC, id DESC`), só `parent_id IS NULL`; `author` = `{ nickname, name }` do canal do autor; `viewer_reaction` em lote por uma leitura de `comment_reactions` dos ids da página (método de leitura exportado pelo `ReactionsModule`, criado aqui) e `viewer_is_author` (per `### API Contracts → GET /videos/{publicId}/comments`; `TD-06`, Revisions 2026-10-20).
3. Criar em `src/comments/dto/` `CreateCommentDto`/`UpdateCommentDto` (`text` com `@Transform` de `trim` + `@IsString @Length(1, 2000)`), `ListCommentsQuery` (`sort` `@IsIn(['latest','top'])` default `latest`, `cursor`, `limit` 1..50 default 20), `CommentResponse` e `CommentsPage` com `@ApiProperty`; códigos `COMMENT_NOT_FOUND`/`COMMENT_FORBIDDEN` em `src/comments/comments.constants.ts` (per `### API Contracts → Validation Rules`; `### Error Catalog`).
4. Criar `src/comments/video-comments.controller.ts` (`@Controller('videos')`: `GET /:publicId/comments` `@Public()` + `@OptionalUser()`, `POST /:publicId/comments` com JWT e `201`) e `src/comments/comments.controller.ts` (`@Controller('comments')`: `PATCH /:commentId`, `DELETE /:commentId` com `204`); vídeo resolvido por `public_id` exigindo `published` (senão 404 `VIDEO_NOT_FOUND`); `commentId` malformado → 404; decorators Swagger por status (per `### API Contracts`; `nestjs-controllers.md`).
5. Criar `src/comments/comments.module.ts` (entidade `Comment`, importa `ReactionsModule` para o `viewer_reaction`) e registrá-lo no `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `CommentsService` | Unit (repos mockados): editar/excluir por não autor → `COMMENT_FORBIDDEN`; vídeo não publicado → `COMMENT_NOT_FOUND`; decremento de raiz usa `1 + reply_count` | `src/comments/comments.service.spec.ts` |
| `CommentsService` | Integration (DB real): criar soma `comment_count`; excluir raiz com 2 respostas tira 3 e apaga respostas e reações; `listRoots` por `latest` e `top` com cursor sem repetir nem pular itens; `viewer_reaction`/`viewer_is_author` por espectador | `src/comments/comments.service.integration-spec.ts` |
| `CreateCommentDto` | Unit: `trim` aplicado; vazio, só espaços e 2.001 caracteres recusados; 2.000 aceito | `src/comments/dto/create-comment.dto.spec.ts` |
| `CommentsModule` | Unit: compilation test | `src/comments/comments.module.spec.ts` |

**Dependencies:** SI-06.1.2 (entidades), SI-06.2 (`ReactionsModule`)

**Acceptance criteria:**

- `POST /videos/{publicId}/comments` com `{ "text": "  Ótimo vídeo  " }` retorna `201` com `text: "Ótimo vídeo"`, `parent_id: null`, `viewer_is_author: true`, e o `comment_count` do vídeo soma 1
- `{ "text": "   " }` ou 2.001 caracteres retorna `400` com `error: "VALIDATION_ERROR"`; sem `Authorization` retorna `401`
- `GET /videos/{publicId}/comments?sort=top` retorna as raízes por `like_count` decrescente com `next_cursor`; seguir o cursor não repete itens; `?sort=newest` retorna `400`
- `GET /videos/{publicId}/comments` de um rascunho retorna `404` com `error: "VIDEO_NOT_FOUND"` mesmo com o `Bearer` do dono
- `PATCH /comments/{commentId}` pelo autor retorna `200` com o texto novo e `edited_at` preenchido; por outro usuário retorna `403` com `error: "COMMENT_FORBIDDEN"`
- `DELETE /comments/{commentId}` de uma raiz com 2 respostas retorna `204`, a raiz e as respostas somem e `comment_count` cai 3
- `DELETE /comments/{id-inexistente}` retorna `404` com `error: "COMMENT_NOT_FOUND"`

---

### SI-06.6 — Endpoints de respostas: GET/POST /comments/{commentId}/replies

**Route:** GET /comments/{commentId}/replies, POST /comments/{commentId}/replies
**Test Specs:** see `nestjs-project/specs/comments-replies.plan.md`
**Authorization:** Listagem pública com auth opcional; responder exige sessão — per `### Authorization Matrix`

**Description:** Responder a comentários num único nível de aninhamento e listar as respostas de uma raiz sob demanda.

**Technical actions:**

1. Em `CommentsService`, `reply(commentId, userId, text)`: resolve a raiz (se `commentId` é uma resposta, usa o `parent_id` dela — um nível, per `social-interactions/TD-05`), grava a resposta e, na mesma transação, soma 1 a `comments.reply_count` da raiz e a `videos.comment_count` (per `### Data Model → Escrita dos contadores`).
2. Em `CommentsService`, `listReplies(rootId, { cursor, limit }, viewerId?)`: keyset por `created_at ASC, id ASC` sobre `parent_id = rootId`, com `viewer_reaction`/`viewer_is_author` como em `listRoots`; `commentId` que não é raiz → `COMMENT_NOT_FOUND` (per `### API Contracts → GET /comments/{commentId}/replies`; `TD-06`).
3. Adicionar ao `CommentsController` `GET /:commentId/replies` (`@Public()` + `@OptionalUser()`, `ListRepliesQuery` com `cursor` e `limit` 1..50 default 20) e `POST /:commentId/replies` (JWT, `201`, `CreateCommentDto`), com decorators Swagger (per `### API Contracts → POST /comments/{commentId}/replies`; `nestjs-controllers.md`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `CommentsService.reply` / `listReplies` | Integration (DB real): responder a uma resposta grava `parent_id` = raiz; `reply_count` e `comment_count` somam 1; listagem cronológica com cursor; `GET …/replies` de uma resposta → `COMMENT_NOT_FOUND` | `src/comments/comments.service.integration-spec.ts` (estender) |
| `CommentsService.reply` | Unit (repos mockados): raiz resolvida a partir de uma resposta; vídeo não publicado → `COMMENT_NOT_FOUND` | `src/comments/comments.service.spec.ts` (estender) |

**Dependencies:** SI-06.5 (comentários raiz)

**Acceptance criteria:**

- `POST /comments/{raiz}/replies` com `{ "text": "Concordo" }` retorna `201` com `parent_id` = id da raiz; o `reply_count` da raiz e o `comment_count` do vídeo somam 1
- `POST /comments/{resposta}/replies` retorna `201` com `parent_id` = id da raiz (não o da resposta)
- `GET /comments/{raiz}/replies` retorna as respostas da mais antiga para a mais nova, com `next_cursor` quando houver mais
- `GET /comments/{resposta}/replies` retorna `404` com `error: "COMMENT_NOT_FOUND"`
- `POST /comments/{commentId}/replies` sem `Authorization` retorna `401`

---

### SI-06.7 — Endpoints PUT/DELETE /comments/{commentId}/reaction

**Route:** PUT /comments/{commentId}/reaction, DELETE /comments/{commentId}/reaction
**Test Specs:** see `nestjs-project/specs/comments-reaction.plan.md`
**Authorization:** Autenticado — per `### Authorization Matrix` (raízes e respostas; vídeo não `published` → 404)

**Description:** Permitir curtir, descurtir e remover a reação a comentários e respostas com a mesma semântica e o mesmo protocolo de contadores das reações a vídeo.

**Technical actions:**

1. Criar `src/reactions/comment-reactions.service.ts` com `set(commentId, userId, value)`/`remove(commentId, userId)` reaproveitando `reactionTransition` e o mesmo protocolo de lock (`SELECT … FOR UPDATE` + `INSERT … ON CONFLICT DO NOTHING` com retry), somando os deltas a `comments.like_count`/`dislike_count`; devolve `ReactionStateResponse` (per `### Data Model → Escrita dos contadores`; `social-interactions/TD-01`, `TD-02`, `TD-03`).
2. Criar `src/reactions/comment-reactions.controller.ts` (`@Controller('comments')`) com `PUT /:commentId/reaction` e `DELETE /:commentId/reaction` (JWT, `@HttpCode(200)`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`); comentário inexistente ou de vídeo não `published` → 404 `COMMENT_NOT_FOUND`; decorators Swagger 200/400/401/404/429 (per `### API Contracts → PUT /comments/{commentId}/reaction`).
3. Registrar o serviço e o controller no `ReactionsModule` (leitura de `Comment` via `forFeature`, sem importar o `CommentsModule`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `CommentReactionsService` | Unit (repos mockados): mesmo valor não escreve contador; `remove` sem reação não escreve | `src/reactions/comment-reactions.service.spec.ts` |
| `CommentReactionsService` | Integration (DB real): transições ajustam os contadores do comentário; 10 `set` paralelos do mesmo usuário terminam com contador == `COUNT(*)`; reagir a resposta funciona igual | `src/reactions/comment-reactions.service.integration-spec.ts` |

**Dependencies:** SI-06.2 (`reactionTransition`, `ReactionsModule`), SI-06.5 (comentários)

**Acceptance criteria:**

- `PUT /comments/{commentId}/reaction` com `{ "value": "like" }` retorna `200` com `{ viewer_reaction: "like", like_count: 1, dislike_count: 0 }`; repetir não muda os contadores
- `DELETE /comments/{commentId}/reaction` retorna `200` com `viewer_reaction: null` e o contador volta
- Depois, `GET /videos/{publicId}/comments` com o `Bearer` do usuário mostra `viewer_reaction` e `like_count` coerentes no item
- `PUT` em comentário inexistente retorna `404` com `error: "COMMENT_NOT_FOUND"`; sem `Authorization` retorna `401`

---

### SI-06.8 — Endpoints GET /me/subscriptions e GET /me/subscriptions/videos

**Route:** GET /me/subscriptions, GET /me/subscriptions/videos
**Test Specs:** see `nestjs-project/specs/me-subscriptions.plan.md`
**Authorization:** Autenticado — per `### Authorization Matrix` (cada usuário só lê as próprias inscrições e o próprio feed)

**Description:** Dar à área de canais seguidos a lista de canais (em ordem alfabética) e o feed cronológico dos vídeos públicos desses canais.

**Technical actions:**

1. Em `SubscriptionsService`, `listChannels(userId, { cursor, limit })`: join `subscriptions` → `channels` ordenado por `channels.name ASC, channels.id ASC` em keyset (nome de ordenação `name` no `encodeCursor`/`decodeCursor`), itens `VideoCardChannel` (`{ nickname, name }`) (per `### API Contracts → GET /me/subscriptions`; `social-interactions/TD-08`, Revisions 2026-10-20).
2. Criar `src/subscriptions/me-subscriptions.controller.ts` (`@Controller('me/subscriptions')`) com `GET /` (JWT, `limit` 1..50 default 20, `cursor`) devolvendo `SubscribedChannelsPage`, com decorators Swagger.
3. Em `VideosListingService`, `listSubscriptionFeed(userId, { cursor, limit })`: vídeos com `status = published`, `visibility = public`, `processing_status = ready` cujo `channel_id` está em `subscriptions` do usuário (join na leitura, sem fan-out na escrita), por `published_at DESC, id DESC` em keyset (`latest`), mapeados para `VideoCardItem` (per `### API Contracts → GET /me/subscriptions/videos`; `TD-08`; `video-channel-management/TD-06`).
4. Criar `src/videos/subscription-feed.controller.ts` (`@Controller('me/subscriptions')`) com `GET /videos` (JWT) devolvendo `SubscriptionFeedPage`; criar `SubscribedChannelsPage`/`SubscriptionFeedPage` com `@ApiProperty` e registrar os controllers nos módulos (per `### API Contracts → Shapes compartilhados`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `SubscriptionsService.listChannels` | Integration (DB real): ordem alfabética com desempate por id; cursor sem repetir; só as inscrições do usuário | `src/subscriptions/subscriptions.service.integration-spec.ts` (estender) |
| `VideosListingService.listSubscriptionFeed` | Integration (DB real): só vídeos `published` + `public` + `ready` de canais seguidos, mais recentes primeiro; exclui unlisted, rascunho e canais não seguidos; cursor estável | `src/videos/videos-listing.service.integration-spec.ts` (estender) |

**Dependencies:** SI-06.3 (`SubscriptionsService`)

**Acceptance criteria:**

- `GET /me/subscriptions?limit=7` de um usuário que segue 9 canais retorna os 7 primeiros por nome e um `next_cursor`; a página seguinte traz os 2 restantes e `next_cursor: null`
- `GET /me/subscriptions/videos` retorna só vídeos públicos e prontos dos canais seguidos, do mais recente ao mais antigo
- Um vídeo unlisted ou rascunho de um canal seguido não aparece no feed
- Os dois endpoints sem `Authorization` retornam `401`; `?limit=0` retorna `400` com `error: "VALIDATION_ERROR"`

---

### SI-06.9 — Sincronizar contrato OpenAPI, aliases e handlers MSW

**Description:** Levar os contratos novos e modificados do backend ao frontend pela cadeia OpenAPI e dar ao MSW os handlers e o estado que os testes do BFF e o E2E das três telas consomem.

**Technical actions:**

1. Rodar a cadeia completa: `docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` → `docker compose exec next-frontend npm run openapi:types` (regenera `lib/api/types.gen.ts`, nunca editado à mão) (per `next-frontend-openapi-typing/TD-01`, `TD-02`, `TD-03`; `openapi-docs-nestjs/TD-02`).
2. Adicionar a `lib/api/contracts.ts` os aliases `ReactionValue`, `ReactionState`, `SubscriptionState`, `Comment`, `CommentsPage`, `SubscribedChannelsPage` e `SubscriptionFeedPage`; `Video` e `ChannelPublic` passam a carregar os campos novos pelo tipo gerado (per `next-frontend-openapi-typing/TD-04`).
3. Estender `mocks/store.ts` e `mocks/factories/` com reações, comentários (com respostas), inscrições e `subscriber_count`, resetados pelo `POST /auth/login` como o resto do store; seed com comentários em `published-01` (raízes com e sem respostas) e o usuário do store seguindo `tech_mastery` (per `next-frontend-msw-foundation/TD-03`).
4. Criar `mocks/handlers/comments.ts` (comentários, respostas, edição/exclusão, reações a comentário) e `mocks/handlers/subscriptions.ts` (inscrição, `/me/subscriptions`, feed) e estender `mocks/handlers/videos.ts` (reação ao vídeo, `viewer_reaction` e `channel.subscriber_count`/`viewer_subscribed` em `GET /videos/{publicId}`) e `mocks/handlers/channels.ts` (`subscriber_count`/`viewer_subscribed`), todos ligados ao barrel e com as mesmas regras do backend (publicado, autoria → 403, próprio canal → 422) (per `next-frontend-msw-foundation/TD-01`, `TD-04`; `next-frontend-openapi-typing/TD-05`).
5. Documentar os triggers novos na seção "E2E architecture" do `next-frontend/CLAUDE.md` (ex.: inscrever-se no canal do próprio store → 422; comentário de outro autor no seed para provar a ausência do menu "⋮").

**Tests:** _(empty — contract sync; os handlers são exercitados pelos testes de integração do BFF de SI-06.10/SI-06.11 e pelas specs das telas)_

**Dependencies:** SI-06.4, SI-06.5, SI-06.6, SI-06.7, SI-06.8 (contratos do backend)

**Acceptance criteria:**

- `nestjs-project/openapi.json` e `next-frontend/openapi.json` são idênticos e contêm as rotas de reação, inscrição, comentários, respostas e `/me/subscriptions*`
- `lib/api/types.gen.ts` regenerado compila (`docker compose exec next-frontend npx tsc --noEmit`) e o check de frescor do OpenAPI passa
- Com MSW, `GET /videos/published-01/comments` devolve `{ items, next_cursor }` com os comentários do seed e `PUT /channels/{nickname-do-store}/subscription` devolve `422` com `error: "CANNOT_SUBSCRIBE_OWN_CHANNEL"`
- Com MSW, `PUT /videos/published-01/reaction` seguido de `GET /videos/published-01` com `Bearer` devolve `viewer_reaction: "like"`

---

### SI-06.10 — Route Handlers BFF de reação e inscrição

**Route:** PUT|DELETE /api/videos/{publicId}/reaction, PUT|DELETE /api/comments/{commentId}/reaction, PUT|DELETE /api/channels/{nickname}/subscription
**Authorization:** Sessão `iron-session` obrigatória — sem sessão, 401 `UNAUTHORIZED` sem chamar o upstream; o resto da regra fica com o upstream — per `### Authorization Matrix`

**Description:** Expor aos botões otimistas as mutações set-state de reação e inscrição pelo BFF, repassando o estado resultante sem reshape.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/reaction/route.ts` com `PUT` (corpo via `readJson`/`invalidBody`) e `DELETE` → `withSession((headers) => upstream.PUT|DELETE("/videos/{publicId}/reaction", …))`, pass-through de `200`/`400`/`404`/`429` (per `### API Contracts → BFF tier → PUT /api/videos/{publicId}/reaction`; `phase-02-auth-frontend/TD-03`, `TD-05`).
2. Criar `app/api/comments/[commentId]/reaction/route.ts` com `PUT`/`DELETE` → `upstream.PUT|DELETE("/comments/{commentId}/reaction", …)`, mesmo tratamento (per `### API Contracts → BFF tier → PUT /api/comments/{commentId}/reaction`).
3. Criar `app/api/channels/[nickname]/subscription/route.ts` com `PUT`/`DELETE` → `upstream.PUT|DELETE("/channels/{nickname}/subscription", …)`, pass-through de `200`/`404`/`422` (per `### API Contracts → BFF tier → PUT /api/channels/{nickname}/subscription`); exportar o tipo de contexto `{ params: Promise<{ commentId }> }`/`{ nickname }` ao lado do `PublicIdContext` em `lib/api/bff.ts`.
4. Atualizar a árvore de `app/api/**` no `next-frontend/CLAUDE.md` com as rotas novas.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `PUT|DELETE /api/videos/{publicId}/reaction` | Integration (route como função + MSW): sem sessão → `401` sem chamar o upstream; com sessão → `Bearer` repassado e `200` com o estado; JSON inválido → `400`; `404`/`429` pass-through | `app/api/videos/[publicId]/reaction/__tests__/route.integration.test.ts` |
| `PUT|DELETE /api/comments/{commentId}/reaction` | Integration (route como função + MSW): mesmos casos; `404 COMMENT_NOT_FOUND` pass-through | `app/api/comments/[commentId]/reaction/__tests__/route.integration.test.ts` |
| `PUT|DELETE /api/channels/{nickname}/subscription` | Integration (route como função + MSW): sem sessão → `401`; `200` com `{ subscribed, subscriber_count }`; `422 CANNOT_SUBSCRIBE_OWN_CHANNEL` e `404` pass-through; upstream `401` → refresh e nova tentativa | `app/api/channels/[nickname]/subscription/__tests__/route.integration.test.ts` |

**Dependencies:** SI-06.9 (tipos + handlers MSW)

**Acceptance criteria:**

- `PUT /api/videos/{publicId}/reaction` sem cookie de sessão retorna `401` com `error: "UNAUTHORIZED"` e o upstream não é chamado
- Com sessão, `PUT /api/videos/{publicId}/reaction` com `{ "value": "dislike" }` retorna `200` com `viewer_reaction: "dislike"`
- `PUT /api/channels/{nickname}/subscription` no canal do próprio usuário retorna `422` com `error: "CANNOT_SUBSCRIBE_OWN_CHANNEL"`
- `DELETE /api/comments/{commentId}/reaction` de um comentário inexistente retorna `404` com `error: "COMMENT_NOT_FOUND"`

---

### SI-06.11 — Route Handlers BFF de comentários, respostas e canais seguidos

**Route:** GET|POST /api/videos/{publicId}/comments, PATCH|DELETE /api/comments/{commentId}, GET|POST /api/comments/{commentId}/replies, GET /api/me/subscriptions
**Authorization:** Leituras de comentários/respostas com sessão opcional (`withOptionalSession`); mutações e `/api/me/subscriptions` com sessão obrigatória (`withSession`, 401 sem chamar o upstream) — per `### Authorization Matrix`

**Description:** Expor ao cliente as páginas seguintes de comentários, respostas e canais seguidos e as mutações de comentário pelo BFF.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/comments/route.ts`: `GET` → `withOptionalSession` repassando `sort`/`cursor`/`limit`; `POST` → `withSession` com corpo via `readJson`/`invalidBody`; pass-through (per `### API Contracts → BFF tier → GET|POST /api/videos/{publicId}/comments`; `social-interactions/TD-09`).
2. Criar `app/api/comments/[commentId]/route.ts`: `PATCH` (corpo) e `DELETE` → `withSession`, pass-through de `200`/`204`/`400`/`403`/`404` (per `### API Contracts → BFF tier → PATCH /api/comments/{commentId}`).
3. Criar `app/api/comments/[commentId]/replies/route.ts`: `GET` → `withOptionalSession` (`cursor`/`limit`); `POST` → `withSession` com corpo (per `### API Contracts → BFF tier → GET|POST /api/comments/{commentId}/replies`).
4. Criar `app/api/me/subscriptions/route.ts`: `GET` → `withSession` repassando `cursor`/`limit` (per `### API Contracts → BFF tier → GET /api/me/subscriptions`; `TD-08`, Revisions 2026-10-20) e atualizar a árvore de `app/api/**` no `next-frontend/CLAUDE.md`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `GET|POST /api/videos/{publicId}/comments` | Integration (route como função + MSW): `GET` anônimo → `200` com a página; query repassada; com sessão → `Bearer`; `POST` sem sessão → `401`; `POST` com JSON inválido → `400`; `404 VIDEO_NOT_FOUND` pass-through | `app/api/videos/[publicId]/comments/__tests__/route.integration.test.ts` |
| `PATCH|DELETE /api/comments/{commentId}` | Integration (route como função + MSW): autor → `200`/`204`; não autor → `403 COMMENT_FORBIDDEN` pass-through; sem sessão → `401` | `app/api/comments/[commentId]/__tests__/route.integration.test.ts` |
| `GET|POST /api/comments/{commentId}/replies` | Integration (route como função + MSW): `GET` anônimo com cursor; `POST` com sessão → `201`; `404 COMMENT_NOT_FOUND` pass-through | `app/api/comments/[commentId]/replies/__tests__/route.integration.test.ts` |
| `GET /api/me/subscriptions` | Integration (route como função + MSW): sem sessão → `401`; com sessão → página de canais com `cursor` repassado | `app/api/me/subscriptions/__tests__/route.integration.test.ts` |

**Dependencies:** SI-06.9 (tipos + handlers MSW)

**Acceptance criteria:**

- `GET /api/videos/{publicId}/comments?sort=top&cursor=…` sem cookie de sessão retorna `200` com a página seguinte vinda do upstream
- `POST /api/videos/{publicId}/comments` sem cookie de sessão retorna `401` com `error: "UNAUTHORIZED"` e o upstream não é chamado
- `PATCH /api/comments/{commentId}` de um comentário alheio retorna `403` com `error: "COMMENT_FORBIDDEN"`
- `GET /api/comments/{commentId}/replies` sem sessão retorna `200` com as respostas
- `GET /api/me/subscriptions?cursor=…` com sessão retorna `200` com `{ items, next_cursor }`

---

### SI-06.12 — Mutação otimista e contexto de inscrições (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### social-interactions/TD-09 — Estratégia de dados do frontend para as interações (reavaliação de video-channel-management/TD-12)`

**Technical actions:**

1. Nenhuma biblioteca nova: `useOptimistic`/`startTransition` vêm do React 19 instalado (per `social-interactions/TD-09`; guia `node_modules/next/dist/docs/01-app/02-guides/forms.md` § "Optimistic updates").
2. Implementar o **Setup snippet** byte-verbatim em `hooks/use-optimistic-mutation.ts` (estado confirmado + `useOptimistic` + `run(next, request)` com reconciliação pela resposta e toast no erro), estendendo com o boilerplate derivável (`"use client"`, imports, `messageFor` mapeando 401/404/429 para as mensagens do Error Catalog → UX mapping).
3. Implementar `components/layout/subscriptions-provider.tsx` (`SubscriptionsProvider initial={…}` + hook `useSubscriptions()` com `channels`, `onChange(channel, subscribed)` que insere em ordem alfabética ou remove, e `loadMore()` via `GET /api/me/subscriptions?cursor=`), conforme o snippet (per `### Frontend Runtime → Setup`; `TD-08`, Revisions 2026-10-20).

**Dependencies:** —

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Acceptance criteria:**

- `hooks/use-optimistic-mutation.ts` e `components/layout/subscriptions-provider.tsx` existem e o conteúdo F2 do Setup snippet (`useOptimistic(confirmed, …)`, `startTransition` em volta do `setConfirmed` após o `await`, `<SubscriptionsProvider initial={…}>`) está presente byte-verbatim
- `docker compose exec next-frontend npx tsc --noEmit` passa com os dois arquivos
- Nenhuma dependência nova em `next-frontend/package.json`

---

### SI-06.13 — Componentes otimistas de reação e inscrição

**Description:** Author os botões que reagem e inscrevem com estado otimista — compartilhados pela watch page e pela página do canal — sobre o hook de SI-06.12 e as rotas BFF de SI-06.10.

**Technical actions:**

1. Author `components/channel/subscribe-button.tsx` per UI Contract (Watch page → `SubscribeButton`): pill "Subscribe" ↔ "Subscribed" com `aria-pressed`, `useOptimisticMutation` sobre `PUT|DELETE /api/channels/{nickname}/subscription` reconciliando `{ subscribed, subscriber_count }`; chama `useSubscriptions().onChange` só após a confirmação; expõe a contagem confirmada ao chamador (callback) para a linha "N subscribers"; anônimo → `/login?returnTo=` da página atual; não renderiza para o dono (per `social-interactions/TD-03`, `TD-09`, `TD-10`).
2. Author `components/watch/video-reaction-buttons.tsx` per UI Contract (Watch page → `Par like/dislike do vídeo`): pill segmentada, like com contagem compacta e dislike sem contagem, ícones preenchidos no estado ativo; clicar no ativo envia `DELETE`, no outro envia `PUT { value }`, via `/api/videos/{publicId}/reaction` (per `TD-03`, `TD-04`, `TD-09`).
3. Author `components/comments/comment-reaction-buttons.tsx` per UI Contract (Watch page → `Like/dislike do comentário`): mesma mecânica sobre `/api/comments/{commentId}/reaction`, ícones pequenos sem fundo, like com contagem e dislike sem.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `subscribe-button.tsx` | Unit per testing-guide-next-frontend § "Client Components" (RTL + MSW na rota BFF): otimista imediato; reconciliação pela resposta; erro → volta ao confirmado + toast; anônimo → navegação para login com `returnTo`; oculto para o dono; contexto atualizado só após 200 | `components/channel/__tests__/subscribe-button.test.tsx` |
| `video-reaction-buttons.tsx` | Unit (RTL + MSW): like/dislike/remover enviam o verbo certo; `aria-pressed`; contagem reconciliada; `429` reverte com toast | `components/watch/__tests__/video-reaction-buttons.test.tsx` |
| `comment-reaction-buttons.tsx` | Unit (RTL + MSW): mesmas transições sobre a rota do comentário; anônimo → login | `components/comments/__tests__/comment-reaction-buttons.test.tsx` |

**Dependencies:** SI-06.0.2 (ícones preenchidos), SI-06.10 (rotas BFF), SI-06.12 (hook + contexto)

**Acceptance criteria:**

- Clicar em "Subscribe" mostra "Subscribed" antes da resposta e, após `200`, a contagem exibida é a `subscriber_count` devolvida
- Com a rota respondendo `500`, o botão volta a "Subscribe" e um toast de erro aparece
- Clicar em like com dislike ativo envia `PUT` com `{ "value": "like" }`; clicar em like ativo envia `DELETE`
- Um anônimo que clica em qualquer um dos três controles é levado a `/login?returnTo=<página atual>` sem nenhuma chamada à API
- O `SubscribeButton` não é renderizado quando o espectador é o dono do canal

---

### SI-06.14 — Seção de comentários (lista, respostas e mutações no cliente)

**Description:** Author a seção de comentários da watch page — primeira página vinda do RSC, paginação, respostas sob demanda, criação, edição e exclusão em estado local via BFF, sem `router.refresh()`.

**Technical actions:**

1. Author `components/comments/comment-section.tsx` per UI Contract (Watch page → `Seção de comentários`): recebe `publicId`, `commentCount` e a primeira página do RSC; cabeçalho "N Comments" (número completo com separador de milhar) + `CommentSortMenu` + `CommentComposer`; ao trocar a ordem, busca `GET /api/videos/{publicId}/comments?sort=` e substitui a lista; comentário criado entra no topo (em `latest`) e soma 1 ao cabeçalho (per `social-interactions/TD-06`, `TD-09`).
2. Author `components/comments/comment-list.tsx` per UI Contract (Watch page → `Lista de comentários`): renderiza `CommentItem` com `CommentReactionButtons`, "Reply", `CommentActionsMenu` (via `viewer_is_author`) e `CommentReplies` nos slots; "Show more comments" com `next_cursor`; edição troca o texto pelo `CommentComposer` e aplica a resposta do `PATCH`; exclusão (`DELETE`) remove o item e desconta `1 + reply_count` do cabeçalho; estado vazio (per `TD-05`, `TD-07`; resolução OQ-2).
3. Author `components/comments/comment-replies.tsx` per UI Contract (Watch page → `Alternância "N replies" / respostas`): "N replies" com `aria-expanded`, carrega `GET /api/comments/{commentId}/replies` na primeira abertura e mantém o carregado ao recolher; "Show more replies"; composer de resposta (`@nickname` pré-preenchido ao responder uma resposta) que anexa o `201` ao fim da thread e soma 1 a `reply_count` e ao cabeçalho (per `TD-05`, `TD-06`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `comment-section.tsx` | Unit per testing-guide-next-frontend § "Client Components" (RTL + MSW nas rotas BFF): troca de ordem refaz a primeira página; criar insere no topo e soma 1; falha da criação mantém o texto e mostra erro | `components/comments/__tests__/comment-section.test.tsx` |
| `comment-list.tsx` | Unit (RTL + MSW): "Show more" anexa e some sem `next_cursor`; menu só para `viewer_is_author`; editar aplica `edited_at`; excluir raiz desconta `1 + reply_count`; `COMMENT_NOT_FOUND` remove o item + toast | `components/comments/__tests__/comment-list.test.tsx` |
| `comment-replies.tsx` | Unit (RTL + MSW): carrega na primeira abertura e não recarrega ao reabrir; responder anexa ao fim e soma `reply_count`; responder uma resposta pré-preenche `@nickname` | `components/comments/__tests__/comment-replies.test.tsx` |

**Dependencies:** SI-06.0.3 (`comment-item`, `comment-sort-menu`), SI-06.0.4 (`comment-composer`), SI-06.0.5 (`comment-actions-menu`), SI-06.11 (rotas BFF), SI-06.13 (`comment-reaction-buttons`)

**Acceptance criteria:**

- Escolher "Top" no seletor recarrega a lista com a ordem do upstream e descarta as páginas carregadas antes
- Publicar um comentário o mostra no topo da lista e o cabeçalho passa de "N Comments" para "N+1 Comments" sem recarregar a página
- "Show more comments" anexa a próxima página e desaparece quando `next_cursor` é `null`
- Abrir "N replies" busca as respostas uma única vez; responder anexa a resposta ao fim da thread
- Excluir uma raiz com 2 respostas a remove da lista e o cabeçalho cai 3
- O menu "⋮" não aparece em comentários de outros autores

---

### SI-06.15 — Lista de canais seguidos no menu lateral

**Description:** Author a seção "Subscriptions" do menu lateral, ligada ao contexto de inscrições, com os 7 primeiros canais e "Show more".

**Technical actions:**

1. Author `components/layout/side-nav-subscriptions.tsx` per UI Contract (Channel Show → `SideNav subscriptions list`): título "Subscriptions" + lista de `ChannelAvatar` (iniciais) + nome com link para `/channel/{nickname}`, lida de `useSubscriptions()`; "Show more" chama `loadMore()` (`GET /api/me/subscriptions?cursor=`) e some sem cursor; estado vazio em texto muted; destaque do canal da rota atual (per `social-interactions/TD-08`, Revisions 2026-10-20; `TD-09`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `side-nav-subscriptions.tsx` | Unit per testing-guide-next-frontend § "Client Components" (RTL + MSW na rota BFF, dentro do `SubscriptionsProvider`): renderiza os canais iniciais em ordem; "Show more" anexa e some; `onChange` do contexto insere/remove um canal em ordem alfabética; estado vazio | `components/layout/__tests__/side-nav-subscriptions.test.tsx` |

**Dependencies:** SI-06.0.1 (`side-nav`), SI-06.11 (`GET /api/me/subscriptions`), SI-06.12 (`SubscriptionsProvider`)

**Acceptance criteria:**

- Com 9 inscrições, a seção mostra 7 canais em ordem alfabética e um "Show more"; clicar nele mostra os 9 e o botão some
- Inscrever-se num canal pelo `SubscribeButton` faz o canal aparecer na lista na posição alfabética sem recarregar a página; desinscrever o remove
- Sem inscrições, a seção mostra o estado vazio em vez da lista

---

### SI-06.16.0 — Drift audit: Página pública do canal — inscrição e menu lateral (Channel Show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 — sem Figma MCP: `docs/inventories/assets/phase-06/Channel Show.png` + `Left Menu.png` (resolução OQ-1)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal — inscrição e menu lateral (Channel Show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (sem MCP: comparar contra `Channel Show.png` e `Left Menu.png`)
   - Reused DS components: [`components/channel/channel-header.tsx`, `components/channel/channel-info.tsx`, `components/ui/button.tsx`, `components/channel/subscribe-button.tsx`, `components/ui/icon-button.tsx`, `components/layout/app-shell.tsx`, `components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/layout/side-nav-subscriptions.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`Channel Show — RSC da rota`, `channel info`, `SubscribeButton`, `SideNav subscriptions list`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/channel/[nickname]/page.tsx` + `app/(app)/layout.tsx` + `components/channel/*.tsx` + `components/layout/*.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Write a `## Screen: channel-show-social — audited at SI-06.16.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-06.0.1, SI-06.0.2, SI-06.13, SI-06.15

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: channel-show-social` exists with the current run's date in heading (appended on first run, overwritten in place on re-run per schema § Section ownership and update discipline).
- Every component in the Reused DS list has exactly one row in the table.
- Every row has a Decision column populated:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` or `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"`, or `CONFLICT: <one-liner>; <verb> "<specifics>"`
  - `componente ausente` → `create`
- Every `exception` decision carries a one-liner justification.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-06.16a — Tela de Página pública do canal — inscrição e menu lateral (visual shell)

**Route:** `/channel/{nickname}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal — inscrição e menu lateral (Channel Show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: channel-show-social`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics (esperado: meta row do `channel-info` com "N subscribers"; slot `actions` do `channel-header` com o Subscribe)
   - `create` → create the file (icons via Material Symbols per resolução OQ-4; components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (sem MCP: `Channel Show.png` + `Left Menu.png`)
   - Reused DS components: [`components/channel/channel-header.tsx`, `components/channel/channel-info.tsx`, `components/ui/button.tsx`, `components/channel/subscribe-button.tsx`, `components/layout/app-shell.tsx`, `components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/layout/side-nav-subscriptions.tsx`] _(now reflecting any DS edits from action 1; o sino 158:2691 não é renderizado)_
   - Server-connected component names (no endpoints/auth/errors): [`Channel Show — RSC da rota`, `channel info`, `SubscribeButton`, `SideNav subscriptions list`]
   - Target paths: `app/(app)/channel/[nickname]/page.tsx` + `components/channel/channel-info.tsx` + `components/channel/channel-header.tsx`

**Dependencies:** SI-06.16.0 + SI-06.0.1, SI-06.0.2

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `next-frontend` build command.
- Rendering matches Figma node fidelity within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-06.16b — Tela de Página pública do canal — inscrição e menu lateral (lógica & wiring)

**Test Specs:** see `next-frontend/specs/channel-social.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página pública do canal — inscrição e menu lateral (Channel Show)`

**Technical actions:**

1. **Route guard / app shell (Migração `app/(app)/layout.tsx`)** — criar o grupo de rotas `app/(app)/(shell)/` com `layout.tsx` que, **com sessão**, renderiza `AppShell` + `SideNav` (itens Home → `/`, Subscriptions → `/feed/subscriptions`, Your videos → `/studio/videos`, item ativo por `usePathname` num wrapper cliente) e `SubscriptionsProvider` semeado por `GET /me/subscriptions?limit=7` com o `Bearer` da sessão (falha → menu sem a seção de canais); mover `page.tsx` (home), `channel/` e `studio/` para dentro do grupo — URLs inalteradas; `watch/` fica fora (frame sem SideNav) (per `### Frontend Runtime → social-interactions/TD-09` Migração; `social-interactions/TD-08`, Revisions 2026-10-20).
2. **Rendering strategy application** — Server Component (RSC): a página do canal continua lendo `GET /channels/{nickname}` via `publicRead`, agora com `subscriber_count`/`viewer_subscribed` (per `### UI Contracts → Rendering strategy`; `TD-04`).
3. **Endpoint wiring (Migração `app/(app)/channel/[nickname]/page.tsx`)** — passar `subscriber_count` à meta row de `ChannelInfo` e montar `SubscribeButton` no slot `actions` do `ChannelHeader` com `viewer_subscribed`, oculto quando `session.channelSlug === nickname` (dono); a contagem exibida acompanha a resposta do Subscribe (per `### API Contracts → BFF tier → PUT /api/channels/{nickname}/subscription`; `TD-03`, `TD-10`).
4. **Error mapping** — per UI Contract `**Error Catalog → UX mapping:**`: `CHANNEL_NOT_FOUND` na leitura → `notFound()` (Fase 04); na mutação → toast e reverte; `UNAUTHORIZED` → `/login?returnTo=/channel/{nickname}`; `CANNOT_SUBSCRIBE_OWN_CHANNEL` → reverte.

**Dependencies:**

- `SI-06.16a` (visual shell must exist before wiring).
- Backend SIs: `SI-06.3`, `SI-06.4`, `SI-06.8` (inscrição, `subscriber_count`/`viewer_subscribed`, `/me/subscriptions`).
- Shared-types / BFF: `SI-06.9`, `SI-06.10`, `SI-06.11`; runtime e componentes: `SI-06.12`, `SI-06.13`, `SI-06.15`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/channel/channel-info.tsx` | Unit per testing-guide-next-frontend § "Client Components" — meta row "@nickname • N subscribers • N videos" com singular/plural e formato compacto | `components/channel/__tests__/channel-info.test.tsx` (estender) |
| `components/layout/side-nav-active.tsx` (wrapper cliente do item ativo) | Unit — o item da rota atual recebe `aria-current="page"` (`/feed/subscriptions` → Subscriptions; `/studio/*` → Your videos; `/` → Home) | `components/layout/__tests__/side-nav-active.test.tsx` |

E2E for the page (menu lateral com e sem sessão, inscrição refletida no menu, dono sem Subscribe) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `/channel/{nickname}` com sessão mostra o menu lateral com Home, Subscriptions, Your videos e até 7 canais seguidos; sem sessão, só o conteúdo
- `/channel/{nickname}` mostra "N subscribers" na meta row e o Subscribe no estado vindo de `viewer_subscribed`; o dono não vê o botão
- Inscrever-se no canal faz a contagem e a lista do menu lateral mudarem sem recarregar a página
- `/watch/{publicId}` continua sem menu lateral e `/studio/videos`, `/studio/channel` e `/` passam a tê-lo (com sessão), com as mesmas URLs de antes

---

### SI-06.17.0 — Drift audit: Página de visualização do vídeo — interações (Video show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 — sem Figma MCP: `docs/inventories/assets/phase-06/Video show.png` (resolução OQ-1)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo — interações (Video show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (sem MCP: comparar contra `Video show.png`)
   - Reused DS components: [`components/watch/video-channel-link.tsx`, `components/channel/subscribe-button.tsx`, `components/watch/video-reaction-buttons.tsx`, `components/icons/thumb-up-icon.tsx`, `components/icons/thumb-down-icon.tsx`, `components/comments/comment-section.tsx`, `components/comments/comment-sort-menu.tsx`, `components/comments/comment-composer.tsx`, `components/comments/comment-list.tsx`, `components/comments/comment-item.tsx`, `components/comments/comment-reaction-buttons.tsx`, `components/ui/button.tsx`, `components/comments/comment-replies.tsx`, `components/comments/comment-actions-menu.tsx`, `components/ui/dialog.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`Watch page — RSC da rota`, `Canal do vídeo — avatar + nome + inscritos`, `SubscribeButton`, `Par like/dislike do vídeo`, `Seção de comentários`, `Seletor "Sort by: Latest"`, `Composer "Add a comment…"`, `Lista de comentários`, `Item de comentário`, `Like/dislike do comentário`, `Composer de resposta`, `Alternância "N replies" / respostas`, `Menu "⋮" do comentário — Edit / Delete`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/watch/[publicId]/page.tsx` + `components/watch/*.tsx` + `components/comments/*.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions` (inclusive a seção da Fase 05 para a mesma tela e a seção `channel-show-social` desta fase); populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Write a `## Screen: watch-social — audited at SI-06.17.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-06.0.1, SI-06.0.2, SI-06.0.3, SI-06.0.4, SI-06.0.5, SI-06.13, SI-06.14

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: watch-social` exists with the current run's date in heading (appended on first run, overwritten in place on re-run per schema § Section ownership and update discipline).
- Every component in the Reused DS list has exactly one row in the table.
- Every row has a Decision column populated:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` or `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"`, or `CONFLICT: <one-liner>; <verb> "<specifics>"`
  - `componente ausente` → `create`
- Every `exception` decision carries a one-liner justification.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-06.17a — Tela de Página de visualização do vídeo — interações (visual shell)

**Route:** `/watch/{publicId}`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo — interações (Video show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: watch-social`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics (esperado: linha "N subscribers" no `video-channel-link`)
   - `create` → create the file (icons via Material Symbols per resolução OQ-4; components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (sem MCP: `Video show.png`)
   - Reused DS components: [`components/watch/video-channel-link.tsx`, `components/channel/subscribe-button.tsx`, `components/watch/video-reaction-buttons.tsx`, `components/comments/comment-section.tsx`] _(now reflecting any DS edits from action 1; os demais componentes de comentário entram pela `comment-section`)_
   - Server-connected component names (no endpoints/auth/errors): [`Watch page — RSC da rota`, `Canal do vídeo — avatar + nome + inscritos`, `SubscribeButton`, `Par like/dislike do vídeo`, `Seção de comentários`]
   - Target paths: `app/(app)/watch/[publicId]/page.tsx` — linha "canal + inscritos + Subscribe" à esquerda e "like/dislike + Share + ⋮" à direita; seção de comentários abaixo do bloco de descrição na coluna principal

**Dependencies:** SI-06.17.0 + SI-06.0.1, SI-06.0.2, SI-06.0.3, SI-06.0.4, SI-06.0.5

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `next-frontend` build command.
- Rendering matches Figma node fidelity within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-06.17b — Tela de Página de visualização do vídeo — interações (lógica & wiring)

**Test Specs:** see `next-frontend/specs/watch-social.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo — interações (Video show)`

**Technical actions:**

1. **Route guard application** — Mixed (per UI Contract `**Auth requirement:**`): a rota continua pública; cada controle social recebe `isLoggedIn` da sessão e o `returnTo` `/watch/{publicId}`, e o anônimo é levado ao login sem chamada à API (per `social-interactions/TD-10`).
2. **Rendering strategy application (Migração `app/(app)/watch/[publicId]/page.tsx`)** — Server Component (RSC): quando `video.status === "published"`, ler em paralelo (com playback e sugestões) a primeira página `GET /videos/{publicId}/comments?sort=latest` via `publicRead`; quando não publicado (dono no próprio rascunho/processamento), **não** ler comentários nem renderizar o par like/dislike e a seção de comentários — canal e inscritos continuam (per `### Frontend Runtime → social-interactions/TD-09` Migração; `TD-03`, Revisions 2026-10-20).
3. **Endpoint wiring** — passar `viewer_reaction` + `like_count` a `VideoReactionButtons`; `channel.subscriber_count` + `channel.viewer_subscribed` a um wrapper cliente `components/watch/video-channel-subscription.tsx` que mantém a contagem exibida no `VideoChannelLink` sincronizada com a resposta do `SubscribeButton` (oculto quando `session.channelSlug === channel.nickname`); `comment_count`, a primeira página e o canal da sessão (avatar do composer) a `CommentSection` (per `### UI Contracts → Server-connected components`; `TD-04`, `TD-09`).
4. **Error mapping** — per UI Contract `**Error Catalog → UX mapping:**`: falha da primeira página de comentários → bloco com mensagem e "Try again" (a página não cai); `UNAUTHORIZED` em qualquer mutação → `/login?returnTo=/watch/{publicId}`; `VIDEO_NOT_FOUND`/`COMMENT_NOT_FOUND`/429 → reverte o otimista + toast com as mensagens da tabela.
5. **Client-side validation mirror** — conferir que o composer principal, o de resposta e o de edição aplicam `text` com `trim`, 1–2.000 caracteres (per `### API Contracts → Validation Rules`), igual ao backend.

**Dependencies:**

- `SI-06.17a` (visual shell must exist before wiring).
- Backend SIs: `SI-06.2`, `SI-06.3`, `SI-06.4`, `SI-06.5`, `SI-06.6`, `SI-06.7` (reação, inscrição, estado do espectador, comentários, respostas, reação a comentário).
- Shared-types / BFF: `SI-06.9`, `SI-06.10`, `SI-06.11`; runtime e componentes: `SI-06.12`, `SI-06.13`, `SI-06.14`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/watch/video-channel-subscription.tsx` | Unit per testing-guide-next-frontend § "Client Components" — contagem inicial do RSC; após inscrever, exibe a `subscriber_count` da resposta; dono → sem botão; anônimo → login com `returnTo` | `components/watch/__tests__/video-channel-subscription.test.tsx` |

E2E for the page (reagir, inscrever-se, comentar, responder, editar, excluir, anônimo → login, rascunho do dono sem seção social, nenhum `router.refresh()` após os cliques) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `/watch/{publicId}` de um vídeo publicado chega com o par like/dislike, o Subscribe e a seção de comentários já no estado do espectador (sem flicker de estado)
- `/watch/{publicId}` aberto pelo dono num rascunho não mostra o par like/dislike nem a seção de comentários, e nenhuma chamada a `/comments` é feita
- Curtir, inscrever-se, comentar, responder, editar e excluir atualizam a página sem nova leitura de `GET /videos/{publicId}` nem de `/playback`
- Um anônimo que clica em like, Subscribe, Reply ou no campo de comentário vai para `/login?returnTo=/watch/{publicId}`
- Falha na leitura dos comentários mostra o bloco de erro com "Try again" e o resto da página renderiza normalmente

---

### SI-06.18.0 — Drift audit: Feed das inscrições (base visual: Home / Catalog Show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 — sem Figma MCP: `docs/inventories/assets/phase-06/Home (Catalog Show).png` (resolução OQ-1)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Feed das inscrições (base visual: Home / Catalog Show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (sem MCP: comparar contra `Home (Catalog Show).png`; só grid, card com avatar e menu lateral — chips e busca fora)
   - Reused DS components: [`components/layout/app-shell.tsx`, `components/layout/side-nav-subscriptions.tsx`, `components/ui/filter-chip.tsx`, `components/feed/subscription-video-grid.tsx`, `components/videos/video-card.tsx`, `components/studio/load-more.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [`Feed page — RSC da rota`, `Grid de vídeos do feed`, `VideoCard com avatar do canal`, `"Load more" do feed`]
   - Target paths (read-only context for audit; no writes here): `app/(app)/(shell)/feed/subscriptions/page.tsx` + `components/feed/*.tsx` + `components/videos/video-card.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Write a `## Screen: subscriptions-feed — audited at SI-06.18.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-06.0.1, SI-06.15, SI-06.16b (grupo `(shell)` e app shell montados)

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: subscriptions-feed` exists with the current run's date in heading (appended on first run, overwritten in place on re-run per schema § Section ownership and update discipline).
- Every component in the Reused DS list has exactly one row in the table (esperado: `video-card.tsx` como `drift relevante` pela falta da variante com avatar — resolução OQ-5).
- Every row has a Decision column populated:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` or `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"`, or `CONFLICT: <one-liner>; <verb> "<specifics>"`
  - `componente ausente` → `create`
- Every `exception` decision carries a one-liner justification.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty.

---

### SI-06.18a — Tela de Feed das inscrições (visual shell)

**Route:** `/feed/subscriptions`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Feed das inscrições (base visual: Home / Catalog Show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: subscriptions-feed`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics (esperado: variante com avatar do canal no `VideoCard`, com `ChannelAvatar` de iniciais a partir de `channel.name` e link para `/channel/{nickname}`, sem mudar as variantes `default`/`horizontal` — resolução OQ-5)
   - `create` → create the file (components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (sem MCP: `Home (Catalog Show).png`; chips de categoria não renderizados)
   - Reused DS components: [`components/layout/app-shell.tsx`, `components/layout/side-nav-subscriptions.tsx`, `components/feed/subscription-video-grid.tsx`, `components/videos/video-card.tsx`, `components/studio/load-more.tsx`] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [`Feed page — RSC da rota`, `Grid de vídeos do feed`, `VideoCard com avatar do canal`, `"Load more" do feed`]
   - Target paths: `app/(app)/(shell)/feed/subscriptions/page.tsx` + `app/(app)/(shell)/feed/subscriptions/loading.tsx` + `app/(app)/(shell)/feed/subscriptions/error.tsx` — título "Subscriptions", grid, estado vazio com link para `/`

**Dependencies:** SI-06.18.0 + SI-06.0.1

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `next-frontend` build command.
- Rendering matches Figma node fidelity within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-06.18b — Tela de Feed das inscrições (lógica & wiring)

**Test Specs:** see `next-frontend/specs/subscriptions-feed.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Feed das inscrições (base visual: Home / Catalog Show)`

**Technical actions:**

1. **Route guard application** — Authenticated (per UI Contract `**Auth requirement:**`): estender o `matcher` do `proxy.ts` para `["/studio/:path*", "/feed/:path*"]` (anônimo → `/login?returnTo=/feed/subscriptions`), e a página revalida a sessão como defesa em profundidade, como o estúdio (per `next-frontend/CLAUDE.md` → "Studio guard").
2. **Rendering strategy application** — Server Component (RSC): ler `GET /me/subscriptions/videos` com o `Bearer` da sessão e `cursor` vindo de `searchParams`, como a página do canal; a página acumula as páginas já vistas via `LoadMore` (per `### UI Contracts → Rendering strategy`; `video-channel-management/TD-12`).
3. **Endpoint wiring** — passar `items` ao `SubscriptionVideoGrid` (cards com avatar) e `next_cursor` ao `LoadMore`; estado vazio quando a primeira página não tem itens (per `### API Contracts → GET /me/subscriptions/videos`; `social-interactions/TD-08`).
4. **Error mapping** — per UI Contract `**Error Catalog → UX mapping:**`: 401 → `/login?returnTo=/feed/subscriptions`; `VALIDATION_ERROR` (cursor adulterado) → redireciona para a primeira página; demais → `error.tsx` com "Try again".

**Dependencies:**

- `SI-06.18a` (visual shell must exist before wiring).
- Backend SIs: `SI-06.8` (feed).
- Shared-types: `SI-06.9`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `proxy.ts` (matcher estendido) | Unit — `/feed/subscriptions` sem cookie de sessão redireciona para `/login?returnTo=/feed/subscriptions`; com sessão segue | `__tests__/proxy.test.ts` (novo — o `proxy.ts` ainda não tem teste próprio) |

E2E for the page (feed com sessão, redirecionamento do anônimo, "Load more", estado vazio) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above and consumed JIT by `/implement` Step 3.

**Acceptance criteria:**

- `/feed/subscriptions` sem sessão redireciona para `/login?returnTo=/feed/subscriptions`
- Com sessão, a página lista os vídeos públicos dos canais seguidos do mais recente ao mais antigo, com avatar e nome do canal em cada card
- "Load more" traz a próxima página e some quando não há mais vídeos
- Sem inscrições, a página mostra o estado vazio com link para a home
- O item "Subscriptions" do menu lateral fica ativo nesta rota

---

### SI-06.19 — Mutação otimista e contexto de inscrições (Verification)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### social-interactions/TD-09 — Estratégia de dados do frontend para as interações (reavaliação de video-channel-management/TD-12)` → Verificação

**Technical actions:**

1. Adicionar os testes unitários do Verificação: o hook `useOptimisticMutation` (otimista imediato, reconciliação pelo corpo do `200`, volta ao confirmado + toast em 4xx/5xx, `startTransition` em volta do `setConfirmed` após o `await`) e o `SubscriptionsProvider` (`onChange` insere em ordem alfabética e remove; `loadMore` anexa e encerra sem cursor).
2. Rodar os regression guards do Verificação: as suítes Vitest e Playwright das Fases 04 e 05 (estúdio, página do canal, player, registro de visualização, download) contra o build de produção com MSW, depois da reorganização do grupo `(shell)`.

**Dependencies:** SI-06.12, SI-06.16b, SI-06.17b

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `useOptimisticMutation` (verification surface) | Unit per testing-guide-next-frontend § "Custom hook" (`renderHook`, jsdom, MSW) — assertions do Verificação | `hooks/__tests__/use-optimistic-mutation.test.ts` |
| `SubscriptionsProvider` (verification surface) | Unit per testing-guide-next-frontend § "Client Components" — ordem alfabética, remoção, `loadMore` | `components/layout/__tests__/subscriptions-provider.test.tsx` |

**Acceptance criteria:**

- Verificação tests listed in the spec are present and passing.
- Regression guards (when called out) are wired to the test runner: os E2E existentes das Fases 04 e 05 continuam passando depois da mudança de layout.

---

## Technical Specifications

### Data Model

_Todas as tabelas novas nascem numa única migration (SI-06.1); `synchronize` segue desligado. Os contadores denormalizados são escritos **na mesma transação** do evento que os altera, com incremento/decremento atômico (`col = col + :delta`), como o `view_count` da Fase 05 (per `social-interactions/TD-02`; `video-channel-management/TD-05`)._

#### Enum `reaction_value` (novo — per `social-interactions/TD-01`)

Enum Postgres `reaction_value ('like','dislike')`, compartilhado por `video_reactions` e `comment_reactions`.

#### VideoReaction (nova — tabela `video_reactions`, per `social-interactions/TD-01`)

| Field | Type | Constraints |
|-------|------|-------------|
| user_id | uuid | PK (composta), FK → `users.id` `ON DELETE CASCADE` |
| video_id | uuid | PK (composta), FK → `videos.id` `ON DELETE CASCADE` |
| value | reaction_value | not null |
| created_at | timestamp | not null, default now() |
| updated_at | timestamp | not null, default now() |

**Relations:** `User` has many `VideoReaction`; `Video` has many `VideoReaction` (one-to-many; o hard delete de vídeo de `video-channel-management/TD-09` leva as reações em cascata)
**Indexes:** PK `(user_id, video_id)` — uma reação por usuário e vídeo, alvo do `INSERT … ON CONFLICT DO NOTHING`; btree em `video_id` (cascata da FK)

#### Comment (nova — tabela `comments`, per `social-interactions/TD-05`, `TD-07`)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| video_id | uuid | not null, FK → `videos.id` `ON DELETE CASCADE` |
| user_id | uuid | not null, FK → `users.id` `ON DELETE CASCADE` — autor; o `author` exposto é o canal desse usuário |
| parent_id | uuid | nullable, FK → `comments.id` `ON DELETE CASCADE` — `null` = raiz; quando preenchido, aponta **sempre** para uma raiz (um nível, per `TD-05`) |
| text | text | not null — texto puro de 1 a 2.000 caracteres após `trim` (validado no DTO, per `TD-07`) |
| like_count | integer | not null, default 0 |
| dislike_count | integer | not null, default 0 |
| reply_count | integer | not null, default 0 — só na raiz; conta apenas as respostas (per `TD-05`) |
| edited_at | timestamp | nullable — preenchido pela edição do autor (per `TD-07`) |
| created_at | timestamp | not null, default now() |
| updated_at | timestamp | not null, default now() |

**Relations:** `Video` has many `Comment`; `User` has many `Comment`; `Comment` (raiz) has many `Comment` (respostas) via `parent_id`
**Indexes:** btree `(video_id, created_at, id)` `WHERE parent_id IS NULL` — raízes por `latest`; btree `(video_id, like_count, created_at, id)` `WHERE parent_id IS NULL` — raízes por `top`; btree `(parent_id, created_at, id)` — respostas em ordem cronológica
**Regra de um nível:** responder a uma resposta grava `parent_id` = a raiz da resposta (o texto chega com `@nickname` pré-preenchido pelo cliente; per `TD-05`).

#### CommentReaction (nova — tabela `comment_reactions`, per `social-interactions/TD-01`)

| Field | Type | Constraints |
|-------|------|-------------|
| user_id | uuid | PK (composta), FK → `users.id` `ON DELETE CASCADE` |
| comment_id | uuid | PK (composta), FK → `comments.id` `ON DELETE CASCADE` |
| value | reaction_value | not null |
| created_at | timestamp | not null, default now() |
| updated_at | timestamp | not null, default now() |

**Relations:** `User` has many `CommentReaction`; `Comment` has many `CommentReaction` (one-to-many; apagar o comentário leva as reações)
**Indexes:** PK `(user_id, comment_id)`; btree em `comment_id` (cascata da FK)

#### Subscription (nova — tabela `subscriptions`, per `social-interactions/TD-03`, `TD-08`)

| Field | Type | Constraints |
|-------|------|-------------|
| user_id | uuid | PK (composta), FK → `users.id` `ON DELETE CASCADE` — quem se inscreve |
| channel_id | uuid | PK (composta), FK → `channels.id` `ON DELETE CASCADE` — canal seguido |
| created_at | timestamp | not null, default now() |

**Relations:** `User` has many `Subscription`; `Channel` has many `Subscription`
**Indexes:** PK `(user_id, channel_id)` — uma inscrição por usuário e canal; btree em `channel_id` (cascata da FK)
**Regra:** o usuário não se inscreve no próprio canal (422 `CANNOT_SUBSCRIBE_OWN_CHANNEL`, per `TD-03`).

#### Channel (modificada)

| Field | Type | Constraints |
|-------|------|-------------|
| subscriber_count | integer | not null, default 0 — **novo**; contador denormalizado de `subscriptions` (per `social-interactions/TD-02`, `TD-04`) |

#### Video (inalterada nesta fase)

Nenhuma coluna nova. `like_count`, `dislike_count` e `comment_count` (integer, default 0, `video-channel-management/TD-05`) passam a ser escritos: reações a vídeo alteram `like_count`/`dislike_count`; criar comentário (raiz **ou** resposta) soma 1 a `comment_count` (raízes + respostas, per `social-interactions/TD-05`).

#### Escrita dos contadores (per `social-interactions/TD-02`)

- **Reação (vídeo ou comentário) — `PUT` com `value`:** na transação, `SELECT value … FOR UPDATE` da reação do usuário; se não existir, `INSERT … ON CONFLICT DO NOTHING RETURNING` e, se perder a corrida (nenhuma linha), repetir o `SELECT … FOR UPDATE`; aplicar a mudança e somar no alvo o delta da transição (`nada → like`: `like_count + 1`; `like → dislike`: `like_count - 1`, `dislike_count + 1`; mesmo valor: sem efeito).
- **Reação — `DELETE`:** `DELETE … RETURNING value`; decrementa o contador do valor removido (nenhuma linha → sem efeito).
- **Inscrição:** `INSERT … ON CONFLICT DO NOTHING RETURNING` → `subscriber_count + 1` só se a linha entrou; `DELETE … RETURNING` → `subscriber_count - 1` só se a linha saiu.
- **Comentário:** criar raiz → `videos.comment_count + 1`; criar resposta → `videos.comment_count + 1` e `comments.reply_count + 1` na raiz; excluir raiz → `videos.comment_count - (1 + reply_count)` (as respostas e todas as reações caem em cascata); excluir resposta → `videos.comment_count - 1` e `reply_count - 1` na raiz (per `TD-07`).
- **Prova:** teste de integração com N requisições paralelas do mesmo usuário termina com contador == `COUNT(*)` da tabela (per `TD-02`); sem job de reconciliação.

### API Contracts

_Backend tier (NestJS, `Scope: Backend | Cross-layer`). Envelope de erro herdado: `{ statusCode, error, message }` (per `phase-02-auth/TD-07`). **Mutações sociais exigem JWT** (sem token → 401); **leituras públicas usam autenticação opcional** (`@Public()` + `@OptionalUser()`, per `video-channel-management/TD-07`): token ausente → anônimo (`viewer_*` = `null`/`false`); token presente e inválido/expirado → 401. Todas passam pelo throttler global (10 req/min **por rota e por visitante**, IP real via `TRUST_PROXY`, per `watch-page/TD-03`); as rotas de reação têm `@Throttle` próprio de **60 req/min** (per `social-interactions/TD-03`). Mutações de reação e inscrição são **set-state idempotentes** e respondem `200` com o estado resultante (per `TD-03`). Listagens usam o envelope keyset `{ items, next_cursor }` com `limit` default 20, máx. 50 (per `video-channel-management/TD-06`; `DEFAULT_PAGE_LIMIT`/`MAX_PAGE_LIMIT`). Shapes anotados com `@ApiProperty` porque o `openapi.json` é a fonte dos tipos do frontend (per `openapi-docs-nestjs/TD-01`, `next-frontend-openapi-typing/TD-01`)._

**Shapes compartilhados (novos ou modificados nesta fase):**

- `ReactionValue` (novo): `'like' | 'dislike'` (enum `reaction_value`, per `social-interactions/TD-01`)
- `SetReactionDto` (novo): `{ value: ReactionValue }`
- `ReactionStateResponse` (novo): `{ viewer_reaction: ReactionValue | null, like_count: integer, dislike_count: integer }` — resposta das mutações de reação em vídeo **e** em comentário (per `TD-03`)
- `SubscriptionStateResponse` (novo): `{ subscribed: boolean, subscriber_count: integer }` (per `TD-03`)
- `VideoCardChannel` (existente, Fase 04): `{ nickname: string, name: string }` — reutilizado como `author` do comentário e como item da lista de canais seguidos
- `VideoChannel` (novo — substitui `VideoCardChannel` em `VideoResponse.channel`): `{ nickname: string, name: string, subscriber_count: integer, viewer_subscribed: boolean }` (per `TD-04`)
- `VideoResponse` (modificado): shape da Fase 05 **+** `viewer_reaction: ReactionValue | null`; `channel` passa a `VideoChannel` (per `TD-04`). `dislike_count` continua no contrato (a UI não o exibe — per `TD-04`).
- `ChannelPublicResponse` (modificado): shape da Fase 04 **+** `subscriber_count: integer` + `viewer_subscribed: boolean` (per `TD-04`)
- `CommentResponse` (novo): `{ id: uuid, parent_id: uuid | null, text: string, author: VideoCardChannel, created_at: string, edited_at: string | null, like_count: integer, dislike_count: integer, reply_count: integer, viewer_reaction: ReactionValue | null, viewer_is_author: boolean }` — `reply_count` é 0 em respostas; `viewer_is_author` per `TD-06` (Revisions 2026-10-20)
- `CommentsPage` (novo): `{ items: CommentResponse[], next_cursor: string | null }`
- `CreateCommentDto` / `UpdateCommentDto` (novos): `{ text: string }`
- `SubscribedChannelsPage` (novo): `{ items: VideoCardChannel[], next_cursor: string | null }`
- `SubscriptionFeedPage` (novo): `{ items: VideoCardItem[], next_cursor: string | null }` — `VideoCardItem` da Fase 04 (traz `channel: { nickname, name }`)

#### PUT /videos/{publicId}/reaction (SI-06.2)

Define a reação do usuário ao vídeo (cria ou troca). Idempotente: repetir o mesmo `value` não muda nada (per `social-interactions/TD-03`).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório
- Content-Type: application/json

**Request body:** `SetReactionDto`
- value: string, required — `like` | `dislike`

**Response 200:** `ReactionStateResponse` — estado após a escrita

**Error responses:**
- 400 VALIDATION_ERROR: `value` ausente ou fora do enum
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou vídeo que não está `published` — inclusive rascunho do próprio dono (per `TD-03`)
- 429 Too Many Requests: limite de 60 req/min da rota

---

#### DELETE /videos/{publicId}/reaction (SI-06.2)

Remove a reação do usuário ao vídeo. Idempotente: sem reação → mesma resposta, sem efeito.

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Response 200:** `ReactionStateResponse` (`viewer_reaction: null`)

**Error responses:**
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 VIDEO_NOT_FOUND: inexistente ou não `published`
- 429 Too Many Requests: limite de 60 req/min da rota

---

#### PUT /channels/{nickname}/subscription (SI-06.3)

Inscreve o usuário no canal. Idempotente.

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Request body:** nenhum

**Response 200:** `SubscriptionStateResponse` (`subscribed: true`)

**Error responses:**
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 CHANNEL_NOT_FOUND: nickname inexistente
- 422 CANNOT_SUBSCRIBE_OWN_CHANNEL: o canal é do próprio usuário (per `TD-03`)

---

#### DELETE /channels/{nickname}/subscription (SI-06.3)

Cancela a inscrição. Idempotente (sem inscrição → mesma resposta).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Response 200:** `SubscriptionStateResponse` (`subscribed: false`)

**Error responses:**
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 CHANNEL_NOT_FOUND: nickname inexistente

---

#### GET /videos/{publicId} (SI-06.4 — contrato da Fase 05 modificado: `viewer_reaction` + `channel` como `VideoChannel`)

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Response 200:** `VideoResponse` — com `viewer_reaction` (reação do solicitante; anônimo → `null`) e `channel: { nickname, name, subscriber_count, viewer_subscribed }` (anônimo → `viewer_subscribed: false`) (per `social-interactions/TD-04`). Regra de visibilidade inalterada (`video-channel-management/TD-07`).

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho que não pertence ao solicitante

---

#### GET /channels/{nickname} (SI-06.4 — contrato da Fase 04 modificado: `subscriber_count` + `viewer_subscribed`)

**Request headers:**
- Authorization: Bearer <access_token> — opcional (passa a ser lido para `viewer_subscribed`)

**Response 200:** `ChannelPublicResponse` — com `subscriber_count` e `viewer_subscribed` (anônimo → `false`) (per `TD-04`)

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 CHANNEL_NOT_FOUND: nickname inexistente

---

#### GET /videos/{publicId}/comments (SI-06.5)

Comentários raiz do vídeo, paginados (per `social-interactions/TD-06`). Público com auth opcional.

**Request headers:**
- Authorization: Bearer <access_token> — opcional (preenche `viewer_reaction`/`viewer_is_author`)

**Request query parameters:**
- sort: string, optional — `latest` (default; `created_at DESC, id DESC`) | `top` (`like_count DESC`, desempate `created_at DESC, id DESC`)
- cursor: string, optional — `next_cursor` da página anterior (emitido para o mesmo `sort`)
- limit: integer, optional — 1..50, default 20

**Response 200:** `CommentsPage` — só raízes (`parent_id: null`)

**Error responses:**
- 400 VALIDATION_ERROR: `sort`/`limit` inválidos ou `cursor` malformado/de outro `sort`
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente ou não `published` — **inclusive para o dono** (per `TD-03`, Revisions 2026-10-20)

---

#### POST /videos/{publicId}/comments (SI-06.5)

Cria um comentário raiz.

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório
- Content-Type: application/json

**Request body:** `CreateCommentDto`
- text: string, required — após `trim`, 1 a 2.000 caracteres; texto puro, quebras de linha preservadas (per `TD-07`)

**Response 201:** `CommentResponse` (`parent_id: null`, `reply_count: 0`, `viewer_is_author: true`)

**Error responses:**
- 400 VALIDATION_ERROR: `text` ausente, vazio após `trim` ou acima de 2.000 caracteres
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 VIDEO_NOT_FOUND: inexistente ou não `published` (público ou unlisted aceitam comentários — per `TD-07`)

---

#### PATCH /comments/{commentId} (SI-06.5)

Edita o texto do próprio comentário (raiz ou resposta) e grava `edited_at` (per `TD-07`).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório
- Content-Type: application/json

**Request body:** `UpdateCommentDto`
- text: string, required — mesmas regras do `POST`

**Response 200:** `CommentResponse` (com `edited_at` preenchido)

**Error responses:**
- 400 VALIDATION_ERROR: `text` inválido
- 401 Unauthorized: token ausente, inválido ou expirado
- 403 COMMENT_FORBIDDEN: o solicitante não é o autor (per `TD-06`, Revisions 2026-10-20)
- 404 COMMENT_NOT_FOUND: inexistente, `commentId` malformado ou vídeo do comentário não `published`

---

#### DELETE /comments/{commentId} (SI-06.5)

Exclusão física pelo autor; apagar uma raiz apaga as respostas em cascata e decrementa `comment_count` em `1 + reply_count` (per `TD-07`).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Response 204:** No content.

**Error responses:**
- 401 Unauthorized: token ausente, inválido ou expirado
- 403 COMMENT_FORBIDDEN: o solicitante não é o autor
- 404 COMMENT_NOT_FOUND: inexistente, `commentId` malformado ou vídeo não `published`

---

#### GET /comments/{commentId}/replies (SI-06.6)

Respostas de uma raiz em ordem cronológica (`created_at ASC, id ASC`), carregadas sob demanda (per `social-interactions/TD-06`). Público com auth opcional.

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Request query parameters:**
- cursor: string, optional
- limit: integer, optional — 1..50, default 20

**Response 200:** `CommentsPage` — itens com `parent_id` = `commentId`

**Error responses:**
- 400 VALIDATION_ERROR: `limit` inválido ou `cursor` malformado
- 401 Unauthorized: token presente mas inválido/expirado
- 404 COMMENT_NOT_FOUND: inexistente, não é raiz, ou vídeo não `published`

---

#### POST /comments/{commentId}/replies (SI-06.6)

Cria uma resposta. Se `commentId` é uma resposta, a nova resposta é gravada na **raiz** dela (um nível, per `social-interactions/TD-05`); o cliente pré-preenche `@nickname` no texto.

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório
- Content-Type: application/json

**Request body:** `CreateCommentDto`
- text: string, required — mesmas regras do comentário raiz

**Response 201:** `CommentResponse` (`parent_id` = id da raiz)

**Error responses:**
- 400 VALIDATION_ERROR: `text` inválido
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 COMMENT_NOT_FOUND: inexistente ou vídeo não `published`

---

#### PUT /comments/{commentId}/reaction (SI-06.7)

Define a reação do usuário ao comentário ou resposta — mesma semântica de `PUT /videos/{publicId}/reaction` (per `social-interactions/TD-03`).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório
- Content-Type: application/json

**Request body:** `SetReactionDto`
- value: string, required — `like` | `dislike`

**Response 200:** `ReactionStateResponse` (contadores do comentário)

**Error responses:**
- 400 VALIDATION_ERROR: `value` inválido
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 COMMENT_NOT_FOUND: inexistente ou vídeo não `published`
- 429 Too Many Requests: limite de 60 req/min da rota

---

#### DELETE /comments/{commentId}/reaction (SI-06.7)

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Response 200:** `ReactionStateResponse` (`viewer_reaction: null`)

**Error responses:**
- 401 Unauthorized: token ausente, inválido ou expirado
- 404 COMMENT_NOT_FOUND: inexistente ou vídeo não `published`
- 429 Too Many Requests: limite de 60 req/min da rota

---

#### GET /me/subscriptions (SI-06.8)

Canais seguidos pelo usuário, ordenados por nome do canal (alfabético, desempate por id) em cursor keyset; o menu lateral pede os 7 primeiros e "Show more" pagina o restante (per `social-interactions/TD-08`, Revisions 2026-10-20).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Request query parameters:**
- cursor: string, optional
- limit: integer, optional — 1..50, default 20

**Response 200:** `SubscribedChannelsPage`

**Error responses:**
- 400 VALIDATION_ERROR: `limit` inválido ou `cursor` malformado
- 401 Unauthorized: token ausente, inválido ou expirado

---

#### GET /me/subscriptions/videos (SI-06.8)

Feed das inscrições: vídeos dos canais seguidos com `status = published`, `visibility = public` e `processing_status = ready`, por `published_at DESC, id DESC`, montado na leitura por join com `subscriptions` (per `TD-08`).

**Request headers:**
- Authorization: Bearer <access_token> — obrigatório

**Request query parameters:**
- cursor: string, optional
- limit: integer, optional — 1..50, default 20

**Response 200:** `SubscriptionFeedPage`

**Error responses:**
- 400 VALIDATION_ERROR: `limit` inválido ou `cursor` malformado
- 401 Unauthorized: token ausente, inválido ou expirado

---

#### Validation Rules — interações sociais

- `publicId` (path): string de 11 caracteres base64url (`phase-03-videos/TD-08`); formato inválido → 404 `VIDEO_NOT_FOUND`
- `commentId` (path): uuid; formato inválido → 404 `COMMENT_NOT_FOUND`
- `nickname` (path): formato inválido → 404 `CHANNEL_NOT_FOUND` (mesmo comportamento das rotas da Fase 04)
- `value` (`SetReactionDto`): required, enum `like` | `dislike`
- `text` (`CreateCommentDto`, `UpdateCommentDto`): required, string, `trim` antes de validar, min 1, max 2.000 caracteres
- `sort` (`GET /videos/{publicId}/comments`): optional, enum `latest` | `top`, default `latest`
- `limit` (listagens desta fase): optional, integer, min 1, max 50, default 20
- `cursor` (listagens desta fase): optional, string opaca base64url; malformada ou emitida para outro `sort` → 400 `VALIDATION_ERROR`

---

> _BFF tier — frontend-exposed contract. O navegador chama a rota same-origin em `app/api/**`; a rota repassa ao upstream NestJS no servidor (strict BFF, per `next-frontend/CLAUDE.md` → "Talking to the NestJS API"). As leituras iniciais das páginas acontecem no RSC via `upstream`/`publicRead` (per `video-channel-management/TD-12`) e não passam por estas rotas; elas existem para as mutações e para as páginas seguintes carregadas no cliente (per `social-interactions/TD-09`). Rotas de mutação usam `withSession` (sem sessão → 401 `UNAUTHORIZED` sem tocar o upstream); leituras paginadas no cliente usam `withOptionalSession`, exceto `/api/me/subscriptions`, que exige sessão._

#### PUT /api/videos/{publicId}/reaction (SI-06.10)

**forwards-to:** `PUT /videos/{publicId}/reaction` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer da sessão iron-session; sem sessão → 401 `UNAUTHORIZED` sem chamar o upstream *(per phase-02-auth-frontend/TD-01)*

**Request body:** `SetReactionDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*; JSON inválido → 400 `VALIDATION_ERROR` via `readJson`/`invalidBody` de `lib/api/bff.ts` *(per phase-02-auth-frontend/TD-05)*

**Response 200 (FE-facing):** `ReactionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** upstream 401 → refresh single-flight e nova tentativa; refresh falho → sessão destruída e 401 *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### DELETE /api/videos/{publicId}/reaction (SI-06.10)

**forwards-to:** `DELETE /videos/{publicId}/reaction` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Response 200 (FE-facing):** `ReactionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** mesmo refresh do `PUT` *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### PUT /api/channels/{nickname}/subscription (SI-06.10)

**forwards-to:** `PUT /channels/{nickname}/subscription` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request body:** nenhum *(derived: project contract source)*

**Response 200 (FE-facing):** `SubscriptionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight; refresh falho → sessão destruída e 401 *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 CHANNEL_NOT_FOUND: pass-through *(derived: project contract source)*
- 422 CANNOT_SUBSCRIBE_OWN_CHANNEL: pass-through *(derived: project contract source)*

---

#### DELETE /api/channels/{nickname}/subscription (SI-06.10)

**forwards-to:** `DELETE /channels/{nickname}/subscription` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Response 200 (FE-facing):** `SubscriptionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 CHANNEL_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### GET /api/videos/{publicId}/comments (SI-06.11)

Usada pelo "Show more comments" e pela troca de ordenação; a primeira página vem do RSC *(per social-interactions/TD-09)*.

**forwards-to:** `GET /videos/{publicId}/comments` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão **quando houver**; sem sessão a chamada sai anônima *(per video-channel-management/TD-07)*
- X-Forwarded-For / User-Agent do visitante, quando presentes *(per watch-page/TD-03)*

**Request query parameters:** `sort`, `cursor`, `limit` repassados *(derived: project contract source)*

**Response 200 (FE-facing):** `CommentsPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** upstream 401 com sessão → refresh; refresh falho → sessão destruída e nova tentativa **anônima** (`withOptionalSession`) *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### POST /api/videos/{publicId}/comments (SI-06.11)

**forwards-to:** `POST /videos/{publicId}/comments` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request body:** `CreateCommentDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*; JSON inválido → 400 `VALIDATION_ERROR` via `readJson`/`invalidBody` de `lib/api/bff.ts` *(per phase-02-auth-frontend/TD-05)*

**Response 201 (FE-facing):** `CommentResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight; refresh falho → 401 *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### PATCH /api/comments/{commentId} (SI-06.11)

**forwards-to:** `PATCH /comments/{commentId}` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request body:** `UpdateCommentDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 200 (FE-facing):** `CommentResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 403 COMMENT_FORBIDDEN: pass-through *(derived: project contract source)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### DELETE /api/comments/{commentId} (SI-06.11)

**forwards-to:** `DELETE /comments/{commentId}` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Response 204 (FE-facing):** pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 403 COMMENT_FORBIDDEN: pass-through *(derived: project contract source)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### GET /api/comments/{commentId}/replies (SI-06.11)

**forwards-to:** `GET /comments/{commentId}/replies` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão **quando houver** *(per video-channel-management/TD-07)*
- X-Forwarded-For / User-Agent do visitante, quando presentes *(per watch-page/TD-03)*

**Request query parameters:** `cursor`, `limit` repassados *(derived: project contract source)*

**Response 200 (FE-facing):** `CommentsPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh e, se falhar, nova tentativa anônima (`withOptionalSession`) *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### POST /api/comments/{commentId}/replies (SI-06.11)

**forwards-to:** `POST /comments/{commentId}/replies` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request body:** `CreateCommentDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 201 (FE-facing):** `CommentResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*

---

#### PUT /api/comments/{commentId}/reaction (SI-06.10)

**forwards-to:** `PUT /comments/{commentId}/reaction` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request body:** `SetReactionDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 200 (FE-facing):** `ReactionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### DELETE /api/comments/{commentId}/reaction (SI-06.10)

**forwards-to:** `DELETE /comments/{commentId}/reaction` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Response 200 (FE-facing):** `ReactionStateResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 404 COMMENT_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### GET /api/me/subscriptions (SI-06.11)

Usada pelo "Show more" da lista de canais seguidos no menu lateral; os 7 primeiros vêm do RSC do layout *(per social-interactions/TD-08, Revisions 2026-10-20)*.

**forwards-to:** `GET /me/subscriptions` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão; sem sessão → 401 `UNAUTHORIZED` *(per phase-02-auth-frontend/TD-01)*

**Request query parameters:** `cursor`, `limit` repassados *(derived: project contract source)*

**Response 200 (FE-facing):** `SubscribedChannelsPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** refresh single-flight *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*

### Authorization Matrix

_"Owner" = usuário autenticado dono do canal do vídeo (ou do canal-alvo, nas inscrições). "Author" = autor do comentário. "Published" = `status = published`, `public` ou `unlisted` (a leitura é por `public_id`). Para comentários e reações, "published" vale **também para o dono**: rascunho/processamento → 404 (per `social-interactions/TD-03`, Revisions 2026-10-20). As rotas BFF seguem a mesma regra do upstream; sem sessão, as de mutação respondem 401 sem chamar o upstream._

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| PUT / DELETE /videos/{publicId}/reaction — vídeo published | ✗ (401) | ✓ | ✓ (o dono pode reagir ao próprio vídeo) |
| PUT / DELETE /videos/{publicId}/reaction — vídeo draft | ✗ (401) | ✗ (404) | ✗ (404) |
| PUT /channels/{nickname}/subscription | ✗ (401) | ✓ | ✗ (422 `CANNOT_SUBSCRIBE_OWN_CHANNEL`) |
| DELETE /channels/{nickname}/subscription | ✗ (401) | ✓ | ✓ (sem efeito — nunca há inscrição própria) |
| GET /videos/{publicId} — vídeo published (`viewer_reaction`, `channel.viewer_subscribed`) | ✓ (`null`/`false`) | ✓ | ✓ |
| GET /videos/{publicId} — vídeo draft | ✗ (404) | ✗ (404) | ✓ |
| GET /channels/{nickname} (`subscriber_count`, `viewer_subscribed`) | ✓ (`false`) | ✓ | ✓ |
| GET /videos/{publicId}/comments — vídeo published | ✓ (`viewer_*` = `null`/`false`) | ✓ | ✓ |
| GET /videos/{publicId}/comments — vídeo draft | ✗ (404) | ✗ (404) | ✗ (404) |
| POST /videos/{publicId}/comments — vídeo published | ✗ (401) | ✓ | ✓ |
| POST /videos/{publicId}/comments — vídeo draft | ✗ (401) | ✗ (404) | ✗ (404) |
| PATCH / DELETE /comments/{commentId} | ✗ (401) | ✗ (403) — ✓ só o Author | ✗ (403) — o dono do vídeo não modera nesta fase (per `TD-07`) |
| GET /comments/{commentId}/replies | ✓ | ✓ | ✓ |
| POST /comments/{commentId}/replies | ✗ (401) | ✓ | ✓ |
| PUT / DELETE /comments/{commentId}/reaction | ✗ (401) | ✓ | ✓ |
| GET /me/subscriptions | ✗ (401) | ✓ (as próprias) | ✓ (as próprias) |
| GET /me/subscriptions/videos | ✗ (401) | ✓ (o próprio feed) | ✓ (o próprio feed) |
| BFF `PUT|DELETE /api/videos/{publicId}/reaction`, `PUT|DELETE /api/channels/{nickname}/subscription`, `POST /api/videos/{publicId}/comments`, `PATCH|DELETE /api/comments/{commentId}`, `POST /api/comments/{commentId}/replies`, `PUT|DELETE /api/comments/{commentId}/reaction`, `GET /api/me/subscriptions` | ✗ (401 sem chamar o upstream) | ✓ — mesma regra do upstream | ✓ — mesma regra do upstream |
| BFF `GET /api/videos/{publicId}/comments`, `GET /api/comments/{commentId}/replies` | ✓ | ✓ | ✓ — mesma regra do upstream |

### Error Catalog

_Envelope `{ statusCode, error, message }` herdado (per `phase-02-auth/TD-07`). Códigos novos nesta fase: `COMMENT_NOT_FOUND`, `COMMENT_FORBIDDEN`, `CANNOT_SUBSCRIBE_OWN_CHANNEL`; os demais vêm das Fases 02–05._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| VALIDATION_ERROR | 400 | Corpo inválido (`value` fora do enum, `text` vazio após `trim` ou acima de 2.000 caracteres), `sort`/`limit` inválidos, `cursor` malformado ou de outro `sort`; no BFF, corpo que não é JSON |
| UNAUTHORIZED | 401 | BFF: mutação ou `/api/me/subscriptions` sem sessão, ou refresh falho |
| _(sem errorCode)_ | 401 | Upstream: token ausente nas rotas autenticadas, ou presente e inválido/expirado em qualquer rota |
| COMMENT_FORBIDDEN | 403 | `PATCH`/`DELETE /comments/{commentId}` por quem não é o autor (per `social-interactions/TD-06`, Revisions 2026-10-20) |
| VIDEO_NOT_FOUND | 404 | Vídeo inexistente, `publicId` malformado ou não `published` — nas reações ao vídeo e nos comentários **inclusive para o dono**; na leitura `GET /videos/{publicId}`, só rascunho alheio |
| COMMENT_NOT_FOUND | 404 | Comentário inexistente, `commentId` malformado, vídeo do comentário não `published`, ou `GET …/replies` sobre uma resposta (não raiz) |
| CHANNEL_NOT_FOUND | 404 | Nickname inexistente em `GET /channels/{nickname}` e nas rotas de inscrição |
| CANNOT_SUBSCRIBE_OWN_CHANNEL | 422 | `PUT /channels/{nickname}/subscription` no próprio canal (per `social-interactions/TD-03`) |
| _(sem errorCode)_ | 429 | Limite do throttler excedido para o IP real do visitante — 60 req/min nas rotas de reação, 10 req/min por rota nas demais (`ThrottlerException`, corpo padrão do Nest) |

### UI Contracts

_Referência visual (resolução OQ-1 do `/plan-validate 6`): sem a Figma MCP, o `/implement` usa os PNGs de `docs/inventories/assets/phase-06/` + os tokens de `app/globals.css`; a checagem de drift de tokens fica para quando o acesso voltar. Estados sem frame (resolução OQ-2) são derivados dos primitivos `Button`/`IconButton`/`DropdownMenu`/`Dialog` no padrão das plataformas de referência: reação ativa = ícone preenchido; "Subscribed" = pill secundária; composer focado mostra "Cancel"/"Comment"; "(edited)" em texto muted; confirmação de exclusão em `Dialog`; "Show more …" como botão ghost; vazios com texto muted. Ícones ausentes (resolução OQ-4) são desenhados em `components/icons/` a partir do Material Symbols._

#### Screen: Página de visualização do vídeo — interações (Video show)

**Route:** `/watch/{publicId}` _(per `watch-page/TD-06`)_
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (node `0RBoWy5FbrK8SHEz1eK6gb:152:2219`) — referência visual: `docs/inventories/assets/phase-06/Video show.png`. Escopo: só os componentes da Fase 06; o resto da tela segue `screen-inventory-phase-05-watch-page.md` e o plano da Fase 05
**Purpose:** "Interface completa de comentários, likes e inscrições"

**Auth requirement:** Mixed — leitura anônima (vídeo, contagens, comentários); reagir, comentar, responder, editar/excluir e se inscrever exigem sessão — o anônimo vê os controles e é levado a `/login?returnTo=/watch/{publicId}` (per `social-interactions/TD-10`) _(source: §Authorization Matrix — `GET /videos/{publicId}` e `GET /videos/{publicId}/comments` públicos; mutações autenticadas)_

**Rendering strategy:** Server Component (RSC) lê `GET /videos/{publicId}` (com `viewer_reaction` e `channel.viewer_subscribed`) e a **primeira página** de `GET /videos/{publicId}/comments?sort=latest` via `publicRead`, em paralelo com playback e sugestões; Client Components para o par like/dislike, o Subscribe e a seção de comentários, com `useOptimistic` + reconciliação pela resposta e **sem** `router.refresh()` nas interações _(source: `social-interactions/TD-09`; leitura RSC per `video-channel-management/TD-12`)_

**Reused DS components:**
- `app/(app)/watch/[publicId]/page.tsx` — Watch page — RSC da rota — Já existe (Fase 05). Passa a ler também a primeira página de comentários (`latest`) em paralelo com playback e sugestões, e repassa `viewer_reaction`, `channel.subscriber_count` e `channel.viewer_subscribed` do `GET /videos/{publicId}` (`social-interactions/TD-04`) aos componentes abaixo. Sem `router.refresh()` nas interações (`TD-09`)
- `components/watch/video-channel-link.tsx` — Canal do vídeo — avatar + nome + inscritos — Ganha a linha "9.88K subscribers" sob o nome (`formatCompactNumber`), atualizada localmente após inscrever/desinscrever
- `components/channel/subscribe-button.tsx (new)` — SubscribeButton — Compartilhado com a página do canal. Pill preta "Subscribe" (`components/ui/button.tsx`, variante primária); estado inscrito ("Subscribed") não desenhado. `useOptimistic` + reconciliação pela resposta de `PUT/DELETE /channels/{nickname}/subscription` (`TD-03`, `TD-09`); notifica o contexto do menu lateral. Anônimo → `/login?returnTo=` (`TD-10`). **Oculto quando o espectador é o dono do canal** (decisão do usuário)
- `components/watch/video-reaction-buttons.tsx (new)` — Par like/dislike do vídeo — Pill segmentada cinza: like com contagem ("1.2K", `formatCompactNumber`) + divisória + dislike **sem** contagem. Estado ativo (pressionado) não desenhado. `PUT/DELETE /videos/{publicId}/reaction`, otimista (`TD-03`, `TD-09`); anônimo → login (`TD-10`)
- `components/icons/thumb-up-icon.tsx` — Ícone like — Variante preenchida para o estado ativo não existe (ver Observations)
- `components/icons/thumb-down-icon.tsx (new)` — Ícone dislike — Espelho do thumb-up
- `components/comments/comment-section.tsx (new)` — Seção de comentários — Cabeçalho + composer + lista; primeira página vinda do RSC, páginas seguintes, respostas e itens novos em estado local via BFF (`TD-09`)
- `components/comments/comment-sort-menu.tsx (new)` — Seletor "Sort by: Latest" — Gatilho com `components/icons/sort-icon.tsx` + `components/ui/dropdown-menu.tsx`; opções Latest (padrão) e Top; trocar a ordem refaz a primeira página (`TD-06`). Conteúdo do menu não desenhado
- `components/comments/comment-composer.tsx (new)` — Composer "Add a comment…" — Avatar do usuário (`components/channel/channel-avatar.tsx`) + campo com sublinhado (`components/ui/textarea.tsx`, autoexpansível). Botões "Cancel"/"Comment" ao focar não desenhados. Texto 1–2.000 caracteres (`TD-07`). Mesmo componente para responder e editar. Anônimo → link "Sign in to comment" (`TD-10`)
- `components/comments/comment-list.tsx (new)` — Lista de comentários — Raízes na ordem escolhida; botão "Show more comments" (`components/ui/button.tsx`) pedindo a próxima página por `next_cursor` via BFF — decisão do usuário (scroll infinito fica para a Fase 07). Botão e estado vazio não desenhados
- `components/comments/comment-item.tsx (new)` — Item de comentário — Avatar 48px (`components/channel/channel-avatar.tsx`), "@nickname" (link para `/channel/{nickname}`) + tempo relativo (`formatRelativeTime`) em muted, texto com quebras preservadas, marca "(edited)" quando `edited_at` (não desenhada)
- `components/comments/comment-reaction-buttons.tsx (new)` — Like/dislike do comentário — Ícones pequenos sem fundo: like com contagem ("245") + dislike sem contagem; `PUT/DELETE /comments/{commentId}/reaction` otimista; vale para raízes e respostas
- `components/ui/button.tsx` — Botão "Reply" — Variante ghost/link; abre o composer de resposta inline sob o item. Numa resposta, o composer abre na thread da raiz com `@nickname` pré-preenchido (`TD-05`). Anônimo → login
- `components/comments/comment-composer.tsx (new)` — Composer de resposta — Mesmo componente do composer principal, recuado; não desenhado
- `components/comments/comment-replies.tsx (new)` — Alternância "N replies" / respostas — Não desenhada. Mostra `reply_count`; ao abrir carrega `GET /comments/{commentId}/replies` (cronológico) com "Show more replies"; respostas recuadas um nível (`TD-05`, `TD-06`)
- `components/comments/comment-actions-menu.tsx (new)` — Menu "⋮" do comentário — Edit / Delete — Não desenhado. Só para o autor (`TD-07`); gatilho `components/ui/icon-button.tsx` + `components/icons/more-vertical-icon.tsx` + `components/ui/dropdown-menu.tsx`. "Edit" troca o texto pelo composer; "Delete" pede confirmação. A visibilidade usa `viewer_is_author` do item (per `social-interactions/TD-06`, Revisions 2026-10-20)
- `components/ui/dialog.tsx` — Diálogo de confirmação de exclusão — Não desenhado; avisa que as respostas também serão excluídas quando a raiz tiver respostas (`TD-07`)

**Server-connected components:**
- `Watch page — RSC da rota` — verbs: (orquestra os demais; carrega `viewer_reaction`, `channel.subscriber_count`, `channel.viewer_subscribed` e a primeira página de comentários) | endpoint: `GET /videos/{publicId}`, `GET /videos/{publicId}/comments` (RSC via `publicRead` — §API Contracts → backend tier) | reuse: `app/(app)/watch/[publicId]/page.tsx`
- `Canal do vídeo — avatar + nome + inscritos` — verbs: Exibir a contagem de inscritos do canal ao lado do nome, abaixo do player | endpoint: `GET /videos/{publicId}` → `channel.subscriber_count` (RSC — §API Contracts → backend tier) | reuse: `components/watch/video-channel-link.tsx`
- `SubscribeButton` — verbs: Inscrever-se ou cancelar a inscrição no canal do vídeo; Levar o visitante anônimo ao login ao tentar reagir, comentar, responder ou se inscrever | endpoint: `PUT /api/channels/{nickname}/subscription`, `DELETE /api/channels/{nickname}/subscription` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection) | reuse: new
- `Par like/dislike do vídeo` — verbs: Curtir, descurtir ou remover a própria reação ao vídeo, exibindo a contagem de likes e o estado da minha reação; Levar o visitante anônimo ao login… | endpoint: `PUT /api/videos/{publicId}/reaction`, `DELETE /api/videos/{publicId}/reaction` (§API Contracts → BFF tier) | reuse: new
- `Seção de comentários` / `Lista de comentários` / `Item de comentário` — verbs: Exibir os comentários do vídeo paginados, com a contagem total e ordenação por mais recentes ou mais curtidos | endpoint: primeira página no RSC; `GET /api/videos/{publicId}/comments` para "Show more" (§API Contracts → BFF tier) | reuse: new
- `Seletor "Sort by: Latest"` — verbs: Exibir os comentários do vídeo paginados, com a contagem total e ordenação por mais recentes ou mais curtidos | endpoint: `GET /api/videos/{publicId}/comments?sort=` (§API Contracts → BFF tier) | reuse: new
- `Composer "Add a comment…"` — verbs: Publicar um comentário no vídeo; Levar o visitante anônimo ao login… | endpoint: `POST /api/videos/{publicId}/comments` (§API Contracts → BFF tier) | reuse: new
- `Menu "⋮" do comentário — Edit / Delete` — verbs: Editar o próprio comentário; Excluir o próprio comentário (com as respostas, se for raiz) | endpoint: `PATCH /api/comments/{commentId}`, `DELETE /api/comments/{commentId}` (§API Contracts → BFF tier) | reuse: new
- `Composer de resposta` — verbs: Responder a um comentário na thread da raiz | endpoint: `POST /api/comments/{commentId}/replies` (§API Contracts → BFF tier) | reuse: new
- `Alternância "N replies" / respostas` — verbs: Exibir as respostas de um comentário sob demanda | endpoint: `GET /api/comments/{commentId}/replies` (§API Contracts → BFF tier) | reuse: new
- `Like/dislike do comentário` — verbs: Curtir, descurtir ou remover a própria reação a um comentário ou resposta; Levar o visitante anônimo ao login… | endpoint: `PUT /api/comments/{commentId}/reaction`, `DELETE /api/comments/{commentId}/reaction` (§API Contracts → BFF tier) | reuse: new

**Behaviors:**

*Rendered states:*
- Loading: a página é RSC dinâmica e chega com o estado do espectador já aplicado (botões no estado certo no primeiro HTML, per `TD-04`); durante uma mutação o controle mostra o estado otimista; "Show more comments"/"Show more replies" ficam desabilitados com indicador enquanto a página carrega
- Empty: vídeo sem comentários → cabeçalho "0 Comments" + composer + texto muted convidando a comentar; comentário sem respostas → sem alternância "N replies"
- Success: linha canal (avatar, nome, "N subscribers", Subscribe) + par like/dislike + Share + "⋮"; seção "N Comments" com "Sort by", composer e até 20 raízes por página
- **Vídeo não publicado (dono abrindo o próprio rascunho/processamento):** o par like/dislike e a seção de comentários **não são renderizados**; canal e contagem de inscritos continuam (per `social-interactions/TD-03`, Revisions 2026-10-20 — o RSC nem chama `GET …/comments`)
- Error: falha ao carregar a primeira página de comentários → bloco de comentários com mensagem e "Try again"; falha de mutação → estado otimista volta ao confirmado + toast (`components/ui/sonner.tsx`)

*Interactions:*
- Like click (sem reação ou com dislike) → `PUT …/reaction { value: "like" }`; like click com like ativo → `DELETE …/reaction`; idem para dislike — o otimista aplica na hora e a resposta reconcilia `like_count` (per `TD-03`, `TD-09`)
- Subscribe click → `PUT …/subscription` (botão vira "Subscribed", inscritos +1 otimista); "Subscribed" click → `DELETE` — a resposta reconcilia `subscriber_count`
- Composer foco → mostra "Cancel"/"Comment"; "Comment" habilitado só com 1–2.000 caracteres após `trim`; sucesso → o novo comentário entra no topo da lista (em `latest`) e "N Comments" soma 1, composer limpa
- "Reply" click → abre o composer de resposta sob o item (numa resposta, com `@nickname` pré-preenchido, na thread da raiz); sucesso → a resposta entra no fim da thread aberta e `reply_count`/"N Comments" somam 1
- "N replies" click → carrega `GET …/replies` e expande; click de novo recolhe sem descartar o que já foi carregado
- "⋮" → "Edit" troca o texto pelo composer preenchido; salvar → texto e "(edited)" atualizados pela resposta; "Delete" → `Dialog` de confirmação → `DELETE`; sucesso → o item (e, se raiz, suas respostas) sai da lista e "N Comments" cai em `1 + reply_count`
- "Sort by" → Latest/Top refaz a primeira página com o novo `sort` e descarta as páginas carregadas
- Qualquer controle social clicado por anônimo → navega para `/login?returnTo=/watch/{publicId}` (per `TD-10`); o clique não é reaplicado após o login

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `UNAUTHORIZED` | Sessão expirada no meio da interação → navega para `/login?returnTo=/watch/{publicId}` |
| `VALIDATION_ERROR` | Composer: mensagem sob o campo; demais (cursor/sort): toast genérico |
| `VIDEO_NOT_FOUND` | Mutação num vídeo que deixou de estar publicado → toast "This video is no longer available" e reverte o otimista |
| `COMMENT_NOT_FOUND` | Comentário apagado entre a leitura e a ação → remove o item da lista + toast |
| `COMMENT_FORBIDDEN` | Não deveria ocorrer (menu só para o autor) → toast genérico e reverte |
| `CANNOT_SUBSCRIBE_OWN_CHANNEL` | Não deveria ocorrer (botão oculto para o dono) → reverte o otimista |
| 429 (sem errorCode) | Reverte o otimista + toast "Too many actions, try again in a moment" |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules)_

- `text`: required, `trim` antes de validar, min 1, max 2.000 caracteres

**Accessibility notes:**
- Botões de reação com `aria-pressed` e rótulo com a contagem ("Like, 1.2K"); "Subscribe"/"Subscribed" com `aria-pressed`
- O composer precisa de `<label>` acessível ("Add a comment")
- A alternância de respostas com `aria-expanded`
- O menu "⋮" do comentário é icon-only e precisa de `aria-label`

#### Screen: Página pública do canal — inscrição e menu lateral (Channel Show)

**Route:** `/channel/{nickname}` _(per `video-channel-management/TD-08`)_
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=155-1926 (node `0RBoWy5FbrK8SHEz1eK6gb:155:1926`) — referência visual: `docs/inventories/assets/phase-06/Channel Show.png` e `Left Menu.png` (frame 150:959)
**Purpose:** "Contagem de inscritos na página do canal"

**Auth requirement:** Mixed — página anônima; inscrever-se exige sessão (anônimo → `/login?returnTo=/channel/{nickname}`, per `social-interactions/TD-10`); o menu lateral só aparece com sessão (per `TD-08`) _(source: §Authorization Matrix — `GET /channels/{nickname}` público; `PUT|DELETE …/subscription` e `GET /me/subscriptions` autenticados)_

**Rendering strategy:** Server Component (RSC) lê `GET /channels/{nickname}` (com `subscriber_count` e `viewer_subscribed`) via `publicRead`; o layout com sessão lê os 7 primeiros canais seguidos (`GET /me/subscriptions?limit=7`) e hidrata um contexto cliente compartilhado entre o Subscribe e o menu lateral; Client Components só para o Subscribe, o "Show more" e o item ativo do menu _(source: `social-interactions/TD-09`; leitura RSC per `video-channel-management/TD-12`)_

**Reused DS components:**
- `app/(app)/channel/[nickname]/page.tsx` — Channel Show — RSC da rota — Já existe (Fase 04). Lê `subscriber_count` e `viewer_subscribed` do `GET /channels/{nickname}` (`social-interactions/TD-04`)
- `components/channel/channel-header.tsx` — channel header row — O slot `actions` (vazio na Fase 04) recebe o SubscribeButton
- `components/channel/channel-info.tsx` — channel info — Meta row passa a "@nickname • N subscribers • N videos"
- `components/ui/button.tsx` — Button Subscribe — Herdado da Fase 04 — primitivo visual do SubscribeButton
- `components/channel/subscribe-button.tsx (new)` — SubscribeButton — see screen: Página de visualização do vídeo — interações (Video show)
- `components/ui/icon-button.tsx` — IconButton notifications — Sino de notificações sem capability — **não renderizado**
- `components/layout/app-shell.tsx (new)` — Body / app shell — SideNav + conteúdo principal. Com sessão, em todas as rotas `(app)` exceto a watch page (decisão do usuário); sem sessão, só o conteúdo
- `components/layout/side-nav.tsx (new)` — SideNav — Herdado da Fase 04. Frame 150:959: grupo de navegação, divisória, seção "You", divisória, seção "Subscriptions". Fixa (sem colapso nesta fase — o "≡" e o mobile ficam para a Fase 07)
- `components/layout/side-nav-item.tsx (new)` — SideNav item Home / Subscriptions / Your videos — Herdado da Fase 04. Destinos: Home → `/`, Subscriptions → `/feed/subscriptions`, Your videos → `/studio/videos`; item ativo pela rota atual. Ícones home/subscriptions/your videos ainda não existem em `components/icons/`
- `components/layout/side-nav-subscriptions.tsx (new)` — SideNav subscriptions list — Herdado da Fase 04 como placeholder; agora real: título "Subscriptions" + canais seguidos (avatar de iniciais `components/channel/channel-avatar.tsx` + nome) com link para `/channel/{nickname}`. Carregado no layout via `GET /me/subscriptions` e atualizado por um contexto cliente compartilhado com o SubscribeButton (`TD-08`, `TD-09`). Mostra os 7 primeiros em ordem alfabética e "Show more" carrega o restante (per `social-interactions/TD-08`, Revisions 2026-10-20)

**Server-connected components:**
- `Channel Show — RSC da rota` / `channel info` — verbs: Exibir a contagem de inscritos do canal no cabeçalho | endpoint: `GET /channels/{nickname}` → `subscriber_count` (RSC via `publicRead` — §API Contracts → backend tier) | reuse: `components/channel/channel-info.tsx`
- `SubscribeButton` — verbs: Inscrever-se ou cancelar a inscrição no canal; Levar o visitante anônimo ao login ao tentar se inscrever | endpoint: `PUT /api/channels/{nickname}/subscription`, `DELETE /api/channels/{nickname}/subscription` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection) | reuse: new
- `SideNav subscriptions list` — verbs: Exibir no menu lateral os canais seguidos, com acesso à página de cada canal; Refletir no menu lateral a inscrição ou a desinscrição feita na página | endpoint: `GET /me/subscriptions?limit=7` (RSC do layout); `GET /api/me/subscriptions` para "Show more" (§API Contracts → BFF tier) | reuse: new

**Behaviors:**

*Rendered states:*
- Loading: RSC dinâmica; o menu lateral chega pronto com os 7 primeiros canais
- Empty: usuário sem inscrições → seção "Subscriptions" do menu sem lista (só o título omitido ou texto muted "No subscriptions yet"); canal com 0 inscritos → "0 subscribers"
- Success: cabeçalho do canal com "@nickname • N subscribers • N videos" e Subscribe à direita; menu lateral fixo à esquerda com Home, Subscriptions, Your videos e a lista de canais seguidos
- Error: 404 do canal → `not-found` da rota (Fase 04); falha ao ler `/me/subscriptions` no layout → menu renderiza sem a seção de canais (não bloqueia a página)

*Interactions:*
- Subscribe/Subscribed click → mesma mecânica otimista da watch page; o canal entra/sai da lista do menu lateral na hora, em ordem alfabética (contexto compartilhado, per `TD-09`)
- "Show more" no menu → `GET /api/me/subscriptions?cursor=` e anexa os canais; esgotado o cursor, o botão some
- Item do menu click → navega (`<Link>`); o item da rota atual fica destacado
- Dono vendo o próprio canal → sem Subscribe; o sino (158:2691) não é renderizado
- Anônimo clica em Subscribe → `/login?returnTo=/channel/{nickname}` (per `TD-10`)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `CHANNEL_NOT_FOUND` | Leitura: `notFound()` (Fase 04); mutação num canal que mudou de nickname → toast e reverte o otimista |
| `UNAUTHORIZED` | Sessão expirada → `/login?returnTo=/channel/{nickname}` |
| `CANNOT_SUBSCRIBE_OWN_CHANNEL` | Não deveria ocorrer (botão oculto para o dono) → reverte o otimista |

**Client-side validation mirror:** _Nenhum formulário nesta tela._

**Accessibility notes:**
- O menu lateral é um `<nav aria-label="Main">` com `aria-current="page"` no item ativo
- A seção "Subscriptions" é uma lista com cabeçalho; avatares de iniciais são decorativos quando o nome do canal acompanha
- "Subscribe"/"Subscribed" com `aria-pressed`

#### Screen: Feed das inscrições (base visual: Home / Catalog Show)

**Route:** `/feed/subscriptions`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`) — referência visual: `docs/inventories/assets/phase-06/Home (Catalog Show).png`; o feed não tem frame próprio (base visual por decisão do usuário)
**Purpose:** "Área de canais seguidos com acesso rápido aos vídeos"

**Auth requirement:** Authenticated _(source: §Authorization Matrix — `GET /me/subscriptions/videos`); o `proxy.ts` redireciona o anônimo para `/login?returnTo=/feed/subscriptions`, como no estúdio_

**Rendering strategy:** Server Component (RSC) lê `GET /me/subscriptions/videos` com o `Bearer` da sessão; paginação por `searchParams` (`cursor`) com o `LoadMore` do estúdio, como a página do canal _(source: `video-channel-management/TD-12`)_

**Reused DS components:**
- `components/layout/app-shell.tsx (new)` — Body / app shell — see screen: Página pública do canal — inscrição e menu lateral (Channel Show)
- `components/layout/side-nav-subscriptions.tsx (new)` — SideNav e subscriptions list — see screen: Página pública do canal — inscrição e menu lateral (Channel Show); o item "Subscriptions" fica ativo nesta rota
- `components/ui/filter-chip.tsx` — Chips de categoria — **Não renderizados** — o filtro por categoria é da home (Fase 07)
- `components/feed/subscription-video-grid.tsx (new)` — Grid de vídeos do feed — Grid de 4 colunas (frame Home) com os vídeos públicos dos canais seguidos, mais recentes primeiro
- `components/videos/video-card.tsx` — VideoCard com avatar do canal — O frame Home usa a variante com avatar do canal à esquerda do título (DS 143:2505); o card atual tem `default`/`horizontal` sem avatar — falta a variante com avatar (`components/channel/channel-avatar.tsx`). Nome do canal visível; selo de verificado não renderizado. Sem mudança de contrato: `VideoCardItem.channel` já traz `{ nickname, name }` (resolução OQ-5)
- `components/studio/load-more.tsx` — "Load more" do feed — O frame mostra um spinner de scroll infinito; decisão do usuário: botão "Load more" pedindo ao RSC a próxima página por `cursor` (mesmo padrão do canal); scroll infinito na Fase 07

**Server-connected components:**
- `Feed page — RSC da rota` / `Grid de vídeos do feed` / `VideoCard com avatar do canal` — verbs: Exibir os vídeos públicos mais recentes dos canais seguidos | endpoint: `GET /me/subscriptions/videos` (RSC via `upstream` com `Bearer` — §API Contracts → backend tier) | reuse: new / `components/videos/video-card.tsx`
- `"Load more" do feed` — verbs: Carregar mais vídeos do feed | endpoint: `GET /me/subscriptions/videos?cursor=` (RSC — o botão só muda `searchParams`) | reuse: `components/studio/load-more.tsx`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton do grid (padrão das páginas do estúdio)
- Empty: sem inscrições, ou canais seguidos sem vídeos públicos → texto muted + link para a home (`/`)
- Success: título "Subscriptions" + grid de cards (thumbnail, avatar do canal, título em 2 linhas, nome do canal, "N views • tempo") + "Load more" enquanto houver `next_cursor`
- Error: falha do upstream → `error.tsx` da rota com "Try again"

*Interactions:*
- Card click → `/watch/{publicId}`; avatar/nome do canal click → `/channel/{nickname}`
- "Load more" click → nova página pelo RSC (`cursor=next_cursor`), anexada ao grid
- O feed não reflete inscrições feitas em outra aba até a próxima navegação

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `UNAUTHORIZED` / 401 | Sessão expirada → `/login?returnTo=/feed/subscriptions` |
| `VALIDATION_ERROR` | `cursor` adulterado na URL → recarrega a primeira página |

**Client-side validation mirror:** _Nenhum formulário nesta tela._

**Accessibility notes:**
- Thumbnails com `alt` vazio quando o título é o texto do link
- O estado vazio precisa de um texto que leve à descoberta de canais (link para a home)

### Frontend Runtime

#### social-interactions/TD-09 — Estratégia de dados do frontend para as interações (reavaliação de `video-channel-management/TD-12`)

**Pattern:** atende a UI otimista com primitivos do React 19 já usados pelo Next 16, não multiplica leituras sob o throttler e mantém TD-12 válido para o resto da app; a Option B passa a se pagar se a Fase 07 (home com scroll infinito, busca) trouxer mais listas paginadas no cliente, e a migração continua aditiva. Decisão: `useOptimistic` + reconciliação pela resposta da mutação, sem `router.refresh()` nas interações; primeira página de comentários no RSC e o resto paginado no cliente via BFF; contexto cliente compartilhado entre "Subscribe" e o menu lateral; TanStack Query reavaliado na Fase 07.

**Setup:**

```tsx
// next-frontend/hooks/use-optimistic-mutation.ts — estado confirmado + otimista, reconciliado pela resposta (per TD-03)
const [confirmed, setConfirmed] = useState(initial) // vem do RSC (per TD-04)
const [shown, show] = useOptimistic(confirmed, (_current, next: T) => next)
const run = (next: T, request: () => Promise<Response>) =>
  startTransition(async () => {
    show(next)
    const res = await request()
    if (!res.ok) return toast.error(messageFor(res)) // sem setConfirmed: o otimista volta ao confirmado ao fim da transição
    const body = (await res.json()) as T
    startTransition(() => setConfirmed(body)) // update após await precisa de novo startTransition
  })

// next-frontend/components/layout/subscriptions-provider.tsx — semeado pelo RSC do layout; o SubscribeButton chama onChange
<SubscriptionsProvider initial={firstPage /* GET /me/subscriptions?limit=7 */}>{children}</SubscriptionsProvider>
```

**Aplicação:**

- **Adopts the pattern:** os componentes de mutação de `## UI Inventory → ### Server-connected Components` desta fase — `SubscribeButton`, `Par like/dislike do vídeo`, `Like/dislike do comentário`, `Composer "Add a comment…"`, `Composer de resposta`, `Menu "⋮" do comentário — Edit / Delete` — e as listas paginadas no cliente (`Lista de comentários`, `Alternância "N replies" / respostas`, `SideNav subscriptions list` no "Show more").
  - **Excludes / boundaries:**
    - `Watch page — RSC da rota`, `Channel Show — RSC da rota`, `Feed page — RSC da rota` — leitura inicial no RSC (per `video-channel-management/TD-12`), sem cache cliente.
    - `"Load more" do feed` — paginação por `searchParams` no RSC (padrão da Fase 04), não por estado cliente.
    - Telas do estúdio e de auth — continuam com `router.refresh()` após mutação (TD-12 segue válido fora das interações sociais).

**Migração:**

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/app/(app)/watch/[publicId]/page.tsx` | Lê vídeo, playback e sugestões; sem estado do espectador nem comentários | Lê também a primeira página de comentários (só quando `published`) e passa `viewer_reaction`/`channel.*`/página inicial como estado inicial dos componentes otimistas | SI-06.17b |
| `next-frontend/app/(app)/layout.tsx` | Só `<AppHeader />` | Rotas com menu lateral passam a um grupo de rotas com `AppShell` + `SubscriptionsProvider` semeado por `GET /me/subscriptions?limit=7` (com sessão); a watch page fica fora do grupo | SI-06.16b |
| `next-frontend/app/(app)/channel/[nickname]/page.tsx` | Cabeçalho sem ações | Passa `subscriber_count`/`viewer_subscribed` ao `SubscribeButton` no slot `actions` | SI-06.16b |

**Verificação:**

- **Unit:** o hook aplica o estado otimista na hora, reconcilia com o corpo da resposta 200 e volta ao estado confirmado (com toast) em 4xx/5xx; o `SubscribeButton` atualiza o contexto do menu lateral só após a confirmação (Vitest + RTL, `fetch` via MSW).
- **Integration:** os Route Handlers BFF repassam o estado resultante sem reshape e respondem 401 sem sessão sem tocar o upstream (Vitest + MSW, `onUnhandledRequest: "error"`).
- **E2E:** curtir/descurtir, inscrever-se (o canal aparece no menu lateral sem recarregar), comentar, responder, editar e excluir na watch page — sem nova requisição de `GET /videos/{publicId}`/`/playback` após cada clique (nenhum `router.refresh()`).
- **Regression guards:** os E2E da Fase 05 (player, registro de visualização, download) e da Fase 04 (estúdio, página do canal) continuam passando.

### UI ↔ API Traceability Matrix

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Curtir, descurtir ou remover a própria reação ao vídeo, exibindo a contagem de likes e o estado da minha reação | Par like/dislike do vídeo | /watch/{publicId} | PUT\|DELETE /api/videos/{publicId}/reaction → forwards-to PUT\|DELETE /videos/{publicId}/reaction | social-interactions/TD-01, TD-02, TD-03, TD-04, TD-09 |
| Inscrever-se ou cancelar a inscrição no canal do vídeo | SubscribeButton | /watch/{publicId} | PUT\|DELETE /api/channels/{nickname}/subscription → forwards-to PUT\|DELETE /channels/{nickname}/subscription | social-interactions/TD-02, TD-03, TD-09 |
| Exibir a contagem de inscritos do canal ao lado do nome, abaixo do player | Canal do vídeo — avatar + nome + inscritos | /watch/{publicId} | GET /videos/{publicId} → `channel.subscriber_count` (RSC via `publicRead`) | social-interactions/TD-04 |
| Exibir os comentários do vídeo paginados, com a contagem total e ordenação por mais recentes ou mais curtidos | Seção de comentários; Seletor "Sort by"; Lista de comentários; Item de comentário | /watch/{publicId} | GET /videos/{publicId}/comments (RSC, 1ª página); GET /api/videos/{publicId}/comments → forwards-to GET /videos/{publicId}/comments | social-interactions/TD-06, TD-09 |
| Publicar um comentário no vídeo | Composer "Add a comment…" | /watch/{publicId} | POST /api/videos/{publicId}/comments → forwards-to POST /videos/{publicId}/comments | social-interactions/TD-02, TD-07 |
| Editar o próprio comentário | Menu "⋮" do comentário → Composer | /watch/{publicId} | PATCH /api/comments/{commentId} → forwards-to PATCH /comments/{commentId} | social-interactions/TD-06, TD-07 |
| Excluir o próprio comentário (com as respostas, se for raiz) | Menu "⋮" do comentário | /watch/{publicId} | DELETE /api/comments/{commentId} → forwards-to DELETE /comments/{commentId} | social-interactions/TD-02, TD-07 |
| Responder a um comentário na thread da raiz | Composer de resposta | /watch/{publicId} | POST /api/comments/{commentId}/replies → forwards-to POST /comments/{commentId}/replies | social-interactions/TD-05 |
| Exibir as respostas de um comentário sob demanda | Alternância "N replies" / respostas | /watch/{publicId} | GET /api/comments/{commentId}/replies → forwards-to GET /comments/{commentId}/replies | social-interactions/TD-05, TD-06 |
| Curtir, descurtir ou remover a própria reação a um comentário ou resposta | Like/dislike do comentário | /watch/{publicId} | PUT\|DELETE /api/comments/{commentId}/reaction → forwards-to PUT\|DELETE /comments/{commentId}/reaction | social-interactions/TD-01, TD-02, TD-03 |
| Levar o visitante anônimo ao login ao tentar reagir, comentar, responder ou se inscrever | SubscribeButton; Par like/dislike do vídeo; Composer; Botão "Reply"; Like/dislike do comentário | /watch/{publicId} | — (navegação client-side para `/login?returnTo=`; nenhuma chamada) | social-interactions/TD-10 |
| Exibir a contagem de inscritos do canal no cabeçalho | Subscribers count em channel info | /channel/{nickname} | GET /channels/{nickname} → `subscriber_count` (RSC via `publicRead`) | social-interactions/TD-02, TD-04 |
| Inscrever-se ou cancelar a inscrição no canal | SubscribeButton | /channel/{nickname} | PUT\|DELETE /api/channels/{nickname}/subscription → forwards-to PUT\|DELETE /channels/{nickname}/subscription | social-interactions/TD-03, TD-09 |
| Exibir no menu lateral os canais seguidos, com acesso à página de cada canal | SideNav subscriptions list | /channel/{nickname} | GET /me/subscriptions?limit=7 (RSC do layout); GET /api/me/subscriptions → forwards-to GET /me/subscriptions | social-interactions/TD-08 |
| Refletir no menu lateral a inscrição ou a desinscrição feita na página | SideNav subscriptions list (via contexto do SubscribeButton) | /channel/{nickname} | — (estado cliente compartilhado; reconciliado pela resposta de PUT\|DELETE /api/channels/{nickname}/subscription) | social-interactions/TD-08, TD-09 |
| Levar o visitante anônimo ao login ao tentar se inscrever | SubscribeButton | /channel/{nickname} | — (navegação client-side para `/login?returnTo=`) | social-interactions/TD-10 |
| Exibir os vídeos públicos mais recentes dos canais seguidos | Feed page — RSC da rota; Grid de vídeos do feed; VideoCard com avatar do canal | /feed/subscriptions | GET /me/subscriptions/videos (RSC via `upstream` com `Bearer`) | social-interactions/TD-08 |
| Carregar mais vídeos do feed | "Load more" do feed | /feed/subscriptions | GET /me/subscriptions/videos?cursor= (RSC) | social-interactions/TD-08 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix._

---

## Dependency Map

```
Backend
SI-06.1.1 (root) — migration
└── SI-06.1.2 — depends on SI-06.1.1 (entidades sobre o schema)
    ├── SI-06.2 — reação a vídeo (ReactionsModule, reactionTransition)
    │   ├── SI-06.4 — também depends on SI-06.3 (estado do espectador nas leituras)
    │   ├── SI-06.5 — também depends on SI-06.1.2 (comentários; viewer_reaction pelo ReactionsModule)
    │   │   ├── SI-06.6 — respostas
    │   │   └── SI-06.7 — também depends on SI-06.2 (reação a comentário)
    └── SI-06.3 — inscrição (SubscriptionsModule)
        ├── SI-06.4 — (ver acima)
        └── SI-06.8 — canais seguidos + feed

Contrato + BFF
SI-06.9 — depends on SI-06.4, SI-06.5, SI-06.6, SI-06.7, SI-06.8 (OpenAPI + aliases + MSW)
├── SI-06.10 — BFF de reação e inscrição
└── SI-06.11 — BFF de comentários, respostas e canais seguidos

Bootstrap (roots, independentes do backend)
SI-06.0.1 (root) — thumb-down-icon, app-shell, side-nav, side-nav-item, grid do feed
└── SI-06.0.2 — ícones do menu e variantes preenchidas
SI-06.0.3 (root) — comment-item, comment-sort-menu
SI-06.0.4 (root) — comment-composer
SI-06.0.5 (root) — comment-actions-menu

Frontend Runtime (social-interactions/TD-09)
SI-06.12 (root) — Setup: useOptimisticMutation + SubscriptionsProvider
├── SI-06.13 — depends on SI-06.0.2, SI-06.10, SI-06.12 (subscribe, reação a vídeo e a comentário)
│   └── SI-06.14 — também depends on SI-06.0.3, SI-06.0.4, SI-06.0.5, SI-06.11 (seção de comentários)
└── SI-06.15 — depends on SI-06.0.1, SI-06.11, SI-06.12 (canais seguidos no menu)

Telas
SI-06.16.0 — depends on SI-06.0.1, SI-06.0.2, SI-06.13, SI-06.15 (audit canal + menu)
└── SI-06.16a — + SI-06.0.1, SI-06.0.2 (shell)
    └── SI-06.16b — + SI-06.3, SI-06.4, SI-06.8, SI-06.9, SI-06.10, SI-06.11, SI-06.12, SI-06.13, SI-06.15 (grupo (shell) + wiring do canal)
        └── SI-06.18.0 — + SI-06.0.1, SI-06.15 (audit feed; precisa do grupo (shell))
            └── SI-06.18a — + SI-06.0.1 (shell do feed)
                └── SI-06.18b — + SI-06.8, SI-06.9 (proxy + wiring do feed)
SI-06.17.0 — depends on SI-06.0.1..SI-06.0.5, SI-06.13, SI-06.14 (audit watch)
└── SI-06.17a — + SI-06.0.1..SI-06.0.5 (shell)
    └── SI-06.17b — + SI-06.2..SI-06.7, SI-06.9..SI-06.14 (wiring da watch)

Verificação
SI-06.19 — depends on SI-06.12, SI-06.16b, SI-06.17b (testes do hook/contexto + regression guards das Fases 04/05)
```

---

## Deliverables

- [ ] SI-06.0.1 — Custom-business simple group: thumb-down-icon + app-shell + side-nav + side-nav-item + subscription-video-grid
- [ ] SI-06.0.2 — Custom-business simple group: ícones do menu lateral e variantes preenchidas
- [ ] SI-06.0.3 — Custom-business simple group: comment-item + comment-sort-menu
- [ ] SI-06.0.4 — Custom-business complex: comment-composer
- [ ] SI-06.0.5 — Custom-business complex: comment-actions-menu
- [ ] SI-06.1.1 — Infra: migration das interações sociais
- [ ] SI-06.1.2 — Entidades das interações sociais
- [ ] SI-06.2 — Endpoints PUT/DELETE /videos/{publicId}/reaction
- [ ] SI-06.3 — Endpoints PUT/DELETE /channels/{nickname}/subscription
- [ ] SI-06.4 — Estado do espectador em GET /videos/{publicId} e GET /channels/{nickname}
- [ ] SI-06.5 — Endpoints de comentários: GET/POST /videos/{publicId}/comments, PATCH/DELETE /comments/{commentId}
- [ ] SI-06.6 — Endpoints de respostas: GET/POST /comments/{commentId}/replies
- [ ] SI-06.7 — Endpoints PUT/DELETE /comments/{commentId}/reaction
- [ ] SI-06.8 — Endpoints GET /me/subscriptions e GET /me/subscriptions/videos
- [ ] SI-06.9 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- [ ] SI-06.10 — Route Handlers BFF de reação e inscrição
- [ ] SI-06.11 — Route Handlers BFF de comentários, respostas e canais seguidos
- [ ] SI-06.12 — Mutação otimista e contexto de inscrições (Setup)
- [ ] SI-06.13 — Componentes otimistas de reação e inscrição
- [ ] SI-06.14 — Seção de comentários (lista, respostas e mutações no cliente)
- [ ] SI-06.15 — Lista de canais seguidos no menu lateral
- [ ] SI-06.16.0 — Drift audit: Página pública do canal — inscrição e menu lateral (Channel Show)
- [ ] SI-06.16a — Tela de Página pública do canal — inscrição e menu lateral (visual shell)
- [ ] SI-06.16b — Tela de Página pública do canal — inscrição e menu lateral (lógica & wiring)
- [ ] SI-06.17.0 — Drift audit: Página de visualização do vídeo — interações (Video show)
- [ ] SI-06.17a — Tela de Página de visualização do vídeo — interações (visual shell)
- [ ] SI-06.17b — Tela de Página de visualização do vídeo — interações (lógica & wiring)
- [ ] SI-06.18.0 — Drift audit: Feed das inscrições (base visual: Home / Catalog Show)
- [ ] SI-06.18a — Tela de Feed das inscrições (visual shell)
- [ ] SI-06.18b — Tela de Feed das inscrições (lógica & wiring)
- [ ] SI-06.19 — Mutação otimista e contexto de inscrições (Verification)

**Per-screen deliverables:**

- [ ] Screen Página de visualização do vídeo — interações (`/watch/{publicId}`) is routable
- [ ] Screen Página de visualização do vídeo — interações (`/watch/{publicId}`) renders loading, success, and error states (inclusive vídeo não publicado do dono sem seção social)
- [ ] Screen Página de visualização do vídeo — interações (`/watch/{publicId}`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Página pública do canal — inscrição e menu lateral (`/channel/{nickname}`) is routable
- [ ] Screen Página pública do canal — inscrição e menu lateral (`/channel/{nickname}`) renders loading, success, and error states
- [ ] Screen Página pública do canal — inscrição e menu lateral (`/channel/{nickname}`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Feed das inscrições (`/feed/subscriptions`) is routable
- [ ] Screen Feed das inscrições (`/feed/subscriptions`) renders loading, success, and error states
- [ ] Screen Feed das inscrições (`/feed/subscriptions`) passes component tests (per testing-guide-next-frontend layers)

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type/lint checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit && docker compose exec nestjs-api npm run lint`)
- [ ] OpenAPI chain in sync (`docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` → `docker compose exec next-frontend npm run openapi:types`; `git diff --exit-code next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` vazio)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type/lint checks pass (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose restart next-frontend && docker compose exec next-frontend npm run build && docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"`, depois no host `node node_modules/@playwright/test/cli.js test`)
