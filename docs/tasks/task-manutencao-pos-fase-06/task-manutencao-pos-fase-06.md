---
kind: task
name: task-manutencao-pos-fase-06
test_specs_aware: true
sources_mtime:
  docs/tasks/task-manutencao-pos-fase-06/context.md: "2026-10-20T15:16:34Z"
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-social-interactions.md: "2026-10-20T14:57:17Z"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-watch-page.md: "2026-10-20T03:49:39Z"
  docs/phases/phase-06-social-interactions/context.md: "2026-10-20T14:57:17Z"
---

# Manutenção pós-Fase 06

## Objective

manutenção após a Fase 06. (1) nestjs-project/src/videos/video-views.service.ts: o registro de visualização (Fase 05) incrementa videos.view_count com manager.increment, que também atualiza videos.updated_at — campo que versiona a URL pública da thumbnail (?v=) —, de modo que cada visualização invalida o cache da imagem; passar a incrementar por SQL direto na mesma transação, como os contadores da Fase 06 (regra registrada em nestjs-project/CLAUDE.md, seção 'Interações sociais (Fase 06)'), com teste de integração garantindo que updated_at não muda. (2) nestjs-project: nove suítes de integração (comments.service, comment.entity, comment-reactions.service, comment-reaction.entity, video-reaction.entity, video-reactions.service, subscription.entity, subscriptions.service e videos.service — *.integration-spec.ts em src/) só limpam o banco compartilhado no beforeEach e deixam as linhas do último teste para as suítes seguintes; limpar também no afterAll, sem mudar o que cada suíte verifica. (3) next-frontend/components/channel/channel-avatar.tsx: o ChannelAvatar só tem o tamanho de 128px (iniciais em text-h1); os usos menores ajustam as iniciais por seletor descendente (components/layout/side-nav-subscriptions.tsx em 24px e components/videos/video-card.tsx em 40px) ou ficam com as iniciais em text-h1 num círculo de 40px (components/comments/comment-item.tsx e components/comments/comment-composer.tsx); dar ao componente variantes de tamanho com tipografia proporcional e usá-las em todos os pontos, sem regressão visual nas telas existentes. (4) next-frontend: três links de login ainda montam /login?returnTo= à mão — components/comments/comment-composer.tsx e, na Fase 04, components/studio/thumbnail-upload-button.tsx e components/studio/video-edit-form.tsx, que codificam as barras (%2F) ao contrário do restante da aplicação —; passar a usar loginHref de lib/auth/return-to.ts. (5) next-frontend: a sessão iron-session guarda só o nickname do canal (channelSlug); o POST /api/auth/login já lê GET /channels/me para preenchê-lo — guardar também o nome do canal na sessão e usá-lo nas iniciais do avatar do campo de comentário da watch page (hoje vêm do nickname), mantendo o PATCH /api/channel coerente quando o nome muda.

---

## Step Implementations

### SI-1 — Incrementar `view_count` por SQL direto, sem tocar `updated_at`

**Description:** O registro de visualização da Fase 05 passa a somar `videos.view_count` com `UPDATE … SET "view_count" = "view_count" + 1` na mesma transação do `INSERT` em `video_views`, como os contadores da Fase 06, para que uma visualização não mova `updated_at` (que versiona o `?v=` da thumbnail) — alinhado a `social-interactions/TD-02`, `video-channel-management/TD-10` e `watch-page/TD-02`.

**Technical actions:**

