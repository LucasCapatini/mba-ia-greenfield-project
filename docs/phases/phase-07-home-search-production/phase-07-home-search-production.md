---
kind: phase
name: phase-07-home-search-production
test_specs_aware: true
sources_mtime:
  docs/phases/phase-07-home-search-production/context.md: "2026-10-20T13:27:44-04:00"
  docs/decisions/technical-decisions-home-search-production.md: "2026-10-20T13:27:43-04:00"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T16:16:01-04:00"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T23:49:39-04:00"
---

# Phase 07 — Página Inicial, Busca e Finalização

## Objective

Entregar a página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação) e filtro por categoria, a barra de busca por título e canal com sua página de resultados, o header/navbar com logo, busca, login/avatar e navegação, scroll infinito nas listagens de vídeos, layout responsivo para dispositivos móveis, testes dos fluxos principais da plataforma e o ambiente de produção com seu mecanismo de deploy — backend NestJS, frontend Next.js (BFF) e repositório (testes full-stack, CI, imagens, compose de produção e runbook).

---

## Step Implementations

_Bootstrap (`SI-07.0.1`, sintetizada dos marcadores `(new)` dos UI Contracts) → backend (`SI-07.1` migration da busca, `SI-07.2` `GET /videos` + throttle das listagens) → contrato OpenAPI + MSW (`SI-07.3`) → BFF (`SI-07.4`) → scroll infinito (`home-search-production/TD-04`: Setup `SI-07.5`, migrações `SI-07.6`–`SI-07.7`) → shell responsivo (`home-search-production/TD-05`: Setup `SI-07.8`, migrações `SI-07.9`–`SI-07.13`) → telas (`SI-07.14.x` home, `SI-07.15.x` resultados) → verificações dos TDs de runtime (`SI-07.16`, `SI-07.17`) → testes dos fluxos principais (`SI-07.18`, TD-06) → produção (`SI-07.19` backend pronto para produção, `SI-07.20` imagens, `SI-07.21` compose + Caddy, `SI-07.22` CI, `SI-07.23` deploy + runbook — TD-07..TD-11). Fora do bootstrap por decisão de escopo: `components/layout/account-menu.tsx` (faz I/O de logout — autorado na migração do header, `SI-07.9`) e `components/videos/infinite-video-grid.tsx` + `components/videos/infinite-scroll-sentinel.tsx` (são o próprio padrão do TD-04 — autorados no Setup, `SI-07.5`)._

### SI-07.0.1 — Custom-business simple group: category-chips + global-search + nav-drawer

**Description:** Author business components sem I/O próprio — a barra de chips (links), o campo de busca do header (navegação) e o drawer de navegação (casca de `Dialog`) — consumidos pelo header, pelo shell e pela home.

**Technical actions:**

