---
kind: task
name: task-manutencao-pos-fase-06
sources_mtime:
  docs/decisions/technical-decisions-phase-02-auth-frontend.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-social-interactions.md: "2026-10-20T14:57:17Z"
  docs/decisions/technical-decisions-video-channel-management.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-watch-page.md: "2026-10-20T03:49:39Z"
  docs/phases/phase-06-social-interactions/context.md: "2026-10-20T14:57:17Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T13:27:45Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-20T03:49:39Z"
---

# task-manutencao-pos-fase-06 — Context

## Scope

> manutenção após a Fase 06. (1) nestjs-project/src/videos/video-views.service.ts: o registro de visualização (Fase 05) incrementa videos.view_count com manager.increment, que também atualiza videos.updated_at — campo que versiona a URL pública da thumbnail (?v=) —, de modo que cada visualização invalida o cache da imagem; passar a incrementar por SQL direto na mesma transação, como os contadores da Fase 06 (regra registrada em nestjs-project/CLAUDE.md, seção 'Interações sociais (Fase 06)'), com teste de integração garantindo que updated_at não muda. (2) nestjs-project: nove suítes de integração (comments.service, comment.entity, comment-reactions.service, comment-reaction.entity, video-reaction.entity, video-reactions.service, subscription.entity, subscriptions.service e videos.service — *.integration-spec.ts em src/) só limpam o banco compartilhado no beforeEach e deixam as linhas do último teste para as suítes seguintes; limpar também no afterAll, sem mudar o que cada suíte verifica. (3) next-frontend/components/channel/channel-avatar.tsx: o ChannelAvatar só tem o tamanho de 128px (iniciais em text-h1); os usos menores ajustam as iniciais por seletor descendente (components/layout/side-nav-subscriptions.tsx em 24px e components/videos/video-card.tsx em 40px) ou ficam com as iniciais em text-h1 num círculo de 40px (components/comments/comment-item.tsx e components/comments/comment-composer.tsx); dar ao componente variantes de tamanho com tipografia proporcional e usá-las em todos os pontos, sem regressão visual nas telas existentes. (4) next-frontend: três links de login ainda montam /login?returnTo= à mão — components/comments/comment-composer.tsx e, na Fase 04, components/studio/thumbnail-upload-button.tsx e components/studio/video-edit-form.tsx, que codificam as barras (%2F) ao contrário do restante da aplicação —; passar a usar loginHref de lib/auth/return-to.ts. (5) next-frontend: a sessão iron-session guarda só o nickname do canal (channelSlug); o POST /api/auth/login já lê GET /channels/me para preenchê-lo — guardar também o nome do canal na sessão e usá-lo nas iniciais do avatar do campo de comentário da watch page (hoje vêm do nickname), mantendo o PATCH /api/channel coerente quando o nome muda.

## Decisions Index

_No TDs._

## Decisions Detail

_No current-scope TDs._

## Inherited Decisions Detail

### social-interactions/TD-01

**Recommendation:** são exatamente dois alvos fixos pela capability, a cascata por FK combina com o hard delete de vídeos já decidido e o `INSERT … ON CONFLICT` sobre a PK fica direto; a duplicação é pequena e isolável num helper. Parâmetro a fixar junto: `value` como enum Postgres `reaction_value ('like','dislike')`, compartilhado pelas duas tabelas.
**Libraries:** —

### social-interactions/TD-02

**Recommendation:** mantém o padrão de escrita já adotado para `view_count`, deixa a regra no código revisado e testado e resolve a corrida do mesmo usuário com o lock da própria linha da reação; a Option B só compensa se o número de caminhos de escrita crescer a ponto de o drift se tornar provável. Parâmetro a fixar junto: um teste de integração com N requisições paralelas do mesmo usuário provando contador == `COUNT(*)` ao final; job de reconciliação fica fora até existir drift observado.
**Libraries:** —

### social-interactions/TD-03

**Recommendation:** a única em que retry e clique repetido são seguros, o que é pré-requisito para a UI otimista de TD-09; a resposta com contadores elimina uma leitura extra por clique. Parâmetros a fixar junto: reagir/comentar exige vídeo legível e `published` (rascunho → 404, coerente com `video-channel-management/TD-07`); inscrever-se no próprio canal → 422 `CANNOT_SUBSCRIBE_OWN_CHANNEL` (o dono pode curtir o próprio vídeo); `@Throttle` próprio nas rotas de reação (ex.: 60/min por visitante), já que o limite global de 10/min por rota esgota ao curtir vários comentários seguidos.
**Libraries:** —

