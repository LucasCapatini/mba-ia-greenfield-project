---
kind: phase
name: phase-05-watch-page
test_specs_aware: true
sources_mtime:
  docs/phases/phase-05-watch-page/context.md: "2026-10-19T19:52:47-04:00"
  docs/decisions/technical-decisions-watch-page.md: "2026-10-19T19:51:33-04:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-10-17T09:27:46-04:00"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T17:30:21-04:00"
---

# Phase 05 — Página de Visualização do Vídeo

## Objective

Entregar a página de visualização com player funcional (controles de play/pause, volume e barra de progresso), o layout de vídeo principal + informações + sidebar com sugestões de vídeos da mesma categoria, a descrição com expansão/recolhimento, a contagem de visualizações, o botão de download do vídeo e o acesso anônimo à visualização — com vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens) — backend NestJS + frontend Next.js (BFF).

---

## Step Implementations

_Bootstrap (`SI-05.0.k`, sintetizadas dos marcadores `(new)` dos UI Contracts) → backend (`SI-05.1`–`SI-05.6`) → contrato OpenAPI + MSW (`SI-05.7`) → BFF (`SI-05.8`–`SI-05.9`) → player (`SI-05.10`) → tela (`SI-05.11.0`, `SI-05.11a`, `SI-05.11b`) → reuso do player no estúdio (`SI-05.12`). Fora do bootstrap por decisão de escopo: `components/watch/video-player.tsx` — componente com lógica de mídia, renovação de URL e registro de visualização, autorado em SI própria (`SI-05.10`) em vez de um grupo de bootstrap; os demais `(new)` da tela entram no bootstrap._

### SI-05.0.1 — Infra: install batch shadcn primitives

**Description:** Instalar o primitivo `slider` do shadcn (wrapper do `Slider` do `radix-ui`, já instalado) usado pela barra de progresso e pelo volume do player.

**Technical actions:**

1. Rodar `docker compose exec next-frontend npx shadcn@latest add slider` — gera `components/ui/slider.tsx` respeitando `components.json` (style `radix-nova`, `cssVariables: true`).
2. Commitar `components/ui/slider.tsx`.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/slider.tsx` existe e importa o `Slider` de `radix-ui`.
- O arquivo gerado compila per `docker compose exec next-frontend npx tsc --noEmit`.

---

### SI-05.0.2 — Tests shadcn batch (≤5 files)

**Description:** Unit test para o primitivo instalado em SI-05.0.1 — a11y, data-slot e eventos de valor.

**Technical actions:**

1. Author `components/ui/__tests__/slider.test.tsx` (`// @vitest-environment jsdom`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `slider.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" — `role="slider"`, `aria-valuenow/min/max`, `data-slot`, setas/Home/End alteram o valor e chamam `onValueChange` | `components/ui/__tests__/slider.test.tsx` |

**Dependencies:** SI-05.0.1

**Acceptance criteria:**

- O primitivo tem um teste unitário cobrindo atributos ARIA, âncora `data-slot` e a mudança de valor por teclado.
- Tests pass per `docker compose exec next-frontend npm test`.

---

### SI-05.0.3 — Custom-business simple group: download-icon + fullscreen-icon + pause-icon + share-icon + volume-icon

**Description:** Author os ícones SVG custom do player e das ações da watch page (sem biblioteca de ícones, per `next-frontend/CLAUDE.md`).

**Technical actions:**

1. Author `components/icons/download-icon.tsx` per UI Contract (item "Download" do menu "⋮").
2. Author `components/icons/fullscreen-icon.tsx` per UI Contract (par entrar/sair no mesmo arquivo — dois componentes exportados).
3. Author `components/icons/pause-icon.tsx` per UI Contract (par do `play-icon.tsx` existente).
4. Author `components/icons/share-icon.tsx` per UI Contract (botão Share).
5. Author `components/icons/volume-icon.tsx` per UI Contract (botão de volume).

**Tests:** _(empty — icons are static SVG; per testing-guide-next-frontend § "Icons" no unit test)_

**Dependencies:** none

**Acceptance criteria:**

- Cada ícone existe no caminho declarado, aceita `className`/`aria-hidden` como `components/icons/check-icon.tsx` e compila.
- O desenho segue a referência `docs/inventories/assets/phase-05/Video show.png` (Figma MCP indisponível — resolução OQ-6).

---

### SI-05.0.4 — Custom-business simple group: volume-off-icon + download-menu-item + related-videos + video-channel-link

**Description:** Author o ícone restante e os componentes de apresentação da watch page que recebem dados prontos do RSC (sem estado nem I/O próprio).

**Technical actions:**

1. Author `components/icons/volume-off-icon.tsx` per UI Contract (estado mudo do botão de volume).
2. Author `components/watch/download-menu-item.tsx` per UI Contract — item de `DropdownMenu` com `download-icon` e rótulo "Download" que navega para a `downloadUrl` recebida por prop (per `watch-page/TD-08`).
3. Author `components/watch/related-videos.tsx` per UI Contract — lista vertical de `VideoCard` a partir de `items: VideoCardItem[]` por prop; lista vazia → não renderiza nada (per `watch-page/TD-04`). A variante horizontal do card é aplicada na tela pelas decisões do drift audit (SI-05.11.0 / SI-05.11a).
4. Author `components/watch/video-channel-link.tsx` per UI Contract — `ChannelAvatar` (iniciais, `components/channel/channel-avatar.tsx`) + nome do canal com `<Link href="/channel/{nickname}">`, a partir de `channel: { nickname, name }` por prop.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `download-menu-item.tsx` | Unit per testing-guide-next-frontend § "Client Components" — rótulo "Download", destino = `downloadUrl` da prop | `components/watch/__tests__/download-menu-item.test.tsx` |
| `related-videos.tsx` | Unit — um card por item, link `/watch/{public_id}` por card; lista vazia não renderiza a seção | `components/watch/__tests__/related-videos.test.tsx` |
| `video-channel-link.tsx` | Unit — link para `/channel/{nickname}` com o nome do canal e o avatar de iniciais | `components/watch/__tests__/video-channel-link.test.tsx` |

**Dependencies:** SI-05.0.3 (download-icon)

**Acceptance criteria:**

- Cada componente existe no caminho declarado e corresponde ao seu UI Contract.
- Os testes unitários cobrem a renderização a partir das props e os destinos dos links.

---

### SI-05.0.5 — Custom-business complex: player-controls

**Description:** Author `components/watch/player-controls.tsx` — business component com state per Notes "agrupa play/pause, volume, tempo e tela cheia sobre gradiente escuro na base do vídeo; nenhum I/O; estado local (toggle) de play/mudo/tela cheia".

**Technical actions:**

1. Author `components/watch/player-controls.tsx` per UI Contract (`"use client"`; componente controlado: recebe `paused`, `muted`, `volume`, `currentTime`, `duration`, `buffered`, `fullscreen` e callbacks `onTogglePlay`, `onToggleMute`, `onVolumeChange`, `onSeek`, `onToggleFullscreen`; usa `IconButton`, `Slider` (progresso + volume), `play-icon`/`pause-icon`, `volume-icon`/`volume-off-icon`, `fullscreen-icon` e `formatDuration` para "0:20 / 4:56"; rótulos acessíveis conforme o estado — per `watch-page/TD-05`, Revisions 2026-10-19: só play/pause, volume, progresso, tempo e tela cheia).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `player-controls.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline — renderiza os 4 controles e o tempo formatado | `components/watch/__tests__/player-controls.test.tsx` |
| `player-controls.tsx` | Unit: toggle assertions — rótulo "Play"↔"Pause", "Mute"↔"Unmute", "Enter full screen"↔"Exit full screen" seguem as props; cliques e teclado no slider chamam os callbacks com o valor esperado | (same file) |

**Dependencies:** SI-05.0.1 (slider), SI-05.0.3 (ícones), SI-05.0.4 (volume-off-icon)

**Acceptance criteria:**

- `components/watch/player-controls.tsx` existe e corresponde ao UI Contract (nenhum controle além dos da capability + tela cheia).
- Os testes cobrem a renderização base e as transições de rótulo/estado e callbacks.

---

### SI-05.0.6 — Custom-business complex: video-description

**Description:** Author `components/watch/video-description.tsx` — business component com state per Notes "linha 'N views • tempo' (`formatCompactNumber` + `formatRelativeTime` de `lib/format.ts`) + descrição em texto puro com quebras preservadas; estado local (toggle) de expansão/recolhimento via `line-clamp` (per `watch-page/TD-09`)".

**Technical actions:**

1. Author `components/watch/video-description.tsx` per UI Contract (`"use client"`; props `viewCount`, `publishedAt`, `description: string | null`; texto puro com `whitespace-pre-line`, sem transformar timestamps/URLs em links (resolução OQ-4); recolhido com `line-clamp-3`; mede o overflow com `ref` para só mostrar o `<button aria-expanded>` "…more"/"Show less" quando o texto excede 3 linhas (resolução OQ-3); descrição nula → só a linha de métricas).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-description.tsx` | Unit per testing-guide-next-frontend § "Client Components" baseline — "N views • tempo" formatado, texto com quebras preservadas, descrição nula sem controle | `components/watch/__tests__/video-description.test.tsx` |
| `video-description.tsx` | Unit: toggle assertions — com overflow simulado, "…more" expande (`aria-expanded="true"`, rótulo "Show less") e volta a recolher; sem overflow, o controle não aparece | (same file) |

**Dependencies:** none

**Acceptance criteria:**

- `components/watch/video-description.tsx` existe e corresponde ao UI Contract.
- Os testes cobrem a renderização base e a alternância expandir/recolher.

---

### SI-05.1 — Infra: IP real do visitante atrás do BFF (TRUST_PROXY + throttler)

**Description:** Fazer o throttler global (e, adiante, a deduplicação de visualizações) enxergar o IP do visitante em vez do IP do container `next-frontend`, confiando em `X-Forwarded-For` somente quando a conexão vem do BFF.

**Technical actions:**