1. Em `nestjs-project/src/videos/video-views.service.ts`, trocar `manager.increment(Video, { id: video.id }, 'view_count', 1)` por `manager.query('UPDATE "videos" SET "view_count" = "view_count" + 1 WHERE "id" = $1', [video.id])`, no mesmo ramo `if (inserted)` dentro de `dataSource.transaction` (mesmo padrão de `src/comments/comments.service.ts` e `src/reactions/video-reactions.service.ts`); atualizar o docblock da classe citando a regra "Contadores" do `nestjs-project/CLAUDE.md` e remover o import de `Video` se ficar sem uso.
2. Em `src/videos/video-views.service.spec.ts`, substituir o mock `manager.increment` por `manager.query` e ajustar os dois casos: linha nova → `query` chamado uma vez com SQL que contém `"view_count" = "view_count" + 1` e parâmetros `['video-1']`; conflito (mesmo espectador, mesmo dia) → `query` não chamado.
3. Em `src/videos/video-views.service.integration-spec.ts`, adicionar o caso "should not touch updated_at when counting a view": ler `updated_at` do vídeo semeado, chamar `service.record(video, ANON, NOW)` e conferir `view_count` 1 com `updated_at` idêntico (`getTime()`).
4. No mesmo arquivo, reescrever o caso de rollback ("should leave neither the view nor the counter when the increment fails") para fazer o `UPDATE` falhar em vez de `EntityManager.prototype.increment` — `jest.spyOn(EntityManager.prototype, 'query')` com `mockImplementationOnce` que rejeita só quando o SQL começa com `UPDATE "videos"` (o `INSERT` do QueryBuilder não pode ser afetado); manter as asserções (`view_count` 0, nenhuma linha em `video_views`).
5. Conferir com `grep -rn "\.increment(" src --include=*.ts | grep -v spec` que nenhum contador de `videos`, `comments` ou `channels` usa mais `increment` do TypeORM.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoViewsService.record` | Unit: ramo linha nova → `UPDATE` direto; ramo conflito → sem `UPDATE` | `nestjs-project/src/videos/video-views.service.spec.ts` |
| `VideoViewsService.record` | Integration: `updated_at` intacto após visualização contada; rollback do `INSERT` quando o `UPDATE` falha | `nestjs-project/src/videos/video-views.service.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Uma visualização contada de um vídeo `published` soma 1 a `videos.view_count` e deixa `videos.updated_at` com o mesmo valor de antes.
- `thumbnail_url` devolvido por `GET /videos/{publicId}` traz o mesmo `?v=` antes e depois de `POST /videos/{publicId}/views` responder `204`.
- O mesmo espectador anônimo no mesmo dia UTC não move `view_count` na segunda chamada.
- Se o `UPDATE` de `view_count` falha, nenhuma linha nova fica em `video_views` e `view_count` não muda.
- `POST /videos/{publicId}/views` continua respondendo `204` nos cenários existentes da suíte e2e (anônimo, autenticado, dono, rascunho).

---

### SI-2 — Limpar o banco compartilhado também no `afterAll` das nove suítes de integração

**Description:** As nove suítes de integração listadas no escopo passam a chamar `cleanAllTables(dataSource)` no `afterAll`, antes de fechar a conexão, para não deixar as linhas do último teste para as suítes seguintes; o `beforeEach` e as asserções de cada suíte não mudam.

**Technical actions:**

1. Suítes de entidade — `src/comments/entities/comment.entity.integration-spec.ts`, `src/reactions/entities/comment-reaction.entity.integration-spec.ts`, `src/reactions/entities/video-reaction.entity.integration-spec.ts` e `src/subscriptions/entities/subscription.entity.integration-spec.ts`: no `afterAll`, `await cleanAllTables(dataSource)` antes de `await dataSource.destroy()`.
2. Suítes de serviço com `TestingModule` — `src/comments/comments.service.integration-spec.ts`, `src/reactions/comment-reactions.service.integration-spec.ts`, `src/reactions/video-reactions.service.integration-spec.ts` e `src/subscriptions/subscriptions.service.integration-spec.ts`: no `afterAll`, `await cleanAllTables(dataSource)` antes de `await close()`.
3. `src/videos/videos.service.integration-spec.ts`: no `afterAll`, `await cleanAllTables(dataSource)` depois da limpeza dos prefixos do S3 e antes de `await module.close()`.
4. Rodar cada uma das nove suítes isolada (`npm test -- <arquivo>`) e, ao final, conferir pelo `psql` do container `db` que as tabelas do domínio estão vazias; depois rodar `npm run test:integration` completo. As suítes fora desta lista não entram no escopo — se alguma delas também deixar linhas, registrar como observação no `progress.md`.