**Revisions:**
- 2026-10-20 — Listar comentários (`GET /videos/{publicId}/comments`) também exige vídeo `published` (rascunho/processamento → 404, mesmo para o dono); na watch page de um vídeo não publicado aberto pelo dono, o par like/dislike e a seção de comentários não são renderizados (canal e contagem de inscritos continuam). Rationale: AMB-2 do `/plan-validate 6`, escolha do usuário (ocultar até publicar).

### social-interactions/TD-04

**Recommendation:** as leituras já são personalizadas por sessão, o estado chega correto no primeiro HTML e o custo é uma consulta por PK, sem multiplicar chamadas sob o throttler por rota. `subscriber_count` é público e pertence ao shape do canal de qualquer forma (capability "Contagem de inscritos"). Observação para o `/screen-inventory 6`: o Figma não exibe a contagem de dislikes (vídeo nem comentário); o contrato mantém `dislike_count` (já existe desde a Fase 04) e a UI decide não exibi-lo.
**Libraries:** —

### social-interactions/TD-05

**Recommendation:** responde o ponto de atenção com o modelo das plataformas de referência, mantém a paginação no padrão keyset já existente e cabe no layout do Figma. Parâmetro a fixar junto: `videos.comment_count` conta raízes **e** respostas (como "4,256 Comments" no Figma); `reply_count` da raiz conta só as respostas.
**Libraries:** —

### social-interactions/TD-06

**Recommendation:** segue o envelope keyset já adotado, mantém cada resposta limitada e casa com o "Reply"/"N replies" da interface. Parâmetro a fixar junto: ordenações `latest` (default, como no Figma) e `top` (`like_count DESC`, desempate por `created_at`/`id`); se a ordenação `top` não for desejada nesta fase, o `/screen-inventory 6` pode reduzir o seletor a `latest`.
**Libraries:** —

**Revisions:**
- 2026-10-20 — Item de comentário (raiz e resposta) ganha `viewer_is_author: boolean` por espectador (anônimo → `false`), no mesmo espírito de `viewer_reaction` (TD-04); a UI usa o campo para mostrar o menu "⋮" (Edit/Delete) e a API continua validando a autoria (403 para não autor). Rationale: AMB-1 do `/plan-validate 6`, escolha do usuário.

### social-interactions/TD-07

**Recommendation:** fecha a "interface completa" com o menor número de regras e reaproveita a cascata por FK de TD-01 e o padrão de hard delete do projeto; a perda das respostas ao apagar a raiz é o mesmo comportamento das plataformas de referência. Parâmetros a fixar junto: texto puro de 1 a 2.000 caracteres após `trim` (sem HTML/markdown; quebras de linha preservadas); comentar só em vídeos `published` (público ou unlisted); moderação pelo dono do vídeo fica fora desta fase (sem capability).
**Libraries:** —

### social-interactions/TD-08

**Recommendation:** é a leitura direta do Figma e da capability, e o feed por join na leitura não exige nada além de índices. Parâmetro a fixar junto: o menu lateral nasce nesta fase visível apenas com sessão e só com o que existe ("Home", "Subscriptions", "Your videos" → `/studio/videos` e a seção de canais seguidos); "Liked videos" não tem capability e fica de fora; colapso pelo ícone "≡" e comportamento mobile ficam para a Fase 07.
**Libraries:** —

**Revisions:**
- 2026-10-20 — Lista de canais seguidos do menu lateral: `GET /me/subscriptions` ordenado por nome do canal (alfabético, desempate por id) em cursor keyset; o menu mostra os 7 primeiros e um "Show more" carrega/expande o restante. Rationale: OQ-3 do `/plan-validate 6`, escolha do usuário.

### social-interactions/TD-09

**Recommendation:** atende a UI otimista com primitivos do React 19 já usados pelo Next 16, não multiplica leituras sob o throttler e mantém TD-12 válido para o resto da app; a Option B passa a se pagar se a Fase 07 (home com scroll infinito, busca) trouxer mais listas paginadas no cliente, e a migração continua aditiva.
**Renders in:** frontend-runtime
**Libraries:** —

### social-interactions/TD-10