1. Author `next-frontend/components/home/category-chips.tsx` per UI Contract (Home → "Barra de chips de categoria"): recebe as categorias (`Category[]`) e o `slug` ativo; "All" + um `FilterChip` (`components/ui/filter-chip.tsx`) por categoria em `sort_order`, cada um `<Link>` para `/?category=<slug>` ("All" → `/`), `aria-current` no ativo, rolagem horizontal com esmaecimento na borda direita.
2. Author `next-frontend/components/layout/global-search.tsx` per UI Contract (Home → "Busca global"): compõe `components/ui/search-input.tsx`; envia com Enter ou botão para `/results?q=<termo>` com `router.push`; não envia vazio/só espaços; `maxLength` 100; recebe o `q` atual como valor inicial; abaixo de `md` vira `IconButton` que expande a barra sobre o header; `role="search"` (per `home-search-production/TD-02`, Revisions 2026-10-20).
3. Author `next-frontend/components/layout/nav-drawer.tsx` per UI Contract (Home → "Drawer de navegação"): `Dialog` (`components/ui/dialog.tsx`) ancorado à esquerda, controlado por `open`/`onOpenChange`, que renderiza o menu recebido como `children` e fecha quando a rota muda (`usePathname`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `category-chips.tsx` | Unit per testing-guide-next-frontend § "Client Components" — "All" + chips na ordem recebida, `href` de cada chip, `aria-current` no ativo | `next-frontend/components/home/__tests__/category-chips.test.tsx` |
| `global-search.tsx` | Unit per testing-guide-next-frontend § "Client Components" — Enter/botão navega para `/results?q=`, vazio não navega, `maxLength` 100, valor inicial | `next-frontend/components/layout/__tests__/global-search.test.tsx` |
| `nav-drawer.tsx` | Unit per testing-guide-next-frontend § "Client Components" — abre/fecha por `open`, `Esc` fecha, fecha ao mudar de rota | `next-frontend/components/layout/__tests__/nav-drawer.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- Each business component exists at its declared path and matches its UI Contract.
- Clicar no chip "Music" leva a `/?category=music`; o chip ativo expõe `aria-current="page"`.
- Enviar "  aula  " no campo de busca navega para `/results?q=aula`; enviar o campo vazio não navega.
- O drawer fecha ao pressionar `Esc` e quando a rota muda.

---

### SI-07.1 — Infra: migration `AddVideoSearch` (pg_trgm + unaccent + índices de trigramas)

**Description:** Criar a migration da busca textual — extensões, a função `immutable_unaccent` e os três índices GIN — para que `GET /videos?q=` case por substring sem acento nem caixa usando índice (per `home-search-production/TD-03`).

**Technical actions:**

1. Criar `nestjs-project/src/database/migrations/<timestamp>-AddVideoSearch.ts` com `npm run migration:create` (não `generate`: extensões, função e índices de expressão não vêm de entidade) — `up` conforme `### Data Model` → "Migration `AddVideoSearch`": `CREATE EXTENSION IF NOT EXISTS pg_trgm` e `unaccent`, a função `immutable_unaccent(text)` (`LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT`, corpo `SELECT public.unaccent('public.unaccent', $1)`) e os índices `IDX_videos_title_trgm`, `IDX_channels_name_trgm`, `IDX_channels_nickname_trgm` (`USING gin (immutable_unaccent(lower(<coluna>)) gin_trgm_ops)`) (per `home-search-production/TD-03`).
2. Implementar o `down` na ordem inversa: os três índices, a função, `DROP EXTENSION IF EXISTS unaccent` e `pg_trgm`.
3. Registrar a migration em `nestjs-project/src/database/migrations.integration-spec.ts` (`MIGRATIONS`), como exige `nestjs-project/CLAUDE.md` → "Interações sociais (Fase 06)", e acrescentar à suíte um caso que confirma, após o `up`, a existência das extensões e dos índices e o casamento sem acento (`immutable_unaccent(lower('Música')) = 'musica'`).
4. Aplicar no banco de dev com `docker compose exec nestjs-api npm run migration:run` e conferir com `migration:revert` + `migration:run` que o `down` é reversível.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Migration `AddVideoSearch` | Integration — `up`/`down` aplicados pela suíte de migrations; extensões, função e índices presentes após o `up` | `nestjs-project/src/database/migrations.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Após `npm run migration:run`, `SELECT extname FROM pg_extension` lista `pg_trgm` e `unaccent`.
- `SELECT immutable_unaccent(lower('Programação'))` retorna `programacao`.
- `\di` mostra `IDX_videos_title_trgm`, `IDX_channels_name_trgm` e `IDX_channels_nickname_trgm` do tipo `gin`.
- `npm run migration:revert` remove os índices, a função e as extensões sem erro, e um novo `migration:run` os recria.

---

### SI-07.2 — Endpoint GET /videos (home e busca) + throttle das listagens públicas

**Route:** GET /videos
**Test Specs:** see `nestjs-project/specs/videos-list.plan.md`
**Authorization:** Anonymous (autenticação opcional — §Authorization Matrix)

**Description:** Entregar a listagem pública global com filtro por categoria e busca por título/canal (per `home-search-production/TD-01`, `TD-02`, `TD-03`) e dar às listagens que o scroll infinito pagina um limite próprio de 60 req/min.

**Technical actions:**

1. Criar `ListPublicVideosDto` (estende `CursorPageQuery`; `category?: string`; `q?: string` com `@Transform` de `trim` + `@Length(2, 100)`) e `PublicVideosPage` (`items: VideoCardItem[]`, `next_cursor: string | null`) em `nestjs-project/src/videos/dto/`, com `@ApiProperty`/`@ApiPropertyOptional` (per §API Contracts → `GET /videos`, §API Contracts → Validation Rules).
2. Implementar `listPublic(query)` em `nestjs-project/src/videos/videos-listing.service.ts`: elegíveis `status = published`, `visibility = public`, `processing_status = ready`; `category` resolvido pelo `slug` (sem correspondência → exceção de domínio 404 com o código existente `CATEGORY_NOT_FOUND`); `q` casado por `immutable_unaccent(lower(...)) LIKE '%' || immutable_unaccent(lower(:q)) || '%'` em `videos.title`, `channels.name` e `channels.nickname` (OR), com `%`, `_` e `\` escapados como no `q` do painel do dono; ordem `published_at DESC, id DESC` com o cursor keyset de `common/pagination/cursor.ts` amarrado à ordenação `latest`; itens mapeados para `VideoCardItem` (per `home-search-production/TD-01`, `TD-03`; `video-channel-management/TD-06`).
3. Expor `@Get()` em `nestjs-project/src/videos/videos.controller.ts` com `@Public()`, `@Throttle(LISTING_THROTTLE)`, `@ApiOkResponse({ type: PublicVideosPage })` e as respostas 400/401/404/429 documentadas (per §API Contracts → `GET /videos`).
4. Criar a constante `LISTING_THROTTLE = { default: { limit: 60, ttl: 60_000 } }` em `nestjs-project/src/videos/videos.constants.ts` (no molde de `REACTION_THROTTLE`) e aplicá-la também em `GET /channels/{nickname}/videos` (`channel-videos.controller.ts`) e `GET /me/subscriptions/videos` (`subscription-feed.controller.ts`) (per `home-search-production/TD-01`).
5. Registrar o 404 de `CATEGORY_NOT_FOUND` desta rota na exceção de domínio (o mesmo código continua 400 em `PATCH /videos/{publicId}` — per §Error Catalog), sem alterar o filtro global (per `phase-02-auth/TD-07`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosListingService.listPublic` | Integration: elegibilidade (rascunho, unlisted, `processing` e `failed` fora), ordem cronológica + paginação keyset sem repetição, filtro por `category`, `CATEGORY_NOT_FOUND`, `q` por substring sem acento/caixa no título, no `name` e no `nickname`, escape de `%`/`_`, combinação `q` + `category` | `nestjs-project/src/videos/videos-listing.service.integration-spec.ts` |
| `ListPublicVideosDto` | Unit: `trim` + limites de `q` (1 e 101 caracteres falham; 2 e 100 passam), `category` opcional | `nestjs-project/src/videos/dto/list-public-videos.dto.spec.ts` |

**Dependencies:** SI-07.1 (índices e função `immutable_unaccent` usados pela consulta)

**Acceptance criteria:**

- `GET /videos` sem token retorna `200` com até 20 `VideoCardItem` publicados, públicos e `ready`, do mais recente ao mais antigo, e `next_cursor` quando há mais.
- `GET /videos?cursor=<next_cursor>` retorna a página seguinte sem repetir nenhum `public_id` da anterior.
- `GET /videos?category=music` retorna só vídeos da categoria `music`; `GET /videos?category=inexistente` retorna `404` com `error: "CATEGORY_NOT_FOUND"`.
- `GET /videos?q=musica` encontra um vídeo de título "Música ao vivo" e os vídeos de um canal de nome "Músicas do Bia"; `GET /videos?q=a` retorna `400` com `error: "VALIDATION_ERROR"`.
- `GET /videos?q=100%` não trata `%` como curinga (só casa títulos que contêm literalmente "100%").
- A 61ª requisição em um minuto do mesmo visitante a `GET /videos`, `GET /channels/{nickname}/videos` ou `GET /me/subscriptions/videos` retorna `429`.
- `GET /videos` nunca lista rascunhos nem vídeos unlisted, inclusive para o dono autenticado.

---

### SI-07.3 — Sincronizar contrato OpenAPI, aliases e handlers MSW

**Description:** Levar `GET /videos` e as respostas 429 novas pela cadeia OpenAPI até o frontend e dar ao MSW o comportamento da listagem pública, para que BFF, componentes e E2E consumam o contrato real (per `next-frontend-openapi-typing/TD-01`, `TD-04`, `TD-05`; `next-frontend-msw-foundation/TD-01`, `TD-04`).

**Technical actions:**

1. Regenerar a cadeia: `docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` (host) → `docker compose exec next-frontend npm run openapi:types`, commitando `nestjs-project/openapi.json`, `next-frontend/openapi.json` e `next-frontend/lib/api/types.gen.ts` juntos (per `next-frontend-openapi-typing/TD-03`).
2. Acrescentar a `next-frontend/lib/api/contracts.ts` os aliases `PublicVideosPage` e `PublicVideosQuery` (derivados de `paths["/videos"]["get"]`), ao lado dos existentes `Category`, `ChannelVideosPage`, `SubscriptionFeedPage` e `VideoCardItem` (per `next-frontend-openapi-typing/TD-04`).
3. Implementar o handler de `GET /videos` em `next-frontend/mocks/handlers/videos.ts`, tipado por `paths`: elegíveis do store (`published` + `public` + `ready`, fora os triggers ocultos), ordem `published_at` desc, `limit`/`cursor` como as demais listagens, `category` por slug, `q` casando título ou `name`/`nickname` do canal sem acento nem caixa (normalização NFD), `q` fora de 2–100 → 400 `VALIDATION_ERROR` (per `next-frontend-openapi-typing/TD-05`).
4. Acrescentar os triggers reservados `category=unknown-category` → 404 `CATEGORY_NOT_FOUND` e `category=upstream-error` → 500 (erro da primeira página da home) e garantir no seed (`mocks/factories/videos.ts`) mais de 20 vídeos elegíveis na listagem global (scroll infinito com ao menos duas páginas) e um vídeo elegível de título acentuado com "música" (ex.: "Música ao vivo", para a busca sem acento), sem colidir com os valores de fixture do Vitest (per `next-frontend-msw-foundation/TD-04`).
5. Documentar os triggers novos na seção "E2E architecture" de `next-frontend/CLAUDE.md` (lista de triggers por fase).

**Tests:** _(empty — contrato gerado e fixtures; exercitados pelos testes de integração do BFF em SI-07.4 e pelos E2E das telas)_

**Dependencies:** SI-07.2 (`GET /videos` precisa existir no Swagger para entrar no `openapi.json`)

**Acceptance criteria:**

- `next-frontend/lib/api/types.gen.ts` contém `paths["/videos"]["get"]` com os parâmetros `category`, `q`, `limit` e `cursor`.
- `git diff --exit-code` em `next-frontend/openapi.json` e `next-frontend/lib/api/types.gen.ts` após rerodar a cadeia está limpo (o workflow `openapi-freshness` passa).
- Com `MSW_ENABLED=true`, `GET /videos` no upstream fake devolve mais de 20 vídeos elegíveis paginados e `GET /videos?category=unknown-category` devolve `404 CATEGORY_NOT_FOUND`.
- `npx tsc --noEmit` passa no `next-frontend` com os novos aliases.

---

### SI-07.4 — Route Handlers BFF das listagens paginadas no cliente

**Route:** GET /api/videos, GET /api/channels/{nickname}/videos, GET /api/me/subscriptions/videos _(BFF tier — §API Contracts)_

**Description:** Dar ao scroll infinito as rotas same-origin que buscam as páginas seguintes da home/busca, da página do canal e do feed das inscrições (per `home-search-production/TD-04`; strict BFF per `next-frontend-config-base/TD-03`).

**Technical actions:**

1. Acrescentar `GET` a `next-frontend/app/api/videos/route.ts` (o arquivo já tem `POST`): `withOptionalSession` repassando `cursorQuery(request)` + `category` e `q` a `upstream.GET("/videos")`, resposta pass-through (per §API Contracts → BFF tier → `GET /api/videos`; `watch-page/TD-03`).
2. Criar `next-frontend/app/api/channels/[nickname]/videos/route.ts`: `GET` com `withOptionalSession`, repassando `cursorQuery(request)` + `sort` a `upstream.GET("/channels/{nickname}/videos")` (per §API Contracts → BFF tier → `GET /api/channels/{nickname}/videos`).
3. Criar `next-frontend/app/api/me/subscriptions/videos/route.ts`: `GET` com `withSession` (sem sessão → 401 `UNAUTHORIZED` sem chamar o upstream), repassando `cursorQuery(request)` a `upstream.GET("/me/subscriptions/videos")` (per §API Contracts → BFF tier → `GET /api/me/subscriptions/videos`; `phase-02-auth-frontend/TD-01`, `TD-03`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/route.ts` (`GET`) | Integration (Vitest + MSW) per testing-guide-next-frontend § "Route handlers" — repassa `category`/`q`/`cursor`/`limit`, pass-through de 200/400/404, `X-Forwarded-For` encaminhado, sessão opcional com refresh | `next-frontend/app/api/videos/__tests__/list.integration.test.ts` |
| `app/api/channels/[nickname]/videos/route.ts` | Integration (Vitest + MSW) — repassa `sort`/`cursor`, pass-through de 200/404 | `next-frontend/app/api/channels/[nickname]/videos/__tests__/route.integration.test.ts` |
| `app/api/me/subscriptions/videos/route.ts` | Integration (Vitest + MSW) — 401 sem sessão sem tocar o upstream, pass-through com sessão, refresh single-flight | `next-frontend/app/api/me/subscriptions/videos/__tests__/route.integration.test.ts` |

**Dependencies:** SI-07.3 (tipos de `paths["/videos"]` e handlers MSW)

**Acceptance criteria:**

- `GET /api/videos?category=music&cursor=<c>` responde `200` com o mesmo corpo que o upstream devolveu para `GET /videos?category=music&cursor=<c>`.
- `GET /api/videos?category=unknown-category` responde `404` com `error: "CATEGORY_NOT_FOUND"`.
- `GET /api/channels/tech_mastery/videos?sort=popular&cursor=<c>` responde `200` com a página seguinte do canal.
- `GET /api/me/subscriptions/videos` sem cookie de sessão responde `401` com `error: "UNAUTHORIZED"` e nenhuma requisição chega ao upstream.
- A requisição ao upstream carrega o `X-Forwarded-For` do visitante.

---

### SI-07.5 — Scroll infinito com hook próprio (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-04 — Paginação vs. scroll infinito no frontend e camada de dados das listas`

**Technical actions:**

1. Criar `next-frontend/hooks/use-cursor-list.ts` implementando o **Setup snippet** byte-verbatim (chave `cursor-list:${pathname}?${searchParams}`, `MAX_STORED_ITEMS = 200`, `useCursorList({ initial, endpoint, query })` → `{ items, nextCursor, loadMore, status }`): anexa a página seguinte pedida ao `endpoint` com `cursor`, ignora `loadMore` concorrente, expõe erro e nova tentativa, deduplica por `public_id`, grava itens/`nextCursor`/`scrollY` em `sessionStorage` (respeitando o limite) e restaura ao montar; sem dado salvo, parte de `initial` (per `home-search-production/TD-04`, Revisions 2026-10-20). Sem dependência nova.
2. Criar `next-frontend/components/videos/infinite-scroll-sentinel.tsx`: elemento observado por `IntersectionObserver` que chama `loadMore` ao entrar na tela, spinner circular do frame enquanto carrega, botão "Load more" sempre alcançável por teclado (fallback), mensagem inline + "Load more" no erro; some quando `nextCursor` é `null` (per UI Contract Home → "Spinner / sentinela de scroll infinito").
3. Criar `next-frontend/components/videos/infinite-video-grid.tsx` (`"use client"`): usa o hook e renderiza os cards em grid 1/2/3/4 colunas por breakpoint com `VideoCard` (variante com avatar do canal) + o sentinela; recebe `initial` (`{ items, next_cursor }` do RSC), `endpoint` e `query`; o consumidor o monta com `key` pelos `searchParams` para reiniciar ao trocar filtro/termo (per UI Contract Home → "Grid de vídeos com scroll infinito").

**Dependencies:** —

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Acceptance criteria:**

- O Setup snippet (chave por URL, `MAX_STORED_ITEMS = 200`, `IntersectionObserver` sobre o sentinela, `sessionStorage` com itens/`nextCursor`/`scrollY`, `key={searchParams.toString()}` no consumidor) está presente byte-verbatim em `hooks/use-cursor-list.ts` e `components/videos/infinite-video-grid.tsx`.
- Nenhuma dependência nova em `next-frontend/package.json` (sem TanStack Query — per `home-search-production/TD-04`).
- `docker compose exec next-frontend npx tsc --noEmit` e `npm run lint` passam com os três arquivos novos.

---

### SI-07.6 — Página pública do canal → scroll infinito

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-04 — Paginação vs. scroll infinito no frontend e camada de dados das listas` → Migração row for `next-frontend/app/(app)/(shell)/channel/[nickname]/page.tsx`

**Technical actions:**

1. Ler `app/(app)/(shell)/channel/[nickname]/page.tsx`, `components/channel/channel-video-list.tsx` e `components/channel/channel-load-more.tsx` → identificar o padrão atual ("Load more" troca a URL com `?cursor=` e o RSC entrega a página seguinte).
2. Refatorar a página para ler só a **primeira** página de `GET /channels/{nickname}/videos` (mantendo `?sort=`) e entregá-la ao `InfiniteVideoGrid` com `endpoint="/api/channels/{nickname}/videos"`, `query={{ sort }}` e `key` pelo `sort`; remover `components/channel/channel-load-more.tsx` e o tratamento de `?cursor=` (per `home-search-production/TD-04`).
3. Ajustar o E2E da página do canal (`next-frontend/tests/channel-public.e2e-spec.ts`) para rolar até o sentinela em vez de clicar no "Load more" que trocava a URL.

**Dependencies:** SI-07.5 (Setup do scroll infinito), SI-07.4 (BFF `GET /api/channels/{nickname}/videos`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/channel/channel-video-list.tsx` | Unit per testing-guide-next-frontend § "Client Components" — a lista usa o `InfiniteVideoGrid` com o endpoint do canal e reinicia ao trocar `sort`; os testes atuais de ordenação continuam passando | `next-frontend/components/channel/__tests__/channel-video-list.test.tsx` |

**Acceptance criteria:**

- `channel-load-more.tsx` não existe mais e nenhum arquivo da página do canal lê `cursor` dos `searchParams` (grep).
- Rolar a página de `tech_mastery` até o fim carrega os 4 vídeos restantes (24 = 20 + 4) sem mudar a URL.
- Trocar a ordenação para "Popular" recomeça a lista na primeira página dessa ordenação.
- Os E2E existentes da página do canal (cabeçalho, inscrição, ordenações) passam.

---

### SI-07.7 — Feed das inscrições → scroll infinito

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-04 — Paginação vs. scroll infinito no frontend e camada de dados das listas` → Migração row for `next-frontend/app/(app)/(shell)/feed/subscriptions/page.tsx`

**Technical actions:**

1. Ler `app/(app)/(shell)/feed/subscriptions/page.tsx` e `components/feed/subscription-feed-list.tsx` → identificar o padrão atual ("Load more" troca a URL e a lista acumula os cards em estado com `merge`).
2. Refatorar a página para ler só a primeira página de `GET /me/subscriptions/videos` (com o `Bearer` da sessão) e entregá-la ao `InfiniteVideoGrid` com `endpoint="/api/me/subscriptions/videos"`; remover `components/feed/subscription-feed-list.tsx` e o `cursor` dos `searchParams` (o grid substitui o `SubscriptionVideoGrid` + `LoadMore`) (per `home-search-production/TD-04`).
3. Ajustar `next-frontend/tests/subscriptions-feed.e2e-spec.ts` para rolar até o sentinela em vez de clicar no "Load more" que trocava a URL.

**Dependencies:** SI-07.5 (Setup do scroll infinito), SI-07.4 (BFF `GET /api/me/subscriptions/videos`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/(app)/(shell)/feed/subscriptions/page.tsx` | E2E de regressão já existente (`tests/subscriptions-feed.e2e-spec.ts`), ajustado por esta SI — a página é RSC assíncrono (fora do alcance do Vitest per testing-guide-next-frontend § "Pages") | `next-frontend/tests/subscriptions-feed.e2e-spec.ts` |

**Acceptance criteria:**

- `subscription-feed-list.tsx` não existe mais e a página do feed não lê `cursor` dos `searchParams` (grep).
- Com sessão seguindo `tech_mastery`, rolar o feed até o fim exibe os 24 cards (20 + 4) sem mudar a URL.
- Sessão expirada durante o scroll (o BFF responde 401) leva a `/login?returnTo=/feed/subscriptions`.
- O estado vazio (sem inscrições) continua com o link para a home.

---

### SI-07.8 — Shell de navegação responsivo (Setup)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` (inclui a Migração row de `next-frontend/app/(app)/layout.tsx`, aplicada por este Setup)

**Technical actions:**

1. Criar `next-frontend/components/layout/nav-state-provider.tsx` (`"use client"`): contexto com o modo do menu (`expanded` | `mini`), o estado aberto/fechado do drawer e as ações `toggle` (em `lg+` alterna o modo e grava `document.cookie = "side_nav=mini; path=/; max-age=31536000; samesite=lax"`, ou o expira ao voltar a `expanded`; abaixo de `lg` abre o drawer) e `closeDrawer` (per `home-search-production/TD-05`).
2. Implementar o **Setup snippet** byte-verbatim em `next-frontend/app/(app)/layout.tsx`: `(await cookies()).get("side_nav")?.value === "mini" ? "mini" : "expanded"` → `<NavStateProvider initialMode={navMode}>` envolvendo `<AppHeader />`, `<NavDrawer>{sideNav}</NavDrawer>` (de `SI-07.0.1`, controlado pelo contexto) e `{children}`.
3. Mover para `app/(app)/layout.tsx` a leitura da primeira página de canais seguidos (`GET /me/subscriptions?limit=7`, com sessão) e o `SubscriptionsProvider`, hoje em `app/(app)/(shell)/layout.tsx`, para que o drawer da watch page mostre o mesmo menu (per §Frontend Runtime → TD-05 → Migração).

**Dependencies:** SI-07.0.1 (`components/layout/nav-drawer.tsx`, montado pelo snippet)

**Tests:** _(empty — Setup SI; smoke-gated by AC; behavior tests live in Migration + Verification SIs)_

**Acceptance criteria:**

- O Setup snippet (leitura do cookie `side_nav`, `<NavStateProvider initialMode={navMode}>`, `<NavDrawer>` e o valor do cookie `side_nav=mini; path=/; max-age=31536000; samesite=lax`) está presente byte-verbatim nos arquivos citados.
- Com o cookie `side_nav=mini`, o HTML servido de `/` já sai com o menu no modo mini (sem salto de layout na hidratação).
- A watch page renderiza o drawer com os canais seguidos quando há sessão, sem nova chamada a `GET /me/subscriptions` além da do layout.
- A aplicação sobe sem erro de runtime (`next build` + `next start`).

---

### SI-07.9 — Header do Figma com menu da conta → shell responsivo

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Migração row for `next-frontend/components/layout/app-header.tsx`

**Technical actions:**

1. Ler `components/layout/app-header.tsx` → identificar o padrão atual (header mínimo em português: e-mail, "Meus vídeos", "Meu canal", "Sair" / "Entrar", "Criar conta").
2. Reescrever o header conforme UI Contract Home → "TopNav / header": "≡" (`IconButton`, `aria-label` + `aria-expanded`, chama `toggle` do contexto de SI-07.8), `BrandLogo` (link para `/`), `GlobalSearch` (de SI-07.0.1, com o `q` atual em `/results`), e — com sessão — "+" para `/studio/upload` e o avatar (`ChannelAvatar` com as iniciais de `channelName`); sem sessão, "Sign in" para `/login?returnTo=<página atual>`; microfone não renderizado; textos em inglês (per `home-search-production/TD-05`, Revisions 2026-10-20).
3. Criar `next-frontend/components/layout/account-menu.tsx` (`"use client"`): painel lateral direito sobre `components/ui/dialog.tsx` aberto pelo avatar — título "Account" + fechar, nome (`channelName`) e `@{channelSlug}` com link para `/channel/{channelSlug}`, "Edit Channel" → `/studio/channel`, "Sign Out" → `POST /api/auth/logout` + `router.refresh()` (per UI Contract Home → "Account User Menu — painel da conta"; §API Contracts → BFF tier → `POST /api/auth/logout`; `home-search-production/TD-05`, Revisions 2026-10-20 — `channelSlug` já é o nickname).
4. Atualizar os E2E cujos seletores dependiam dos textos antigos do header (`tests/logout.e2e-spec.ts` e os que navegavam por "Meus vídeos"/"Meu canal"/"Entrar") para os novos controles (avatar → "Sign Out", "Sign in", menu lateral).

**Dependencies:** SI-07.8 (Setup do shell — contexto do "≡"), SI-07.0.1 (`components/layout/global-search.tsx`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/app-header.tsx` | Unit per testing-guide-next-frontend § "Client Components" — "Sign in" com `returnTo` sem sessão; avatar + "+" com sessão; "≡" chama o `toggle` e reflete `aria-expanded` | `next-frontend/components/layout/__tests__/app-header.test.tsx` |
| `components/layout/account-menu.tsx` | Integration (Vitest + MSW) per testing-guide-next-frontend § "Client Components" — mostra nome e `@nickname` da sessão, links de canal e "Edit Channel", "Sign Out" chama `POST /api/auth/logout` e `router.refresh()`, `Esc` fecha e devolve o foco ao avatar | `next-frontend/components/layout/__tests__/account-menu.integration.test.tsx` |

**Acceptance criteria:**

- Sem sessão, o header mostra "≡", logo, busca e "Sign in"; o link de "Sign in" em `/watch/abc` é `/login?returnTo=/watch/abc`.
- Com sessão, o header mostra "≡", logo, busca, "+" e o avatar com as iniciais do canal; nenhum texto em português ("Sair", "Entrar", "Meus vídeos", "Meu canal") permanece no header.
- Clicar no avatar abre o painel "Account" com o nome do canal e `@<nickname>`; "Sign Out" encerra a sessão e o header volta ao estado anônimo.
- `tests/logout.e2e-spec.ts` passa com o fluxo novo (avatar → "Sign Out").

---

### SI-07.10 — Layout `(shell)` com menu para o anônimo → shell responsivo

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Migração row for `next-frontend/app/(app)/(shell)/layout.tsx`

**Technical actions:**

1. Ler `app/(app)/(shell)/layout.tsx` → identificar o padrão atual (menu lateral só com sessão; carrega a primeira página de canais seguidos e monta o `SubscriptionsProvider`).
2. Refatorar o layout para renderizar o `AppShell` com o menu **sempre**: com sessão, `SideNavActive` com "Home", "Subscriptions", "Your videos" e a lista de canais seguidos; sem sessão, a variante do anônimo ("Home" + convite "Sign in to see your subscriptions" com link para `/login?returnTo=`); o modo `expanded`/`mini` vem do contexto de SI-07.8 (per `home-search-production/TD-05`, Revisions 2026-10-20; `social-interactions/TD-08`, Revisions 2026-10-20).
3. Remover deste layout a leitura de `GET /me/subscriptions?limit=7` e o `SubscriptionsProvider` (movidos para `app/(app)/layout.tsx` em SI-07.8), consumindo o provider de cima.

**Dependencies:** SI-07.8 (Setup do shell)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/side-nav-active.tsx` (variante do anônimo e da sessão consumidas pelo layout) | Unit per testing-guide-next-frontend § "Client Components" — anônimo vê só "Home" + convite com `returnTo`; com sessão vê "Subscriptions", "Your videos" e a lista; item ativo pela rota | `next-frontend/components/layout/__tests__/side-nav-active.test.tsx` |

**Acceptance criteria:**

- Sem sessão, `/` e `/channel/tech_mastery` mostram o menu lateral com "Home" e o convite para entrar, sem "Subscriptions" nem "Your videos".
- Com sessão, o menu mostra "Home", "Subscriptions", "Your videos" e os canais seguidos, como na Fase 06.
- `app/(app)/(shell)/layout.tsx` não chama mais `GET /me/subscriptions` (grep); a página faz uma única leitura dessa rota por render.

---

### SI-07.11 — AppShell com breakpoints → shell responsivo

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Migração row for `next-frontend/components/layout/app-shell.tsx`

**Technical actions:**

1. Ler `components/layout/app-shell.tsx` → identificar o padrão atual (coluna fixa `w-64`, sem breakpoints, `data-nav` visível/oculto).
2. Refatorar o `AppShell`: em `lg+`, coluna do menu expandida (`w-64`, como hoje) ou mini (estreita, só ícones) conforme o modo do contexto de SI-07.8 (`data-mode="expanded|mini"`); abaixo de `lg`, sem coluna — o menu fica só no drawer; conteúdo com `min-w-0` para não estourar em telas estreitas (per `home-search-production/TD-05`).

**Dependencies:** SI-07.8 (Setup do shell)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/app-shell.tsx` | Unit per testing-guide-next-frontend § "Client Components" — `data-mode` reflete o modo do contexto; a coluna do menu tem as classes de visibilidade só em `lg+` (asserção por `data-slot`/`data-mode`, não por string de classe) | `next-frontend/components/layout/__tests__/app-shell.test.tsx` |

**Acceptance criteria:**

- Em 1280 px, o menu ocupa a coluna esquerda expandida; após o toggle, fica mini (só ícones) e o conteúdo ganha a largura liberada.
- Em 390 px, nenhuma coluna de menu é renderizada e o conteúdo ocupa a largura toda, sem rolagem horizontal.

---

### SI-07.12 — SideNav nos modos expandido, mini e drawer → shell responsivo

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Migração row for `next-frontend/components/layout/side-nav.tsx`, `side-nav-item.tsx`, `side-nav-active.tsx`

**Technical actions:**

1. Ler `components/layout/side-nav.tsx`, `side-nav-item.tsx` e `side-nav-active.tsx` → identificar o padrão atual (um único modo expandido; comentário "colapso pelo ≡ e mobile pertencem à Fase 07").
2. Acrescentar a prop `mode` (`expanded` | `mini` | `drawer`) ao `SideNav`: `mini` renderiza só os itens principais como ícone + rótulo curto ("Home", "Subscriptions", "You"), sem as seções "You"/"Subscriptions" expandidas nem a lista de canais; `drawer` renderiza o menu completo dentro do `NavDrawer` (per UI Contract Home → "SideNav"; `home-search-production/TD-05`).
3. Ajustar `SideNavItem` para o layout em coluna (ícone sobre rótulo) no modo `mini`, mantendo o item ativo pela rota; "Liked videos" continua fora.
4. Fazer o `SideNavActive` repassar o modo vindo do contexto (coluna do `AppShell`) ou `drawer` (dentro do `NavDrawer`), e fechar o drawer ao clicar num item.

**Dependencies:** SI-07.8 (Setup do shell)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/side-nav.tsx` | Unit per testing-guide-next-frontend § "Client Components" — `mini` mostra só os três itens com rótulo curto e esconde a lista de canais; `expanded`/`drawer` mostram as seções completas | `next-frontend/components/layout/__tests__/side-nav.test.tsx` |
| `components/layout/side-nav-item.tsx` | Unit — item ativo (`aria-current`) nos modos `mini` e `expanded` | `next-frontend/components/layout/__tests__/side-nav-item.test.tsx` |

**Acceptance criteria:**

- No modo mini, o menu mostra apenas "Home", "Subscriptions" e "You" como ícone + rótulo curto; a lista de canais seguidos não aparece.
- No drawer, o menu aparece completo (seções "You" e "Subscriptions" com os canais) e clicar num canal navega e fecha o drawer.
- O item da rota atual tem `aria-current="page"` nos três modos.

---

### SI-07.13 — Telas existentes → layout responsivo (watch, canal, feed, auth, estúdio)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Migração row for `next-frontend/app/(app)/watch/[publicId]/page.tsx`, `app/(app)/(shell)/channel/[nickname]/page.tsx`, `app/(app)/(shell)/feed/subscriptions/page.tsx`, telas de `app/(auth)/` e de `app/(app)/(shell)/studio/`

**Technical actions:**

1. Watch page (`app/(app)/watch/[publicId]/page.tsx` e `components/watch/*`): abaixo de `lg`, player em largura total, informações e comentários empilhados e as sugestões abaixo do conteúdo (cards horizontais de largura total); controles do player utilizáveis em toque (per `home-search-production/TD-05`, Revisions 2026-10-20).
2. Página do canal e feed (`components/channel/channel-header*.tsx`, `channel-info.tsx`, grids): cabeçalho do canal empilhado abaixo de `md` (banner, avatar, nome e "Subscribe" em coluna), chips de ordenação com rolagem horizontal, grid 1/2/3/4 colunas por breakpoint.
3. Telas de auth (`app/(auth)/**`): card de largura total com margens laterais abaixo de `sm`, sem rolagem horizontal.
4. Estúdio (`components/studio/owner-video-list.tsx`, `owner-video-row.tsx`, `video-filters.tsx`, `video-edit-form.tsx`, `video-config-card.tsx`, `channel-settings-form.tsx`): abaixo de `md`, a tabela de vídeos vira lista empilhada (thumbnail + título + status + ações por item) e os formulários ficam em coluna única, com o card de configuração abaixo dos campos (per `home-search-production/TD-05`, Revisions 2026-10-20).

**Dependencies:** SI-07.8 (Setup do shell)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/studio/owner-video-row.tsx` | Unit per testing-guide-next-frontend § "Client Components" — no layout empilhado, título, status e ações continuam acessíveis por nome (`getByRole`) | `next-frontend/components/studio/__tests__/owner-video-row.test.tsx` |
| Watch page, canal, feed, auth, estúdio | E2E de regressão já existentes (`tests/watch.e2e-spec.ts`, `tests/channel-public.e2e-spec.ts`, `tests/studio-videos.e2e-spec.ts`, `tests/auth-login.e2e-spec.ts`) — devem passar sem mudança de comportamento; cobertura mobile em SI-07.17 | `next-frontend/tests/*.e2e-spec.ts` |

**Acceptance criteria:**

- Em 390 px, nenhuma das telas `/watch/{publicId}`, `/channel/{nickname}`, `/feed/subscriptions`, `/login`, `/studio/videos` e `/studio/videos/{publicId}/edit` tem rolagem horizontal.
- Em 390 px, a lista de vídeos do estúdio mostra cada vídeo como um item empilhado com título, status e o menu de ações.
- Em 1280 px, as telas mantêm o layout das Fases 04–06 (os E2E existentes passam).

---

### SI-07.14.0 — Drift audit: Página inicial (Home / Catalog Show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 — sem cota na Figma MCP: referência visual `docs/inventories/assets/phase-07/Home (Catalog Show).png`, `Account User Menu.png` e `Left Menu.png` + tokens de `app/globals.css` (resolução OQ-6 do `/plan-validate 7`)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página inicial (Home / Catalog Show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31; com a MCP indisponível, a comparação usa os PNGs acima) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/icon-button.tsx`, `components/auth/brand-logo.tsx`, `components/layout/global-search.tsx`, `components/channel/channel-avatar.tsx`, `components/ui/button.tsx`, `components/layout/account-menu.tsx`, `components/layout/app-shell.tsx`, `components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/layout/side-nav-subscriptions.tsx`, `components/layout/nav-drawer.tsx`, `components/home/category-chips.tsx`, `components/ui/filter-chip.tsx`, `components/videos/infinite-video-grid.tsx`, `components/videos/video-card.tsx`, `components/videos/infinite-scroll-sentinel.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [Home page — RSC da rota, Barra de chips de categoria, Grid de vídeos com scroll infinito, VideoCard com avatar do canal, Spinner / sentinela de scroll infinito, Account User Menu — painel da conta, SideNav subscriptions list]
   - Target paths (read-only context for audit; no writes here): `app/(app)/(shell)/page.tsx` + `components/home/category-chips.tsx`, `components/videos/infinite-video-grid.tsx`, `components/layout/app-header.tsx`, `components/layout/account-menu.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Write a `## Screen: home — audited at SI-07.14.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-07.0.1, SI-07.5, SI-07.9, SI-07.12 (os componentes auditados precisam existir em disco: bootstrap, grid/sentinela do Setup do TD-04, header + menu da conta e SideNav nos três modos)

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: home` exists with the current run's date in heading (appended on first run, overwritten in place on re-run per schema § Section ownership and update discipline).
- Every component in the Reused DS list has exactly one row in the table.
- Every row has a Decision column populated:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` or `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"`, or `CONFLICT: <one-liner>; <verb> "<specifics>"` (CONFLICT only when `prior_decisions` diverges; on CONFLICT rows `<verb>` is `auto-Edit` (default) or `exception` (override) — `create` and `skip` are categorically incompatible with `drift relevante`)
  - `componente ausente` → `create`
- Every `exception` decision carries a one-liner justification.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty (no code touched in target subproject; the report file lives outside `next-frontend` and is excluded from the scoped check by construction).

---

### SI-07.14a — Tela de Página inicial (Home / Catalog Show) (visual shell)

**Route:** `/`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 — referência visual `docs/inventories/assets/phase-07/Home (Catalog Show).png`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página inicial (Home / Catalog Show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: home`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics
   - `create` → create the file (icons via Figma asset; components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above (`<verb>` is `auto-Edit` or `exception` on CONFLICT rows; `create`/`skip` cannot appear here per schema § Decision)

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31; sem a MCP, a partir do PNG + tokens) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948
   - Reused DS components: [`components/layout/app-header.tsx`, `components/layout/app-shell.tsx`, `components/layout/side-nav.tsx`, `components/home/category-chips.tsx`, `components/ui/filter-chip.tsx`, `components/videos/infinite-video-grid.tsx`, `components/videos/video-card.tsx`, `components/videos/infinite-scroll-sentinel.tsx`] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [Home page — RSC da rota, Barra de chips de categoria, Grid de vídeos com scroll infinito, Spinner / sentinela de scroll infinito]
   - Target paths: `app/(app)/(shell)/page.tsx` (layout da home: barra de chips fixa no topo do conteúdo + grid; estado vazio com link "All"), `app/(app)/(shell)/loading.tsx` (skeleton dos chips e do grid)

**Dependencies:** SI-07.14.0 + SI-07.0.1

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npm run build`.
- Rendering matches Figma node fidelity within tolerance of DS component set (chips no topo, grid de 4 colunas em `xl`, cards com avatar, spinner abaixo do grid).
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-07.14b — Tela de Página inicial (Home / Catalog Show) (lógica & wiring)

**Test Specs:** see `next-frontend/specs/home.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página inicial (Home / Catalog Show)`

**Technical actions:**

1. **Route guard application** — per UI Contract `**Auth requirement:**` (Mixed — página pública): nenhum guard de rota; a sessão só muda o header e o menu (já tratados em SI-07.9/SI-07.10); `/` fica fora do matcher do `proxy.ts`.
2. **Rendering strategy application** — Server Component (RSC): `app/(app)/(shell)/page.tsx` lê `searchParams.category`, chama `GET /categories` e a primeira página de `GET /videos?category=` via `publicRead` em paralelo e monta `<InfiniteVideoGrid key={searchParams.toString()} initial={firstPage} endpoint="/api/videos" query={{ category }} />` (per `home-search-production/TD-04`; Migração row de `app/(app)/(shell)/page.tsx` do TD-04).
3. **Endpoint wiring + error mapping** — criar `next-frontend/lib/home/home-listing.ts` com a decisão da primeira página: `CATEGORY_NOT_FOUND` → refaz `GET /videos` sem `category`, marca o aviso "Category not found" e deixa "All" ativo (sem `notFound()` nem redirect); 5xx → lança para o `error.tsx`; `VALIDATION_ERROR` de `cursor` na página seguinte é tratado pelo hook (recomeça) (per UI Contract Home → Error Catalog → UX mapping; `home-search-production/TD-01`, Revisions 2026-10-20).
4. Criar `app/(app)/(shell)/error.tsx` (`"Try again"` com `reset()`) e substituir o placeholder da home pelos chips (`CategoryChips` com o `slug` ativo) + aviso + grid; remover o texto "O feed de vídeos chega na Fase 07".

**Dependencies:**

- `SI-07.14a` (visual shell must exist before wiring).
- Backend SIs: `SI-07.2` (`GET /videos`), `SI-07.4` (BFF `GET /api/videos`).
- Shared-types SI: `SI-07.3` (aliases `PublicVideosPage`/`PublicVideosQuery` e handlers MSW).
- Frontend Runtime: `SI-07.5` (Setup do scroll infinito — esta SI aplica a Migração row da home).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/home/home-listing.ts` | Unit per testing-guide-next-frontend § "Utilities & boundary modules" — `category` válido repassado; `CATEGORY_NOT_FOUND` → nova leitura sem filtro + aviso; 5xx lança; sem `category` lê a lista geral | `next-frontend/lib/home/__tests__/home-listing.test.ts` |

E2E for the page (rolagem até a página seguinte, troca de chip, slug desconhecido com aviso, volta da watch page com restauração) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above. Page-level Unit testing is excluded by testing-guide-next-frontend "Pages → E2E only".

**Acceptance criteria:**

- `/` sem sessão renderiza os chips ("All" + categorias de `GET /categories`) e o grid com os vídeos mais recentes.
- `/?category=music` renderiza só vídeos de `music`, com o chip "Music" ativo; `/?category=unknown-category` renderiza a lista geral com "All" ativo e o aviso "Category not found".
- Rolar até o fim de `/` carrega a página seguinte por `GET /api/videos` sem nova requisição de RSC.
- Falha do upstream na primeira página mostra o `error.tsx` com "Try again".

---

### SI-07.15.0 — Drift audit: Resultados da busca

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 — sem frame próprio (grid da Home sem os chips); sem cota na Figma MCP: referência visual `docs/inventories/assets/phase-07/Home (Catalog Show).png` + tokens de `app/globals.css`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Resultados da busca`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31; com a MCP indisponível, a comparação usa o PNG acima) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948
   - Reused DS components: [`components/layout/app-header.tsx`, `components/layout/global-search.tsx`, `components/layout/side-nav.tsx`, `components/videos/infinite-video-grid.tsx`, `components/videos/video-card.tsx`, `components/videos/infinite-scroll-sentinel.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [Results page — RSC da rota, Grid de resultados com scroll infinito, VideoCard com avatar do canal, Spinner / sentinela de scroll infinito]
   - Target paths (read-only context for audit; no writes here): `app/(app)/(shell)/results/page.tsx` + `components/videos/infinite-video-grid.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Write a `## Screen: results — audited at SI-07.15.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-07.0.1, SI-07.5, SI-07.9, SI-07.12 (componentes auditados em disco)

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` exists in the plan folder; section `## Screen: results` exists with the current run's date in heading (appended on first run, overwritten in place on re-run per schema § Section ownership and update discipline).
- Every component in the Reused DS list has exactly one row in the table.
- Every row has a Decision column populated:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` or `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"`, or `CONFLICT: <one-liner>; <verb> "<specifics>"` (CONFLICT only when `prior_decisions` diverges; on CONFLICT rows `<verb>` is `auto-Edit` (default) or `exception` (override) — `create` and `skip` are categorically incompatible with `drift relevante`)
  - `componente ausente` → `create`
- Every `exception` decision carries a one-liner justification.
- `git diff --name-only HEAD -- next-frontend` after the SI is empty (no code touched in target subproject; the report file lives outside `next-frontend` and is excluded from the scoped check by construction).

---

### SI-07.15a — Tela de Resultados da busca (visual shell)

**Route:** `/results`
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 — referência visual `docs/inventories/assets/phase-07/Home (Catalog Show).png` (grid sem os chips)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Resultados da busca`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: results`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics
   - `create` → create the file (icons via Figma asset; components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above (`<verb>` is `auto-Edit` or `exception` on CONFLICT rows; `create`/`skip` cannot appear here per schema § Decision)

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31; sem a MCP, a partir do PNG + tokens) with:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948
   - Reused DS components: [`components/layout/app-header.tsx`, `components/layout/side-nav.tsx`, `components/videos/infinite-video-grid.tsx`, `components/videos/video-card.tsx`, `components/videos/infinite-scroll-sentinel.tsx`] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [Results page — RSC da rota, Grid de resultados com scroll infinito, Spinner / sentinela de scroll infinito]
   - Target paths: `app/(app)/(shell)/results/page.tsx` (título "Results for “{q}”" + grid; estado vazio "No results for “{q}”" com sugestão e link para a home), `app/(app)/(shell)/results/loading.tsx`

**Dependencies:** SI-07.15.0 + SI-07.0.1

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npm run build`.
- Rendering matches Figma node fidelity within tolerance of DS component set (grid da home sem os chips, título com o termo acima do grid).
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-07.15b — Tela de Resultados da busca (lógica & wiring)

**Test Specs:** see `next-frontend/specs/search-results.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Resultados da busca`

**Technical actions:**

1. **Route guard application** — per UI Contract `**Auth requirement:**` (Anonymous): nenhum guard; `/results` fica fora do matcher do `proxy.ts`.
2. **Client-side validation mirror** — criar `next-frontend/lib/search/search-query.ts` com `parseSearchQuery(raw)`: `trim`; ausente, vazio ou só espaços → `{ kind: "redirect" }`; 1 caractere → `{ kind: "too-short" }`; acima de 100 → corta em 100; senão `{ kind: "search", q }` (per §API Contracts → Validation Rules; `home-search-production/TD-02`, Revisions 2026-10-20).
3. **Rendering strategy application** — Server Component (RSC): `app/(app)/(shell)/results/page.tsx` aplica `parseSearchQuery` (`redirect("/")` / estado vazio "Enter at least 2 characters" sem chamar a API / busca), lê a primeira página de `GET /videos?q=` via `publicRead` e monta `<InfiniteVideoGrid key={q} initial={firstPage} endpoint="/api/videos" query={{ q }} />`; o `GlobalSearch` do header recebe o `q` atual como valor inicial (per `home-search-production/TD-02`, `TD-04`).
4. **Error mapping** — per UI Contract `**Error Catalog → UX mapping:**`: lista vazia → "No results for “{q}”" + link para a home; 5xx na primeira página → `app/(app)/(shell)/results/error.tsx` com "Try again"; 429/5xx nas páginas seguintes → tratados pelo sentinela (mensagem inline + "Load more").

**Dependencies:**

- `SI-07.15a` (visual shell must exist before wiring).
- Backend SIs: `SI-07.2` (`GET /videos?q=`), `SI-07.4` (BFF `GET /api/videos`).
- Shared-types SI: `SI-07.3` (aliases e handlers MSW).
- Frontend Runtime: `SI-07.5` (Setup do scroll infinito).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/search/search-query.ts` | Unit per testing-guide-next-frontend § "Utilities & boundary modules" — ausente/vazio/espaços → redirect; 1 caractere → too-short; 2 e 100 → search; 101 → corta em 100; `trim` aplicado | `next-frontend/lib/search/__tests__/search-query.test.ts` |

E2E for the page (busca pelo header, resultados por título e por canal, termo curto, estado vazio, scroll infinito) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above. Page-level Unit testing is excluded by testing-guide-next-frontend "Pages → E2E only".

**Acceptance criteria:**

- Enviar "musica" no header leva a `/results?q=musica`, com o título "Results for “musica”" e os vídeos cujo título ou canal contém "música"/"musica".
- `/results` sem `q` (ou com `q` só de espaços) redireciona para `/`.
- `/results?q=a` mostra "Enter at least 2 characters" sem nenhuma chamada a `GET /videos`.
- `/results?q=termo-sem-resultado` mostra "No results for “termo-sem-resultado”" com link para a home.
- O campo de busca do header vem preenchido com o termo atual em `/results`.

---

### SI-07.16 — Scroll infinito com hook próprio (Verification)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-04 — Paginação vs. scroll infinito no frontend e camada de dados das listas` → Verificação

**Technical actions:**

1. Add the unit tests listed in the Verificação field for the hook: anexa a página seguinte, para em `next_cursor` `null`, ignora `loadMore` concorrente, erro inline + nova tentativa, deduplicação por `public_id`, gravação/restauração de itens + `nextCursor` + `scrollY` no `sessionStorage` por URL e corte em `MAX_STORED_ITEMS` (`IntersectionObserver` simulado, `fetch` via MSW).
2. Add the unit tests for `InfiniteVideoGrid` (reinicia com nova `key`, renderiza cards + sentinela) e `InfiniteScrollSentinel` (chama `loadMore` ao intersectar, "Load more" acionável por teclado, some sem `nextCursor`).
3. Rodar como regression guards os E2E da página do canal e do feed ajustados em SI-07.6/SI-07.7 e o E2E da home (spec de SI-07.14b), confirmando a rolagem sem nova requisição de RSC.

**Dependencies:** SI-07.5, SI-07.6, SI-07.7, SI-07.14b (Setup + todas as linhas da Migração do TD-04 — a da home é aplicada pela tela)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `hooks/use-cursor-list.ts` | Unit per testing-guide-next-frontend § "Custom hooks" — paginação, concorrência, erro/retry, dedup, `sessionStorage` (restauração e limite) | `next-frontend/hooks/__tests__/use-cursor-list.test.tsx` |
| `components/videos/infinite-video-grid.tsx` | Unit per testing-guide-next-frontend § "Client Components" — reinício por `key`, cards + sentinela | `next-frontend/components/videos/__tests__/infinite-video-grid.test.tsx` |
| `components/videos/infinite-scroll-sentinel.tsx` | Unit per testing-guide-next-frontend § "Client Components" — interseção dispara `loadMore`, fallback por teclado, oculto sem cursor | `next-frontend/components/videos/__tests__/infinite-scroll-sentinel.test.tsx` |

**Acceptance criteria:**

- Verificação tests listed in the spec are present and passing.
- Regression guards (E2E do canal, do feed e da home) are wired to the test runner and pass.
- Voltar da watch page para `/` após duas páginas carregadas mostra os mesmos cards e a mesma posição de rolagem, sem nova chamada a `GET /api/videos`.

---

### SI-07.17 — Shell de navegação responsivo (Verification)

**Frontend Runtime spec:** see `## Technical Specifications` → `### Frontend Runtime` → `#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile` → Verificação

**Technical actions:**

1. Add the unit tests for `NavStateProvider`: `toggle` em `lg+` alterna `expanded`/`mini` e grava/expira o cookie `side_nav`; abaixo de `lg` abre o drawer; `closeDrawer` fecha e devolve o foco ao "≡" (`matchMedia` simulado).
2. Acrescentar ao `next-frontend/playwright.config.ts` o projeto mobile `{ name: "mobile", use: { ...devices["Pixel 7"] } }` ao lado do `chromium` existente (sem `webServer`, `workers: 1` mantido — per `next-frontend/CLAUDE.md`), restrito por `testMatch` aos specs responsivos para não dobrar a suíte (per `home-search-production/TD-06`).
3. Criar `next-frontend/tests/shell-responsive.e2e-spec.ts` (projeto mobile + desktop): sem coluna de menu em 390 px, "≡" abre o drawer, busca em modo ícone, drawer na watch page; em desktop, o colapso para mini persiste após recarregar sem salto de layout.
4. Rodar como regression guards os E2E de logout (Fase 02), estúdio (Fase 04), watch page (Fase 05) e canal/feed (Fase 06) com o header e o menu novos.

**Dependencies:** SI-07.8, SI-07.9, SI-07.10, SI-07.11, SI-07.12, SI-07.13 (Setup + todas as linhas da Migração do TD-05)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/layout/nav-state-provider.tsx` | Unit per testing-guide-next-frontend § "Client Components" — toggle + cookie `side_nav`, drawer abaixo de `lg`, foco devolvido | `next-frontend/components/layout/__tests__/nav-state-provider.test.tsx` |
| Shell responsivo (verification surface) | E2E (Playwright + MSW server-side) per testing-guide-next-frontend § "Pages" — projetos `mobile` e `chromium` | `next-frontend/tests/shell-responsive.e2e-spec.ts` |
| Regression guards (logout, estúdio, watch, canal, feed) | E2E de regressão já existentes | `next-frontend/tests/*.e2e-spec.ts` |

**Acceptance criteria:**

- Verificação tests listed in the spec are present and passing.
- Regression guards (E2E das Fases 02, 04, 05 e 06) are wired to the test runner and pass com o header e o menu novos.
- `npx playwright test --project=mobile` roda os specs responsivos no perfil Pixel 7 e passa.

---

### SI-07.18 — Suíte E2E full-stack dos fluxos principais

**Description:** Provar os fluxos principais da plataforma contra as duas stacks reais (navegador → BFF → API → worker → storage → Mailpit), sem MSW, com poucas jornadas — e marcar o subconjunto que vira o smoke pós-deploy (per `home-search-production/TD-06`).

**Technical actions:**

1. Criar `next-frontend/playwright.full-stack.config.ts` (`testDir: "./full-stack"`, `testMatch: "**/*.e2e-spec.ts"`, `baseURL` de `FULL_STACK_BASE_URL` com default `http://localhost:3001`, `workers: 1`, sem `webServer`, timeout por teste ampliado para upload + processamento) e o script `test:full-stack` no `next-frontend/package.json` (roda no host, como o Playwright atual) (per `home-search-production/TD-06`; `next-frontend/CLAUDE.md` → "E2E test prerequisites").
2. Criar o suporte em `next-frontend/full-stack/support/`: usuário único por execução (e-mail com sufixo aleatório), leitura do link de confirmação pela API do Mailpit (`MAILPIT_URL`, default `http://localhost:8025`) e reaproveitamento da fixture WebM/VP9 curta de `tests/fixtures/` (per `watch-page/TD-07`).
3. Criar `next-frontend/full-stack/account.e2e-spec.ts`: cadastro → link de confirmação lido do Mailpit → login → "Sign Out" pelo menu da conta → login de novo.
4. Criar `next-frontend/full-stack/publish-and-discover.e2e-spec.ts`: upload da fixture pelo estúdio → processamento pelo `video-worker` → publicação → o vídeo aparece na home e em `/results?q=<título>` → watch page reproduz e registra a visualização; `next-frontend/full-stack/social.e2e-spec.ts`: comentário, like e inscrição → o vídeo aparece em `/feed/subscriptions`; e `next-frontend/full-stack/smoke.e2e-spec.ts` (`@smoke`, **somente leitura** — roda contra produção a cada deploy, então não cadastra usuários nem envia e-mails): `/` responde com o grid ou o estado vazio, `/results?q=` responde, `/login` renderiza e um `/watch/{publicId}` existente (variável `SMOKE_VIDEO_ID`, opcional) toca.
5. Documentar em `next-frontend/CLAUDE.md` a seção "Full-stack E2E": backend `up` + `migration:run`, frontend em `next build` + `next start` **sem** `MSW_ENABLED`, comando `npx playwright test -c playwright.full-stack.config.ts` (`--grep @smoke` para o smoke) e a limpeza opcional dos usuários criados.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Jornada de conta | E2E full-stack (Playwright, stacks reais, sem MSW) | `next-frontend/full-stack/account.e2e-spec.ts` |
| Jornada de publicação e descoberta | E2E full-stack | `next-frontend/full-stack/publish-and-discover.e2e-spec.ts` |
| Jornada social | E2E full-stack | `next-frontend/full-stack/social.e2e-spec.ts` |
| Smoke somente leitura (`@smoke`) | E2E full-stack — reutilizado pelo deploy (SI-07.23) | `next-frontend/full-stack/smoke.e2e-spec.ts` |

**Dependencies:** SI-07.14b, SI-07.15b (home e resultados), SI-07.9 (menu da conta com "Sign Out"), SI-07.2 (`GET /videos` real)

**Acceptance criteria:**

- Com as duas stacks no ar (frontend sem `MSW_ENABLED`), `npx playwright test -c playwright.full-stack.config.ts` passa as três jornadas e o smoke.
- A jornada de conta confirma o cadastro com o link que chegou ao Mailpit (nenhum token fabricado no teste).
- A jornada de publicação encontra o vídeo recém-publicado na home e em `/results?q=<título>` e registra uma visualização.
- `npx playwright test -c playwright.full-stack.config.ts --grep @smoke` roda só o smoke de leitura, sem cadastrar usuário, enviar e-mail nem criar vídeo.
- Nenhuma jornada depende de dados criados por outra: cada execução cria os próprios usuários.

---

### SI-07.19 — Backend pronto para produção: SMTP autenticado e migrations compiladas

**Description:** Fechar as lacunas de código que impedem o backend de rodar em produção: o mailer só conhece `MAIL_HOST`/`MAIL_PORT`/`MAIL_FROM` (sem credenciais nem TLS, como o Mailpit) e o data source do TypeORM só aponta para `src/**/*.ts`, que não existe numa imagem compilada (per `home-search-production/TD-09`, `TD-11`).

**Technical actions:**

1. Acrescentar as chaves opcionais `MAIL_USER`, `MAIL_PASSWORD` e `MAIL_SECURE` (`'true' | 'false'`, default `false`) ao schema Joi de `nestjs-project/src/config/env.validation.ts` e ao namespace `mail` (`src/config/mail.config.ts`), com `MAIL_USER` e `MAIL_PASSWORD` exigidos juntos (per `phase-01-configuracao-base/TD-02`, `TD-03`; `home-search-production/TD-09` — provedor SMTP transacional).
2. Passar `secure` e, quando houver usuário, `auth: { user, pass }` ao `transport` em `nestjs-project/src/mail/mail.module.ts`; sem `MAIL_USER`, o transporte continua idêntico ao do Mailpit (per `phase-02-auth/TD-05`).
3. Fazer `nestjs-project/src/database/data-source.ts` resolver `migrations`/`entities` pela extensão do próprio arquivo (`.ts` → `src/**`, `.js` → `dist/**`), e criar o script `migration:run:prod` (`typeorm migration:run -d dist/database/data-source.js`) usado pelo serviço `migrate` de produção (per `home-search-production/TD-11`, Revisions — data source de produção em `dist/database/migrations/*.js`).
4. Atualizar `nestjs-project/.env.example` (chaves `MAIL_*` novas comentadas e `SWAGGER_ENABLED=false`, hoje ausente do exemplo) e a seção de variáveis do `nestjs-project/CLAUDE.md`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| Schema Joi (`env.validation.ts`) | Unit — `MAIL_USER` sem `MAIL_PASSWORD` (e vice-versa) é rejeitado; ausência de ambos é aceita; `MAIL_SECURE` só `true`/`false` | `nestjs-project/src/config/env.validation.spec.ts` |
| `MailModule` | Unit: compilation test com e sem credenciais (transporte com e sem `auth`) | `nestjs-project/src/mail/mail.module.spec.ts` |
| `data-source.ts` | Unit — caminhos de `migrations`/`entities` para `.ts` e `.js` | `nestjs-project/src/database/data-source.spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- A API sobe com o `.env` atual de dev (sem `MAIL_USER`) e continua entregando e-mail ao Mailpit.
- Com `MAIL_USER`, `MAIL_PASSWORD` e `MAIL_SECURE=true`, o transporte do mailer é criado com `auth` e TLS.
- Com só `MAIL_USER` definido, a API não sobe e o Joi aponta a chave faltante.
- Após `npm run build`, `npm run migration:run:prod` aplica as migrations a partir de `dist/` sem depender de `ts-node`.

---

### SI-07.20 — Infra: imagens de produção multi-stage (API/worker/migrate e Next standalone)

**Description:** Criar imagens autocontidas para produção — uma imagem Nest para `api`, `worker` e `migrate` e uma imagem Next em modo `standalone` — sem bind mount nem `tail -f /dev/null` (per `home-search-production/TD-11`).

**Technical actions:**

1. Criar `nestjs-project/Dockerfile` multi-stage sobre `node:25.6.0-slim` (a mesma base do `Dockerfile.dev`): estágio `deps` (`npm ci`), estágio `build` (`npm run build`), estágio `runtime` com `ffmpeg` do apt (o worker precisa dele — per `phase-03-upload-processing/TD-05`, `TD-06`), só dependências de produção (`npm ci --omit=dev`), `dist/` e `USER node`; `CMD ["node", "dist/main"]` — o compose troca o comando para `node dist/worker` (worker) e `npm run migration:run:prod` (migrate) (per `home-search-production/TD-11`).
2. Criar `next-frontend/Dockerfile` multi-stage sobre `node:22.16.0-slim`: `deps` (`npm ci`), `build` (`npm run build` com a validação de env do `lib/env.ts` desligada só no build — `API_URL`/`SESSION_PASSWORD` são de runtime, per `next-frontend-config-base/TD-03`), `runtime` copiando `.next/standalone`, `.next/static` e `public/`, `USER node`, `CMD ["node", "server.js"]`; `MSW_ENABLED` nunca definido na imagem (per TD-11, Revisions).
3. Acrescentar `output: "standalone"` a `next-frontend/next.config.ts` (per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`).
4. Criar `nestjs-project/.dockerignore` e `next-frontend/.dockerignore` (`node_modules`, `.next`, `dist`, `.env*`, `test-results`, `playwright-report`, `coverage`) para que nenhum segredo nem artefato local entre no contexto de build.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-07.19 (`migration:run:prod` e data source compilado usados pelo comando `migrate`)

**Acceptance criteria:**

- `docker build -t streamtube-api nestjs-project` e `docker build -t streamtube-web next-frontend` terminam sem erro e sem `.env` no contexto.
- `docker run streamtube-api ffmpeg -version` funciona e a imagem não contém `devDependencies` (`npm ls --omit=dev` limpo; `jest` ausente).
- Com as variáveis de produção, o container da API responde `200` em `GET /` e o do frontend responde `200` em `/`.
- A imagem do frontend não loga `[msw] server-side mocking enabled` ao subir.

---

### SI-07.21 — Infra: compose de produção com Caddy, env e backup (validado localmente)

**Description:** Descrever o ambiente de produção numa VPS — Caddy na borda, frontend, API, worker, migration e PostgreSQL num compose único — e prová-lo subindo-o localmente, já que provisionar a VPS e executar o deploy real ficam com o usuário (per `home-search-production/TD-08`, `TD-09`, `TD-10`; `TD-11`, Revisions 2026-10-20).

**Technical actions:**

1. Criar `deploy/compose.yaml` (compose único na raiz, unindo as duas stacks): `caddy` (únicas portas publicadas, 80/443; volumes `caddy_data`/`caddy_config`), `web` (imagem do frontend, sem porta publicada, IP fixo na rede interna para o `TRUST_PROXY`), `api` e `worker` (mesma imagem Nest, comandos `node dist/main` / `node dist/worker`, sem porta publicada), `migrate` (one-shot `npm run migration:run:prod`; `api` e `worker` com `depends_on: condition: service_completed_successfully`), `db` (`postgres:17`, volume nomeado, healthcheck `pg_isready`); imagens por `ghcr.io/<owner>/streamtube-{api,web}:${IMAGE_TAG}`; sem `rustfs`, `storage-init` nem `mailpit` (per `home-search-production/TD-08`, `TD-09`; `watch-page/TD-03` — rede com sub-rede fixa).
2. Criar `deploy/Caddyfile`: `{$DOMAIN}` com `reverse_proxy web:3000`, TLS automático e o comportamento padrão de **sobrescrever** `X-Forwarded-For` com o IP real do cliente (sem `trusted_proxies`), fechando a pendência de `watch-page/TD-03` (Revisions 2026-10-19) (per `home-search-production/TD-10`).
3. Criar `deploy/.env.example` com o conjunto completo de chaves de produção: `DOMAIN`, `IMAGE_TAG`, `NODE_ENV=production`, `FRONTEND_URL=https://$DOMAIN`, `APP_URL`, `SWAGGER_ENABLED=false`, `TRUST_PROXY=<IP fixo do web>`, `DB_*`, `JWT_*`, `MAIL_HOST`/`MAIL_PORT`/`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_SECURE`/`MAIL_FROM` (SMTP transacional), `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT`/`S3_REGION`/`S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_FORCE_PATH_STYLE` (AWS S3), `API_URL=http://api:3000`, `SESSION_PASSWORD`; `MSW_ENABLED` ausente (per `home-search-production/TD-09`, Revisions — AWS S3; `TD-11`, Revisions).
4. Criar `deploy/compose.local.yaml` (override só para validação local): `build:` apontando para os Dockerfiles de SI-07.20, `DOMAIN=localhost` (CA local do Caddy) e, sob o profile `local-validation`, `rustfs` + `storage-init` + `mailpit` no lugar do AWS S3 e do SMTP real — para subir o ambiente de produção inteiro numa máquina de teste.
5. Criar `deploy/backup.sh`: `pg_dump` do `db` comprimido e enviado ao bucket em `backups/` (prefixo privado; a política anônima cobre só `thumbnails/*`) com retenção por data no nome, para agendamento por cron na VPS (per `home-search-production/TD-09`).

**Tests:** _(empty — Infra)_

**Dependencies:** SI-07.20 (imagens referenciadas pelo compose)

**Acceptance criteria:**

- `docker compose -f deploy/compose.yaml config` valida sem erro com o `.env.example` copiado.
- `docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --profile local-validation up -d` sobe o ambiente; `migrate` termina com código 0 antes de `api` e `worker` subirem; `https://localhost` serve a home.
- Do host, a porta 3000 da API e a 3000 do frontend não respondem — só 80/443 do Caddy.
- Uma requisição com `X-Forwarded-For: 1.2.3.4` forjado chega à API com o IP real do cliente (verificável nos logs da API ou pelo throttler, que não é contornado ao variar o header).
- `deploy/backup.sh` gera um dump restaurável (`pg_restore --list` lê o arquivo) no prefixo `backups/` do bucket local.

---

### SI-07.22 — Infra: pipeline de CI de qualidade via Docker Compose

**Description:** Rodar em CI os mesmos gates do Definition of Done — lint, `tsc`, testes unitários/integração e e2e de cada subprojeto, mais a suíte full-stack — no mesmo ambiente Docker Compose do dev, como gate antes do deploy (per `home-search-production/TD-07`).

**Technical actions:**

1. Criar `.github/workflows/ci.yml` com `on: pull_request` (para `dev` e `main`) e `push` (em `dev`), `permissions: contents: read` e `concurrency` por ref, no estilo de `.github/workflows/openapi-freshness.yml` (mantido como está — per `saneamento-fase-02-e-infra/TD-06`).
2. Job `backend`: `docker compose up -d` em `nestjs-project/` (cria a rede `streamtube`, `db`, `mailpit`, `rustfs`, `storage-init`), `.env` a partir do `.env.example`, `docker compose exec -T nestjs-api npm ci`, `migration:run`, `lint`, `npx tsc --noEmit`, `npm test -- --runInBand` e `npm run test:e2e` (os comandos de `nestjs-project/CLAUDE.md`).
3. Job `frontend`: rede `streamtube` criada como no backend, `docker compose up -d` em `next-frontend/`, `npm ci`, `lint`, `npx tsc --noEmit`, `npm test`, `npm run build` e `MSW_ENABLED=true npm run start` em background, depois Playwright no runner (`npm ci` + `install chromium` no host, `npx playwright test` com os projetos `chromium` e `mobile`), publicando o relatório como artefato em falha (per `next-frontend/CLAUDE.md` → "E2E test prerequisites").
4. Job `full-stack` (só em `pull_request` para `main` e `push` em `dev`): as duas stacks, `migration:run`, frontend em `next build` + `next start` **sem** `MSW_ENABLED`, `npx playwright test -c playwright.full-stack.config.ts` (per `home-search-production/TD-06`, `TD-07`).
5. Documentar no `CLAUDE.md` da raiz (seções "Git Conventions" e "Definition of Done") os status checks exigidos na proteção de `main` (`backend`, `frontend`, `full-stack`, `openapi-freshness`) — a configuração da proteção é feita pelo usuário no GitHub.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-07.17 (projeto `mobile` do Playwright), SI-07.18 (suíte full-stack)

**Acceptance criteria:**

- Um PR para `dev` dispara os jobs `backend` e `frontend` (e o `openapi-freshness` existente); um PR para `main` dispara também o `full-stack`.
- Um PR com um erro de lint ou um teste quebrado em qualquer subprojeto termina com o job correspondente em falha.
- Em falha do Playwright, o relatório HTML fica disponível como artefato do job.
- Os jobs usam `docker compose exec` para todo comando `npm`/`npx` de Vitest, Jest, `tsc` e lint (nenhum desses roda no runner fora dos containers).

---

### SI-07.23 — Infra: workflow de deploy (GHCR + SSH) e runbook de produção

**Description:** Entregar o mecanismo de deploy — imagens publicadas no GHCR pelo CI em push para `main`, deploy por SSH com a migration como job único e smoke pós-deploy — e o runbook que leva o usuário do zero (VPS, DNS, S3, SMTP, secrets) ao primeiro deploy, já que provisionar e executar o deploy real é tarefa operacional dele (per `home-search-production/TD-11`, Revisions 2026-10-20; `TD-08`, `TD-09`, `TD-10`).

**Technical actions:**

1. Criar `.github/workflows/deploy.yml` com `on: push: branches: [main]` e `workflow_dispatch` (input `image_tag`, para rollback): job `images` com `permissions: packages: write` que constrói `nestjs-project/Dockerfile` e `next-frontend/Dockerfile` e publica `ghcr.io/<owner>/streamtube-{api,web}` com a tag do SHA; o job só roda depois dos gates do `ci.yml` (`needs`/`workflow_run` em sucesso) (per `home-search-production/TD-11`).
2. Job `deploy` no GitHub Environment `production` (secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DOMAIN`): copia `deploy/compose.yaml` e `deploy/Caddyfile` para a VPS e executa `IMAGE_TAG=<tag> docker compose pull`, `docker compose run --rm migrate` e `docker compose up -d` — o `.env` de produção vive só na VPS, fora do git (per TD-11).
3. Passo de smoke após o `up -d`: `npx playwright test -c playwright.full-stack.config.ts --grep @smoke` com `FULL_STACK_BASE_URL=https://$DOMAIN`; falha do smoke marca o deploy como falho e o runbook indica o rollback pelo `workflow_dispatch` com a tag anterior (per `home-search-production/TD-06`, `TD-11`).
4. Escrever `docs/deploy/runbook.md`: (a) VPS com Docker e firewall só 22/80/443; (b) DNS do domínio; (c) bucket AWS S3 — CORS para `FRONTEND_URL`, política anônima só em `thumbnails/*`, lifecycle `AbortIncompleteMultipartUpload` (2 dias, maior que `UPLOAD_TTL`), usuário IAM com o mínimo (`GetObject`, `PutObject`, `DeleteObject`, `ListMultipartUploadParts`, `AbortMultipartUpload` no bucket) e a verificação de que a URL path-style `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/thumbnails/...` responde na região escolhida; (d) provedor SMTP transacional (`MAIL_*`, SPF/DKIM do domínio); (e) `.env` de produção a partir de `deploy/.env.example` (segredos gerados); (f) secrets do Environment `production`; (g) cron do `deploy/backup.sh` e o procedimento de restauração; (h) primeiro deploy, rollback e o pós-deploy (logs, `video.delete failed`) (per `home-search-production/TD-09`, Revisions — AWS S3; `video-channel-management/TD-10`; `phase-03-upload-processing/TD-12`).
5. Atualizar o `CLAUDE.md` da raiz (Repository Structure, Architecture e Commands) com `deploy/`, o runbook, as imagens de produção e os workflows `ci.yml`/`deploy.yml`.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-07.21 (compose de produção e Caddyfile), SI-07.22 (gates do CI), SI-07.18 (smoke `@smoke`)

**Acceptance criteria:**

- Um push em `main` com os gates do `ci.yml` verdes publica `ghcr.io/<owner>/streamtube-api:<sha>` e `streamtube-web:<sha>`.
- Com os secrets do Environment `production` configurados, o job `deploy` aplica a migration antes de subir `api`/`worker` e termina com o smoke verde; sem os secrets, o job falha antes de qualquer acesso à VPS.
- `workflow_dispatch` com `image_tag` de um deploy anterior sobe aquela versão sem rebuild.
- Seguindo só o `docs/deploy/runbook.md`, um ambiente novo é provisionado e recebe o primeiro deploy sem passos fora do documento.
- Nenhum segredo de produção (`.env`, chaves AWS, senha SMTP, chave SSH) é commitado no repositório.

---

## Technical Specifications

### Data Model

_Nenhuma entidade TypeORM muda nesta fase: a home e a busca leem `videos` (com `channel` e `category`) e `categories` como estão. A única mudança de schema é a migration da busca textual (per `home-search-production/TD-03`), que cria extensões, uma função e índices — sem coluna nova. `synchronize` segue desligado; a migration entra na lista de `src/database/migrations.integration-spec.ts` (`MIGRATIONS`), conforme `nestjs-project/CLAUDE.md` → "Interações sociais (Fase 06)"._

#### Migration `AddVideoSearch` (nova — per `home-search-production/TD-03`)

| Objeto | Definição | Observação |
|--------|-----------|------------|
| Extensão `pg_trgm` | `CREATE EXTENSION IF NOT EXISTS pg_trgm` | "trusted" no PostgreSQL 17 — dispensa superusuário |
| Extensão `unaccent` | `CREATE EXTENSION IF NOT EXISTS unaccent` | "trusted" no PostgreSQL 17 |
| Função `immutable_unaccent(text)` | `LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT`, corpo `SELECT public.unaccent('public.unaccent', $1)` | wrapper `IMMUTABLE` exigido para indexar `unaccent` (per TD-03); dicionário qualificado para não depender do `search_path` |
| Índice `IDX_videos_title_trgm` | `ON videos USING gin (immutable_unaccent(lower(title)) gin_trgm_ops)` | `videos.title` é `varchar(100)` |
| Índice `IDX_channels_name_trgm` | `ON channels USING gin (immutable_unaccent(lower(name)) gin_trgm_ops)` | `channels.name` é `varchar(50)` |
| Índice `IDX_channels_nickname_trgm` | `ON channels USING gin (immutable_unaccent(lower(nickname)) gin_trgm_ops)` | `channels.nickname` é `varchar(50)`, já `unique` |

**`down`:** remove os três índices, a função e as duas extensões (`DROP EXTENSION IF EXISTS unaccent`, `pg_trgm`), nesta ordem.

**Indexes (existentes, reaproveitados):** a listagem pública cronológica usa `IDX_videos_status_visibility_published (status, visibility, published_at, id)` — `status = published`, `visibility = public`, `processing_status = ready`, ordem `published_at DESC, id DESC` (per `home-search-production/TD-01`); o filtro por categoria usa o índice existente de `videos.category_id`. Nenhum índice novo para a home.

**Casamento textual (per `home-search-production/TD-03`):** `immutable_unaccent(lower(<coluna>)) LIKE '%' || immutable_unaccent(lower(:q)) || '%'` sobre `videos.title`, `channels.name` e `channels.nickname` (OR), com `%`, `_` e `\` do termo escapados (mesmo escape do `q` de `GET /channels/me/videos` em `videos-listing.service.ts`). Termos de 2 caracteres não geram trigramas e varrem o índice inteiro — custo aceito no volume do projeto (per TD-03).

#### Video, Channel, Category (inalteradas nesta fase)

Shapes, colunas e contadores da Fase 06. `VideoCardItem` (Fase 04) continua sendo o item das listagens: `{ public_id, title, thumbnail_url, duration_seconds, view_count, published_at, channel: VideoCardChannel }`, com `VideoCardChannel = { nickname, name }` — sem avatar (o card usa as iniciais de `components/channel/channel-avatar.tsx`).

#### Sessão do frontend (inalterada nesta fase)

`SessionData` (`next-frontend/lib/auth/session.ts`) já carrega `channelSlug` (o nickname do canal, preenchido no login e reescrito por `PATCH /api/channel` quando o nickname muda) e `channelName`; o menu da conta usa os dois — nenhum campo novo (per `home-search-production/TD-05`, Revisions 2026-10-20).

### API Contracts

_Backend tier (NestJS, `Scope: Backend | Cross-layer`). Envelope de erro herdado: `{ statusCode, error, message }` (per `phase-02-auth/TD-07`). Leituras públicas com autenticação opcional (`@Public()`, per `video-channel-management/TD-07`); a listagem pública não tem estado do espectador, então token presente só é validado (inválido/expirado → 401, para o BFF acionar o refresh). Listagens no envelope keyset `{ items, next_cursor }` com `limit` default 20, máx. 50 e cursor amarrado à ordenação (per `video-channel-management/TD-06`; `DEFAULT_PAGE_LIMIT`/`MAX_PAGE_LIMIT`). Throttler global de 10 req/min **por rota e por visitante** (IP real via `TRUST_PROXY`, per `watch-page/TD-03`); as listagens públicas que o scroll infinito pagina ganham `@Throttle` próprio de **60 req/min por visitante** — nova constante `LISTING_THROTTLE`, no molde de `REACTION_THROTTLE` (per `home-search-production/TD-01`). Shapes anotados com `@ApiProperty`: o `openapi.json` é a fonte dos tipos do frontend (per `openapi-docs-nestjs/TD-01`, `next-frontend-openapi-typing/TD-01`)._

**Shapes novos ou modificados nesta fase:**

- `ListPublicVideosDto` (novo — query de `GET /videos`): estende `CursorPageQuery` (`limit`, `cursor`) com `category?: string` e `q?: string`
- `PublicVideosPage` (novo): `{ items: VideoCardItem[], next_cursor: string | null }` — `VideoCardItem` da Fase 04, sem campo novo
- `CategoryResponse` (existente, Fase 04): `{ id, slug, name, sort_order }` — a home o consome por `GET /categories` (resposta: array, já em `sort_order`)
- `ChannelVideosPage` / `SubscriptionFeedPage` (existentes): inalterados; só ganham `@Throttle(LISTING_THROTTLE)` nas rotas

#### GET /videos (SI-07.2)

Listagem pública global da home e da busca (per `home-search-production/TD-01`, `TD-02`). Elegíveis: `status = published`, `visibility = public`, `processing_status = ready` — unlisted nunca aparece. Ordem `published_at DESC, id DESC` (cronológica, inclusive com `q` — per TD-03).

**Request headers:**
- Authorization: Bearer <access_token> — opcional (sem efeito no resultado; inválido/expirado → 401)

**Request query parameters:**
- category: string, optional — `slug` de `categories`; filtra pela categoria (per TD-01)
- q: string, optional — `trim`, 2 a 100 caracteres; casa por substring, sem acento nem caixa, o título do vídeo **ou** o `name`/`nickname` do canal (per TD-02, TD-03); combinável com `category`
- limit: integer, optional — 1..50, default 20
- cursor: string, optional — opaco, emitido por esta rota (ordenação `latest`)

**Response 200:** `PublicVideosPage`

**Error responses:**
- 400 VALIDATION_ERROR: `q` fora de 2–100 caracteres após `trim` (inclusive vazio), `limit` fora de 1..50, `cursor` malformado ou emitido para outra ordenação
- 401 Unauthorized: token presente e inválido/expirado
- 404 CATEGORY_NOT_FOUND: `category` que não corresponde a nenhum `slug` (inclusive formato inválido) — per `home-search-production/TD-01`; a home trata o 404 caindo para "All" com aviso (TD-01, Revisions 2026-10-20)
- 429 Too Many Requests: acima de 60 req/min por visitante nesta rota

---

#### GET /channels/{nickname}/videos (SI-07.2 — contrato da Fase 04 inalterado; throttle próprio)

Mesmos parâmetros (`sort=latest|popular|oldest`, `limit`, `cursor`) e mesma resposta `ChannelVideosPage` da Fase 04. Muda só o limite: `@Throttle(LISTING_THROTTLE)` — 60 req/min por visitante — porque a página do canal passa a paginar por scroll infinito (per `home-search-production/TD-01`, `TD-04`).

**Error responses (acrescentado):**
- 429 Too Many Requests: acima de 60 req/min por visitante nesta rota

---

#### GET /me/subscriptions/videos (SI-07.2 — contrato da Fase 06 inalterado; throttle próprio)

Mesmos parâmetros (`limit`, `cursor`) e mesma resposta `SubscriptionFeedPage` da Fase 06; exige JWT. Ganha `@Throttle(LISTING_THROTTLE)` — o feed passa a paginar por scroll infinito (per TD-01, TD-04).

**Error responses (acrescentado):**
- 429 Too Many Requests: acima de 60 req/min por visitante nesta rota

---

#### Validation Rules — home e busca

- `category` (`GET /videos`): optional, string; sem correspondência em `categories.slug` (inclusive formato inválido) → 404 `CATEGORY_NOT_FOUND`
- `q` (`GET /videos`): optional, string, `trim` antes de validar, min 2, max 100; presente mas vazio após `trim` → 400 `VALIDATION_ERROR`
- `limit` (`GET /videos` e listagens desta fase): optional, integer, min 1, max 50, default 20
- `cursor` (`GET /videos`): optional, string opaca base64url; malformada ou emitida para outra ordenação → 400 `VALIDATION_ERROR`

---

> _BFF tier — frontend-exposed contract. O navegador chama a rota same-origin em `app/api/**`; a rota repassa ao upstream NestJS no servidor (strict BFF, per `next-frontend/CLAUDE.md` → "Talking to the NestJS API"). A **primeira página** de cada listagem é lida no RSC via `publicRead`/`upstream` (per `video-channel-management/TD-12`) e não passa por estas rotas; elas servem às páginas seguintes do scroll infinito (per `home-search-production/TD-04`). Leituras públicas usam `withOptionalSession` (sessão quando houver + `clientHeaders()`, per `watch-page/TD-03`); o feed usa `withSession`. A query é repassada com `cursorQuery(request)` mais os parâmetros próprios de cada rota._

#### GET /api/videos (SI-07.4)

**forwards-to:** `GET /videos` *(derived: project contract source)*

**Request headers:**
- `X-Forwarded-For` / `User-Agent` do visitante via `clientHeaders()`; `Authorization` da sessão quando houver *(per watch-page/TD-03)*

**Request query parameters:** `ListPublicVideosDto` — `category`, `q`, `cursor`, `limit` repassados *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 200 (FE-facing):** `PublicVideosPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** upstream 401 com sessão → refresh single-flight; refresh falho → sessão destruída e a chamada é repetida anônima *(per phase-02-auth-frontend/TD-03, watch-page/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 404 CATEGORY_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### GET /api/channels/{nickname}/videos (SI-07.4)

**forwards-to:** `GET /channels/{nickname}/videos` *(derived: project contract source)*

**Request headers:**
- `X-Forwarded-For` / `User-Agent` via `clientHeaders()`; `Authorization` da sessão quando houver *(per watch-page/TD-03)*

**Request query parameters:** `ListChannelVideosDto` — `sort`, `cursor`, `limit` repassados *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 200 (FE-facing):** `ChannelVideosPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** igual a `GET /api/videos` (`withOptionalSession`) *(per phase-02-auth-frontend/TD-03, watch-page/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 404 CHANNEL_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### GET /api/me/subscriptions/videos (SI-07.4)

**forwards-to:** `GET /me/subscriptions/videos` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão iron-session; sem sessão → 401 `UNAUTHORIZED` sem chamar o upstream *(per phase-02-auth-frontend/TD-01)*

**Request query parameters:** `ListSubscriptionFeedDto` — `cursor`, `limit` repassados *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 200 (FE-facing):** `SubscriptionFeedPage` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** upstream 401 → refresh single-flight e nova tentativa; refresh falho → sessão destruída e 401 *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sem sessão ou refresh falho *(per phase-02-auth-frontend/TD-03)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

---

#### POST /api/auth/logout (existente — Fase 02; consumido pelo menu da conta, SI-07.9)

**forwards-to:** `POST /auth/logout` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão iron-session *(per phase-02-auth-frontend/TD-01)*

**Request body:** _nenhum_ *(derived: project contract source)*

**Response 204 (FE-facing):** sem corpo — o resultado do upstream é ignorado *(per phase-02-auth-frontend/TD-02)*

**Set-Cookie / session side-effect:** `destroySession()` incondicional (logout local é idempotente) *(per phase-02-auth-frontend/TD-02)*

**Error responses (FE-facing):** _nenhum — falhas do upstream são engolidas_ *(per phase-02-auth-frontend/TD-02)*

### Authorization Matrix

_A home, a busca, a página do canal e as categorias são públicas; só o feed das inscrições e o logout dependem de sessão. "Published" = `status = published` + `visibility = public` + `processing_status = ready` na listagem global (unlisted só abre por link, per `watch-page/TD-04`). As rotas BFF seguem a mesma regra do upstream. O menu lateral passa a aparecer também para o anônimo (per `home-search-production/TD-05`, Revisions 2026-10-20; `social-interactions/TD-08`, Revisions 2026-10-20), sem as seções de inscrições e "You"._

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| GET /videos (home e busca) | ✓ | ✓ (mesmo resultado) | ✓ (rascunhos e unlisted do próprio canal **não** aparecem) |
| GET /categories | ✓ | ✓ | ✓ |
| GET /channels/{nickname}/videos | ✓ | ✓ | ✓ (published + public, como na Fase 04) |
| GET /me/subscriptions/videos | ✗ (401) | ✓ (o próprio feed) | ✓ (o próprio feed) |
| BFF `GET /api/videos`, `GET /api/channels/{nickname}/videos` | ✓ | ✓ — mesma regra do upstream | ✓ — mesma regra do upstream |
| BFF `GET /api/me/subscriptions/videos` | ✗ (401 sem chamar o upstream) | ✓ | ✓ |
| BFF `POST /api/auth/logout` | ✓ (no-op: destrói uma sessão inexistente, 204) | ✓ | ✓ |

### Error Catalog

_Envelope `{ statusCode, error, message }` herdado (per `phase-02-auth/TD-07`). Nenhum código novo: `CATEGORY_NOT_FOUND` já existe (`VIDEO_ERROR_CODES`, Fase 04) e responde 400 no `PATCH /videos/{publicId}`; em `GET /videos` ele responde **404** (per `home-search-production/TD-01`)._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| VALIDATION_ERROR | 400 | `GET /videos`: `q` fora de 2–100 caracteres após `trim`, `limit` inválido, `cursor` malformado ou de outra ordenação; demais listagens: como nas Fases 04/06 |
| UNAUTHORIZED | 401 | BFF: `GET /api/me/subscriptions/videos` sem sessão ou com refresh falho |
| _(sem errorCode)_ | 401 | Upstream: token presente e inválido/expirado em `GET /videos`; token ausente/inválido em `GET /me/subscriptions/videos` |
| CATEGORY_NOT_FOUND | 404 | `GET /videos?category=` sem `slug` correspondente (inclusive formato inválido) |
| CHANNEL_NOT_FOUND | 404 | `GET /channels/{nickname}/videos` com nickname inexistente (Fase 04) |
| _(sem errorCode)_ | 429 | Acima de 60 req/min por visitante em `GET /videos`, `GET /channels/{nickname}/videos` e `GET /me/subscriptions/videos` (`LISTING_THROTTLE`); 10 req/min por rota nas demais (`ThrottlerException`, corpo padrão do Nest) |

### UI Contracts

_Referência visual (resolução OQ-6 do `/plan-validate 7`): sem a Figma MCP, o `/implement` usa os PNGs de `docs/inventories/assets/phase-07/` (`Home (Catalog Show).png`, `Account User Menu.png`, `Left Menu.png`) + os tokens de `app/globals.css`; a checagem de drift de tokens fica para quando o acesso voltar. Textos sem frame em inglês, como o Figma (per `home-search-production/TD-05`, Revisions 2026-10-20) — o header atual em português ("Entrar", "Criar conta", "Meus vídeos", "Meu canal", "Sair") é substituído. Estados sem frame (menu mini, drawer, header anônimo, busca em modo ícone, estados vazios) são derivados do Left Menu 150:959 e dos primitivos `IconButton`/`Button`/`Dialog`/`FilterChip` (decisões do usuário no `/screen-inventory 7`)._

#### Screen: Página inicial (Home / Catalog Show)

**Route:** `/` (filtro na URL: `/?category=<slug>` — per `home-search-production/TD-01`)
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`) — referência visual: `docs/inventories/assets/phase-07/Home (Catalog Show).png`; menu da conta em `Account User Menu.png` (frame 150:1267); menu lateral em `Left Menu.png` (frame 150:959). O header e o menu lateral são compartilhados por todas as rotas de app e inventariados aqui
**Purpose:** "Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)"

**Auth requirement:** Mixed — a página, as categorias e a listagem são públicas (anônimo vê o grid, os chips e o menu lateral com "Home" + convite para entrar); o menu da conta, o "+" e as seções "Subscriptions"/"You" do menu lateral exigem sessão _(source: §Authorization Matrix — `GET /videos` e `GET /categories` públicos; `POST /api/auth/logout` com sessão; menu do anônimo per `home-search-production/TD-05`, Revisions 2026-10-20)_

**Rendering strategy:** Server Component (RSC) lê `GET /categories` e a **primeira página** de `GET /videos?category=` via `publicRead`, em paralelo; as páginas seguintes chegam no cliente pelo hook de cursor via `GET /api/videos` (scroll infinito com `IntersectionObserver` + "Load more" de fallback, restauração por `sessionStorage` ao voltar); a lista recomeça quando `category` muda (`key` pelos `searchParams`) _(source: `home-search-production/TD-04`; leitura RSC per `video-channel-management/TD-12`)_

**Reused DS components:**
- `new` — Home page — RSC da rota (143:948) — `app/(app)/(shell)/page.tsx` substitui o placeholder atual. Lê `?category=` dos `searchParams`, a primeira página de `GET /videos` e as categorias de `GET /categories` (`home-search-production/TD-01`); acesso anônimo
- `components/layout/app-header.tsx` — TopNav / header (componente 152:1827) — Reescrito conforme `TD-05`: "≡", logo, busca, "+" e login/avatar em todas as rotas de app (inclusive a watch page). O conteúdo atual (e-mail, "Meus vídeos", "Meu canal", "Sair") sai do header e vai para o menu lateral e o menu da conta
- `components/ui/icon-button.tsx` — Menu trigger "≡" (I152:1827;62:1860) — Em `lg+` alterna o menu lateral entre expandido e mini (estado em cookie lido no RSC); abaixo de `lg` e na watch page abre o drawer de navegação
- `components/auth/brand-logo.tsx` — BrandLogo / Size=sm (3050:135) — Link para `/`
- `components/layout/global-search.tsx (new)` — Busca global — campo + botão (I152:1827;62:1879 + 62:1881) — Compõe `components/ui/search-input.tsx` (DS "Search" 158:4007). Ao enviar (Enter ou botão) navega para `/results?q=` (`TD-02`); sem autocomplete. Abaixo de `md` vira ícone que expande a barra ocupando o header
- `components/ui/icon-button.tsx` — Voice search (I152:1827;62:1883) — **Não renderizado** — busca por voz sem capability (decisão do usuário)
- `components/ui/icon-button.tsx` — IconButton "+" (I152:1827;70:31) — Atalho para `/studio/upload`, só com sessão (decisão do usuário)
- `components/channel/channel-avatar.tsx` — Avatar da conta (I152:1827;62:1892) — Iniciais do nome do canal (já na sessão); abre o menu da conta. O canal não tem imagem de avatar
- `components/ui/button.tsx` — Botão "Sign in" do header — Estado anônimo (não desenhado no frame): link para `/login?returnTo=<página atual>` no lugar do avatar e do "+"
- `components/layout/account-menu.tsx (new)` — Account User Menu — painel da conta (150:1267) — Painel lateral direito sobre `components/ui/dialog.tsx`: título "Account" + fechar, nome e @nickname do canal (link para `/channel/{nickname}`), "Edit Channel" → `/studio/channel`, "Sign Out" → fluxo de logout existente. Nome e nickname vêm de `channelName`/`channelSlug` da sessão (per `TD-05`, Revisions 2026-10-20)
- `components/layout/app-shell.tsx` — Body / app shell (2737:2153) — Ganha breakpoints: coluna do menu expandido ou mini em `lg+`, sem coluna abaixo de `lg`
- `components/layout/side-nav.tsx` — SideNav (150:959) — Três estados (`TD-05`): expandido (frame), mini (ícones + rótulo curto: Home, Subscriptions, You) e dentro do drawer. Visível também para o anônimo, com "Home" e um convite para entrar; "Liked videos" segue não renderizado
- `components/layout/side-nav-item.tsx` — SideNav item Home / Subscriptions / Your videos (I155:1927;62:1620, 62:1630, 62:1653) — "Home" ativo nesta rota; "Subscriptions" e "Your videos" só com sessão
- `components/layout/side-nav-subscriptions.tsx` — SideNav subscriptions list (I155:1927;62:1672) — Herdado da Fase 06 sem mudança de verbo; só com sessão; oculto no estado mini
- `components/layout/nav-drawer.tsx (new)` — Drawer de navegação — Sem frame (decisão do usuário): o mesmo SideNav dentro de um `Dialog` lateral esquerdo, aberto pelo "≡" abaixo de `lg` e na watch page; fecha ao navegar
- `components/home/category-chips.tsx (new)` — Barra de chips de categoria — "All" + as categorias de `GET /categories` em `sort_order`; cada chip é um `<Link>` para `/?category=<slug>` ("All" limpa o filtro). Rolagem horizontal com esmaecimento na borda direita quando não cabe (como no frame)
- `components/ui/filter-chip.tsx` — FilterChip (158:2651) — Variantes active/normal; "All" ativo sem `category`
- `components/videos/infinite-video-grid.tsx (new)` — Grid de vídeos com scroll infinito — Grid de 4 colunas no frame (1/2/3/4 por breakpoint). Primeira página do RSC; as seguintes pelo BFF com o hook de cursor de `TD-04`, reiniciado ao trocar a categoria. Reaproveitado na busca, no canal e no feed
- `components/videos/video-card.tsx` — VideoCard com avatar do canal (143:2505) — Variante `default` com avatar de iniciais; thumbnail, título em 2 linhas, nome do canal, visualizações e tempo relativo. Selo de verificado não renderizado (não existe no domínio)
- `components/videos/infinite-scroll-sentinel.tsx (new)` — Spinner / sentinela de scroll infinito — O frame mostra um spinner circular abaixo do grid. Dispara a próxima página ao entrar na tela; botão "Load more" como fallback acessível (`TD-04`); some quando `next_cursor` é `null`
- `new` — Estado vazio da home — Não desenhado: plataforma sem vídeos públicos, ou categoria sem vídeos (com link para "All")
- `new` — Verified badge (I156:3591;156:3819) — **Não renderizado** — verificação de canal não existe no domínio

**Server-connected components:**
- `Home page — RSC da rota` / `Grid de vídeos com scroll infinito` / `VideoCard com avatar do canal` — verbs: Exibir a grade de vídeos públicos mais recentes da plataforma | endpoint: `GET /videos?category=` (RSC via `publicRead`, 1ª página — §API Contracts → backend tier) | reuse: new / `components/videos/infinite-video-grid.tsx (new)` / `components/videos/video-card.tsx`
- `Barra de chips de categoria` — verbs: Listar as categorias disponíveis como filtros da home; Filtrar a grade da home por categoria | endpoint: `GET /categories` (RSC — §API Contracts → backend tier); o filtro é navegação para `/?category=<slug>`, que refaz o RSC | reuse: `components/home/category-chips.tsx (new)`
- `Spinner / sentinela de scroll infinito` — verbs: Carregar mais vídeos da home ao chegar ao fim da grade | endpoint: `GET /api/videos` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection) | reuse: `components/videos/infinite-scroll-sentinel.tsx (new)`
- `Account User Menu — painel da conta` — verbs: Encerrar a sessão pelo menu da conta | endpoint: `POST /api/auth/logout` (§API Contracts → BFF tier) | reuse: `components/layout/account-menu.tsx (new)`
- `SideNav subscriptions list` — verbs: (Fase 06, sem mudança) | endpoint: `GET /me/subscriptions?limit=7` (RSC do layout) + `GET /api/me/subscriptions` (Fase 06) | reuse: `components/layout/side-nav-subscriptions.tsx`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton dos chips e do grid (padrão do feed); durante a próxima página, o spinner do frame abaixo do grid
- Empty: plataforma sem vídeos públicos → texto muted; categoria sem vídeos → texto muted + link "All" (para `/`)
- Success: chips ("All" + categorias, ativo destacado) + grid de cards (thumbnail, avatar do canal, título em 2 linhas, nome do canal, "N views • tempo") + sentinela/spinner enquanto houver `next_cursor`
- Error: falha do upstream na primeira página → `error.tsx` da rota com "Try again"; falha numa página seguinte → mensagem inline + "Load more" para tentar de novo, sem perder os cards já exibidos

*Interactions:*
- Chip click → navegação para `/?category=<slug>` ("All" → `/`); o grid recomeça na primeira página (per `TD-01`, `TD-04`)
- Sentinela visível (ou "Load more" clicado) → próxima página por `GET /api/videos?category=&cursor=`, anexada ao grid
- Voltar da watch page → restaura itens, cursor e rolagem guardados em `sessionStorage` para a URL (per `TD-04`, Revisions 2026-10-20); sem dado salvo, recomeça na primeira página
- "≡" click → `lg+`: alterna menu expandido/mini (grava o cookie); abaixo de `lg`: abre o drawer; navegar fecha o drawer
- Busca do header enviada (Enter ou botão) → `/results?q=<termo>`; campo vazio/só espaços não envia; termo cortado em 100 caracteres (per `TD-02`, Revisions 2026-10-20)
- Avatar click → abre o menu da conta; "Sign Out" → `POST /api/auth/logout` e `router.refresh()`; "Edit Channel" → `/studio/channel`; nome/@nickname → `/channel/{nickname}`
- Card click → `/watch/{publicId}`; avatar/nome do canal → `/channel/{nickname}`

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `CATEGORY_NOT_FOUND` | O RSC cai para a lista sem filtro, com o chip "All" ativo e um aviso discreto ("Category not found") — sem `notFound()` nem redirect (per `TD-01`, Revisions 2026-10-20) |
| `VALIDATION_ERROR` | `cursor` adulterado numa página seguinte → recarrega a primeira página |
| 429 | Página seguinte bloqueada pelo throttler → mensagem inline + "Load more" para tentar de novo |
| 5xx | Primeira página → `error.tsx` ("Try again"); página seguinte → mensagem inline + "Load more" |

**Client-side validation mirror:** _(campo de busca do header — §API Contracts → Validation Rules de `GET /videos`)_

- `q`: `trim`; vazio ou só espaços → não envia; máximo 100 caracteres (o campo corta); o mínimo de 2 é checado em `/results` (ver tela de Resultados)

**Accessibility notes:**
- "≡" com `aria-label` e `aria-expanded`; drawer e menu da conta como `Dialog` (foco preso, `Esc` fecha, foco volta ao gatilho)
- Campo de busca com `role="search"` e rótulo acessível
- O sentinela não pode ser o único caminho: o botão "Load more" continua alcançável por teclado
- Chips com `aria-current` no ativo; thumbnails com `alt` vazio quando o título é o texto do link

#### Screen: Resultados da busca

**Route:** `/results` (`/results?q=<termo>` — per `home-search-production/TD-02`)
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=143-948 (node `0RBoWy5FbrK8SHEz1eK6gb:143:948`) — referência visual: `docs/inventories/assets/phase-07/Home (Catalog Show).png`; a página de resultados não tem frame próprio (grid da Home sem os chips, por decisão do usuário)
**Purpose:** "Barra de busca (pesquisa por título e canal)"

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `GET /videos` público; header e menu lateral como na Home)_

**Rendering strategy:** Server Component (RSC) valida `q` e lê a primeira página de `GET /videos?q=` via `publicRead`; as seguintes chegam pelo mesmo `InfiniteVideoGrid` via `GET /api/videos?q=`; a lista recomeça quando `q` muda _(source: `home-search-production/TD-04`; leitura RSC per `video-channel-management/TD-12`)_

**Reused DS components:**
- `new` — Results page — RSC da rota — `app/(app)/(shell)/results/page.tsx`. Lê `q` dos `searchParams` e a primeira página de `GET /videos?q=` (`home-search-production/TD-02`); acesso anônimo
- `components/layout/app-header.tsx` — TopNav / header (componente 152:1827) — see screen: Página inicial (Home / Catalog Show); o campo de busca vem preenchido com o `q` atual
- `components/layout/global-search.tsx (new)` — Busca global — campo + botão — see screen: Página inicial (Home / Catalog Show)
- `components/layout/side-nav.tsx` — Body / app shell e SideNav — see screen: Página inicial (Home / Catalog Show); nenhum item ativo nesta rota
- `new` — Título "Results for “{q}”" — Não existe no frame; orienta a página (`<h1>`)
- `components/videos/infinite-video-grid.tsx (new)` — Grid de resultados com scroll infinito — see screen: Página inicial (Home / Catalog Show); sem os chips de categoria; reiniciado quando o `q` muda
- `components/videos/video-card.tsx` — VideoCard com avatar do canal — see screen: Página inicial (Home / Catalog Show)
- `components/videos/infinite-scroll-sentinel.tsx (new)` — Spinner / sentinela de scroll infinito — see screen: Página inicial (Home / Catalog Show)
- `new` — Estado vazio da busca — Não desenhado: nenhum vídeo para o termo (sugere outro termo e link para a home)

**Server-connected components:**
- `Results page — RSC da rota` / `Grid de resultados com scroll infinito` / `VideoCard com avatar do canal` — verbs: Pesquisar vídeos públicos pelo título ou pelo nome do canal | endpoint: `GET /videos?q=` (RSC via `publicRead`, 1ª página — §API Contracts → backend tier) | reuse: new / `components/videos/infinite-video-grid.tsx (new)` / `components/videos/video-card.tsx`
- `Spinner / sentinela de scroll infinito` — verbs: Carregar mais resultados ao chegar ao fim da grade | endpoint: `GET /api/videos` (§API Contracts → BFF tier) | reuse: `components/videos/infinite-scroll-sentinel.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: `loading.tsx` com skeleton do título e do grid
- Empty: nenhum resultado → texto muted ("No results for “{q}”") + sugestão de outro termo e link para a home; `q` com 1 caractere → estado vazio com a regra ("Enter at least 2 characters"), sem chamar a API (per `TD-02`, Revisions 2026-10-20)
- Success: título "Results for “{q}”" + grid de cards + sentinela/spinner enquanto houver `next_cursor`
- Error: falha do upstream na primeira página → `error.tsx` ("Try again"); página seguinte → mensagem inline + "Load more"

*Interactions:*
- `/results` sem `q` ou com `q` vazio/só espaços → redirect para `/` (per `TD-02`, Revisions 2026-10-20)
- Novo termo enviado pelo header → navegação para `/results?q=` com o grid recomeçado
- Sentinela visível (ou "Load more") → próxima página por `GET /api/videos?q=&cursor=`
- Voltar da watch page → restaura itens, cursor e rolagem do `sessionStorage` (per `TD-04`, Revisions 2026-10-20)
- Card click → `/watch/{publicId}`; canal → `/channel/{nickname}`

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VALIDATION_ERROR` | `q` acima de 100 caracteres na URL → o RSC corta em 100 antes de chamar; `cursor` adulterado → recarrega a primeira página |
| 429 | Página seguinte bloqueada → mensagem inline + "Load more" |
| 5xx | Primeira página → `error.tsx` ("Try again"); página seguinte → mensagem inline + "Load more" |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules de `GET /videos`)_

- `q`: required nesta rota, `trim`, min 2, max 100 caracteres

**Accessibility notes:**
- O título com o termo é o primeiro cabeçalho da página (`<h1>`)
- O estado vazio precisa de texto, não só ilustração

### Frontend Runtime

#### home-search-production/TD-04 — Paginação vs. scroll infinito no frontend e camada de dados das listas

**Pattern:** entrega o scroll infinito com o padrão já usado nos comentários, sem refazer o RSC por página e sem um segundo modelo de dados na app; a perda das páginas extras ao voltar é contornável guardando cursor e itens em `sessionStorage`. Decisão: scroll infinito com `IntersectionObserver` + hook próprio via BFF, botão "Load more" como fallback; home, resultados, página do canal e feed; estúdio mantém o botão; sem TanStack Query. Revisions 2026-10-20: o hook guarda itens, `next_cursor` e a posição de rolagem por URL em `sessionStorage` (com limite de itens guardados) e restaura ao remontar a lista; sem dado salvo, recomeça na primeira página.

**Setup:**

```tsx
// next-frontend/hooks/use-cursor-list.ts — 1ª página do RSC, seguintes pelo BFF (sem router.refresh)
const storageKey = `cursor-list:${pathname}?${searchParams}` // uma entrada por URL
const MAX_STORED_ITEMS = 200
const { items, nextCursor, loadMore, status } = useCursorList({ initial, endpoint, query })
new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore()) // sentinela abaixo do grid
sessionStorage.setItem(storageKey, JSON.stringify({ items, nextCursor, scrollY }))

// next-frontend/components/videos/infinite-video-grid.tsx — reinicia quando o filtro/termo muda
<InfiniteVideoGrid key={searchParams.toString()} initial={firstPage} endpoint="/api/videos" query={{ category, q }} />
```

**Aplicação:**

- **Adopts the pattern:** os componentes de listagem de `## UI Inventory → ### Server-connected Components` desta fase — `Grid de vídeos com scroll infinito` + `Spinner / sentinela de scroll infinito` (home) e `Grid de resultados com scroll infinito` + `Spinner / sentinela de scroll infinito` (resultados) — e, por migração, a página do canal e o feed das inscrições.
  - **Excludes / boundaries:**
    - `Home page — RSC da rota`, `Results page — RSC da rota` — leem só a primeira página no RSC (per `video-channel-management/TD-12`); o hook não refaz a primeira página.
    - Telas do estúdio (`/studio/videos`) — mantêm o `LoadMore` com `router.replace(?cursor=)` (per TD-04).
    - Comentários e respostas da watch page e "Show more" do menu lateral — já paginam no cliente pelo padrão da Fase 06 (`social-interactions/TD-09`); não migram.

**Migração:**

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/app/(app)/(shell)/page.tsx` | Placeholder ("O feed de vídeos chega na Fase 07") | Home real: RSC com chips + primeira página de `GET /videos` + `InfiniteVideoGrid` | SI-07.14b |
| `next-frontend/app/(app)/(shell)/channel/[nickname]/page.tsx`, `components/channel/channel-video-list.tsx`, `components/channel/channel-load-more.tsx` | "Load more" troca a URL (`?cursor=`) e o RSC entrega a página seguinte | Primeira página no RSC + `InfiniteVideoGrid` via `GET /api/channels/{nickname}/videos` (mantendo `?sort=`); `ChannelLoadMore` sai | SI-07.6 |
| `next-frontend/app/(app)/(shell)/feed/subscriptions/page.tsx`, `components/feed/subscription-feed-list.tsx` | "Load more" troca a URL e a lista acumula os cards em estado | Primeira página no RSC + `InfiniteVideoGrid` via `GET /api/me/subscriptions/videos` | SI-07.7 |

**Verificação:**

- **Unit:** o hook anexa a página seguinte, para quando `next_cursor` é `null`, não dispara duas cargas concorrentes, mostra erro inline e permite tentar de novo; restaura itens/cursor/rolagem do `sessionStorage` e respeita o limite de itens guardados (Vitest + RTL, `IntersectionObserver` simulado, `fetch` via MSW).
- **Integration:** os Route Handlers `GET /api/videos`, `/api/channels/{nickname}/videos` e `/api/me/subscriptions/videos` repassam a query e a resposta sem reshape; o feed responde 401 sem sessão sem tocar o upstream (Vitest + MSW, `onUnhandledRequest: "error"`).
- **E2E:** rolar a home carrega a página seguinte sem nova requisição de RSC; trocar de chip recomeça a lista; abrir um vídeo e voltar restaura os cards e a rolagem; o "Load more" funciona por teclado.
- **Regression guards:** os E2E da Fase 04 (página do canal, ordenações) e da Fase 06 (feed das inscrições) continuam passando com o scroll infinito no lugar do "Load more".

#### home-search-production/TD-05 — Shell de navegação responsivo — header, menu lateral e mobile

**Pattern:** é a leitura direta do Figma, mantém a área de canais seguidos acessível em qualquer largura e usa só primitivos já instalados; o cookie evita o salto de layout que um estado em `localStorage` causaria no SSR. Decisão: shell único do Figma — header com "≡", busca e login/avatar com menu; menu lateral expandido/mini em `lg+` com estado em cookie lido no RSC; drawer abaixo de `lg` e na watch page; menu visível também para o anônimo com "Home" e convite para entrar. Revisions 2026-10-20: "Subscriptions", "Your videos" e a lista de canais seguidos só com sessão; o menu da conta usa `channelSlug` (nickname) e `channelName` da sessão, sem campo novo; responsivo em todas as telas (públicas, auth e estúdio — abaixo de `md`, tabelas do estúdio viram lista empilhada e formulários ficam em coluna única); textos sem frame em inglês.

**Setup:**

```tsx
// next-frontend/app/(app)/layout.tsx — header global em todas as rotas de app; estado do menu lido no servidor (sem flash)
const navMode = (await cookies()).get("side_nav")?.value === "mini" ? "mini" : "expanded"
<NavStateProvider initialMode={navMode}>
  <AppHeader /> {/* ≡ · logo · GlobalSearch · ("+" + avatar → AccountMenu) | "Sign in" */}
  <NavDrawer>{sideNav}</NavDrawer> {/* Dialog do radix-ui, lado esquerdo: < lg e na watch page */}
  {children}
</NavStateProvider>
// toggle em lg+: document.cookie = "side_nav=mini; path=/; max-age=31536000; samesite=lax"
```

**Aplicação:**

- **Adopts the pattern:** o header, o menu lateral e o drawer de `## UI Inventory → ### Server-connected Components` (`Account User Menu — painel da conta`, `SideNav subscriptions list`) e os componentes de layout da tela `/` (TopNav, Menu trigger "≡", Busca global, SideNav, Drawer de navegação), aplicados a todas as rotas sob `app/(app)/`; o ajuste responsivo de conteúdo alcança todas as telas (per Revisions 2026-10-20).
  - **Excludes / boundaries:**
    - Telas de `app/(auth)/` — não têm header nem menu lateral (layout próprio de card); recebem só o ajuste responsivo de conteúdo.
    - A watch page — fica fora do grupo `(shell)` (sem coluna de menu em nenhuma largura); o "≡" abre sempre o drawer.

**Migração:**

| File | Current behavior | Required change | Owning SI |
|------|-----------------|-----------------|-----------|
| `next-frontend/app/(app)/layout.tsx` | Só `<AppHeader />` | Lê o cookie `side_nav`, monta `NavStateProvider`, o header novo e o `NavDrawer`; a primeira página de canais seguidos (`GET /me/subscriptions?limit=7`) e o `SubscriptionsProvider` sobem do layout `(shell)` para cá, para o drawer da watch page ter o mesmo menu | SI-07.8 |
| `next-frontend/components/layout/app-header.tsx` | Header mínimo em português (e-mail, "Meus vídeos", "Meu canal", "Sair" / "Entrar", "Criar conta") | Header do Figma: "≡", logo, `GlobalSearch`, "+" e avatar (`AccountMenu`) com sessão, "Sign in" sem sessão | SI-07.9 |
| `next-frontend/app/(app)/(shell)/layout.tsx` | Menu só com sessão; carrega a primeira página de canais seguidos | Menu sempre presente (anônimo: "Home" + convite para entrar); modo expandido/mini do contexto; a carga dos canais seguidos sai daqui (vai para o layout `(app)`) | SI-07.10 |
| `next-frontend/components/layout/app-shell.tsx` | Coluna fixa `w-64`, sem breakpoints | `lg+`: coluna expandida ou mini; abaixo de `lg`: sem coluna (o drawer assume) | SI-07.11 |
| `next-frontend/components/layout/side-nav.tsx`, `side-nav-item.tsx`, `side-nav-active.tsx` | Um único modo (expandido), só com sessão | Modos `expanded` / `mini` / dentro do drawer; variante do anônimo | SI-07.12 |
| `next-frontend/app/(app)/watch/[publicId]/page.tsx`, `app/(app)/(shell)/channel/[nickname]/page.tsx`, `app/(app)/(shell)/feed/subscriptions/page.tsx`, telas de `app/(auth)/` e de `app/(app)/(shell)/studio/` | Layouts pensados para desktop (poucos breakpoints; tabela do estúdio de largura fixa) | Ajuste responsivo de conteúdo: grids por breakpoint, watch page empilhada abaixo de `lg`, estúdio com lista empilhada e formulários em coluna única abaixo de `md` | SI-07.13 |

**Verificação:**

- **Unit:** o toggle grava o cookie `side_nav` e alterna `expanded`/`mini`; o drawer abre/fecha por "≡", `Esc` e navegação, devolvendo o foco ao gatilho; o header mostra "Sign in" sem sessão e avatar + "+" com sessão; o menu do anônimo mostra só "Home" + convite (Vitest + RTL, `next/navigation` simulado).
- **Integration:** `Sign Out` chama `POST /api/auth/logout` e o header volta ao estado anônimo após `router.refresh()` (Vitest + MSW).
- **E2E:** projeto mobile do Playwright (`devices['Pixel 7']`): sem coluna de menu, "≡" abre o drawer, busca em modo ícone; desktop: colapso para mini persiste após recarregar sem salto de layout; watch page abre o menu pelo drawer.
- **Regression guards:** os E2E de logout (Fase 02), estúdio (Fase 04), watch page (Fase 05) e canal/feed (Fase 06) continuam passando com o header e o menu novos — os seletores que dependiam dos textos em português ("Sair", "Entrar", "Meus vídeos") são atualizados junto.

### UI ↔ API Traceability Matrix

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Exibir a grade de vídeos públicos mais recentes da plataforma | Home page — RSC da rota; Grid de vídeos com scroll infinito; VideoCard com avatar do canal | / | GET /videos (RSC via `publicRead`, 1ª página) | home-search-production/TD-01, TD-04 |
| Listar as categorias disponíveis como filtros da home | Barra de chips de categoria | / | GET /categories (RSC) | home-search-production/TD-01 |
| Filtrar a grade da home por categoria | Barra de chips de categoria; Home page — RSC da rota | / | GET /videos?category= (RSC, após navegação para `/?category=<slug>`) | home-search-production/TD-01 |
| Carregar mais vídeos da home ao chegar ao fim da grade | Spinner / sentinela de scroll infinito; Grid de vídeos com scroll infinito | / | GET /api/videos → forwards-to GET /videos | home-search-production/TD-01, TD-04 |
| Encerrar a sessão pelo menu da conta | Account User Menu — painel da conta | / | POST /api/auth/logout → forwards-to POST /auth/logout | home-search-production/TD-05 |
| Pesquisar vídeos públicos pelo título ou pelo nome do canal | Results page — RSC da rota; Grid de resultados com scroll infinito; VideoCard com avatar do canal | /results | GET /videos?q= (RSC via `publicRead`, 1ª página) | home-search-production/TD-02, TD-03, TD-04 |
| Carregar mais resultados ao chegar ao fim da grade | Spinner / sentinela de scroll infinito; Grid de resultados com scroll infinito | /results | GET /api/videos → forwards-to GET /videos | home-search-production/TD-02, TD-04 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix._

---

## Dependency Map

```
Backend + contrato + BFF
SI-07.1 (root) — migration AddVideoSearch
└── SI-07.2 — depends on SI-07.1 (GET /videos + LISTING_THROTTLE)
    └── SI-07.3 — depends on SI-07.2 (OpenAPI + aliases + MSW)
        └── SI-07.4 — depends on SI-07.3 (BFF das listagens)

Bootstrap
SI-07.0.1 (root) — category-chips, global-search, nav-drawer

Scroll infinito (home-search-production/TD-04)
SI-07.5 (root) — Setup: use-cursor-list, InfiniteVideoGrid, InfiniteScrollSentinel
├── SI-07.6 — depends on SI-07.5 + SI-07.4 (página do canal)
└── SI-07.7 — depends on SI-07.5 + SI-07.4 (feed das inscrições)

Shell responsivo (home-search-production/TD-05)
SI-07.8 — depends on SI-07.0.1 (Setup: NavStateProvider, cookie side_nav, layout (app), NavDrawer)
├── SI-07.9 — também depends on SI-07.0.1 (header do Figma + AccountMenu)
├── SI-07.10 — layout (shell) com menu para o anônimo
├── SI-07.11 — AppShell com breakpoints
├── SI-07.12 — SideNav expandido / mini / drawer
└── SI-07.13 — telas existentes responsivas

Telas
SI-07.14.0 — depends on SI-07.0.1, SI-07.5, SI-07.9, SI-07.12 (drift audit da home)
└── SI-07.14a — depends on SI-07.14.0 + SI-07.0.1
    └── SI-07.14b — também depends on SI-07.2, SI-07.3, SI-07.4, SI-07.5 (home: RSC + grid)
SI-07.15.0 — depends on SI-07.0.1, SI-07.5, SI-07.9, SI-07.12 (drift audit dos resultados)
└── SI-07.15a — depends on SI-07.15.0 + SI-07.0.1
    └── SI-07.15b — também depends on SI-07.2, SI-07.3, SI-07.4, SI-07.5 (resultados: q + grid)

Verificações dos TDs de runtime
SI-07.16 — depends on SI-07.5, SI-07.6, SI-07.7, SI-07.14b (TD-04)
SI-07.17 — depends on SI-07.8, SI-07.9, SI-07.10, SI-07.11, SI-07.12, SI-07.13 (TD-05 + projeto mobile)

Testes dos fluxos principais + produção (Repo-wide)
SI-07.18 — depends on SI-07.14b, SI-07.15b, SI-07.9, SI-07.2 (E2E full-stack + smoke)
SI-07.19 (root) — SMTP autenticado + migrations compiladas
└── SI-07.20 — depends on SI-07.19 (imagens de produção)
    └── SI-07.21 — depends on SI-07.20 (compose de produção + Caddy + backup)
SI-07.22 — depends on SI-07.17, SI-07.18 (CI de qualidade)
SI-07.23 — depends on SI-07.21, SI-07.22, SI-07.18 (deploy GHCR + SSH + runbook)
```

---

## Deliverables

- [ ] SI-07.0.1 — Custom-business simple group: category-chips + global-search + nav-drawer
- [ ] SI-07.1 — Infra: migration `AddVideoSearch` (pg_trgm + unaccent + índices de trigramas)
- [ ] SI-07.2 — Endpoint GET /videos (home e busca) + throttle das listagens públicas
- [ ] SI-07.3 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- [ ] SI-07.4 — Route Handlers BFF das listagens paginadas no cliente
- [ ] SI-07.5 — Scroll infinito com hook próprio (Setup)
- [ ] SI-07.6 — Página pública do canal → scroll infinito
- [ ] SI-07.7 — Feed das inscrições → scroll infinito
- [ ] SI-07.8 — Shell de navegação responsivo (Setup)
- [ ] SI-07.9 — Header do Figma com menu da conta → shell responsivo
- [ ] SI-07.10 — Layout `(shell)` com menu para o anônimo → shell responsivo
- [ ] SI-07.11 — AppShell com breakpoints → shell responsivo
- [ ] SI-07.12 — SideNav nos modos expandido, mini e drawer → shell responsivo
- [ ] SI-07.13 — Telas existentes → layout responsivo (watch, canal, feed, auth, estúdio)
- [ ] SI-07.14.0 — Drift audit: Página inicial (Home / Catalog Show)
- [ ] SI-07.14a — Tela de Página inicial (Home / Catalog Show) (visual shell)
- [ ] SI-07.14b — Tela de Página inicial (Home / Catalog Show) (lógica & wiring)
- [ ] SI-07.15.0 — Drift audit: Resultados da busca
- [ ] SI-07.15a — Tela de Resultados da busca (visual shell)
- [ ] SI-07.15b — Tela de Resultados da busca (lógica & wiring)
- [ ] SI-07.16 — Scroll infinito com hook próprio (Verification)
- [ ] SI-07.17 — Shell de navegação responsivo (Verification)
- [ ] SI-07.18 — Suíte E2E full-stack dos fluxos principais
- [ ] SI-07.19 — Backend pronto para produção: SMTP autenticado e migrations compiladas
- [ ] SI-07.20 — Infra: imagens de produção multi-stage (API/worker/migrate e Next standalone)
- [ ] SI-07.21 — Infra: compose de produção com Caddy, env e backup (validado localmente)
- [ ] SI-07.22 — Infra: pipeline de CI de qualidade via Docker Compose
- [ ] SI-07.23 — Infra: workflow de deploy (GHCR + SSH) e runbook de produção

**Per-screen deliverables:**

- [ ] Screen Página inicial (Home / Catalog Show) (`/`) is routable
- [ ] Screen Página inicial (Home / Catalog Show) (`/`) renders loading, success, empty, and error states
- [ ] Screen Página inicial (Home / Catalog Show) (`/`) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Resultados da busca (`/results`) is routable
- [ ] Screen Resultados da busca (`/results`) renders loading, success, empty, and error states
- [ ] Screen Resultados da busca (`/results`) passes component tests (per testing-guide-next-frontend layers)

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type/compilation checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type/compilation checks pass (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass on the production build with MSW, projects `chromium` and `mobile` (`cd next-frontend && npx playwright test`)
- [ ] Full-stack E2E passes against both real stacks without MSW (`cd next-frontend && npx playwright test -c playwright.full-stack.config.ts`)
- [ ] OpenAPI chain in sync (`git diff --exit-code -- next-frontend/openapi.json next-frontend/lib/api/types.gen.ts` after `openapi:export` → `scripts/sync-openapi.sh` → `openapi:types`)
- [ ] Production environment validates locally (`docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --profile local-validation up -d`, then the read-only smoke `npx playwright test -c next-frontend/playwright.full-stack.config.ts --grep @smoke` against `https://localhost`)