**Tests:** _(empty — muda só os hooks de suítes existentes; a própria suíte de integração, sem casos novos, é a verificação)_

**Dependencies:** none

**Acceptance criteria:**

- Ao terminar qualquer uma das nove suítes rodando isolada, as tabelas `comments`, `comment_reactions`, `video_reactions`, `subscriptions`, `video_views`, `videos`, `channels` e `users` do banco compartilhado (`streamtube`) ficam sem linhas.
- Cada uma das nove suítes passa rodando isolada e dentro da suíte completa, com o mesmo número de testes de antes.
- Rodar `npm run test:integration` duas vezes seguidas dá o mesmo resultado nas duas execuções.

---

### SI-3 — Variantes de tamanho no `ChannelAvatar`

**Description:** `ChannelAvatar` ganha a prop `size` (`sm` 24px, `md` 40px, `lg` 128px — padrão) com a tipografia das iniciais proporcional a cada tamanho, e todos os usos passam a escolher a variante em vez de sobrescrever tamanho e tipografia por `className`/seletor descendente; 24px e 40px do menu lateral e do card ficam idênticos, e os avatares de 40px dos comentários deixam de usar `text-h1`.

**Technical actions:**

1. Em `next-frontend/components/channel/channel-avatar.tsx`, criar `channelAvatarVariants` com `cva` — `sm`: `size-6` + iniciais `text-helper`; `md`: `size-10` + iniciais `text-label-md`; `lg`: `size-32` + iniciais `text-h1` — e a prop `size?: "sm" | "md" | "lg"` (padrão `"lg"`), mantendo `Omit<…, "children" | "size">` sobre o `size` do primitivo; expor a variante em `data-avatar-size` (o primitivo `Avatar` já é dono de `data-size` e o estiliza com `data-[size=lg]:size-10`); `className` continua mesclado por `cn()` para posição/`shrink-0`; atualizar o docblock com os três tamanhos.
2. `components/layout/side-nav-subscriptions.tsx`: `size="sm"`, removendo `size-6` e `[&_[data-slot=avatar-fallback]]:text-helper` do `className` (fica `shrink-0`).
3. `components/videos/video-card.tsx`: `size="md"`, removendo `size-10` e `[&_[data-slot=avatar-fallback]]:text-label-md`.
4. `components/comments/comment-item.tsx` e `components/comments/comment-composer.tsx`: `size="md"`, removendo `size-10` (fica `shrink-0`). `channel-header.tsx` e `channel-header-card.tsx` continuam no padrão `lg`, sem mudança.
5. Criar `components/channel/__tests__/channel-avatar.test.tsx` (docblock `// @vitest-environment jsdom`): iniciais e `aria-label` com o nome do canal, `data-avatar-size="lg"` sem a prop e `"sm"`/`"md"` quando informados, `data-slot="channel-avatar"` preservado.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ChannelAvatar` | Unit: iniciais, nome acessível, variante exposta em `data-avatar-size` | `next-frontend/components/channel/__tests__/channel-avatar.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- O avatar de cada canal seguido no menu lateral mede 24×24 px com as iniciais em 12px/16px, como antes.
- O avatar do canal no card de vídeo (home, página do canal, feed de inscrições) mede 40×40 px com as iniciais em 14px/20px, como antes.
- O avatar do autor de cada comentário e o do campo de comentário da watch page medem 40×40 px com as iniciais em 14px/20px, sem transbordar o círculo.
- O avatar do cabeçalho da página do canal e do cartão de configurações do canal continua com 128×128 px e iniciais em `text-h1`.
- Nenhum componente define o tamanho ou a tipografia do `ChannelAvatar` por seletor descendente `[data-slot=avatar-fallback]`.

---

### SI-4 — Usar `loginHref` nos três links de login montados à mão

**Description:** O link "Sign in to comment" do campo de comentário e os redirecionamentos por `401` do botão de thumbnail e do formulário de edição de vídeo passam a usar `loginHref` de `lib/auth/return-to.ts` (`social-interactions/TD-10`), deixando as barras do `returnTo` legíveis como no restante da aplicação.

