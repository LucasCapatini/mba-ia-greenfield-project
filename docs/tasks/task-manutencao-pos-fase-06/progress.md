# task-manutencao-pos-fase-06 — Progress

**Status:** completed
**SIs:** 5/5 completed

## Final verification (2026-10-20)

- Backend `npm test -- --runInBand`: 613/613 (78 suítes). `npm run test:e2e`: 157/157 (25 suítes). `npx tsc --noEmit` e `npm run lint`: exit 0.
- Frontend `npm test` (Vitest): 764/764 (123 arquivos). `npx tsc --noEmit` e `npm run lint`: exit 0.
- Frontend E2E (Playwright no host contra `next build` + `MSW_ENABLED=true next start`): 73/73. Numa primeira rodada, `studio-channel › 1.1 settings-show-current-channel` falhou uma vez (e os outros 4 casos do grupo serial não rodaram); a spec isolada e a suíte completa rodada de novo passaram sem alteração de código. O caso não toca nada desta task.
- Medição dos avatares no build de produção (largura×altura do círculo, fonte das iniciais): cabeçalho do canal 128×128 a 24px/32px/700; menu lateral 24×24 a 12px/16px/400; card de vídeo no feed 40×40 a 14px/20px/500; campo de comentário e comentário 40×40 a 14px/20px/500 (antes 24px). Iniciais do campo de comentário: `SC`.
- Os Deliverables do plano mandavam rodar `npm test` do backend sem `-- --runInBand`. A primeira rodada assim falhou (90 testes em 20 suítes disputando o banco compartilhado), como o `nestjs-project/CLAUDE.md` avisa. O comando do plano foi corrigido.

### SI-1 — Incrementar `view_count` por SQL direto, sem tocar `updated_at`
- **Status:** completed
- **Tests:** 12 passing (`video-views.service.spec.ts` + `video-views.service.integration-spec.ts`)
- **Observations:**
  - O spy do caso de rollback reimplementa `EntityManager.query` delegando a `this.connection.query(sql, parameters, this.queryRunner)` — o corpo do método no TypeORM 0.3.28 — em vez de guardar a referência do protótipo: chamar o método solto com `.call` falhava no lint (`@typescript-eslint/unbound-method` e `no-unsafe-return`).
  - `grep -rn "\.increment(" src` (fora dos specs) não encontra mais nenhum contador incrementado pelo TypeORM.

### SI-2 — Limpar o banco compartilhado também no `afterAll` das nove suítes de integração
- **Status:** completed
- **Tests:** no tests (hooks de suítes existentes) — as nove suítes rodadas isoladas passam (3+2+3+2+8+3+5+4+17 testes) e deixam 0 linhas em `comments`, `comment_reactions`, `video_reactions`, `subscriptions`, `video_views`, `videos`, `channels` e `users`; `npm run test:integration` completo rodado duas vezes seguidas: 252/252 (35 suítes) nas duas
- **Observations:** none

### SI-3 — Variantes de tamanho no `ChannelAvatar`
- **Status:** completed
- **Tests:** 6 passing (`channel-avatar.test.tsx`); 100 passing somando os testes de `components/channel`, `components/videos/video-card`, `components/comments` e `components/layout` que renderizam o avatar
- **Observations:**
  - Duas `cva` no mesmo arquivo — `channelAvatarVariants` (tamanho do círculo) e `channelAvatarInitialsVariants` (tipografia das iniciais no `AvatarFallback`) — porque as classes vão em elementos diferentes; o `cn()` do `AvatarFallback` troca o `text-sm` do primitivo por `text-helper`/`text-label-md`/`text-h1`.
  - O teste confere também que o `data-size` do primitivo continua `default`: assim o `data-[size=lg]:size-10` do `Avatar` nunca disputa com a variante `lg` de 128px.

### SI-4 — Usar `loginHref` nos três links de login montados à mão
- **Status:** completed
- **Tests:** 26 passing (`thumbnail-upload-button.test.tsx`, `video-edit-form.test.tsx`, `comment-composer.test.tsx`) — 2 casos novos de `401` → `/login?returnTo=/studio/videos/vid-1/edit`
- **Observations:**
  - Fora do escopo, sem mudança: `channel-settings-form.tsx`, `owner-video-list.tsx` e `upload-dropzone.tsx` usam destinos fixos (`"/login?returnTo=/studio/..."`), e as páginas do estúdio fazem `redirect` com `encodeURIComponent(publicId)` só no segmento do id. Todos já geram barras legíveis.
  - `thumbnail-upload-button.test.tsx` passou a limpar `router.push` no `beforeEach`; antes nenhum caso conferia o `push`.
  - Na verificação final, `components/upload/__tests__/upload-video-form.test.tsx` falhou: a tela de upload reaproveita o `VideoEditForm`, e o teste fixava o formato antigo `/login?returnTo=%2Fstudio%2Fupload%2Fvid-1`. A expectativa passou para `/login?returnTo=/studio/upload/vid-1`, que é o comportamento pedido por esta SI.

### SI-5 — Guardar o nome do canal na sessão e usá-lo no avatar do campo de comentário
- **Status:** completed
- **Tests:** 43 passing (Vitest — `app/api/auth/login`, `app/api/channel`, `lib/auth`); E2E `tests/watch-social.e2e-spec.ts` 7/7 contra o build de produção com MSW
- **Observations:**
  - Tornar `channelName` obrigatório em `SessionData` quebrou o `tsc` em 20 arquivos de teste que montam a sessão com `setSession`. Todos ganharam `channelName` ao lado de `channelSlug`: `""` na maioria, `"Studio Canal"`/`"Alice"`/`"Alice Channel"` onde o teste confere o campo.
  - O caso de `PATCH /api/channel` "keeps the session cookie untouched when the nickname does not change" mandava `{ name: "Outro nome" }`, o que agora reescreve a sessão. Virou dois casos: troca de nome reescreve `channelName`; nome e nickname iguais não tocam o cookie.
  - O fallback para sessões antigas (sem `channelName` → iniciais do nickname) está no `session.channelName || session.channelSlug` da watch page. Nenhum teste automatizado o cobre, porque o MSW sempre emite a sessão nova no login.
