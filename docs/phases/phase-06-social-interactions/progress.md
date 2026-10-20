# phase-06-social-interactions — Progress

**Status:** completed
**SIs:** 31/31 completed

### SI-06.0.1 — Custom-business simple group: thumb-down-icon + app-shell + side-nav + side-nav-item + subscription-video-grid
- **Status:** completed
- **Tests:** 13 passing
- **Observations:**
  - `AppShell` envolve o conteúdo numa `<div>` (não `<main>` como o plano sugeria): todas as páginas `(app)` já renderizam o próprio `<main>`, e aninhar dois landmarks `main` é inválido.

### SI-06.0.2 — Custom-business simple group: ícones do menu lateral e variantes preenchidas
- **Status:** completed
- **Tests:** no tests (icons — testing-guide: Icon → None); `tsc --noEmit` e eslint dos arquivos tocados exit 0
- **Observations:**
  - O `thumb-up-icon.tsx` existente já era o glifo sólido (métrica de likes do estúdio); a variante nova é a **contornada** (estado inativo da reação), via prop `filled` com default `true` — o consumidor `components/studio/video-stats.tsx` segue idêntico. O `thumb-down-icon.tsx` ganhou a mesma prop.
  - Paths dos ícones novos tirados do Material Icons (24×24); reconciliar com o Figma quando a MCP voltar (OQ-4).

### SI-06.0.3 — Custom-business simple group: comment-item + comment-sort-menu
- **Status:** completed
- **Tests:** 8 passing
- **Observations:**
  - `CommentItem` ganhou um slot `editor` (substitui o texto durante a edição) além dos slots de reações, Reply, menu "⋮" e respostas, para a SI-06.14 encaixar o composer de edição sem duplicar o item.

### SI-06.0.4 — Custom-business complex: comment-composer
- **Status:** completed
- **Tests:** 7 passing (1 fix attempt)
- **Observations:**
  - Formulário com react-hook-form + zod (`trim`, 1–2.000), conforme `phase-02-auth-frontend/TD-04` herdada. Com `mode: "onChange"` o RHF só calcula `isValid` após a primeira validação; o composer pré-preenchido (edição, ou `@nickname ` na resposta) agora valida no mount para o botão nascer habilitado.
  - O link do anônimo mantém as barras legíveis (`/login?returnTo=/watch/tech-01`), como o `proxy.ts`, porque é o formato que o spec E2E `watch-social` espera.
  - O campo usa o `Textarea` do DS sem sobrescrever o visual; o "campo com sublinhado" do Figma fica para o drift audit da watch page (SI-06.17.0) decidir.

### SI-06.0.5 — Custom-business complex: comment-actions-menu
- **Status:** completed
- **Tests:** 7 passing
- **Observations:** none

### SI-06.1.1 — Infra: migration das interações sociais (auto-split from SI-06.1 by /plan-build)
- **Status:** completed
- **Tests:** no tests (Infra); migration:run → revert → run sem erro no container; \d comments conferido
- **Observations:**
  - SQL escrito à mão conforme o plano (nomes de PK/FK/índices explícitos e legíveis). A regra `.claude/rules/typeorm-migrations.md` prefere SQL gerado pela CLI; a equivalência é provada na SI-06.1.2 por `migration:generate` sem diferença depois das entidades, que declaram os mesmos nomes.

### SI-06.1.2 — Entidades das interações sociais (auto-split from SI-06.1 by /plan-build)
- **Status:** completed
- **Tests:** 16 passing; migration:generate → "No changes in database schema"; eslint dos arquivos tocados exit 0
- **Observations:**
  - Nomes de PK/FK/índices/enum declarados explicitamente nas entidades (`primaryKeyConstraintName`, `foreignKeyConstraintName`, `@Index(name)`, `enumName`), iguais aos da migration — necessário também porque os testes de integração usam `synchronize: true` sobre o banco de dev.
  - Desvios conscientes da regra `nestjs-entities.md`: tabelas de reação/inscrição com PK composta (decisão de `social-interactions/TD-01`/Data Model, não `@PrimaryGeneratedColumn`), `Subscription` sem `updated_at` (Data Model) e relações `ManyToOne` unidirecionais para `User`/`Video`/`Channel` (mesmo precedente do `VideoView` da Fase 05, evita acoplar as entidades centrais aos módulos novos).
  - Novo helper de teste `src/test/social-fixtures.ts` (`seedUserWithChannel`, `seedVideo` publicado) reutilizável pelas SIs 06.2–06.8.
  - Arquivos novos nasceram LF num repositório CRLF; `eslint --fix` aplicado só nos arquivos tocados (nunca em pastas).