**Technical actions:**

1. `next-frontend/components/comments/comment-composer.tsx`: `href={loginHref(returnTo)}` no lugar do template literal com `encodeURIComponent(…).replaceAll("%2F", "/")`, importando `loginHref` de `@/lib/auth/return-to`.
2. `components/studio/thumbnail-upload-button.tsx`: no ramo `response.status === 401` de `send()`, `router.push(loginHref(pathname))`.
3. `components/studio/video-edit-form.tsx`: `toLogin()` passa a chamar `router.push(loginHref(pathname))`.
4. Em `components/studio/__tests__/thumbnail-upload-button.test.tsx` e `components/studio/__tests__/video-edit-form.test.tsx`, adicionar um caso cada em que o BFF responde `401` (via `server.use` do MSW na rota `/api/videos/{publicId}/thumbnail` e na de salvar, respectivamente) e o `push` mockado recebe `"/login?returnTo=/studio/videos/vid-1/edit"`; o caso anônimo de `comment-composer.test.tsx` (`/login?returnTo=/watch/tech-01`) continua passando sem mudança.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ThumbnailUploadButton` | Unit: `401` no envio leva a `/login?returnTo=` com barras legíveis | `next-frontend/components/studio/__tests__/thumbnail-upload-button.test.tsx` |
| `VideoEditForm` | Unit: `401` ao salvar leva a `/login?returnTo=` com barras legíveis | `next-frontend/components/studio/__tests__/video-edit-form.test.tsx` |
| `CommentComposer` | Unit: link anônimo para `/login?returnTo=/watch/tech-01` (caso existente) | `next-frontend/components/comments/__tests__/comment-composer.test.tsx` |

**Dependencies:** SI-3 — mesmo arquivo `comment-composer.tsx`; aplicar depois da troca da variante do avatar

**Acceptance criteria:**

- Anônimo na watch page vê "Sign in to comment" apontando para `/login?returnTo=/watch/{publicId}`.
- Com a sessão expirada, enviar ou remover a thumbnail na edição de vídeo leva a `/login?returnTo=/studio/videos/{publicId}/edit`, sem `%2F`.
- Com a sessão expirada, "Save Changes" na edição de vídeo leva a `/login?returnTo=/studio/videos/{publicId}/edit`, sem `%2F`.
- Depois de entrar por qualquer um desses links, o usuário volta para a página de origem.
- Nenhum dos três componentes monta mais `/login?returnTo=` à mão. Os destinos fixos (`"/login?returnTo=/studio/videos"` e afins) e os `redirect` das páginas do estúdio ficam fora desta SI.

---

### SI-5 — Guardar o nome do canal na sessão e usá-lo no avatar do campo de comentário

**Description:** A sessão `iron-session` passa a guardar `channelName` ao lado de `channelSlug` (metadado mínimo do usuário, per `phase-02-auth-frontend/TD-02`): o `POST /api/auth/login` o lê do mesmo `GET /channels/me`, o refresh o preserva, o `PATCH /api/channel` o reescreve quando o nome muda e a watch page usa esse nome nas iniciais do avatar do campo de comentário.

**Technical actions:**

1. `next-frontend/lib/auth/session.ts`: `channelName: string` em `SessionData` e atribuído em `setSession`; `lib/auth/refresh.ts` repassa `channelName: session.channelName ?? ""` (cookies emitidos antes desta mudança não têm o campo). Ajustar os chamadores de `setSession` apontados pelo `tsc --noEmit`, incluindo helpers de teste.
2. `app/api/auth/login/route.ts`: `ownChannelSlug` vira `ownChannel(accessToken)` e devolve `{ channelSlug: data?.nickname ?? "", channelName: data?.name ?? "" }` da mesma chamada a `GET /channels/me`; falha na leitura mantém os dois vazios e o login segue `200`; atualizar o docblock.
3. `app/api/channel/route.ts`: depois do `PATCH /channels/me` bem-sucedido, reescrever `session.channelSlug` quando o nickname mudou **e** `session.channelName` quando o nome mudou, com um único `session.save()`; atualizar o comentário do topo.
4. `app/(app)/watch/[publicId]/page.tsx`: `viewerName` passa a `session.channelName || session.channelSlug` (apenas com sessão; senão `undefined`), trocando o comentário "A sessão guarda só o nickname do canal".
5. Testes: estender `app/api/auth/login/__tests__/route.integration.test.ts` (sessão selada com `channelName: "Studio Canal"`; `/channels/me` falhando → `""`), `app/api/channel/__tests__/route.integration.test.ts` (nome alterado reescreve `channelName`; nickname alterado continua reescrevendo `channelSlug`), `lib/auth/__tests__/refresh.integration.test.ts` (refresh preserva `channelName`), `lib/auth/__tests__/session.test.ts` (`setSession` grava `channelName`) e `tests/watch-social.e2e-spec.ts` (logado em `/watch/tech-01`, o `[data-slot='channel-avatar']` do campo de comentário mostra `SC`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `POST /api/auth/login` | Integration (MSW): `channelName` selado a partir de `GET /channels/me`; falha → vazio | `next-frontend/app/api/auth/login/__tests__/route.integration.test.ts` |
| `PATCH /api/channel` | Integration (MSW): troca de nome reescreve `channelName`; troca de nickname reescreve `channelSlug` | `next-frontend/app/api/channel/__tests__/route.integration.test.ts` |
| `refresh` | Integration (MSW): refresh preserva `channelName` | `next-frontend/lib/auth/__tests__/refresh.integration.test.ts` |
| `setSession` | Unit: grava `channelName` | `next-frontend/lib/auth/__tests__/session.test.ts` |
| Watch page (async RSC) | E2E: iniciais do avatar do campo de comentário a partir do nome do canal | `next-frontend/tests/watch-social.e2e-spec.ts` |

**Dependencies:** SI-3 — o avatar do campo de comentário já usa a variante `md` quando a E2E confere as iniciais

**Acceptance criteria:**

- `POST /api/auth/login` com credenciais válidas responde `200` e a sessão guarda `channelName` igual ao `name` de `GET /channels/me` (`"Studio Canal"` no mock).
- Se `GET /channels/me` falha durante o login, `POST /api/auth/login` continua respondendo `200`, com `channelSlug` e `channelName` vazios.
- `PATCH /api/channel` que muda o nome do canal responde com o canal atualizado e a sessão passa a guardar o novo `channelName`; mudar o nickname continua atualizando `channelSlug`.
- Após a renovação do token pelo BFF, a sessão mantém o mesmo `channelName`.
- Logado como `studio_canal`, o avatar do campo de comentário da watch page mostra as iniciais `SC` (de "Studio Canal"), não `S`.
- Com uma sessão emitida antes desta mudança (sem `channelName`), o campo de comentário mostra as iniciais do nickname, como hoje.

---

## Dependency Map

SI-1 (root, backend — `view_count` por SQL direto)
SI-2 (root, backend — limpeza no `afterAll` das nove suítes)
SI-3 (root, frontend — variantes do `ChannelAvatar`)
├── SI-4 — depends on SI-3 (mesmo arquivo `comment-composer.tsx`)
└── SI-5 — depends on SI-3 (a E2E confere as iniciais do avatar `md` do campo de comentário)

---

## Deliverables

- [ ] SI-1 — Incrementar `view_count` por SQL direto, sem tocar `updated_at`
- [ ] SI-2 — Limpar o banco compartilhado também no `afterAll` das nove suítes de integração
- [ ] SI-3 — Variantes de tamanho no `ChannelAvatar`
- [ ] SI-4 — Usar `loginHref` nos três links de login montados à mão
- [ ] SI-5 — Guardar o nome do canal na sessão e usá-lo no avatar do campo de comentário

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type/lint checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit && docker compose exec nestjs-api npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type/lint checks pass (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec next-frontend npm run build`, `docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"`, then on the host `node node_modules/@playwright/test/cli.js test`)