**Recommendation:** reaproveita o fluxo de `returnTo` já implementado, mantém o layout idêntico ao desenhado e não exige um componente sem referência no Figma; a Option B é uma evolução de UX que pode vir depois sem mudar contrato.
**Libraries:** —

### phase-02-auth-frontend/TD-01

**Recommendation:** Three reasons. (1) **Architectural fit.** The strict-BFF model in `next-frontend-config-base/TD-03` already nominates the Route Handler as the only NestJS caller; cookie-based sessions are the natural match, and Auth.js's framework adds layers between the BFF and the cookie that buy nothing because the backend is the auth authority — Auth.js's value (DB adapters, OAuth providers, magic-link, `getServerSession` helpers) is mostly unused in this configuration. (2) **Smaller blast radius.** A ~50-LOC session helper is grep-friendly, debuggable, and test-friendly via the existing MSW+BFF integration test pattern; a misconfigured Auth.js callback is a longer fault-isolation loop. (3) **Compatibility with Next.js 16 / React 19.** Built-in `next/headers` `cookies()` is the canonical primitive both runtimes already use; Auth.js v5 versions track Next.js majors with a lag, adding compatibility risk that Option A does not have. Option C is rejected as unsafe (`localStorage` for refresh tokens) and architecturally regressive (loses RSC personalization).
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Three reasons. (1) **Defense in depth on the cookie content** — `httpOnly` blocks JS, encryption blocks accidental log/proxy inspection; the marginal cost is one ~3KB dep. (2) **Single cookie to manage** simplifies logout (one `session.destroy()` call) and avoids the orphan-cookie failure mode of Option A. (3) **Room to carry minimal user metadata** (`userId`, `email`, `channelSlug`) lets `app/layout.tsx` RSC render the authenticated chrome (avatar, channel name) without a per-render `/auth/me` round-trip — Phase 04+ gains compound here. Option A is a viable downgrade if the team rejects `iron-session` for any reason; the migration A→B (or B→A) is a one-Route-Handler refactor with no test changes downstream because the BFF interface is unchanged. Option C is rejected: it solves a problem (server-side revocation) the project does not have at the cost of infrastructure the project does not own.
**Libraries:** iron-session

### phase-02-auth-frontend/TD-03

**Recommendation:** The single-flight detail is non-trivial and goes in the helper from day one — tested by MSW with a "two concurrent intercepted upstream calls; one refresh expected" assertion. Option B's client-driven pattern is rejected because it doesn't replace Option A (RSC still needs server-side refresh) — adopting B means doing both. Option C's pre-emptive timer is rejected because the failure modes (multiple tabs, sleep/wake) outweigh the latency saving and force a `"use client"` shell near the root.
**Libraries:** —

### phase-02-auth-frontend/TD-04

**Recommendation:** Three reasons. (1) **Decoupled from TD-05** — works with Route Handlers OR Server Actions; the form code does not change if TD-05 is revisited later. (2) **Aligned with shadcn's canonical form primitive** — the project already commits to `radix-nova` shadcn (`components.json`); `npx shadcn@latest add form` produces react-hook-form wrappers; choosing react-hook-form means using the supported primitive instead of hand-rolling around it. (3) **Zod-first developer ergonomics match the rest of the FE foundation** — `next-frontend-config-base/TD-01` chose Zod 4 for env; the same schemas-as-source-of-truth pattern carries to forms with zero new validator paradigm. Option B is rejected for impedance with shadcn's primitive and for over-investing in progressive-enhancement that the strict-BFF model does not require. Option C is rejected for the per-field boilerplate and the loss of client-side feedback on a project that values quick, type-safe form iteration.
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Three reasons. (1) **Strict-BFF alignment.** `next-frontend-config-base/TD-03` named Route Handlers as the BFF surface; Option A keeps every mutation visible under `app/api/**`. (2) **Test scaffold already exists** — `next-frontend/CLAUDE.md` § Testing and `next-frontend-msw-foundation` were authored for Route-Handlers-as-functions; Option A reuses them with zero invention. (3) **Single mutation surface** — Phase 02 sets the precedent for Phases 03–07; uniformity beats per-mutation idiom-picking when the cost of inconsistency compounds (Option C). Option B has real ergonomic appeal for the simplest forms but fragments the BFF surface and forces test-pattern reinvention; if the team later wants progressive enhancement for specific forms, the migration A→B is per-form and doesn't require touching unrelated routes — A is the safer default and the cheaper baseline.
**Libraries:** —