### SI-06.2 — Endpoints PUT/DELETE /videos/{publicId}/reaction
- **Status:** completed
- **Tests:** 25 passing (20 unit/integration + 5 E2E de videos-reaction.plan.md); lint e tsc exit 0
- **Observations:**
  - Contadores de `videos` atualizados por SQL direto (`UPDATE … SET like_count = like_count + $1 …`): o `increment`/update do TypeORM também altera `updated_at`, que versiona a URL pública da thumbnail (`?v=`) — um like não invalida o cache da imagem (teste de integração cobre).
  - **Follow-up fora de escopo:** o registro de visualização da Fase 05 (`VideoViewsService`, `manager.increment`) bumpa `videos.updated_at` a cada view contada, mudando o `?v=` da thumbnail; vale migrar para o mesmo SQL direto numa task separada.
  - Protocolo de lock extraído em `src/reactions/reaction-writer.ts` (`writeReaction`), reaproveitado pela reação a comentários (SI-06.7).
  - Novo helper de E2E `test/support/social-app.ts`: semeia direto no banco e assina o access token com o `JwtService` da app (`{ sub, email }`, mesmo payload do login) — o `JwtAuthGuard` só verifica assinatura; evita cadastro/e-mail/storage em cada spec da fase.
  - `seedUserWithChannel` ganhou `exact: { nickname, name }` para os cenários que citam o canal pelo nome.

### SI-06.3 — Endpoints PUT/DELETE /channels/{nickname}/subscription
- **Status:** completed
- **Tests:** 15 passing (unit 5, integration 3 + entity 2, module 1, e2e 4 — channels-subscription)
- **Observations:**
  - `SubscriptionsService.subscribe/unsubscribe` recebem o nickname e resolvem o canal internamente (404 `CHANNEL_NOT_FOUND`) em vez de receber o `Channel` já carregado — o controller fica sem lógica; mesma semântica do plano.
  - Exceção `CannotSubscribeOwnChannelException` em `src/subscriptions/subscriptions.exceptions.ts`, seguindo o padrão de `channels.exceptions.ts`.
  - Integração extra: o contador muda por SQL direto e não altera `channels.updated_at`.

### SI-06.4 — Estado do espectador em GET /videos/{publicId} e GET /channels/{nickname}
- **Status:** completed
- **Tests:** 297 unit+integration (34 suites em subscriptions/channels/videos/users/reactions) + 28 e2e (7 suites, incl. social-viewer-state 4)
- **Observations:**
  - `VideosService.getVideo(video, viewerId?)`: só `GET /videos/{publicId}` passa o usuário; as respostas do estúdio (edição, publicação, thumbnail) saem com `viewer_reaction: null` e `viewer_subscribed: false`.
  - `ChannelsService` passou a depender de `SubscriptionsService`; as suítes que o montam com `new` usam o helper novo `src/test/channels-service.ts` (`createChannelsService`/`createSubscriptionsService`), e o unit spec recebe um stub.
  - Asserções de forma da Fase 04/05 atualizadas para o contrato novo (TD-04): `test/videos-get.e2e-spec.ts` (canal com `subscriber_count`/`viewer_subscribed`), `test/channels-me.e2e-spec.ts` (chaves do canal público), `videos.service.spec.ts`.
  - `viewer_reaction` documentado com `enum` inline (sem `enumName`), igual ao `ReactionStateResponse`.

### SI-06.5 — Endpoints de comentários: GET/POST /videos/{publicId}/comments, PATCH/DELETE /comments/{commentId}
- **Status:** completed
- **Tests:** 21 passing no SI (unit 7, DTO 6, module 1, integration 6 + entidade 3 já existentes, e2e comments 7) + regressão: 13 suítes unit/integração (64) e 3 e2e (15)
- **Observations:**
  - Leitura em lote do `viewer_reaction` dos comentários entregue como `CommentReactionsService.findViewerReactions` (exportado pelo `ReactionsModule`); a escrita entra no SI-06.7.
  - Cursor `top` guarda `like_count|created_at` no `value` do `encodeCursor` existente; valor malformado → 400 `VALIDATION_ERROR` (`InvalidCursorException`).
  - `CursorPageQuery` (em `src/videos/dto/list-videos.dto.ts`) passou a ser exportada e é a base de `ListCommentsQuery`.
  - Id malformado em `PATCH|DELETE /comments/{id}` → 404 `COMMENT_NOT_FOUND` via `isUUID` no serviço (sem `ParseUUIDPipe`, que daria 400).
  - E2E 2.2 semeia respostas e a reação pelo repositório; o SI-06.6/06.7 troca para os endpoints.
  - Fixture nova `seedComment` em `src/test/social-fixtures.ts`.