1. Fixar a sub-rede da rede `streamtube` em `nestjs-project/compose.yaml` (`ipam.config.subnet`, ex.: `172.30.0.0/24`) e dar ao serviço `next-frontend` um `ipv4_address` nela em `next-frontend/compose.yaml` (ex.: `172.30.0.10`); documentar no `nestjs-project/CLAUDE.md` e no `next-frontend/CLAUDE.md` que a rede existente precisa ser recriada (`docker compose down` nos dois stacks, backend `up` primeiro) (per `watch-page/TD-03`, Revisions 2026-10-19).
2. Adicionar `TRUST_PROXY` (opcional; IP ou lista separada por vírgula) ao schema Joi em `src/config/env.validation.ts`, ao namespace `app` (`src/config/app.config.ts`) e ao `.env.example` com o IP fixo do `next-frontend` (per `phase-01-configuracao-base/TD-02`, `TD-03`).
3. Em `src/main.ts`, criar a aplicação como `NestExpressApplication` e chamar `app.set('trust proxy', TRUST_PROXY)` só quando a variável estiver definida — ausente → `trust proxy` desligado e o tracker é o IP do socket (per `watch-page/TD-03`).
4. Criar `src/auth/guards/throttler-behind-proxy.guard.ts` (`extends ThrottlerGuard`, `getTracker` → `req.ips[0] ?? req.ip`, padrão da documentação do `@nestjs/throttler` 6) e trocar o `APP_GUARD` do `ThrottlerGuard` por ele em `AuthModule` (per `watch-page/TD-03`; `phase-02-auth/TD-08`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `ThrottlerBehindProxyGuard.getTracker` | Unit: `ips` preenchido → primeiro IP; `ips` vazio → `req.ip` | `src/auth/guards/throttler-behind-proxy.guard.spec.ts` |
| `envValidationSchema` (`TRUST_PROXY`) | Unit: ausente é válido; IP e lista de IPs são aceitos | `src/config/env.validation.spec.ts` (estender) |
| Throttling por IP real | E2E (supertest, `trust proxy` = loopback no app de teste): dois `X-Forwarded-For` distintos ganham orçamentos independentes; sem `trust proxy`, o header é ignorado | `test/throttler-proxy.e2e-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- Com `TRUST_PROXY` apontando para o BFF, 10 requisições de `X-Forwarded-For: 203.0.113.1` a uma rota pública não fazem a 1ª requisição de `X-Forwarded-For: 203.0.113.2` receber `429`
- Com `TRUST_PROXY` ausente, `X-Forwarded-For` é ignorado e o limite é contado pelo IP do socket
- A API sobe com `TRUST_PROXY` ausente e recusa subir com um valor que não seja IP/lista de IPs
- Depois de recriar a rede, `docker compose exec next-frontend node -e "require('os').networkInterfaces()"` mostra o IP fixo configurado em `TRUST_PROXY`

---

### SI-05.2 — Endpoint GET /videos/{publicId} passa a devolver o canal

**Route:** GET /videos/{publicId}
**Test Specs:** see `nestjs-project/specs/videos-get.plan.md`
**Authorization:** Público com auth opcional — per `### Authorization Matrix` (dono vê qualquer `status`; demais só `published`; rascunho de terceiro → 404)

**Description:** Incluir os dados públicos do canal na resposta do vídeo para a watch page exibir avatar, nome e link do canal numa única leitura (resolução OQ-1).

**Technical actions:**

1. Adicionar `channel: VideoCardChannel` (`{ nickname, name }`, `@ApiProperty({ type: VideoCardChannel })`) a `VideoResponse` em `src/videos/dto/video-response.dto.ts`, reaproveitando o `VideoCardChannel` existente (per `### API Contracts → Shapes compartilhados`; `openapi-docs-nestjs/TD-01`).
2. Garantir que o vídeo lido por `VideosOwnership.loadReadable`/`loadOwned` traga a relação `channel` e que `VideosService.getVideo` (e os demais pontos que devolvem `VideoResponse` — `PATCH`, `publish`, `unpublish`, thumbnail) preencham `channel` (per `video-channel-management/TD-07`).
3. Atualizar os decorators Swagger de `GET /videos/:publicId` se necessário para refletir o shape novo (per `nestjs-controllers.md`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.getVideo` | Unit (repo mockado): `channel` mapeado de `video.channel` para `{ nickname, name }` | `src/videos/videos.service.spec.ts` (estender) |
| `VideosService.getVideo` | Integration (DB real): vídeo publicado lido por anônimo traz `channel.nickname` do canal dono | `src/videos/videos.service.integration-spec.ts` (estender) |

**Dependencies:** none

**Acceptance criteria:**

- `GET /videos/{publicId}` anônimo de um vídeo publicado retorna `200` com `channel: { nickname, name }` do canal dono
- `PATCH /videos/{publicId}` do dono retorna `200` com o mesmo objeto `channel`
- `GET /videos/{publicId}` anônimo de um rascunho retorna `404` com `error: "VIDEO_NOT_FOUND"` (regra de leitura inalterada)

---

### SI-05.3 — Criar o registro de deduplicação de visualizações (VideoView)

**Description:** Persistir a entidade `VideoView` que decide se uma visualização conta, com a unicidade por vídeo + espectador + dia UTC.

**Technical actions:**

1. Criar `src/videos/entities/video-view.entity.ts` com `id` (uuid PK), `video_id` (FK → `videos.id` `ON DELETE CASCADE`), `viewer_key` varchar(80), `window_start` date, `created_at` timestamp default now(); `@Unique` em `(video_id, viewer_key, window_start)` e `@Index` em `window_start` (per `### Data Model → VideoView`; `watch-page/TD-02`, Revisions 2026-10-19).
2. Gerar a migration em `src/database/migrations/` via `npm run migration:generate` e revisar o SQL (tabela, FK em cascata, unique e índice) (per `phase-01-configuracao-base` — `synchronize` desligado).
3. Registrar `VideoView` no `TypeOrmModule.forFeature` do `VideosModule` e no `WorkerModule` (o job de limpeza o usa) (per `phase-03-upload-processing/TD-05`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoView` | Integration: unique `(video_id, viewer_key, window_start)` rejeita a segunda linha; mesma chave em outro dia é aceita; apagar o vídeo apaga as views | `src/videos/entities/video-view.entity.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `npm run migration:run` cria `video_views` com a FK em cascata, o unique composto e o índice em `window_start`
- Inserir duas linhas com o mesmo `(video_id, viewer_key, window_start)` viola o unique; com `window_start` diferente, ambas persistem
- Apagar um vídeo remove todas as suas linhas de `video_views`

---

### SI-05.4 — Endpoint POST /videos/{publicId}/views

**Route:** POST /videos/{publicId}/views
**Test Specs:** see `nestjs-project/specs/videos-views.plan.md`
**Authorization:** Público com auth opcional — per `### Authorization Matrix` (anônimo e autenticado contam; dono → 204 sem contar; rascunho de terceiro → 404)

**Description:** Registrar a visualização disparada pelo player, deduplicada por espectador e dia UTC, incrementando `view_count` na mesma transação.

**Technical actions:**

1. Criar `src/videos/video-views.service.ts` com `record(video, viewer: { userId?: string; ip: string; userAgent: string })`: `viewer_key` = `user:{userId}` ou `anon:{sha256 hex}` de um salt diário (HMAC do segredo do servidor `JWT_SECRET` com a data UTC) + IP + `User-Agent` — o IP nunca é persistido em claro; `window_start` = data UTC corrente (per `watch-page/TD-02`, Revisions 2026-10-19; `### Data Model → VideoView`).
2. Em `record`, retornar sem efeito quando `status ≠ published` ou quando o espectador é o dono do canal; senão, numa transação, `INSERT … ON CONFLICT (video_id, viewer_key, window_start) DO NOTHING` e, só se a linha entrou, `UPDATE videos SET view_count = view_count + 1` (per `watch-page/TD-01`, `TD-02`; `video-channel-management/TD-05`).
3. Adicionar ao `VideosController` `POST /videos/:publicId/views` (`@Public()`, `@OptionalUser()`, `@HttpCode(204)`) — `loadReadable` para a regra de leitura, IP de `req.ip` (já resolvido pelo `trust proxy` de SI-05.1) e `User-Agent` do header; decorators Swagger com 204/401/404/429 (per `### API Contracts → POST /videos/{publicId}/views`; `nestjs-controllers.md`).
4. Registrar `VideoViewsService` no `VideosModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoViewsService.record` | Unit (repos mockados): rascunho → sem insert; dono → sem insert; `viewer_key` de usuário vs. anônimo; mesmo IP+UA em dias diferentes gera chaves diferentes | `src/videos/video-views.service.spec.ts` |
| `VideoViewsService.record` | Integration (DB real): mesmo espectador duas vezes no dia → `view_count` +1; dois usuários → +2; dono → 0; insert e update na mesma transação | `src/videos/video-views.service.integration-spec.ts` |

**Dependencies:** SI-05.1 (IP real), SI-05.3 (VideoView)

**Acceptance criteria:**

- `POST /videos/{publicId}/views` anônimo num vídeo publicado retorna `204` e `GET /videos/{publicId}` passa a devolver `view_count` +1
- Repetir a chamada com o mesmo IP e `User-Agent` no mesmo dia UTC retorna `204` e não altera `view_count`
- A mesma chamada com o `Bearer` de outro usuário retorna `204` e incrementa `view_count` de novo
- O dono chamando no próprio vídeo publicado ou rascunho recebe `204` e `view_count` não muda
- Anônimo num rascunho retorna `404` com `error: "VIDEO_NOT_FOUND"`
- `video_views` não contém nenhum IP em claro após as chamadas

---

### SI-05.5 — Job agendado video-views.cleanup

**Description:** Apagar diariamente os baldes vencidos de `video_views` para a tabela não crescer sem limite.

**Technical actions:**

1. Adicionar `VIDEO_VIEWS_CLEANUP: 'video-views.cleanup'` a `QUEUE_NAMES` e o payload vazio a `QueuePayloads` em `src/queue/queue.constants.ts`, e um método `schedule(queue, cron)` ao `QueueService` (wrapper do `boss.schedule`, sem lógica de domínio) (per `### Events/Messages → video-views.cleanup`; `phase-03-upload-processing/TD-04`).
2. Criar `src/worker/video-views-cleanup.worker.ts`: na inicialização registra `schedule('video-views.cleanup', '0 3 * * *')` (UTC, idempotente) e consome a fila executando `DELETE FROM video_views WHERE window_start < (now() AT TIME ZONE 'UTC')::date - 2` (per `watch-page/TD-02`, Revisions 2026-10-19).
3. Registrar o handler no `WorkerModule` (nunca no `AppModule`) e documentar a fila no `nestjs-project/CLAUDE.md` (seção do `video-worker`) (per `phase-03-upload-processing/TD-05`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoViewsCleanupWorker` | Integration (DB real + pg-boss `pgboss_test`): linhas com `window_start` anterior a 2 dias são apagadas; hoje, ontem e anteontem permanecem; reexecução não falha | `src/worker/video-views-cleanup.worker.integration-spec.ts` |
| `QueueService.schedule` | Unit (pg-boss mockado): repassa nome e cron ao `boss.schedule` | `src/queue/queue.service.spec.ts` (estender) |

**Dependencies:** SI-05.3 (VideoView)

**Acceptance criteria:**

- Após o `video-worker` subir, `pgboss.schedule` contém `video-views.cleanup` com o cron `0 3 * * *`
- Executar o job com linhas de 5, 2, 1 e 0 dias atrás deixa só as de 2, 1 e 0 dias
- Executar o job duas vezes seguidas produz o mesmo estado final

---

### SI-05.6 — Endpoint GET /videos/{publicId}/related

**Route:** GET /videos/{publicId}/related
**Test Specs:** see `nestjs-project/specs/videos-related.plan.md`
**Authorization:** Público com auth opcional — per `### Authorization Matrix` (origem segue a regra de leitura; itens só `published` + `public` + `ready`)

**Description:** Entregar as sugestões da sidebar — mesma categoria primeiro, completadas por públicos recentes — numa lista fechada.

**Technical actions:**

1. Criar `RelatedVideosQuery` (`limit` `@IsOptional @Type(() => Number) @IsInt @Min(1) @Max(24)`, default 12) em `src/videos/dto/list-videos.dto.ts` e `RelatedVideosResponse` (`{ items: VideoCardItem[] }`, sem `next_cursor`) em `src/videos/dto/video-pages.dto.ts` (per `### API Contracts → Validation Rules`; `watch-page/TD-04`, Revisions 2026-10-19).
2. Estender `VideosListingService` com `listRelated(video, limit)`: elegíveis `status = published` + `visibility = public` + `processing_status = ready` excluindo o próprio vídeo; primeiro a mesma `category_id` por `published_at DESC`, depois — se faltar ou sem categoria — públicos recentes de outras categorias sem repetir; mapear com o mesmo `VideoCardItem` das listagens (per `watch-page/TD-04`).
3. Adicionar ao `VideosController` `GET /videos/:publicId/related` (`@Public()`, `@OptionalUser()`, `loadReadable` na origem) com decorators Swagger 200/400/401/404 (per `### API Contracts → GET /videos/{publicId}/related`; `nestjs-controllers.md`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosListingService.listRelated` | Integration (DB real): mesma categoria primeiro por `published_at DESC`; completa com outras categorias sem duplicar; exclui o próprio vídeo, unlisted, rascunho e não-`ready`; vídeo sem categoria → só recentes; respeita `limit` | `src/videos/videos-listing.service.integration-spec.ts` (estender) |

**Dependencies:** none

**Acceptance criteria:**

- `GET /videos/{publicId}/related` anônimo retorna `200` com `{ items }` (sem `next_cursor`), no máximo 12 itens, os da mesma categoria antes dos demais
- Nenhum item é unlisted, rascunho, não-`ready` ou o próprio vídeo de origem
- `GET /videos/{publicId}/related?limit=30` retorna `400` com `error: "VALIDATION_ERROR"`
- Origem rascunho de terceiro retorna `404` com `error: "VIDEO_NOT_FOUND"`

---

### SI-05.7 — Sincronizar contrato OpenAPI, aliases e handlers MSW

**Description:** Levar os contratos novos/modificados do backend ao frontend pela cadeia OpenAPI e dar ao MSW os handlers que os testes do BFF e o E2E da watch page consomem.

**Technical actions:**

1. Rodar a cadeia completa: `docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` → `docker compose exec next-frontend npm run openapi:types` (regenera `lib/api/types.gen.ts`, nunca editado à mão) (per `next-frontend-openapi-typing/TD-01`, `TD-02`, `TD-03`; `openapi-docs-nestjs/TD-02`).
2. Adicionar a `lib/api/contracts.ts` os aliases `RelatedVideos` (`RelatedVideosResponse`) e, se ainda não existir, `Playback` (`PlaybackResponse`); `Video` passa a carregar `channel` pelo tipo gerado (per `next-frontend-openapi-typing/TD-04`).
3. Em `mocks/factories/videos.ts` + `mocks/store.ts`, incluir `channel: { nickname, name }` em todo `VideoResponse` e categorias nos vídeos publicados do seed para as sugestões terem o que agrupar (per `next-frontend-msw-foundation/TD-03`).
4. Em `mocks/handlers/videos.ts`, adicionar `GET /videos/:publicId/related` (lista fechada `{ items }` a partir do store, mesma regra de elegibilidade) e `POST /videos/:publicId/views` (204; incrementa `view_count` no store uma vez por `publicId` + espectador; 404 para os triggers de leitura existentes); o `stream_url` de `/playback` continua na origem do storage `http://localhost:9000` (per `watch-page/TD-07`; `next-frontend-msw-foundation/TD-01`, `TD-04`; `next-frontend-openapi-typing/TD-05`).
5. Documentar os triggers novos (se houver) na seção "E2E architecture" do `next-frontend/CLAUDE.md`.

**Tests:** _(empty — contract sync; handlers are exercised by the BFF integration tests of SI-05.9 and by the screen spec)_

**Dependencies:** SI-05.2, SI-05.4, SI-05.6 (contratos do backend)

**Acceptance criteria:**

- `nestjs-project/openapi.json` e `next-frontend/openapi.json` são idênticos e contêm `POST /videos/{publicId}/views`, `GET /videos/{publicId}/related` e `channel` em `VideoResponse`
- `lib/api/types.gen.ts` regenerado compila (`docker compose exec next-frontend npx tsc --noEmit`) e o check de frescor do OpenAPI passa
- Com MSW, `GET /videos/{publicId}/related` de um vídeo publicado do seed devolve `{ items }` sem o próprio vídeo e sem unlisted

---

### SI-05.8 — BFF: IP do visitante e sessão opcional nas chamadas ao upstream

**Description:** Dar ao BFF e aos RSC as duas peças que as leituras públicas precisam: repassar o IP/`User-Agent` do visitante ao upstream e usar a sessão quando ela existe sem exigi-la.

**Technical actions:**

1. Criar `lib/api/client-headers.ts` (`server-only`) com `clientHeaders()`: lê `x-forwarded-for` (primeiro IP) e `user-agent` de `headers()` e devolve `{ "X-Forwarded-For"?, "User-Agent"? }` — header ausente → chave omitida (per `watch-page/TD-03`, Revisions 2026-10-19).
2. Verificar que o `next start` do container preenche `x-forwarded-for` com o IP do socket do navegador e registrar o resultado no `next-frontend/CLAUDE.md` (seção "Talking to the NestJS API"); se não preencher, o fallback é não encaminhar — a API usa o IP do BFF (per `watch-page/TD-03`, Revisions 2026-10-19).
3. Adicionar `withOptionalSession(call)` a `lib/api/bff.ts`: sem sessão → chama sem `Authorization`; com sessão → `withRefresh` como o `withSession`; refresh falho → sessão destruída e nova tentativa anônima; sempre mescla `clientHeaders()` (per `### API Contracts → BFF tier`; `phase-02-auth-frontend/TD-03`; `video-channel-management/TD-07`).
4. Criar `lib/api/public-read.ts` (`server-only`) com `publicRead(call)` para RSC: envia o `Bearer` da sessão quando houver + `clientHeaders()`; upstream `401` → repete anônimo (RSC não grava cookie, então não há refresh) (per `video-channel-management/TD-12`; resolução OQ-2 → 401 no RSC).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `clientHeaders` | Unit (`next/headers` mockado): primeiro IP de uma lista `x-forwarded-for`; headers ausentes omitidos | `lib/api/__tests__/client-headers.test.ts` |
| `withOptionalSession` | Integration (MSW): sem sessão → upstream sem `Authorization`; com sessão → `Bearer`; `401` → refresh e nova tentativa; refresh falho → nova tentativa anônima; `X-Forwarded-For` repassado | `lib/api/__tests__/bff.integration.test.ts` (estender) |
| `publicRead` | Integration (MSW): sessão com token expirado (`401`) → segunda leitura anônima bem-sucedida | `lib/api/__tests__/public-read.integration.test.ts` |

**Dependencies:** SI-05.1 (contrato `TRUST_PROXY` da API)

**Acceptance criteria:**

- Uma chamada via `withOptionalSession` sem cookie de sessão chega ao upstream sem `Authorization` e com o `X-Forwarded-For` da requisição de entrada
- Com sessão cujo refresh falha, a sessão é destruída e a chamada é refeita anônima, devolvendo a resposta pública
- `publicRead` com token expirado devolve os dados públicos em vez de propagar `401`

---

### SI-05.9 — Route Handlers BFF de playback e visualizações

**Route:** GET /api/videos/{publicId}/playback, POST /api/videos/{publicId}/views
**Authorization:** Público — sessão `iron-session` opcional; o Route Handler injeta o `Bearer` só quando há sessão e deixa a regra de leitura para o upstream — per `### Authorization Matrix`

**Description:** Expor ao player as duas operações pós-renderização — renovar as URLs assinadas e registrar a visualização — pelo BFF, sem exigir login.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/playback/route.ts` com `GET` → `withOptionalSession((headers) => upstream.GET("/videos/{publicId}/playback", …))`, pass-through de `200`/`404`/`409`/`503` (per `### API Contracts → BFF tier → GET /api/videos/{publicId}/playback`).
2. Criar `app/api/videos/[publicId]/views/route.ts` com `POST` → `withOptionalSession((headers) => upstream.POST("/videos/{publicId}/views", …))`, sem corpo, pass-through de `204`/`404`/`429` (per `### API Contracts → BFF tier → POST /api/videos/{publicId}/views`; `watch-page/TD-01`).
3. Atualizar a árvore de `app/api/videos/**` no `next-frontend/CLAUDE.md` com as duas rotas.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `GET /api/videos/{publicId}/playback` | Integration (route como função + MSW): anônimo → `200` com `stream_url`/`download_url`; `404`/`409` pass-through; com sessão → `Bearer` repassado | `app/api/videos/[publicId]/playback/__tests__/route.integration.test.ts` |
| `POST /api/videos/{publicId}/views` | Integration (route como função + MSW): anônimo → `204`; `404` pass-through; `X-Forwarded-For` e `User-Agent` chegam ao upstream | `app/api/videos/[publicId]/views/__tests__/route.integration.test.ts` |

**Dependencies:** SI-05.7 (tipos + handlers MSW), SI-05.8 (`withOptionalSession`)

**Acceptance criteria:**

- `GET /api/videos/{publicId}/playback` sem cookie de sessão, para um vídeo publicado, retorna `200` com `stream_url`, `download_url` e `expires_at`
- `GET /api/videos/{publicId}/playback` de um rascunho alheio retorna `404` com `error: "VIDEO_NOT_FOUND"`
- `POST /api/videos/{publicId}/views` sem cookie de sessão retorna `204`
- `POST /api/videos/{publicId}/views` de um vídeo inexistente retorna `404` com `error: "VIDEO_NOT_FOUND"`

---

### SI-05.10 — Componente VideoPlayer (mídia, renovação da URL e registro de visualização)

**Description:** Author o player da watch page sobre o `<video>` nativo — estado de mídia, controles próprios, renovação da URL assinada e o disparo único do registro de visualização.

**Technical actions:**

1. Criar `hooks/use-media-state.ts` (`"use client"`): assina os eventos do `<video>` (`play`, `pause`, `timeupdate`, `progress`, `durationchange`, `volumechange`, `waiting`, `playing`, `ended`) e do documento (`fullscreenchange`) e expõe `paused`, `currentTime`, `duration`, `buffered`, `volume`, `muted`, `waiting`, `fullscreen` (per `watch-page/TD-05`).
2. Criar `hooks/use-view-registration.ts`: acumula o tempo efetivamente reproduzido pelos deltas de `timeupdate` (ignora saltos de busca); ao atingir `min(10, duration)` s — ou no `ended` — chama `POST /api/videos/{publicId}/views` **uma vez** por montagem; desligado quando `enabled = false`; falha silenciosa (per `watch-page/TD-01`).
3. Author `components/watch/video-player.tsx` (`"use client"`): props `publicId`, `streamUrl`, `expiresAt`, `posterUrl`, `trackViews = true`; `<video playsInline preload="metadata" poster>` + `PlayerControls`; clique no vídeo alterna play/pause; tela cheia no contêiner; indicador de buffering em `waiting` (per `### UI Contracts → Screen: Página de visualização do vídeo`).
4. No `video-player.tsx`, tratar `error` do `<video>` (ou `expiresAt` vencido ao retomar): salvar `currentTime` e o estado de reprodução, chamar `GET /api/videos/{publicId}/playback`, trocar o `src`, voltar ao tempo salvo e retomar; uma tentativa — se falhar, estado de erro com "tentar novamente" (per `watch-page/TD-05`; `phase-03-upload-processing/TD-09`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `use-media-state` | Unit (`renderHook`, eventos sintéticos sobre stub de `HTMLMediaElement`): cada evento atualiza o campo correspondente | `hooks/__tests__/use-media-state.test.ts` |
| `use-view-registration` | Unit (`renderHook` + MSW): dispara após 10 s acumulados; vídeo de 4 s dispara no `ended`; busca não conta tempo; nunca dispara duas vezes; `enabled = false` nunca dispara | `hooks/__tests__/use-view-registration.test.ts` |
| `video-player.tsx` | Unit per testing-guide-next-frontend § "Client Components" (`HTMLMediaElement.prototype.play/pause` stubados — per `watch-page/TD-07`): play/pause pelo botão e pelo clique no vídeo; `error` → busca nova URL, troca `src` e retoma no tempo salvo; falha da renovação → estado de erro | `components/watch/__tests__/video-player.test.tsx` |

**Dependencies:** SI-05.0.5 (player-controls), SI-05.9 (rotas do BFF)

**Acceptance criteria:**

- Com o player montado e reproduzindo, `POST /api/videos/{publicId}/views` é chamado exatamente uma vez depois de 10 s de reprodução acumulada
- Num vídeo de 4 s, a chamada acontece no fim da reprodução; avançar a barra até o fim sem reproduzir não dispara a chamada
- Com `trackViews = false`, nenhuma chamada a `/views` acontece
- Um `error` do `<video>` após a URL expirar dispara `GET /api/videos/{publicId}/playback` e a reprodução continua do mesmo ponto com o novo `src`
- Os controles expõem só play/pause, volume, progresso, tempo e tela cheia, com rótulos acessíveis que acompanham o estado

---

### SI-05.11.0 — Drift audit: Página de visualização do vídeo (Video show)

**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 — enquanto a Figma MCP estiver indisponível, a referência é `docs/inventories/assets/phase-05/Video show.png` (resolução OQ-6)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo (Video show)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) quando a Figma MCP estiver disponível; sem ela, comparar visualmente contra `docs/inventories/assets/phase-05/Video show.png` e os tokens de `app/globals.css` (resolução OQ-6), com:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/avatar.tsx`, `components/watch/video-player.tsx (new)`, `components/watch/player-controls.tsx (new)`, `components/ui/icon-button.tsx`, `components/icons/pause-icon.tsx (new)`, `components/ui/slider.tsx (new)`, `components/icons/volume-icon.tsx (new)`, `components/icons/volume-off-icon.tsx (new)`, `components/icons/fullscreen-icon.tsx (new)`, `components/watch/video-channel-link.tsx (new)`, `components/studio/copy-link-button.tsx`, `components/icons/share-icon.tsx (new)`, `components/ui/dropdown-menu.tsx`, `components/watch/download-menu-item.tsx (new)`, `components/icons/download-icon.tsx (new)`, `components/watch/video-description.tsx (new)`, `components/watch/related-videos.tsx (new)`, `components/videos/video-card.tsx`]
   - Server-connected component names (no endpoints/auth/errors): [Watch page — RSC da rota, VideoPlayer, Canal do vídeo — avatar + nome, Item "Download" no menu "⋮", Bloco de descrição, Sidebar de sugestões, Card de sugestão horizontal]
   - Target paths (read-only context for audit; no writes here): `app/(app)/watch/[publicId]/page.tsx` + `components/watch/*.tsx`

   For each component in the Reused DS list, perform value-level diff against the file on disk and classify per the 4-value status enum (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`). Compose Decision per default policy (see `.claude/skills/plan-build/references/frontend-drift-report-schema.md` § Default decisions per status). Read prior sections of `frontend-drift-report.md` to build `prior_decisions`; populate `Prior` column with CONFLICT detection (executed by `/implement` per its SKILL.md cross-screen consultation algorithm). Esperados: `video-card.tsx` com `drift relevante` (falta a variante horizontal com duração) e `copy-link-button.tsx` com `drift relevante` (falta a variante "pill" "Share" e o uso fora do estúdio). Write a `## Screen: video-show — audited at SI-05.11.0 ({YYYY-MM-DD})` section to `frontend-drift-report.md` (append on first run, overwrite-in-place on re-run). **No code edits — verifiable via `git diff` at SI end.**

**Dependencies:** SI-05.0.1, SI-05.0.3, SI-05.0.4, SI-05.0.5, SI-05.0.6

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `docs/phases/phase-05-watch-page/frontend-drift-report.md` existe; a seção `## Screen: video-show` existe com a data da execução no título (anexada na primeira execução, sobrescrita no lugar nas seguintes).
- Todo componente da lista Reused DS tem exatamente uma linha na tabela.
- Toda linha tem a coluna Decision preenchida:
  - `alinhado` → `skip`
  - `drift menor` → `auto-Edit "<specifics>"` ou `exception "<reason>"`
  - `drift relevante` → `auto-Edit "<specifics>"`, `exception "<reason>"` ou `CONFLICT: <one-liner>; <verb> "<specifics>"`
  - `componente ausente` → `create`
- Toda decisão `exception` carrega uma justificativa de uma linha.
- `git diff --name-only HEAD -- next-frontend` após a SI é vazio.

---

### SI-05.11a — Tela de Página de visualização do vídeo (visual shell)

**Route:** /watch/{publicId}
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 — referência local `docs/inventories/assets/phase-05/Video show.png` enquanto a Figma MCP estiver indisponível (resolução OQ-6)
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo (Video show)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: video-show`

**Technical actions:**

1. **Apply drift decisions** — read the Drift Report section for this screen. For each row, parse the Decision column and apply per the verb body:
   - `auto-Edit "<specifics>"` → apply `Edit` on the named DS file with the documented specifics
   - `create` → create the file (icons via Figma asset; components per spec)
   - `exception` / `skip` → no-op
   - `CONFLICT: <one-liner>; <verb> "<specifics>"` → strip the `CONFLICT: <one-liner>;` prefix (informational only) and apply the verb body per the rules above

   No drift detection or auto-judgment in this step. The audit-SI did the analysis; this step is mechanical application.

2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff per Decisão #31) quando a Figma MCP estiver disponível; sem ela, construir a partir de `docs/inventories/assets/phase-05/Video show.png` com os tokens de `app/globals.css` (resolução OQ-6), com:
   - Figma URL: https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219
   - Reused DS components: [`components/layout/app-header.tsx`, `components/ui/avatar.tsx`, `components/watch/video-player.tsx (new)`, `components/watch/player-controls.tsx (new)`, `components/ui/icon-button.tsx`, `components/icons/pause-icon.tsx (new)`, `components/ui/slider.tsx (new)`, `components/icons/volume-icon.tsx (new)`, `components/icons/volume-off-icon.tsx (new)`, `components/icons/fullscreen-icon.tsx (new)`, `components/watch/video-channel-link.tsx (new)`, `components/studio/copy-link-button.tsx`, `components/icons/share-icon.tsx (new)`, `components/ui/dropdown-menu.tsx`, `components/watch/download-menu-item.tsx (new)`, `components/icons/download-icon.tsx (new)`, `components/watch/video-description.tsx (new)`, `components/watch/related-videos.tsx (new)`, `components/videos/video-card.tsx`] _(now reflecting any DS edits from action 1)_
   - Server-connected component names (no endpoints/auth/errors): [Watch page — RSC da rota, VideoPlayer, Canal do vídeo — avatar + nome, Item "Download" no menu "⋮", Bloco de descrição, Sidebar de sugestões, Card de sugestão horizontal]
   - Target paths: `app/(app)/watch/[publicId]/page.tsx` + `components/watch/*.tsx` — layout de duas colunas (conteúdo ~2/3 + sidebar), sem os elementos fora de escopo (Subscribe, Like/Dislike, comentários, chips, controles extras do player)

**Dependencies:** SI-05.11.0 + SI-05.0.1, SI-05.0.3, SI-05.0.4, SI-05.0.5, SI-05.0.6

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-Xb; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- All target paths exist, export expected components, and compile per `docker compose exec next-frontend npx tsc --noEmit`.
- Rendering matches the reference (Figma node / PNG) within tolerance of DS component set.
- No runtime imports beyond Reused DS list (stays visually scoped).

---

### SI-05.11b — Tela de Página de visualização do vídeo (lógica & wiring)

**Test Specs:** see `next-frontend/specs/watch.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Página de visualização do vídeo (Video show)`

**Technical actions:**

1. **Route guard application** — Auth requirement `Anonymous`: a rota é **pública para todos** (anônimo e autenticado); nenhum guard nem redirect — o `proxy.ts` continua restrito a `/studio/**`; o dono abre o próprio rascunho pela mesma URL (per `video-channel-management/TD-07`, `watch-page/TD-06`).
2. **Rendering strategy application** — RSC em `app/(app)/watch/[publicId]/page.tsx`: `publicRead` lê `GET /videos/{publicId}`; com o vídeo legível, lê em paralelo `GET /videos/{publicId}/playback` (só quando `processing_status = ready`) e `GET /videos/{publicId}/related`; `generateMetadata` com título e descrição do vídeo (per `video-channel-management/TD-12`; SI-05.8).
3. **Endpoint wiring** — tipos de `@/lib/api/contracts` (`Video`, `Playback`, `RelatedVideos`); `VideoPlayer` recebe `streamUrl`/`expiresAt`/`posterUrl` do playback; `VideoChannelLink` recebe `video.channel`; `VideoDescription` recebe `view_count`/`published_at`/`description`; `CopyLinkButton` (variante "Share") recebe `${origin}/watch/{publicId}` com a origem dos headers como nas páginas do estúdio; menu "⋮" com `DownloadMenuItem` recebendo `download_url`; `RelatedVideos` recebe `items` (per `next-frontend-openapi-typing/TD-04`; `watch-page/TD-04`, `TD-08`).
4. **Error mapping** — `404 VIDEO_NOT_FOUND` → `notFound()`; `409 VIDEO_NOT_READY` (dono) → `components/watch/player-placeholder.tsx` no lugar do player com o status do processamento; `503 STORAGE_UNAVAILABLE` → o mesmo placeholder em modo erro com "tentar novamente" (`router.refresh()`); título, canal e descrição renderizam nos três casos não-404 (resolução OQ-2; per `### UI Contracts → Error Catalog → UX mapping`).
5. **E2E fixture** — gerar `tests/fixtures/watch-sample.webm` (VP9/Opus, ~2 s, poucos KB) com o ffmpeg do container `nestjs-api` (mesmo comando de `src/test/video-fixtures.ts`) e commitar; o spec da tela o serve via `page.route("http://localhost:9000/**")` sobre a origem do `stream_url` (per `watch-page/TD-07`).

**Dependencies:** SI-05.11a, SI-05.2, SI-05.4, SI-05.6 (endpoints do backend), SI-05.7 (tipos + MSW), SI-05.8 (`publicRead`), SI-05.10 (VideoPlayer)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/watch/player-placeholder.tsx` | Unit per testing-guide-next-frontend § "Client Components" — modo processando mostra o status; modo erro mostra "tentar novamente" e chama `router.refresh()` (mock `next/navigation`) | `components/watch/__tests__/player-placeholder.test.tsx` |

E2E for the page (anonymous access, unlisted via direct link, playback via the WebM fixture, view registration, description toggle, download link, 404/409/503 states) is authored externally by `/plan-test-specs` in the spec file referenced by `**Test Specs:**` above. Page-level Unit testing is excluded by `testing-guide-next-frontend` artifact rule "Pages → E2E only".

**Acceptance criteria:**

- `/watch/{publicId}` de um vídeo publicado abre sem sessão, com player, título, canal, descrição, Share, menu "⋮" com Download e a sidebar de sugestões
- `/watch/{publicId}` de um vídeo unlisted abre pelo link direto, e esse vídeo não aparece na sidebar de nenhum outro vídeo
- `/watch/{publicId}` de um vídeo inexistente ou de um rascunho alheio renderiza a página `not-found`
- O dono abrindo o próprio vídeo em processamento vê o placeholder com o status no lugar do player; com o storage indisponível, o placeholder de erro oferece "tentar novamente"
- O item "Download" do menu aponta para a `download_url` devolvida pelo `/playback`

---

### SI-05.12 — Reusar o VideoPlayer no preview do estúdio

**Description:** Trocar o `<video controls>` nativo do preview do `CardVideoConfig` (telas de edição e de upload em processamento da Fase 04) pelo `VideoPlayer` desta fase, sem registrar visualização (decisão do usuário no `/screen-inventory 5`).

**Technical actions:**

1. Em `components/studio/video-preview.tsx`, renderizar `VideoPlayer` com `trackViews={false}` quando houver `streamUrl` (mantendo o placeholder atual sem URL) e aceitar as props `publicId` e `expiresAt` que o player precisa para renovar a URL (per `watch-page/TD-05`; `watch-page/TD-01` — dono não gera visualização).
2. Repassar `publicId` e `expires_at` do playback em `components/studio/video-edit-form.tsx` (e onde mais o `VideoPreview` receber `streamUrl`) a partir dos dados que as páginas do estúdio já leem.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-preview.tsx` | Unit per testing-guide-next-frontend § "Client Components" — com `streamUrl` renderiza o `VideoPlayer` (controles próprios, sem `controls` nativo); sem `streamUrl` mantém o placeholder; nenhum `POST …/views` é feito | `components/studio/__tests__/video-preview.test.tsx` (estender) |

**Dependencies:** SI-05.10 (VideoPlayer)

**Acceptance criteria:**

- Na edição de um vídeo `ready`, o preview mostra os controles próprios do player (play/pause, volume, progresso, tempo, tela cheia) em vez dos controles nativos do navegador
- Reproduzir o vídeo no preview do estúdio por mais de 10 s não faz nenhuma chamada a `/api/videos/{publicId}/views`
- Sem URL de reprodução (vídeo ainda processando), o preview continua mostrando o placeholder com a duração

---

## Technical Specifications

### Data Model

#### VideoView (nova — per `watch-page/TD-02`, Revisions 2026-10-19)

Registro de deduplicação das visualizações: uma linha por (vídeo, espectador, dia UTC). A linha só existe para decidir se `videos.view_count` deve ser incrementado; a exibição continua lendo o contador denormalizado de `video-channel-management/TD-05`.

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated |
| video_id | uuid | not null, FK → `videos.id` `ON DELETE CASCADE` |
| viewer_key | varchar(80) | not null — `user:{user.id}` quando autenticado; `anon:{sha256 hex}` do anônimo (hash de salt diário + IP real + `User-Agent`) |
| window_start | date | not null — data UTC da visualização (balde fixo por dia, alinhado à rotação diária do salt) |
| created_at | timestamp | not null, default now() |

**Relations:** `Video` has many `VideoView` (one-to-many; a view some com o vídeo via cascade — o hard delete de `video-channel-management/TD-09` não deixa órfãos)
**Indexes:** unique `(video_id, viewer_key, window_start)` — alvo do `INSERT … ON CONFLICT DO NOTHING`; btree em `window_start` — varredura do job de limpeza (`### Events/Messages → video-views.cleanup`)
**Escrita:** `INSERT … ON CONFLICT (video_id, viewer_key, window_start) DO NOTHING` e, **somente se a linha entrou**, `UPDATE videos SET view_count = view_count + 1 WHERE id = $1` — as duas na mesma transação (per `watch-page/TD-02`). O hash anônimo nunca guarda o IP em claro; o salt diário é derivado de um segredo do servidor + a data UTC, de modo que a mesma pessoa gera chaves diferentes em dias diferentes.

#### Video (inalterada nesta fase)

Nenhuma coluna nova. `view_count` (integer, default 0, `video-channel-management/TD-05`) passa a ser escrito pelo registro de visualização acima; `like_count`, `dislike_count` e `comment_count` seguem zerados até a Fase 06.

### API Contracts

_Backend tier (NestJS, `Scope: Backend | Cross-layer`). Envelope de erro herdado: `{ statusCode, error, message }` (per `phase-02-auth/TD-07`). As rotas desta fase são **públicas com autenticação opcional** (`@Public()` + `@OptionalUser()`, per `video-channel-management/TD-07`): token ausente → anônimo; token presente e inválido/expirado → 401. Todas passam pelo throttler global, que a partir de SI-05.1 rastreia o IP real do visitante (`X-Forwarded-For` aceito apenas do IP em `TRUST_PROXY`; per `watch-page/TD-03`, Revisions 2026-10-19). Shapes anotados com `@ApiProperty` porque o `openapi.json` é a fonte dos tipos do frontend (per `openapi-docs-nestjs`, `next-frontend-openapi-typing`)._

**Shapes compartilhados (novos ou modificados nesta fase):**

- `VideoCardChannel` (existente, Fase 04): `{ nickname: string, name: string }`
- `VideoResponse` (modificado): shape da Fase 04 **+** `channel: VideoCardChannel` — dados públicos do canal dono do vídeo (resolução OQ-1 do `/plan-validate 5`). O avatar segue sendo o placeholder de iniciais da Fase 04 (sem campo no domínio).
- `RelatedVideosResponse` (novo): `{ items: VideoCardItem[] }` — **sem** `next_cursor`; lista fechada (per `watch-page/TD-04`, Revisions 2026-10-19 — exceção explícita ao cursor keyset de `video-channel-management/TD-06`).

#### GET /videos/{publicId} (SI-05.2 — contrato da Fase 04 modificado: resposta ganha `channel`)

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Response 200:** `VideoResponse` (com `channel: { nickname, name }`)

**Regra de visibilidade (inalterada, per `video-channel-management/TD-07`):** dono → qualquer `status`; demais → somente `status = published` (`public` ou `unlisted`, pois a leitura é por `public_id` — per `watch-page/TD-06`); rascunho de terceiro → 404.

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho que não pertence ao solicitante

---

#### GET /videos/{publicId}/playback (contrato inalterado — Fase 04, SI-04.3; política de download confirmada por `watch-page/TD-08`)

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Response 200:** `{ stream_url, download_url, thumbnail_url, expires_at }` — `download_url` é emitida para **todo** leitor autorizado pela regra de visibilidade, inclusive anônimo (per `watch-page/TD-08`); `stream_url` atende `Range` (206) e `download_url` carrega `Content-Disposition: attachment` (per `phase-03-upload-processing/TD-09`); ambas expiram em `expires_at` (`PLAYBACK_URL_TTL`).

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho de terceiro
- 409 VIDEO_NOT_READY: `processing_status ≠ ready`
- 503 STORAGE_UNAVAILABLE: falha ao assinar as URLs

---

#### POST /videos/{publicId}/views (SI-05.4)

Registro de uma visualização, disparado pelo player após o limiar de reprodução (per `watch-page/TD-01`). Público com auth opcional.

**Request headers:**
- Authorization: Bearer <access_token> — opcional (identifica o espectador autenticado e o dono)
- X-Forwarded-For: IP do visitante — enviado pelo BFF; só é considerado quando a conexão vem do IP em `TRUST_PROXY` (per `watch-page/TD-03`)
- User-Agent: compõe o hash do espectador anônimo

**Request body:** nenhum

**Response 204:** No content — **sempre** que o vídeo é legível pelo solicitante, tenha contado ou não. A visualização só incrementa `view_count` quando: `status = published` E o solicitante não é o dono do canal E a linha `(video_id, viewer_key, window_start)` ainda não existia (per `watch-page/TD-02`). Rascunho do próprio dono, revisita no mesmo dia UTC e dono assistindo ao próprio vídeo publicado → 204 sem efeito.

**Error responses:**
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: inexistente, ou rascunho de terceiro (mesma regra de leitura do `GET`)
- 429 Too Many Requests: limite do throttler global por IP real (corpo padrão do `@nestjs/throttler`, sem `error` de domínio)

---

#### GET /videos/{publicId}/related (SI-05.6)

Sugestões da sidebar (per `watch-page/TD-04`). Público com auth opcional; o vídeo de origem segue a regra de leitura do `GET /videos/{publicId}`.

**Request headers:**
- Authorization: Bearer <access_token> — opcional

**Request query parameters:**
- limit: integer, optional — 1..24, default 12

**Response 200:** `RelatedVideosResponse` — `{ items: VideoCardItem[] }`, sem `next_cursor`. Elegíveis: `status = published` E `visibility = public` E `processing_status = ready`, excluindo o próprio vídeo (unlisted nunca aparece). Seleção: mesma `category_id` do vídeo de origem por `published_at DESC`; quando há menos que `limit` (ou o vídeo não tem categoria), completa com os públicos mais recentes de outras categorias, sem repetir itens.

**Error responses:**
- 400 VALIDATION_ERROR: `limit` fora de 1..24 ou não inteiro
- 401 Unauthorized: token presente mas inválido/expirado
- 404 VIDEO_NOT_FOUND: vídeo de origem inexistente ou rascunho de terceiro

---

#### Validation Rules — visualizações e sugestões

- `publicId` (path, todas as rotas): string de 11 caracteres base64url (`phase-03-upload-processing/TD-08`); formato inválido → 404 `VIDEO_NOT_FOUND` (mesmo comportamento das rotas da Fase 04)
- `limit` (`GET /videos/{publicId}/related`): optional, integer, min 1, max 24, default 12

---

> _BFF tier — frontend-exposed contract. O navegador chama a rota same-origin em `app/api/**`; a rota repassa ao upstream NestJS no servidor (strict BFF, per `next-frontend/CLAUDE.md` → "Talking to the NestJS API"). As leituras da watch page acontecem no RSC via `upstream` (per `video-channel-management/TD-12`) e não passam por estas rotas; elas existem apenas para o que o player faz depois da renderização._

#### GET /api/videos/{publicId}/playback (SI-05.9)

Usado pelo player para renovar as URLs assinadas quando `stream_url` expira (resolução IC-1 / `watch-page/TD-05`: "expiração da URL assinada a tratar no player").

**forwards-to:** `GET /videos/{publicId}/playback` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão iron-session **quando houver**; sem sessão a chamada sai anônima *(per video-channel-management/TD-07)*
- X-Forwarded-For: IP do visitante lido de `x-forwarded-for` na requisição de entrada; omitido quando ausente *(per watch-page/TD-03)*

**Response 200 (FE-facing):** `PlaybackResponse` — pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** upstream 401 com sessão → refresh single-flight e nova tentativa; refresh falho → sessão destruída e nova tentativa **anônima** (a rota é pública) *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 409 VIDEO_NOT_READY: pass-through *(derived: project contract source)*
- 503 STORAGE_UNAVAILABLE: pass-through *(derived: project contract source)*

---

#### POST /api/videos/{publicId}/views (SI-05.9)

Disparado uma vez por carregamento da página quando a reprodução acumulada atinge 10 s (ou o fim do vídeo, se mais curto) *(per watch-page/TD-01)*.

**forwards-to:** `POST /videos/{publicId}/views` *(derived: project contract source)*

**Request headers:**
- Authorization: Bearer da sessão iron-session **quando houver** *(per video-channel-management/TD-07)*
- X-Forwarded-For: IP do visitante lido de `x-forwarded-for`; omitido quando ausente — a API cai no IP do BFF e registra normalmente *(per watch-page/TD-03)*
- User-Agent: repassado do navegador *(per watch-page/TD-02)*

**Request body:** nenhum *(derived: project contract source)*

**Response 204 (FE-facing):** pass-through *(derived: project contract source; reshape: none)*

**Set-Cookie / session side-effect:** mesmo fallback do `GET …/playback` — refresh e, se falhar, nova tentativa anônima *(per phase-02-auth-frontend/TD-03)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 429 Too Many Requests: pass-through *(derived: project contract source)*

### Authorization Matrix

_"Owner" = usuário autenticado dono do canal do vídeo. "Published" = `status = published`, `public` ou `unlisted` (a leitura é por `public_id`, então unlisted é acessível pelo link — per `video-channel-management/TD-07`, `watch-page/TD-06`). Listagens (`/related`) nunca incluem unlisted._

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| GET /videos/{publicId} — vídeo published | ✓ | ✓ | ✓ |
| GET /videos/{publicId} — vídeo draft | ✗ (404) | ✗ (404) | ✓ |
| GET /videos/{publicId}/playback — vídeo published (`stream_url` + `download_url`, per `watch-page/TD-08`) | ✓ | ✓ | ✓ |
| GET /videos/{publicId}/playback — vídeo draft | ✗ (404) | ✗ (404) | ✓ |
| POST /videos/{publicId}/views — vídeo published | ✓ (conta, dedup por IP+UA) | ✓ (conta, dedup por usuário) | ✓ (204, **não** conta) |
| POST /videos/{publicId}/views — vídeo draft | ✗ (404) | ✗ (404) | ✓ (204, não conta) |
| GET /videos/{publicId}/related — origem published | ✓ | ✓ | ✓ |
| GET /videos/{publicId}/related — origem draft | ✗ (404) | ✗ (404) | ✓ |
| GET /api/videos/{publicId}/playback (BFF) | ✓ | ✓ | ✓ — mesma regra do upstream |
| POST /api/videos/{publicId}/views (BFF) | ✓ | ✓ | ✓ — mesma regra do upstream |

### Error Catalog

_Nenhum código de domínio novo nesta fase — todos herdados das Fases 02–04 (envelope `{ statusCode, error, message }`, per `phase-02-auth/TD-07`)._

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| VIDEO_NOT_FOUND | 404 | Vídeo inexistente, `publicId` malformado ou rascunho que não pertence ao solicitante — em `GET /videos/{publicId}`, `/playback`, `/related` e `POST /views` |
| VIDEO_NOT_READY | 409 | `GET /videos/{publicId}/playback` com `processing_status ≠ ready` (só alcançável pelo dono, já que publicar exige `ready`) |
| STORAGE_UNAVAILABLE | 503 | Falha ao assinar `stream_url`/`download_url` |
| VALIDATION_ERROR | 400 | `limit` inválido em `GET /videos/{publicId}/related` |
| _(sem errorCode)_ | 401 | Token presente mas inválido/expirado nas rotas com auth opcional |
| _(sem errorCode)_ | 429 | Limite do throttler global excedido para o IP real do visitante (`ThrottlerException`, corpo padrão do Nest) |

### Events/Messages

#### video-views.cleanup

**Payload:**

```json
{}
```

**Producer:** agendador do pg-boss (`schedule` cron diário, `0 3 * * *` UTC), registrado pelo `video-worker` na inicialização — idempotente, sobrescreve o agendamento existente (per `watch-page/TD-02`, Revisions 2026-10-19; fila sobre o pg-boss de `phase-03-upload-processing/TD-04`)
**Consumer:** handler de limpeza no `WorkerModule` (`video-worker`, per `phase-03-upload-processing/TD-05`) — `DELETE FROM video_views WHERE window_start < (now() AT TIME ZONE 'UTC')::date - 2` (linhas com `window_start` anterior a 2 dias)
**Trigger:** uma vez por dia; só o balde do dia corrente deduplica visualizações novas, então os baldes vencidos são lixo — a margem de 2 dias evita apagar o balde de ontem enquanto ainda há fusos/relógios atrasados escrevendo nele
**Delivery semantics:** at-least-once — o `DELETE` é idempotente, então reexecução ou atraso não mudam o resultado; falha → retry padrão da fila, e o balde vencido é varrido no dia seguinte de qualquer forma

### UI Contracts

#### Screen: Página de visualização do vídeo (Video show)

**Route:** `/watch/{publicId}` _(per `watch-page/TD-06`)_
**Figma:** https://www.figma.com/design/0RBoWy5FbrK8SHEz1eK6gb/FC-Tube?node-id=152-2219 (node `0RBoWy5FbrK8SHEz1eK6gb:152:2219`) — referência visual para o `/implement` enquanto a Figma MCP estiver indisponível: `docs/inventories/assets/phase-05/Video show.png` + tokens de `app/globals.css` (resolução OQ-6)
**Purpose:** "Layout da página: vídeo principal + informações + sidebar com sugestões"

**Auth requirement:** Anonymous _(source: §Authorization Matrix — `GET /videos/{publicId}`, `/playback`, `/related` e `POST /views` são públicos com auth opcional; o dono também abre o próprio rascunho pela mesma URL)_

**Rendering strategy:** Server Component (RSC) lê `GET /videos/{publicId}` + `GET /videos/{publicId}/playback` + `GET /videos/{publicId}/related` via `upstream`, com o `Bearer` da sessão quando houver; Client Components só para o player, a descrição expansível, o menu "⋮" e o Share _(source: video-channel-management/TD-12)_

**Reused DS components:**
- `components/layout/app-header.tsx` — TopNav — header compartilhado (escopo de navegação completo é da Fase 07); autenticado → avatar/menu da conta; anônimo → indicação "sem conta" (link de login) no canto superior direito — frame único; busca, microfone, "+" e hambúrguer não entram nesta fase
- `components/ui/avatar.tsx` — Avatar da conta no header — só no estado autenticado; promovido de `(new)` na Fase 04 — o arquivo já existe
- `components/watch/video-player.tsx (new)` — VideoPlayer — `<video>` nativo com `stream_url` + controles próprios (`watch-page/TD-05` = B); rebusca `/playback` pelo BFF quando a URL assinada expira e retoma do `currentTime`; dispara o registro de visualização após o limiar (`watch-page/TD-01`); poster = `thumbnail_url`; registro de visualização desligável (reuso no estúdio)
- `components/watch/player-controls.tsx (new)` — PlayerControls — barra inferior — agrupa play/pause, volume, tempo e tela cheia sobre gradiente escuro na base do vídeo; nenhum I/O; estado local (toggle) de play/mudo/tela cheia
- `components/ui/icon-button.tsx` — Botão play/pause, Botão de volume / mudo, Botão tela cheia — alterna `play()`/`pause()`, `muted` e Fullscreen API
- `components/icons/pause-icon.tsx (new)` — Ícone pause — —
- `components/ui/slider.tsx (new)` — Barra de progresso / seek e slider de volume — primitivo `Slider` do `radix-ui` (já instalado, ainda sem wrapper em `components/ui`); trilho branco com thumb circular; mostra o buffer
- `components/icons/volume-icon.tsx (new)` — Ícone volume — —
- `components/icons/volume-off-icon.tsx (new)` — Ícone volume mudo — —
- `components/icons/fullscreen-icon.tsx (new)` — Ícone tela cheia / sair da tela cheia — par entrar/sair no mesmo arquivo
- `components/watch/video-channel-link.tsx (new)` — Canal do vídeo — avatar + nome — avatar (`components/channel/channel-avatar.tsx`) + nome do canal com link para `/channel/{nickname}`, a partir de `VideoResponse.channel`
- `components/studio/copy-link-button.tsx` — Botão Share — copia `${origin}/watch/{publicId}`; precisa da variante "pill" com rótulo "Share" do frame e de ser movido/exportado para uso fora do estúdio
- `components/icons/share-icon.tsx (new)` — Ícone share — —
- `components/ui/dropdown-menu.tsx` — Menu "⋮" de ações do vídeo — gatilho `IconButton` com `components/icons/more-vertical-icon.tsx`; o download fica como item deste menu
- `components/watch/download-menu-item.tsx (new)` — Item "Download" no menu "⋮" — abre `download_url` (per `watch-page/TD-08`)
- `components/icons/download-icon.tsx (new)` — Ícone download — —
- `components/watch/video-description.tsx (new)` — Bloco de descrição + alternância "mais / menos" — linha "N views • tempo" (`formatCompactNumber` + `formatRelativeTime` de `lib/format.ts`) + descrição em texto puro com quebras preservadas; estado local (toggle) de expansão/recolhimento via `line-clamp` (per `watch-page/TD-09`)
- `components/watch/related-videos.tsx (new)` — Sidebar de sugestões — lista vertical de até 12 sugestões (`watch-page/TD-04`); unlisted nunca aparece; chips de filtro fora do escopo
- `components/videos/video-card.tsx` — Card de sugestão horizontal — mesmo `VideoCard` da Fase 04 numa variante horizontal compacta com duração ("12:31") via `components/video/video-thumbnail.tsx`; link para `/watch/{publicId}`

**Server-connected components:**
- `Watch page — RSC da rota` — verbs: Carregar o vídeo pelo `publicId` da URL e renderizar a página para visitante anônimo; Abrir vídeo unlisted somente pelo link direto, sem listá-lo nas sugestões | endpoint: `GET /videos/{publicId}`, `GET /videos/{publicId}/playback`, `GET /videos/{publicId}/related` (RSC via `upstream` — §API Contracts → backend tier) | reuse: new
- `VideoPlayer` — verbs: Reproduzir o vídeo a partir da URL de stream com play/pause, volume e busca na barra de progresso; Renovar a URL de reprodução expirada e retomar do mesmo ponto; Registrar uma visualização após o limiar de reprodução | endpoint: `GET /api/videos/{publicId}/playback`, `POST /api/videos/{publicId}/views` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection); URLs iniciais recebidas do RSC | reuse: new
- `Canal do vídeo — avatar + nome` — verbs: Exibir título e canal do vídeo (avatar, nome e link para o canal) abaixo do player | endpoint: `GET /videos/{publicId}` → `channel` (RSC via `upstream` — §API Contracts → backend tier) | reuse: new
- `Item "Download" no menu "⋮"` — verbs: Baixar o arquivo do vídeo | endpoint: `GET /videos/{publicId}/playback` → `download_url` (RSC via `upstream` — §API Contracts → backend tier) | reuse: new
- `Bloco de descrição` — verbs: Exibir a contagem de visualizações e o tempo de publicação; Exibir a descrição do vídeo recolhida ou expandida | endpoint: `GET /videos/{publicId}` (RSC via `upstream` — §API Contracts → backend tier) | reuse: new
- `Sidebar de sugestões` — verbs: Exibir sugestões de vídeos da mesma categoria na sidebar; Abrir vídeo unlisted somente pelo link direto, sem listá-lo nas sugestões | endpoint: `GET /videos/{publicId}/related` (RSC via `upstream` — §API Contracts → backend tier) | reuse: new
- `Card de sugestão horizontal` — verbs: Exibir sugestões de vídeos da mesma categoria na sidebar | endpoint: `GET /videos/{publicId}/related` → `items[]` (RSC via `upstream`) | reuse: `components/videos/video-card.tsx`

**Behaviors:**

*Rendered states:*
- Loading: a página é RSC dinâmica (lê `cookies()`), então chega pronta; enquanto o `<video>` carrega metadados o player mostra o poster (`thumbnail_url`) e os controles desabilitados; buffering (`waiting`) exibe indicador sobre o vídeo
- Empty: sidebar sem sugestões (nenhum público além do próprio vídeo) → bloco da sidebar omitido; vídeo sem descrição → bloco mostra só a linha "N views • tempo", sem controle de expandir
- Success: player com o vídeo; título; canal (avatar + nome com link); ações Share e "⋮" (Download); bloco de descrição recolhido em 3 linhas; sidebar com até 12 cards horizontais
- Error: 404 → `not-found` da rota; 409 `VIDEO_NOT_READY` (só o dono, vídeo processando/falho) → página normal com placeholder no lugar do player mostrando o status do processamento; 503 `STORAGE_UNAVAILABLE` → placeholder de erro no lugar do player com ação "tentar novamente" (resolução OQ-2)

*Interactions:*
- Botão play/pause click (ou clique no vídeo) → alterna `play()`/`pause()` e troca ícone e rótulo acessível
- Arrastar/teclar no slider de progresso → `currentTime` do vídeo; o trilho mostra o trecho já bufferizado
- Botão de volume click → alterna `muted`; slider de volume (aparece em hover/foco do grupo) → `volume` — slider não desenhado no frame, segue o padrão do Slider do design system
- Botão tela cheia click → `requestFullscreen()` no contêiner do player / `exitFullscreen()`; o ícone acompanha `fullscreenchange`
- Reprodução acumulada ≥ 10 s (ou evento `ended` em vídeo mais curto) → uma única chamada `POST /api/videos/{publicId}/views` por carregamento da página (per `watch-page/TD-01`); falha da chamada é silenciosa (não interrompe a reprodução)
- `<video>` `error` por URL expirada → `GET /api/videos/{publicId}/playback`, troca `src` e retoma do `currentTime` salvo (per `watch-page/TD-05`)
- "…more" click → expande a descrição; "Show less" click → recolhe para 3 linhas; o controle só aparece quando o texto excede 3 linhas (resolução OQ-3; per `watch-page/TD-09`)
- Share click → copia `${origin}/watch/{publicId}` e mostra a confirmação de cópia do `CopyLinkButton`
- "⋮" click → abre o menu; "Download" → navega para `download_url` (o storage responde com `Content-Disposition: attachment`)
- Card de sugestão click → navega para `/watch/{publicId}` do card (`<Link>`)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VIDEO_NOT_FOUND` | `notFound()` → página `not-found` da rota (inexistente, `publicId` malformado ou rascunho alheio — não revela existência) |
| `VIDEO_NOT_READY` | Placeholder no lugar do player com o status do processamento (só o dono chega aqui); título, canal e descrição renderizam normalmente |
| `STORAGE_UNAVAILABLE` | Placeholder de erro no lugar do player com ação "tentar novamente" (`router.refresh()`) |
| 401 (sem errorCode) | RSC: token da sessão expirado → nova leitura **anônima** (a rota é pública); BFF: refresh e, se falhar, nova tentativa anônima |
| 429 (sem errorCode) | Registro de visualização: ignorado em silêncio; renovação do playback: mesmo placeholder de erro do 503 |

**Client-side validation mirror:** _Nenhum formulário nesta tela._

**Accessibility notes:**
- Rótulos acessíveis nos controles do player que acompanham o estado: "Play"/"Pause", "Mute"/"Unmute", "Enter full screen"/"Exit full screen"; o estado tocando/pausado é anunciado pelo rótulo do botão
- Slider de progresso e de volume com teclado (setas/Home/End do Radix Slider) e `aria-valuetext` legível (ex.: "0:20 de 4:56")
- O controle "…more"/"Show less" é um `<button>` com `aria-expanded` refletindo o estado da descrição

### UI ↔ API Traceability Matrix

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Carregar o vídeo pelo `publicId` da URL e renderizar a página para visitante anônimo | Watch page — RSC da rota | /watch/{publicId} | GET /videos/{publicId} (RSC via `upstream`) | watch-page/TD-03 |
| Abrir vídeo unlisted somente pelo link direto, sem listá-lo nas sugestões | Watch page — RSC da rota; Sidebar de sugestões | /watch/{publicId} | GET /videos/{publicId}; GET /videos/{publicId}/related (RSC via `upstream`) | watch-page/TD-04, watch-page/TD-06 |
| Reproduzir o vídeo a partir da URL de stream com play/pause, volume e busca na barra de progresso | VideoPlayer | /watch/{publicId} | GET /videos/{publicId}/playback (RSC via `upstream`) | watch-page/TD-05 |
| Renovar a URL de reprodução expirada e retomar do mesmo ponto | VideoPlayer | /watch/{publicId} | GET /api/videos/{publicId}/playback → forwards-to GET /videos/{publicId}/playback | watch-page/TD-05 |
| Registrar uma visualização após o limiar de reprodução | VideoPlayer | /watch/{publicId} | POST /api/videos/{publicId}/views → forwards-to POST /videos/{publicId}/views | watch-page/TD-01, watch-page/TD-02, watch-page/TD-03 |
| Exibir a contagem de visualizações e o tempo de publicação | Bloco de descrição | /watch/{publicId} | GET /videos/{publicId} (RSC via `upstream`) | watch-page/TD-01 |
| Exibir a descrição do vídeo recolhida ou expandida | Bloco de descrição | /watch/{publicId} | GET /videos/{publicId} (RSC via `upstream`) | watch-page/TD-09 |
| Exibir título e canal do vídeo (avatar, nome e link para o canal) abaixo do player | Canal do vídeo — avatar + nome | /watch/{publicId} | GET /videos/{publicId} → `channel` (RSC via `upstream`) | watch-page/TD-06 |
| Exibir sugestões de vídeos da mesma categoria na sidebar | Sidebar de sugestões; Card de sugestão horizontal | /watch/{publicId} | GET /videos/{publicId}/related (RSC via `upstream`) | watch-page/TD-04 |
| Baixar o arquivo do vídeo | Item "Download" no menu "⋮" | /watch/{publicId} | GET /videos/{publicId}/playback → `download_url` (RSC via `upstream`) | watch-page/TD-08 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix._

---

## Dependency Map

```
SI-05.0.1 (root — shadcn slider)
├── SI-05.0.2 — depends on SI-05.0.1 (teste do primitivo instalado)
└── SI-05.0.5 — depends on SI-05.0.1 + SI-05.0.3 + SI-05.0.4 (player-controls usa slider e ícones)
SI-05.0.3 (root — ícones)
└── SI-05.0.4 — depends on SI-05.0.3 (download-menu-item usa download-icon)
SI-05.0.6 (root — video-description)
SI-05.11.0 — depends on SI-05.0.1, SI-05.0.3, SI-05.0.4, SI-05.0.5, SI-05.0.6 (audit lê os componentes do disco)
└── SI-05.11a — depends on SI-05.11.0 + bootstrap (aplica as decisões e monta o shell)

SI-05.1 (root — IP real atrás do BFF)
├── SI-05.4 — depends on SI-05.1 + SI-05.3 (dedup anônima usa o IP real)
└── SI-05.8 — depends on SI-05.1 (BFF encaminha o IP que a API passa a confiar)
SI-05.2 (root — VideoResponse com channel)
SI-05.3 (root — VideoView)
├── SI-05.4 — depends on SI-05.3 (registro grava em video_views)
└── SI-05.5 — depends on SI-05.3 (limpeza apaga de video_views)
SI-05.6 (root — /related)
SI-05.7 — depends on SI-05.2 + SI-05.4 + SI-05.6 (contratos novos na cadeia OpenAPI)
└── SI-05.9 — depends on SI-05.7 + SI-05.8 (rotas do BFF tipadas e com sessão opcional)
    └── SI-05.10 — depends on SI-05.9 + SI-05.0.5 (player chama /playback e /views do BFF)
        ├── SI-05.11b — depends on SI-05.11a + SI-05.2 + SI-05.4 + SI-05.6 + SI-05.7 + SI-05.8 + SI-05.10 (wiring da tela)
        └── SI-05.12 — depends on SI-05.10 (preview do estúdio reusa o player)
```

Cross-layer edges: `SI-05.11b` (frontend: wiring da watch page) depende dos endpoints `SI-05.2`, `SI-05.4` e `SI-05.6` (backend) via `SI-05.7` (contrato) e `SI-05.8`/`SI-05.9` (BFF); `SI-05.8` (frontend) depende de `SI-05.1` (backend + compose dos dois stacks).

---

## Deliverables

- [ ] SI-05.0.1 — Infra: install batch shadcn primitives
- [ ] SI-05.0.2 — Tests shadcn batch (≤5 files)
- [ ] SI-05.0.3 — Custom-business simple group: download-icon + fullscreen-icon + pause-icon + share-icon + volume-icon
- [ ] SI-05.0.4 — Custom-business simple group: volume-off-icon + download-menu-item + related-videos + video-channel-link
- [ ] SI-05.0.5 — Custom-business complex: player-controls
- [ ] SI-05.0.6 — Custom-business complex: video-description
- [ ] SI-05.1 — Infra: IP real do visitante atrás do BFF (TRUST_PROXY + throttler)
- [ ] SI-05.2 — Endpoint GET /videos/{publicId} passa a devolver o canal
- [ ] SI-05.3 — Criar o registro de deduplicação de visualizações (VideoView)
- [ ] SI-05.4 — Endpoint POST /videos/{publicId}/views
- [ ] SI-05.5 — Job agendado video-views.cleanup
- [ ] SI-05.6 — Endpoint GET /videos/{publicId}/related
- [ ] SI-05.7 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- [ ] SI-05.8 — BFF: IP do visitante e sessão opcional nas chamadas ao upstream
- [ ] SI-05.9 — Route Handlers BFF de playback e visualizações
- [ ] SI-05.10 — Componente VideoPlayer (mídia, renovação da URL e registro de visualização)
- [ ] SI-05.11.0 — Drift audit: Página de visualização do vídeo (Video show)
- [ ] SI-05.11a — Tela de Página de visualização do vídeo (visual shell)
- [ ] SI-05.11b — Tela de Página de visualização do vídeo (lógica & wiring)
- [ ] SI-05.12 — Reusar o VideoPlayer no preview do estúdio

**Per-screen deliverables:**

- [ ] Screen Página de visualização do vídeo (`/watch/{publicId}`) is routable
- [ ] Screen Página de visualização do vídeo (`/watch/{publicId}`) renders loading, success, and error states (404 `not-found`, 409 processando, 503 com "tentar novamente")
- [ ] Screen Página de visualização do vídeo (`/watch/{publicId}`) passes component tests (per testing-guide-next-frontend layers)

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type/compilation checks pass (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] OpenAPI chain in sync (`docker compose exec nestjs-api npm run openapi:export` → `bash scripts/sync-openapi.sh` → `docker compose exec next-frontend npm run openapi:types`; `types.gen.ts` sem diff)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend type/compilation checks pass (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] Frontend E2E tests pass (`cd next-frontend && docker compose exec next-frontend npm run build`, `docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"`, then on the host `node node_modules/@playwright/test/cli.js test`)