### phase-02-auth-frontend/TD-06

**Recommendation:** Two reinforcing reasons. (1) **No first-render flicker, no round-trip** — the session is delivered in the same response as the page HTML; the Client Provider hydrates with the correct initial state; users never see "Login" briefly turn into their avatar. (2) **No new BFF endpoint** — the cookie is the source of truth, RSC reads it, the Provider broadcasts it; the BFF surface stays minimal. The `router.refresh()` requirement after mid-session mutations is a small price (one line in the relevant mutation handler) for the structural benefits. Option B is rejected for the double-read-and-flicker; Option C is dominated by Option B and rejected.
**Libraries:** —

### phase-02-auth-frontend/TD-07

**Recommendation:** Three reasons. (1) **First-paint-correct** — the user sees the right outcome on the first paint, no skeleton, no flicker. (2) **Single integration pattern across both flows** — confirmation is RSC-only; reset is RSC + Client form (TD-04, TD-05 patterns reused) — both share the "RSC owns the token, Client Component owns the input" split. (3) **Email-prefetch behavior** is solved at the backend's idempotent-confirmation level (a small note for `/plan-build` to confirm; not a separate TD). Option B's Route-Handler-as-link-target adds redirects for no clean gain. Option C is dominated.
**Libraries:** —

**Revisions:**
- 2026-10-18 — A confirmação deixa de depender de token single-use estrito: `GET /auth/confirm-email` passou a ser idempotente para tokens já usados de contas confirmadas (`saneamento-fase-02-e-infra/TD-03`), então o prefetch do cliente de e-mail não produz mais a tela "already confirmed" no clique real — o RSC renderiza `success` nas duas visitas. Rotas efetivamente entregues: `/confirm-email` e `/reset-password` (não `/confirm`), com links de e-mail gerados a partir de `FRONTEND_URL` (`saneamento-fase-02-e-infra/TD-02`). Rationale: a mitigação prevista nos Cons da Option A ("endpoint idempotente — comportamento de backend a verificar") foi formalizada e implementada pela task de saneamento; o padrão RSC-dono-do-token permanece.

### video-channel-management/TD-01

**Recommendation:** categorias são dado de plataforma com rótulo exibido em três fases; mantê-las no banco com carga via migration faz `migration:run` continuar sendo o único passo de bootstrap (regra já seguida por testes e CLAUDE.md) e evita duplicar a lista no frontend. Option B é aceitável se o time quiser o mínimo de código — a diferença real é "rótulos no servidor + FK" contra "zero infraestrutura".
**Libraries:** —

**Revisions:**
- 2026-10-18 — Lista inicial de categorias fixada para a data migration (slug → nome, nesta ordem): music → Music, gaming → Gaming, education → Education, entertainment → Entertainment, sports → Sports, news → News, technology → Technology, travel → Travel, cooking → Cooking, other → Other. Rationale: AMB-3 do plan-validate da Fase 04 — o conteúdo da lista não existia em nenhum artefato e a migration de dados depende dele.

### video-channel-management/TD-02

**Recommendation:** é a extensão natural do eixo de publicação decidido em `phase-03-videos/TD-07`, preserva a visibilidade ao despublicar e fornece a coluna de ordenação/tempo que o painel e TD-06 precisam. Regra de negócio a fixar junto: publicar exige `ready` + título; editar título/descrição/categoria/visibilidade é permitido em qualquer `processing_status`.
**Libraries:** —

### video-channel-management/TD-03

**Recommendation:** torna as pré-condições de publicação um contrato visível (OpenAPI → `types.gen.ts` → MSW), mantém `PATCH` previsível para o `react-hook-form` da tela de edição e replica o padrão de ação já existente no `VideosController`. O custo é um `fetch` a mais no fluxo "salvar e publicar", irrelevante aqui.
**Libraries:** —

**Revisions:**
- 2026-10-18 — Na UI desta fase, o Route Handler de "Save Changes" (telas de edição de vídeo e de upload em processamento) encadeia o `PATCH` de campos com a ação dedicada `publish` quando `status = draft`, `processing_status = ready` e o título está preenchido; se o vídeo ainda não está `ready`, apenas salva e avisa que continua rascunho (publicação ocorre num novo "Save" após o processamento). `unpublish` só pelo kebab do painel. A API mantém as ações dedicadas da Option A. Rationale: decisão de UI registrada no inventário da Fase 04 (IC-1/OQ-2 do plan-validate); o Figma não tem botão "Publish".