### SI-06.6 — Endpoints de respostas: GET/POST /comments/{commentId}/replies
- **Status:** completed
- **Tests:** 27 unit+integration em src/comments (unit +2, integration +2) + 12 e2e (comments-replies 5, comments 7)
- **Observations:**
  - `listRoots`/`listReplies` compartilham o `readPage` privado (busca `limit + 1` e monta o cursor com o `created_at` em texto); o cursor das respostas usa a ordenação `oldest`.
  - `reply` mapeia violação de FK (raiz excluída entre a leitura e a escrita) para 404 `COMMENT_NOT_FOUND`.
  - `@ApiBearerAuth` do `CommentsController` saiu da classe para os métodos protegidos, porque `GET /comments/{id}/replies` é `@Public()`.
  - E2E `comments` 2.2 agora cria as respostas por `POST /comments/{id}/replies`; a reação continua semeada até o SI-06.7.
  - O e2e de respostas troca o IP (`X-Forwarded-For`) por requisição para que o seed de 22 respostas não esbarre no throttler global (10/min por rota).

### SI-06.7 — Endpoints PUT/DELETE /comments/{commentId}/reaction
- **Status:** completed
- **Tests:** 118 unit+integration (15 suítes: reactions, comments, videos.service.spec, videos.module; novos: comment-reactions unit 7 + integration 3) + 21 e2e (comments-reaction 4, comments 7, comments-replies 5, videos-reaction 5)
- **Observations:**
  - `CommentReactionsService` concentra a escrita (`set`/`remove`, reaproveitando `writeReaction` + `reactionDelta`) e a leitura em lote criada no SI-06.5; o `ReactionsModule` lê `Comment` por `forFeature` e importa só a classe `CommentNotFoundException` do domínio de comentários (sem importar o `CommentsModule`).
  - Se o comentário for excluído no meio da escrita (a cascata leva a reação), o serviço responde 404 `COMMENT_NOT_FOUND` em vez de devolver contadores vazios.
  - E2E `comments` 2.2 agora reage pelo `PUT /comments/{id}/reaction`; o cenário inteiro passa só por HTTP.

### SI-06.8 — Endpoints GET /me/subscriptions e GET /me/subscriptions/videos
- **Status:** completed
- **Tests:** 32 unit+integration (subscriptions 4 suítes; videos-listing 17 incl. 2 do feed; módulos) + 16 e2e (me-subscriptions 4, channels-subscription 4, channels-videos 4, channels-me 4)
- **Observations:**
  - `GET /me/subscriptions` fica no `MeSubscriptionsController` (SubscriptionsModule) e `GET /me/subscriptions/videos` no `SubscriptionFeedController` (VideosModule, dono dos cards); os dois compartilham o prefixo `me/subscriptions`.
  - Feed por join na leitura com `subscriptions` + `innerJoinAndSelect` do canal (joins 1:1, linhas cruas alinhadas) reaproveitando o `page()` com `CHANNEL_SORTS.latest`; `listChannels` faz keyset `(name, id)` com o nome de ordenação `name`.
  - Query DTOs `ListSubscriptionsQuery` e `ListSubscriptionFeedDto` estendem `CursorPageQuery` (exportada no SI-06.5).

### SI-06.9 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- **Status:** completed
- **Tests:** no tests (contract sync) — critérios de aceite verificados por um teste Vitest temporário contra o MSW (4/4, removido); regressão: Vitest completo 639/639 (103 arquivos), lint e tsc limpos; openapi.json idêntico nos dois subprojetos
- **Observations:**
  - Cadeia OpenAPI completa (`openapi:export` → `sync-openapi.sh` → `openapi:types`); aliases novos em `lib/api/contracts.ts`: `ReactionValue`, `ReactionState`, `SetReactionInput`, `SubscriptionState`, `Comment`, `CommentsPage`, `CommentsQuery`, `CommentSort`, `CreateCommentInput`, `UpdateCommentInput`, `SubscribedChannelsPage`, `SubscribedChannel`, `SubscriptionFeedPage`.
  - Store social em `studioStore().social` com seed em `mocks/factories/social.ts`; regras compartilhadas em `mocks/handlers/_social.ts`; handlers novos `comments.ts` e `subscriptions.ts`; `videos.ts`/`channels.ts` estendidos. `VideoEntry.owner` marca vídeos de `tech_mastery` (`tech-01`, `comments-down-id`), que respondem 403 a mutações do estúdio.
  - `published-01` ganhou 10 raízes + 2 respostas para manter o `comment_count` 12 já existente na factory.
  - Triggers e seed documentados em `next-frontend/CLAUDE.md` → E2E architecture.

### SI-06.10 — Route Handlers BFF de reação e inscrição
- **Status:** completed
- **Tests:** 18 passing (integration: videos reaction 8, comments reaction 5, channels subscription 5); lint e tsc limpos
- **Observations:**
  - Rotas com corpo leem o JSON antes do `withSession` (padrão existente do `PATCH /api/videos/{id}`): JSON inválido → 400 sem chamar o upstream.
  - Contextos `CommentIdContext` e `NicknameContext` exportados de `lib/api/bff.ts` ao lado de `PublicIdContext`; árvore de `app/api/**` atualizada no `next-frontend/CLAUDE.md`.

### SI-06.11 — Route Handlers BFF de comentários, respostas e canais seguidos
- **Status:** completed
- **Tests:** 20 passing (integration: videos comments 6, comments PATCH/DELETE 7, replies 5, me/subscriptions 2) + reaction de comentário 5 (regressão); lint e tsc limpos
- **Observations:**
  - Helper novo `cursorQuery(request)` em `lib/api/bff.ts` repassa `cursor`/`limit` presentes na query (`limit` convertido para número; o upstream valida).
  - Testes leem ids do seed direto de `studioStore()` em vez de depender dos uuids gerados.
  - Árvore de `app/api/**` atualizada no `next-frontend/CLAUDE.md`.

### SI-06.12 — Mutação otimista e contexto de inscrições (Setup)
- **Status:** completed
- **Tests:** no tests (Setup SI) — tsc e lint limpos; nenhuma dependência nova; helper loginHref coberto em lib/auth/__tests__/return-to.test.ts (13 passing)
- **Observations:**
  - Linhas do Setup snippet mantidas verbatim, com um desvio mínimo: `if (!res.ok) return void toast.error(...)` — o `return toast.error(...)` do snippet não compila no React 19 (`startTransition` exige callback que retorne void e `toast.error` devolve o id).
  - Boilerplate derivado: 401 → `router.push(loginHref(pathname))` antes do ramo de erro; `messageFor` mapeia 404 (mensagem configurável, padrão "This video is no longer available"), 429 e o genérico; falha de rede vira resposta 503 no `run` exposto; opção `onConfirmed` para o SubscribeButton atualizar o menu lateral só após a confirmação.
  - Helper novo `loginHref(path)` em `lib/auth/return-to.ts` (barras legíveis, query codificada), para os componentes de interação.
  - `SubscriptionsProvider` aceita `initial` nulo (leitura do layout falhou) e `useSubscriptions()` devolve `null` fora do provider (watch page); `onChange` não insere um canal que cai depois do último carregado enquanto há páginas por vir, e `loadMore` deduplica por nickname.

### SI-06.13 — Componentes otimistas de reação e inscrição
- **Status:** completed
- **Tests:** 15 passing (unit RTL+MSW: subscribe-button 6, video-reaction-buttons 5, comment-reaction-buttons 4); lint e tsc limpos
- **Observations:**
  - Lógica de transição compartilhada em `lib/reactions.ts` (`nextReaction` com o mesmo delta do backend + `sendReaction`), usada pelos dois pares de reação.
  - `SubscribeButton` recebe `channel {nickname, name}` (para o `onChange` do menu lateral), `isOwner` (retorna null) e `onSubscriberCountChange` com a contagem confirmada; estado inscrito usa a variante `secondary` do `Button` (não desenhado no Figma).
  - Like do comentário esconde o número quando a contagem é 0 (o rótulo acessível continua "Like, 0").