### video-channel-management/TD-04

**Recommendation:** para um arquivo de poucos MB o custo de atravessar Nest/Next é nulo, e é o único caminho que valida pelos bytes sem criar um job dedicado nem alargar a exceção ao Strict BFF. Modelo: segunda coluna `custom_thumbnail_key` (a automática fica intacta para reverter); `thumbnail_url` resolve `custom ?? auto`. Sub-escolha para o `/plan-build`: `sharp` (dedicado, API síncrona simples) salvo objeção a dependência nativa — nesse caso, `ffmpeg` por `execFile` com o serviço movido para um módulo compartilhado.
**Libraries:** —

### video-channel-management/TD-05

**Recommendation:** a listagem do painel, a home e a watch leem os mesmos números em lote, e a Fase 06 já terá de escrever em transação; manter os contadores na própria linha evita `COUNT` por item em páginas paginadas sem introduzir uma tabela a mais. O contrato (`view_count`, `like_count`, `dislike_count`, `comment_count` na resposta de listagem) nasce agora e não muda depois.
**Libraries:** —

### video-channel-management/TD-06

**Recommendation:** no volume deste projeto A e B custam o mesmo; a diferença decisiva é que A permanece correta se a Fase 07 escolher scroll infinito e não precisa ser reaberta, enquanto B obriga a aceitar drift ou migrar o contrato. O `total` do painel é uma consulta `COUNT` separada, só nesse endpoint.
**Libraries:** —

### video-channel-management/TD-07

**Recommendation:** é a única que entrega "mesma URL para dono e público" sem duplicar rotas nas Fases 05/06, e o custo é um ramo bem delimitado no `JwtAuthGuard` (ou um decorator `@OptionalAuth()` equivalente) mais testes de matriz. As rotas de escrita continuam exigindo JWT e `VideosOwnership`.
**Libraries:** —

### video-channel-management/TD-08

**Recommendation:** satisfaz os dois bullets com o modelo já existente e a mesma allowlist da Fase 02; o custo (links antigos quebram) é o comportamento padrão de handles e pode ser endurecido depois com a Option C como extensão aditiva. Forma da rota: `/channel/{nickname}` (um segmento `@handle` na raiz colidiria com a convenção de parallel routes `@slot` do App Router e com as demais rotas de topo).
**Libraries:** —

### video-channel-management/TD-09

**Recommendation:** reaproveita o padrão transacional "linha + job na mesma transação" de `phase-03-videos/TD-11` e garante que os bytes sejam liberados sem bloquear a resposta nem espalhar um filtro `deleted_at` por todas as fases seguintes. Option B só compensa se o produto pedir lixeira.
**Libraries:** —

### video-channel-management/TD-10

**Recommendation:** thumbnails são conteúdo público por natureza nas Fases 04/05/07 e a URL estável é o que torna cache e `next/image` possíveis; a policy fica restrita ao prefixo, então a decisão de `phase-03/TD-09` para vídeos permanece intacta. Verificação na SI: `curl -sI $S3_PUBLIC_ENDPOINT/$BUCKET/thumbnails/x/auto.jpg` → 200 sem credenciais e `…/videos/x/source` → 403. Se a policy falhar no RustFS, A é o fallback sem mudança de contrato além do cache.
**Libraries:** —

### video-channel-management/TD-11

**Recommendation:** o contrato da Fase 03 é pequeno e já está fechado; a única biblioteca que o espelha (Uppy 5) acaba de ser descontinuada pela própria Uppy 6, cujo modelo conflita com a orquestração pela API. Um módulo de ~200 linhas com pool, retry e retomada é menor que a adaptação de qualquer uma das duas e fica coberto pelos testes de MSW já padronizados. Estado no layout do estúdio (Provider) para a navegação interna não cancelar o envio.
**Libraries:** —

### video-channel-management/TD-12

**Recommendation:** as necessidades desta fase são estreitas (um polling condicional e invalidação por recarga de rota), o padrão já existe desde a Fase 02 e a documentação do TanStack recomenda não adotá-lo em apps RSC sem necessidade concreta. Reavaliar na Fase 06 (likes/comentários otimistas), quando a Option B passa a pagar seu custo; a migração é aditiva (Provider + hooks), não substitui os Route Handlers.
**Renders in:** frontend-runtime
**Libraries:** —