### SI-06.14 — Seção de comentários (lista, respostas e mutações no cliente)
- **Status:** completed
- **Tests:** 13 passing (unit RTL+MSW: comment-section 4, comment-list 6, comment-replies 3); lint e tsc limpos
- **Observations:**
  - Derivados do plano para não duplicar lógica entre raízes e respostas: `components/comments/comment-entry.tsx` (item com reações, Reply, menu do autor, edição/exclusão via BFF) e `components/comments/comment-requests.ts` (fetch com falha de rede → 503 e mensagens do Error Catalog).
  - `CommentList` é controlada pela `CommentSection` (lista, cursor e cabeçalho ficam na seção, que também insere o comentário criado e troca a ordenação); os testes da lista usam um harness com o mesmo estado.
  - Comentário criado entra no topo em qualquer ordenação; responder uma thread ainda não carregada abre e lê a thread (o servidor já devolve a resposta nova).
  - Factory nova `buildCommentResponse` em `mocks/factories/social.ts` para os testes de componentes.
  - 1 falha corrigida no próprio teste: havia vários botões "Reply" na thread, então o submit do composer passou a ser buscado dentro do formulário.

### SI-06.15 — Lista de canais seguidos no menu lateral
- **Status:** completed
- **Tests:** 4 passing (unit RTL+MSW dentro do SubscriptionsProvider); lint e tsc limpos
- **Observations:**
  - Avatar de iniciais em 24px (`size-6`) com as iniciais reduzidas por seletor descendente (`[&_[data-slot=avatar-fallback]]:text-helper`) e `aria-hidden`, para que o nome acessível do link seja só o do canal; o `ChannelAvatar` não foi alterado.
  - Textos não desenhados: estado vazio "Channels you subscribe to will show up here." e o "Show more" com chevron, no mesmo estilo dos itens do menu.
  - 1 ajuste no teste: o helper lia o `textContent` do link (que inclui as iniciais ocultas) e passou a ler o rótulo visível.

### SI-06.16.0 — Drift audit: Página pública do canal — inscrição e menu lateral (Channel Show)
- **Status:** completed
- **Tests:** no tests (audit-only) — relatório criado: docs/phases/phase-06-social-interactions/frontend-drift-report.md
- **Observations:**
  - Auditoria feita sem Figma MCP contra `Channel Show.png` + `Left Menu.png` (2×): 7 alinhado, 1 drift menor (`app-shell` w-60 → w-64, coluna de ~256px no frame), 1 drift relevante (`channel-info` sem "N subscribers" na meta row → `+prop subscriberCount`).
  - Nenhum arquivo do `next-frontend` foi editado neste SI. O critério `git diff --name-only HEAD -- next-frontend` vazio não vale literalmente porque a árvore carrega as mudanças não commitadas dos SIs anteriores (commits são do usuário).
  - Modo contínuo: o checkpoint de override do relatório entre o audit e o SI-06.16a não pausou; as decisões padrão foram aplicadas.

### SI-06.16a — Tela de Página pública do canal — inscrição e menu lateral (visual shell)
- **Status:** completed
- **Tests:** no tests (shell) — tsc e lint limpos; regressão components/channel + components/layout 77/77
- **Observations:**
  - Decisões do drift report aplicadas: `ChannelInfo` ganhou `subscriberCount?` ("N subscribers" com singular/plural entre o nickname e os vídeos; omitido não renderiza) e `ChannelHeader` o repassa; `AppShell` com a coluna do menu em `w-64`.
  - A página do canal não muda neste SI: o encaixe visual (meta row e slot `actions`) está nos componentes do DS e a ligação aos dados é do SI-06.16b.