### watch-page/TD-01

**Recommendation:** é a única que mede "assistiu" em vez de "renderizou", mantém as leituras `GET` puras (o RSC da watch page re-renderiza com frequência por `router.refresh()`) e dá à API um ponto único para dedup e exclusões (dono, rascunho). Parâmetro a fixar junto: limiar de 10 s de reprodução acumulada (ou fim do vídeo, se mais curto), um disparo por carregamento da página. Depende de TD-02 (dedup) e TD-03 (identidade do anônimo).
**Libraries:** —

### watch-page/TD-02

**Recommendation:** é a única das três em que repetir a requisição não move o contador, e reaproveita o pg-boss já presente para a limpeza; a subcontagem por NAT é o erro aceitável (conservador) para um contador público. Combina com TD-03 Option A, que entrega o IP real; com TD-03 Option B (sem IP real), a Option C passa a ser a alternativa coerente.
**Libraries:** —

**Revisions:**
- 2026-10-19 — "Janela de 24 h" = balde fixo por dia UTC: `window_start` é a data UTC da visualização, alinhada à rotação diária do salt do hash anônimo; um job agendado do pg-boss roda uma vez por dia e apaga linhas de `video_views` com `window_start` anterior a 2 dias. Rationale: AMB-1 do `/plan-validate 5`, escolha do usuário.

### watch-page/TD-03

**Recommendation:** corrige a causa (o rastreador vê o BFF, não o visitante) com o padrão oficial do `@nestjs/throttler` 6, preserva o rate limit nas leituras públicas e entrega a identidade que TD-02 precisa. O risco de spoofing é tratado restringindo `TRUST_PROXY` ao endereço do serviço `next-frontend`; a Option C fica como endurecimento caso a API venha a ser exposta publicamente em produção (Fase 07).
**Libraries:** —

**Revisions:**
- 2026-10-19 — `TRUST_PROXY` = IP fixo do `next-frontend`: a rede `streamtube` ganha sub-rede fixa (`ipam`) no `compose.yaml` do backend e o serviço `next-frontend` recebe `ipv4_address` nela; a API confia só nesse IP (o gateway do host não é confiável). Variável ausente → `trust proxy` desligado (sem confiança em proxy, tracker = IP do socket). Chave validada no Joi + `.env.example`. Rationale: AMB-2 do `/plan-validate 5` — o Express não aceita nome de serviço do Compose.
- 2026-10-19 — Fonte do IP no BFF: a SI verifica que `next start` preenche `x-forwarded-for` (lido via `headers()` em RSC e Route Handlers); se o header faltar, o BFF não envia `X-Forwarded-For` e a API cai no IP do BFF, registrando a visualização normalmente. Rationale: AMB-3 do `/plan-validate 5` — o Next 16 não expõe `request.ip`.
- 2026-10-19 — `next start` mantém um `X-Forwarded-For` enviado pelo navegador (só preenche com o IP do socket, no formato `::ffff:x.x.x.x`, quando o header não vem). Como a API confia no `next-frontend` (`TRUST_PROXY`), o deploy exige um proxy reverso na frente do frontend que **sobrescreva** o `X-Forwarded-For` com o IP real do cliente; sem ele, um visitante pode forjar o IP e escapar do throttler e da deduplicação anônima de visualizações (TD-02). Em dev o risco é aceito: todos os visitantes chegam pela porta publicada como o gateway do Docker. Sem mudança de código; a Option C (header assinado) continua como endurecimento. Rationale: verificação do passo 2 da SI-05.8 (rota sonda + `next start`), registrada no `next-frontend/CLAUDE.md`.

### watch-page/TD-04

**Recommendation:** mantém a regra "mesma categoria + preenchimento" num único lugar da API, custa uma chamada por render e não antecipa decisões da home; a Fase 07 decide sua própria listagem sem herdar um filtro desenhado para a sidebar. Parâmetros a fixar: `limit` default 12 (máx. 24), ordenação `published_at DESC`, preenchimento com públicos recentes quando a categoria tiver menos que `limit` ou o vídeo não tiver categoria.
**Libraries:** —