### SI-06.16b — Tela de Página pública do canal — inscrição e menu lateral (lógica & wiring)
- **Status:** completed
- **Tests:** unit: channel-info (estendido) + side-nav-active 11 + login route +2 (regressão components/channel, components/layout, lib, app/api/auth: verde); e2e: channel-social 5/5 + regressão channel-public, studio-channel, studio-videos, logout, auth-login — 24 passing; build e tsc limpos
- **Observations:**
  - Grupo `app/(app)/(shell)/` criado com `mv` (sem `git mv`): `page.tsx` (home), `channel/` e `studio/` dentro dele, URLs inalteradas; `watch/` ficou fora. Comentários com os caminhos antigos atualizados (`upload-provider.tsx`, layout do canal, `next-frontend/CLAUDE.md`).
  - Conflito plano/realidade resolvido: o login gravava `channelSlug` vazio (só o `PATCH /api/channel` o preenchia), então a regra do plano `session.channelSlug === nickname` nunca reconhecia o dono. O `POST /api/auth/login` agora lê `GET /channels/me` com o token novo e guarda o nickname; se a leitura falhar, o login segue com o slug vazio, como antes. Coberto por 2 testes novos de integração.
  - `getPublicChannel` passou a usar `publicRead` (Bearer da sessão quando existe), para que `viewer_subscribed` venha preenchido.
  - Wrapper cliente `components/channel/channel-social-header.tsx` mantém o "N subscribers" sincronizado com a resposta do Subscribe.
  - E2E da Fase 04 `tests/channel-public.e2e-spec.ts` 1.1 invertido (anônimo agora vê Subscribe e "1.2K subscribers") e o cenário marcado como `Source: manual` em `specs/channel-public.plan.md`, conforme autorizado.
  - Os tipos de rota gerados em `.next` apontavam para os caminhos antigos; um build novo os regenerou e o `tsc` voltou a passar.

### SI-06.17.0 — Drift audit: Página de visualização do vídeo — interações (Video show)
- **Status:** completed
- **Tests:** no tests (audit-only) — seção watch-social anexada ao frontend-drift-report.md
- **Observations:**
  - Auditoria contra `Video show.png` (2×), com a linhagem da Fase 05 (`video-show`, SI-05.11.0) e da seção `channel-show-social`: 12 alinhado, 2 drift menor (avatar do item `size-12` → `size-10`; campo do composer como linha inferior em vez de caixa), 1 drift relevante (`video-channel-link` sem "N subscribers").
  - Nenhum arquivo do `next-frontend` editado neste SI (o `git diff` da árvore inclui as mudanças não commitadas dos SIs anteriores).

### SI-06.17a — Tela de Página de visualização do vídeo — interações (visual shell)
- **Status:** completed
- **Tests:** no tests (shell) — lint e tsc limpos; regressão components/comments + components/watch 74/74
- **Observations:**
  - Decisões aplicadas: `VideoChannelLink` ganhou `subscriberCount?` (linha "N subscribers" sob o nome); avatar do `CommentItem` em `size-10`; campo do composer como linha inferior (sem caixa, mantendo a cor da borda no foco).
  - A disposição na página (canal + inscritos + Subscribe à esquerda; like/dislike + Share + ⋮ à direita; seção de comentários sob a descrição) foi feita junto com a ligação aos dados no SI-06.17b, porque posicionar os componentes já exige as props do RSC.

### SI-06.17b — Tela de Página de visualização do vídeo — interações (lógica & wiring)
- **Status:** completed
- **Tests:** unit: video-channel-subscription 4 + comment-section +1 (components/watch + components/comments 79+); e2e: watch-social 7/7 + watch (Fase 05) 7/7; build, tsc e lint limpos
- **Observations:**
  - Watch page lê a primeira página de comentários em paralelo só quando `published`; rascunho/processamento do dono não renderiza o par like/dislike nem a seção, e não chama `/comments`. `key={publicId}` nos componentes com estado, para zerá-los ao navegar entre vídeos.
  - `CommentSection` aceita `initialPage` nulo: bloco de erro com "Try again" (relê pelo BFF) e o resto da página renderiza normalmente.
  - Avatar do composer usa o nickname da sessão (`session.channelSlug`): a sessão não guarda o nome do canal, e uma leitura a mais de `/channels/me` por página não compensava.
  - O par like/dislike do vídeo virou `role="group"` com `aria-label="Video reactions"`, que distingue esses botões dos de comentário para leitor de tela e testes.
  - E2E da Fase 05 `tests/watch.e2e-spec.ts` atualizado: 1.1 (anônimo agora vê Subscribe, o par like/dislike e "Sign in to comment"; cenário marcado `Source: manual` em `specs/watch.plan.md`) e o nome do link do canal virou regex `/^Studio Canal/`, porque agora inclui "N subscribers".
  - Na 1ª execução falharam 2 testes, ambos de setup: a 3.2 anônima herdava a resposta criada na 3.1 (o store só reseta no login; agora loga e limpa os cookies antes) e havia mais uma asserção com o nome exato do link do canal.