**Revisions:**
- 2026-10-19 — Resposta de `GET /videos/{publicId}/related` no mesmo envelope das listagens, `{ items }` com itens `VideoCardItem`, **sem** `next_cursor` (lista fechada, documentada como tal no OpenAPI) — exceção explícita ao cursor keyset de `video-channel-management/TD-06`, que segue valendo para listagens paginadas. Rationale: ICC-1 do `/plan-validate 5`, escolha do usuário.

### watch-page/TD-05

**Recommendation:** a capability pede três controles, os primitivos acessíveis já estão instalados e o player precisa seguir o design system; a Option C só se paga quando surgirem requisitos avançados (legendas, velocidade, streaming adaptativo) e hoje exigiria upgrade do Tailwind e adoção de um major recém-lançado. Confirmar no `/screen-inventory 5`: se o frame do Figma trouxer controles além de play/pause/volume/progresso/tela cheia, reavaliar a favor da Option C.
**Renders in:** ui-contracts
**Libraries:** —

**Revisions:**
- 2026-10-19 — O frame do Figma (152:2219) trouxe controles além da capability (próximo vídeo, capítulos, autoplay, legendas, configurações/HD, miniplayer, modo teatro); o escopo do player fica fixado em play/pause, volume (mudo + slider), barra de progresso com busca, tempo atual/duração e tela cheia — os extras não são renderizados, e a Option B se mantém (o gatilho de reavaliação para a Option C não se aplica). Rationale: decisão do usuário no `/screen-inventory 5`, registrada a partir de IC-1 do `/plan-validate 5`.

### watch-page/TD-06

**Recommendation:** o `public_id` já cumpre o requisito de URL curta e única (`phase-03-videos/TD-08`), o path já está implementado e testado em cinco pontos e ainda não há links em produção que justifiquem um alias; a divergência é só textual no Figma e se resolve registrando-a no `/screen-inventory 5`.
**Libraries:** —

### watch-page/TD-07

**Recommendation:** é a única que exercita o player num navegador real sem distorcer o mock de produção nem publicar fixture no build; o 206 já é provado no backend, então a falta de `Range` no `route.fulfill` não deixa lacuna. Usar WebM/VP9 elimina a dependência de codecs proprietários no Chromium do Playwright.
**Libraries:** —

### watch-page/TD-08

**Recommendation:** o `stream_url` assinado já entrega os bytes a qualquer leitor, então restringir só o `download_url` (B/C) adiciona regra e contrato sem proteção real; a capability pede o botão, não uma política de restrição.
**Libraries:** —

### watch-page/TD-09

**Recommendation:** é estado de UI puro sobre dados já carregados; a Option B só se justifica com descrições desproporcionais, que o projeto não tem.
**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions... _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function... _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and... _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning options... _(from phase 01)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory manutencao-pos-fase-06 if a UI surface is added in a future revision._

## Non-UI / Deferred Capabilities

_None._

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Service with DB only (no branching) | Integration: DB contract |
| Service with configured lib (JWT, cache) | Unit: real lib with test config |
| Service with side-effect dep (email, storage) | Integration: real capture service (Mailpit) or local adapter |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only — do NOT write unit tests |
| DTO | E2E: one validation wiring test per endpoint |
| Guard (delegates to service for business logic) | E2E + Unit if complex internal logic |
| Guard (simple, delegates to Passport) | E2E only |
| Strategy (Passport) | E2E via guard |
| Pipe (custom transformation/validation) | Unit |
| Interceptor (response transform, logging) | Unit and/or E2E |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, static, no logic | None at component level; cover only if part of a critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test client children directly; cover rendered page via `*.e2e-spec.ts` |
| Page — async RSC | `*.e2e-spec.ts` only — Vitest cannot render it |
| Layout (`layout.tsx`) | None unless it adds logic; else via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.tsx` — RTL + `jsdom` docblock, mock `next/navigation`, MSW for fetch |
| Feature component (server, composes primitives) | Skip unit; cover via the page's E2E |
| shadcn UI primitive (`components/ui/*`) | None — trust the library; cover via consumers |
| Icon (`components/icons/*`) | None |
| `lib/` utility / boundary module with branching or shape assumptions | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts(x)` with `renderHook`, `jsdom` docblock |
| Route handler (`app/api/**/route.ts`) — proxy or with branching | `*.integration.test.ts` with MSW (+ `*.test.ts` for extracted pure logic) |
| Server action / middleware / error-loading-not-found / metadata | See guide — depends on type |