### SI-06.18.0 — Drift audit: Feed das inscrições (base visual: Home / Catalog Show)
- **Status:** completed
- **Tests:** no tests (audit-only) — seção subscriptions-feed anexada ao frontend-drift-report.md
- **Observations:**
  - Auditoria contra `Home (Catalog Show).png` (2×): 3 alinhado; `video-card` sem a variante com avatar → `+prop showAvatar` (links separados para o vídeo e o canal, sem aninhar); `filter-chip` e o spinner de rolagem infinita como `exception` justificada (chips são da Home/Fase 07; o feed usa o botão "Load more" por decisão do plano).
  - Nenhum arquivo do `next-frontend` editado neste SI.

### SI-06.18a — Tela de Feed das inscrições (visual shell)
- **Status:** completed
- **Tests:** video-card +3 testes (showAvatar) — 10 passing; regressão components/videos, feed, channel, watch 111 passing; lint e tsc limpos
- **Observations:**
  - Decisão do drift report aplicada: `VideoCard` ganhou `showAvatar` (avatar de iniciais de 40px + nome com link para o canal; thumbnail e título linkam o vídeo; links separados, sem aninhar; thumbnail e avatar duplicados ficam fora da ordem de tab e da árvore acessível); o `SubscriptionVideoGrid` liga `showAvatar`.
  - Páginas criadas: `app/(app)/(shell)/feed/subscriptions/{page,loading,error}.tsx` e o cliente `components/feed/subscription-feed-list.tsx`, que acumula as páginas como a lista do canal e usa o `LoadMore` do estúdio. A página já lê o feed com o Bearer da sessão, porque o shell precisa dos dados para renderizar. O guard do `proxy.ts`, os testes e o E2E ficam no SI-06.18b.

### SI-06.18b — Tela de Feed das inscrições (lógica & wiring)
- **Status:** completed
- **Tests:** unit: __tests__/proxy.test.ts 5 (novo); e2e: subscriptions-feed 4/4; build, tsc e lint limpos
- **Observations:**
  - `proxy.ts` com `matcher: ["/studio/:path*", "/feed/:path*"]`; a página do feed revalida a sessão e mapeia 401 → login com `returnTo`, cursor adulterado (400) → primeira página, demais → `error.tsx`.
  - Estado vazio: "Videos from the channels you subscribe to will show up here." + link "Find channels to follow" para `/` (texto não desenhado).
  - `next-frontend/CLAUDE.md` atualizado (matcher do proxy e árvore).

### SI-06.19 — Mutação otimista e contexto de inscrições (Verification)
- **Status:** completed
- **Tests:** 13 passing (hooks/__tests__/use-optimistic-mutation 7, components/layout/__tests__/subscriptions-provider 6); regression guard: Playwright completo 73/73 contra o build de produção com MSW (inclui as suítes das Fases 02–05 após o grupo (shell))
- **Observations:**
  - O teste do hook usa `renderHook` com a requisição passando pelo MSW (rota de sonda segurada por um portão): otimista imediato, reconciliação pelo corpo do 200 (diferente do palpite), volta ao confirmado + toast em 500/429/404, 401 → login sem toast, falha de rede → toast genérico.

## Verificação final (2026-10-20)

- **Backend:** `npm test -- --runInBand` 78/78 suítes, 612/612 testes; `npm run test:e2e` 25/25 suítes, 157/157 testes; ESLint (sem `--fix`) e `tsc --noEmit` limpos.
- **Frontend:** Vitest 122/122 arquivos, 755/755 testes; `npm run lint` e `tsc --noEmit` limpos; Playwright 73/73 contra o build de produção com MSW.
- **Cadeia OpenAPI:** `openapi:export` → `sync-openapi.sh` → `openapi:types` sem diferença (checksums de `openapi.json` nos dois subprojetos e de `types.gen.ts` idênticos antes e depois).
- **Correção encontrada na verificação final:** `src/database/migrations.integration-spec.ts` não conhecia a migration `CreateSocialInteractions1792472801299`. A suíte derruba e reaplica o schema do banco compartilhado e só reaplicava até `CreateVideoViews`, então deixava o banco sem as FKs das tabelas sociais e sem `channels.subscriber_count`, e as suítes seguintes quebravam (26 de integração e 21 de E2E no 1º run completo). A migration entrou na lista, as tabelas sociais e o enum `reaction_value` na limpeza, e há 2 testes novos (criação das tabelas/FKs/coluna e o revert). As rodadas por SI não pegaram o problema porque nenhuma delas incluía essa suíte.
