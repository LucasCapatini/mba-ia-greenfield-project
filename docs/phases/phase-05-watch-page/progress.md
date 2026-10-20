# phase-05-watch-page — Progress

**Status:** completed
**SIs:** 20/20 completed

### SI-05.0.1 — Infra: install batch shadcn primitives
- **Status:** completed
- **Tests:** no tests (Infra); `npx tsc --noEmit` exit 0
- **Observations:**
  - `npx shadcn@latest add slider` resolveu o alias de utils como o pacote npm `cn` (0.5.0, sem relação com o projeto): adicionou-o ao `package.json`/`package-lock.json` e gerou `import { cn } from "cn"`. O pacote foi desinstalado, os manifestos restaurados e o import corrigido para `@/lib/utils` (igual aos demais primitivos). Vale investigar o `components.json`/versão do CLI antes do próximo `shadcn add` (fora do escopo desta SI).
  - `TaskCreate` não está disponível neste ambiente; o `progress.md` é a lista de SIs da sessão.

### SI-05.0.2 — Tests shadcn batch (≤5 files)
- **Status:** completed
- **Tests:** 5 passing (`components/ui/__tests__/slider.test.tsx`)
- **Observations:**
  - jsdom não tem `ResizeObserver` (usado pelo Radix Slider para medir o thumb); o teste define um stub local em `beforeAll`, sem mexer no setup global do Vitest.
  - O wrapper gerado repassa `aria-label` só ao `Root`; para um nome acessível nos thumbs (progresso/volume do player) será preciso passar `aria-label` ao `Thumb` — a decidir no drift audit (SI-05.11.0) / player-controls (SI-05.0.5).
  - O `slider.tsx` ainda usa as classes padrão do shadcn (`bg-muted`, `bg-primary`, `bg-white`); a reconciliação com os tokens do Figma fica para o drift audit da watch page (SI-05.11.0 → SI-05.11a).

### SI-05.0.3 — Custom-business simple group: download-icon + fullscreen-icon + pause-icon + share-icon + volume-icon
- **Status:** completed
- **Tests:** no tests (icons — testing-guide-next-frontend § "Icons"); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - Ícones desenhados em grade 24×24 a partir da referência `docs/inventories/assets/phase-05/Video show.png` (Figma MCP indisponível — OQ-6), sem copiar paths de bibliotecas de ícones; o drift audit (SI-05.11.0) confere os glifos quando a Figma MCP voltar.
  - `fullscreen-icon.tsx` exporta o par `FullscreenIcon` + `ExitFullscreenIcon`, conforme o UI Contract.

### SI-05.0.4 — Custom-business simple group: volume-off-icon + download-menu-item + related-videos + video-channel-link
- **Status:** completed
- **Tests:** 8 passing (download-menu-item 3, related-videos 3, video-channel-link 2); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - `video-channel-link.tsx` usa o primitivo `Avatar` (`size="lg"`) + `getInitials` exportado por `components/channel/channel-avatar.tsx` em vez do próprio `ChannelAvatar`: este é fixo em 128 px com iniciais em `text-h1`, grande demais para a linha do canal sob o título. O tamanho exato do avatar no frame fica para o drift audit (SI-05.11.0).
  - `download-menu-item.tsx` renderiza o item como `<a href={downloadUrl} download>` via `asChild` — navegação para a URL assinada do storage (externa), não `next/link`.
  - `related-videos.tsx` usa o `VideoCard` vertical atual; a variante horizontal com duração entra pelas decisões do drift audit (SI-05.11.0 → SI-05.11a).

### SI-05.0.5 — Custom-business complex: player-controls
- **Status:** completed
- **Tests:** 12 passing (player-controls 6, slider 6 — 1 caso novo); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - `components/ui/slider.tsx` ganhou duas props opcionais e aditivas, `thumbLabel` e `thumbValueText`, aplicadas como `aria-label`/`aria-valuetext` em cada thumb: o wrapper gerado pelo shadcn não nomeava o elemento com `role="slider"`, e os critérios de aceite exigem rótulos acessíveis ("Seek" "0:20 of 4:56", "Volume" "80%"). Coberto por um caso novo em `slider.test.tsx`.
  - O slider de volume fica recolhido (`w-0 opacity-0`) e abre em hover/foco do grupo; o frame não desenha o estado aberto — conferir no drift audit (SI-05.11.0).
  - A faixa de buffer é uma camada `aria-hidden` sob o trilho do seek slider; as cores do slider seguem as do shadcn até o drift audit.

### SI-05.0.6 — Custom-business complex: video-description
- **Status:** completed
- **Tests:** 5 passing (`components/watch/__tests__/video-description.test.tsx`); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - O overflow das 3 linhas é medido num callback de `requestAnimationFrame` e no `resize` da janela (nunca com `setState` síncrono no corpo do efeito, que o lint do React Compiler acusa); o teste simula a medição com spies em `scrollHeight`/`clientHeight`, já que o jsdom não faz layout.
  - Fundo do bloco = `bg-muted` com `rounded-[var(--radius-4)]` ("fundo/borda sutil" do inventário); o valor exato do frame fica para o drift audit (SI-05.11.0).

### SI-05.1 — Infra: IP real do visitante atrás do BFF (TRUST_PROXY + throttler)
- **Status:** completed
- **Tests:** 22 passing — unit 20 (`throttler-behind-proxy.guard.spec.ts` 2, `env.validation.spec.ts` 18 com 4 casos novos de `TRUST_PROXY`), e2e 2 (`test/throttler-proxy.e2e-spec.ts`); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - Rede `streamtube` recriada com sub-rede fixa `172.30.0.0/24`; `next-frontend` em `172.30.0.10` (verificado). Recriar o stack apagou os dados do Postgres de desenvolvimento (o `db` não tem volume nomeado) — autorizado pelo usuário; `migration:run` reaplicado. Os objetos no RustFS (volume nomeado) foram mantidos, mas não têm mais linhas correspondentes no banco.
  - `TRUST_PROXY=172.30.0.10` acrescentado ao `.env` local (gitignored) e ao `.env.example`; API e `video-worker` sobem com a variável validada ("Queue ready").
  - Risco residual: os IPs dinâmicos dos containers do backend saem do mesmo pool (`172.30.0.2`–`.6` hoje); só colidiriam com `.10` se o stack chegasse a 9+ containers antes do frontend subir. Um `ip_range` no `ipam` eliminaria o risco — fora do escopo desta SI.
  - Os arquivos editados usam CRLF no checkout; as edições preservaram o final de linha (o `prettier --write` foi rodado só em `src/config/env.validation.spec.ts`).
  - Pendência fora do escopo: dar ao `db` um volume nomeado evitaria a perda de dados em futuras recriações de rede.

### SI-05.2 — Endpoint GET /videos/{publicId} passa a devolver o canal
- **Status:** completed
- **Tests:** 73 passing — unit 55 (`videos.service.spec.ts`, 2 casos novos), integration 15 (`videos.service.integration-spec.ts`, 1 caso novo), e2e 3 (`test/videos-get.e2e-spec.ts`, gerado de `specs/videos-get.plan.md`); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - `VideoCardChannel` foi movido para antes de `VideoResponse` em `video-response.dto.ts`: com `emitDecoratorMetadata`, referenciá-lo como tipo de propriedade antes da declaração daria TDZ em runtime.
  - `ChannelsService.findById(id)` foi criado para o `VideosService` resolver o canal quando a relação não vem carregada (ex.: vídeo relido por `findOneBy`); `VideosOwnership` passou a carregar a relação `channel` junto com `upload` e `category`.
  - Prettier rodado só nos 3 arquivos tocados que o lint acusou (quebra de linha), conforme a regra de não formatar a árvore CRLF inteira.

### SI-05.3 — Criar o registro de deduplicação de visualizações (VideoView)
- **Status:** completed
- **Tests:** 14 passing — `video-view.entity.integration-spec.ts` 4, `migrations.integration-spec.ts` 10 (2 casos novos); todas as migrations aplicadas; `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - Migration `1792458459333-CreateVideoViews` gerada pelo `migration:generate`, formatada com prettier e aplicada no banco de desenvolvimento.
  - `video_views` entrou em `ENTITIES`, nos `forFeature` do `VideosModule` e do `WorkerModule` e em `cleanAllTables` (antes de `videos`, na ordem das FKs).
  - A suíte `migrations.integration-spec.ts` (Fase 04) quebrou ao ganhar uma migration nova: o teste de backfill desfazia "a última" supondo que fosse `ExtendVideosForPublishing`. Corrigido com um helper `undoThrough(name)` que desfaz do topo até a migration nomeada — 1 tentativa de correção; o teste não depende mais da posição.
  - `eslint` sobre diretórios inteiros acusa parsing errors nos shims `src/test/*.cjs` (fora do `tsconfig`); o script `lint` do projeto só cobre `*.ts`, então não é regressão — vale saber ao rodar o eslint à mão.

### SI-05.4 — Endpoint POST /videos/{publicId}/views
- **Status:** completed
- **Tests:** 32 passing — unit 8 (`video-views.service.spec.ts` 7, `videos.module.spec.ts` 1), integration 19 (`video-views.service.integration-spec.ts` 4, `videos.service.integration-spec.ts` 15), e2e 5 (`test/videos-views.e2e-spec.ts`, gerado de `specs/videos-views.plan.md`); `tsc --noEmit` e `eslint` exit 0
- **Observations:**
  - Deduplicação em uma transação: `INSERT … ON CONFLICT DO NOTHING RETURNING id` (`orIgnore` + `returning`) e `increment(view_count)` só quando a linha entrou; o caso de integração com `increment` falhando prova que a view não sobra sem o contador.
  - Chave anônima = `anon:` + HMAC-SHA256 com o `JWT_SECRET` (já obrigatório) sobre `dia UTC|IP|User-Agent` — o "salt diário" do TD-02 sem variável de ambiente nova; o IP nunca é persistido.
  - Rota usa `@Ip()` (= `req.ip`, resolvido pelo `trust proxy` de SI-05.1) e `@Headers('user-agent')`.
  - `VideoViewsService` injeta o namespace `auth`; os testes que montam o `VideosModule` com config parcial (`videos.module.spec.ts`, `videos.service.integration-spec.ts`) passaram a carregar `authConfig` — 1 tentativa de correção (junto com uma asserção de tipo desnecessária no mock do query builder).

### SI-05.5 — Job agendado video-views.cleanup
- **Status:** completed
- **Tests:** 2 novos em `video-views-cleanup.worker.integration-spec.ts` + 1 novo em `queue.service.integration-spec.ts`; `src/queue/` + `src/worker/` 12 suítes / 65 testes passando (`--runInBand`); `tsc --noEmit` limpo; eslint em `src/queue` e `src/worker` limpo
- **Observations:**
  - O plano pedia estender `queue.service.spec.ts` (unit), mas esse arquivo não existe: o `QueueService` só tem suíte de integração. O teste de `schedule()` foi para `src/queue/queue.service.integration-spec.ts` e confere direto em `pgboss.schedule` que o cron fica em UTC e que reagendar sobrescreve (uma linha, cron novo).
  - `QueueService.schedule()` reaproveita `QUEUE_SEND_DEFAULTS` da fila (retry 3, backoff, expire 300 s) e fixa `tz: 'UTC'`; o worker agenda em `onModuleInit` antes de `work()`, então reiniciar o `video-worker` só sobrescreve o agendamento.
  - O handler usa SQL cru (`DELETE … WHERE window_start < (now() AT TIME ZONE 'UTC')::date - $1`) para que o corte use o relógio do banco, o mesmo dos testes; retenção de 2 dias e cron em `worker.constants.ts`.
  - Pipeline documentado na seção `video-worker` do `nestjs-project/CLAUDE.md`.

### SI-05.6 — Endpoint GET /videos/{publicId}/related
- **Status:** completed
- **Tests:** 4 novos em `videos-listing.service.integration-spec.ts` (suíte 14/14) + `test/videos-related.e2e-spec.ts` 4/4 (spec `videos-related.plan.md`); `videos.module.spec`, `videos-get` e `swagger` e2e verdes; `tsc --noEmit` limpo; eslint em `src/videos` + o e2e novo limpo
- **Observations:**
  - `listRelated` faz duas consultas: a mesma categoria primeiro e, se faltar, as demais com `category_id IS DISTINCT FROM` (inclui vídeos sem categoria). Ordem `published_at DESC, id DESC`, com `innerJoinAndSelect` do canal para montar o `VideoCardItem` de canais diferentes.
  - Padrão 12 e teto 24 de `limit` em `RELATED_VIDEOS_DEFAULT_LIMIT` / `RELATED_VIDEOS_MAX_LIMIT` (`videos.constants.ts`).
  - O e2e semeia os vídeos direto no repositório, e não por `POST /videos` como o helper do spec descrevia: o cenário 1.1 cria 16 vídeos, e o throttler global (10/min por rota) recusaria os uploads. Isso não muda o que o endpoint testado faz.

### SI-05.7 — Sincronizar contrato OpenAPI, aliases e handlers MSW
- **Status:** completed
- **Tests:** sem testes próprios (sync de contrato). Vitest completo 84 arquivos / 554 testes passando; `tsc --noEmit` e `npm run lint` limpos no frontend. Os handlers foram conferidos com um teste descartável: related sem a origem e sem `unlisted-01`, rascunho anônimo 404, views 204 contando 1x, `storage-down-id` 503, `limit=30` 400. Frescor do OpenAPI: sync + `openapi:types` de novo não mudam os hashes.
- **Observations:**
  - Cadeia completa rodada: os dois `openapi.json` são idênticos e trazem `POST /videos/{publicId}/views`, `GET /videos/{publicId}/related` e `channel` em `VideoResponse`.
  - `contracts.ts` ganhou `RelatedVideos` e `RelatedVideosQuery`; o alias de playback já existia como `VideoPlayback` e não foi duplicado como `Playback`.
  - O handler de leitura do MSW passou a aplicar a regra pública do backend (anônimo não lê rascunho), que o spec `watch` exige para `/watch/processing-01`. Antes qualquer leitura devolvia o vídeo; nenhum teste existente dependia disso.
  - `unlisted-01` e `storage-down-id` entraram no store como ocultos (fora do painel e do canal), para não mudar a contagem de 22 vídeos dos specs do estúdio.
  - O `next-frontend` não tem prettier: um `npx prettier` baixou a ferramenta e converteu 4 arquivos para LF. O CRLF foi restaurado; o estilo do frontend é verificado só pelo eslint.

### SI-05.8 — BFF: IP do visitante e sessão opcional nas chamadas ao upstream
- **Status:** completed
- **Tests:** `lib/api/__tests__/client-headers.test.ts` 3/3, `bff.integration.test.ts` 4/4, `public-read.integration.test.ts` 2/2; `lib/auth/__tests__` continua verde (31 testes no total)
- **Observations:**
  - O plano mandava estender `lib/api/__tests__/bff.integration.test.ts`, mas a pasta não existia: o arquivo foi criado.
  - `withOptionalSession` repete anônimo sempre que o `withRefresh` devolve 401 — refresh falho (sessão destruída) ou token ainda recusado. É seguro porque o 401 vem do guard, antes do handler, então nada foi processado.
  - `publicRead` é genérico sobre o resultado do `openapi-fetch`, então o RSC mantém `data`/`error` tipados.
  - Passo 2 verificado com uma rota sonda temporária, um build de produção e `next start` (a rota e o servidor foram removidos depois). Quando o header não vem, o Next preenche `x-forwarded-for` com o IP do socket no formato `::ffff:172.30.0.x`: do host é o gateway, de outro container é o IP dele. Registrado no `next-frontend/CLAUDE.md`.
  - **Limitação de segurança (para decisão):** o Next mantém um `X-Forwarded-For` enviado pelo navegador (`??=`), e a API confia no BFF (`TRUST_PROXY`). Sem proxy reverso na frente, um visitante pode forjar o IP e escapar do throttler e da deduplicação anônima de views. Em deploy, um proxy precisa sobrescrever o header; documentado no `CLAUDE.md`. Pode virar ajuste de `watch-page/TD-03` via `/decide`.
  - Para testar de dentro da rede `streamtube` foi baixada a imagem `curlimages/curl:8.10.1`, removida em seguida.

### SI-05.9 — Route Handlers BFF de playback e visualizações
- **Status:** completed
- **Tests:** `playback/__tests__/route.integration.test.ts` 5/5, `views/__tests__/route.integration.test.ts` 3/3; `app/api/videos` 7 arquivos / 43 testes passando; `tsc --noEmit` e lint limpos
- **Observations:**
  - Os testes observam os headers enviados ao upstream por `server.events.on("request:start")`, sem sobrescrever os handlers compartilhados; os listeners são removidos no `afterEach`.
  - Além do plano, o teste de playback cobre o 503 `STORAGE_UNAVAILABLE` (trigger `storage-down-id`) e o 409 do dono com `Bearer` em `processing-01`. O de views confere que a segunda chamada não soma de novo no store.

### SI-05.10 — Componente VideoPlayer (mídia, renovação da URL e registro de visualização)
- **Status:** completed
- **Tests:** `use-media-state.test.ts` 8/8, `use-view-registration.test.ts` 7/7, `video-player.test.tsx` 7/7; `components/watch` + `hooks` 10 arquivos / 51 testes passando; `tsc --noEmit` e lint limpos
- **Observations:**
  - Registro de visualização: soma só deltas de `timeupdate` entre 0 e 1,5 s fora de `seeking`, então busca e salto não contam. Dispara ao chegar a `min(10, duration)`. No `ended`, só conta se a reprodução acumulada cobriu o vídeo menos 1 s (tolerância de um tick): avançar a barra até o fim sem assistir não conta. O acumulador zera por `publicId`.
  - Renovação da URL: um `error` do `<video>`, ou dar play com `expiresAt` vencido, busca `/api/videos/{id}/playback`, troca o `src` e, no `loadedmetadata`, volta ao tempo salvo e retoma se estava tocando. Uma tentativa por falha (o contador volta a zero no `playing`); falhou de novo → estado de erro "This video could not be loaded." com "Try again".
  - O `VideoPlayer` deve ser montado com `key={publicId}` na página, para que um vídeo novo comece limpo (documentado no componente).
  - Correção no `PlayerControls` (SI-05.0.5): a prop `onVolumeChange` colidia com o evento de mídia de mesmo nome das props de `div`; agora ela é omitida do tipo base. Só tipo, sem mudança de comportamento.
  - Indicador de buffering: `role="status"` "Loading" sobre o vídeo enquanto `waiting` e tocando; fundo do player com o token `bg-almost-black-1000`.

### SI-05.11.0 — Drift audit: Página de visualização do vídeo (Video show)
- **Status:** completed
- **Tests:** no tests (audit-only). `frontend-drift-report.md` criado com 19 componentes: 11 alinhado, 1 drift menor, 7 drift relevante, 0 ausente. Nenhum arquivo do `next-frontend` mudou nesta SI (hash de `git status` e `git diff` iguais antes e depois).
- **Observations:**
  - Figma MCP indisponível: auditoria feita contra `docs/inventories/assets/phase-05/Video show.png` + tokens de `app/globals.css` (resolução OQ-6). Sem `get_design_context`, os nomes das variantes novas (`overlay`, `secondary`, `pill`, `horizontal`) vêm do inventário e dos tokens/variantes já existentes no DS, não de propriedades do componente Figma. As medidas foram estimadas do PNG (export 2x).
  - O AC `git diff --name-only HEAD -- next-frontend` vazio não se aplica literalmente: o branch já tem mudanças das SIs anteriores ainda não commitadas. A verificação equivalente foi o tree do frontend inalterado durante a SI.
  - Drifts previstos pelo plano confirmados: `video-card.tsx` (variante horizontal + duração) e `copy-link-button.tsx` (variante pill "Share"). O `copy-link-button` fica em `components/studio/` (importável de qualquer rota); mover o arquivo seria `BREAKING(rename)` sem ganho.
  - Drifts além do previsto: `slider.tsx` (trilho/range invisíveis sobre o player: `bg-muted`/`bg-primary`) + `player-controls.tsx` (consumir a variante), `icon-button.tsx` (gatilho "⋮" circular), `related-videos.tsx` (usar o card horizontal) e `video-description.tsx` (caixa com borda e texto body-lg).
  - `app-header.tsx` como `exception`: busca, microfone, "+", hambúrguer e menu da conta são da Fase 07 (decisão do inventário).
  - Controles extras do player desenhados no frame (próximo, capítulos, autoplay, CC, configurações, miniplayer, teatro) ficam fora por `watch-page/TD-05` (Revisions 2026-10-19); por isso `player-controls` não tem bullet sobre eles.

### SI-05.11a — Tela de Página de visualização do vídeo (visual shell)
- **Status:** completed
- **Tests:** sem testes próprios (shell). Vitest completo 92 arquivos / 593 testes passando; `tsc --noEmit` e lint limpos. Smoke no build de produção com `MSW_ENABLED=true`: `/watch/published-01` e `/watch/unlisted-01` → 200; `/watch/notfound-id` e `/watch/processing-01` (rascunho, anônimo) → 404. O HTML traz `<video src=… poster=… preload="metadata">`, título, Share, "More actions" e a sidebar. Screenshot 1440px conferido contra `Video show.png`.
- **Observations:**
  - Decisões do drift report aplicadas: `slider.tsx` (+variant `overlay` via `cva` em track/range/thumb, `data-variant` no root), `player-controls.tsx` (as duas barras com `variant="overlay"`), `icon-button.tsx` (+variant `secondary`; o `rounded-full` foi para `compoundVariants` porque as classes de `size` vêm depois no `cva` e o raio do tamanho venceria), `copy-link-button.tsx` (+variant `pill` = `Button` secondary redondo com `ShareIcon` + "Share", mesmo feedback de cópia), `video-description.tsx` (borda + `bg-background`, meta e texto em `text-body-lg`), `related-videos.tsx` (card horizontal) e `video-card.tsx` (+variant `horizontal` com `VideoThumbnail` `w-42` e duração; +`duration_seconds` opcional em `VideoCardData`).
  - Página `app/(app)/watch/[publicId]/page.tsx` (RSC) + `not-found.tsx` ("Video not found"). Vídeo lido por `lib/watch/get-watch-video.ts` (`cache()` + `publicRead`, compartilhado com `generateMetadata`); playback (só `ready`) e related em paralelo; `VideoPlayer` com `key={publicId}`. Duas colunas em `lg` (conteúdo `flex-1` + sidebar `w-100`), empilhadas abaixo disso. Enquanto não há playback, o espaço do player é uma caixa escura; os placeholders 409/503 entram na SI-05.11b.
  - Novo `lib/request-origin.ts` (origem pública para o link do Share). A página de edição do estúdio mantém a cópia local dessa função; unificar fica como follow-up fora de escopo.
  - Achados na verificação visual, corrigidos no `PlayerControls`: (1) `text-overlay` gerava também a cor do token `--color-overlay` (#00000080), que vencia o `text-neutral-100` e deixava o tempo quase invisível; agora `text-body-lg`. O nome compartilhado entre `--text-overlay` e `--color-overlay` é uma armadilha do registro de tokens, a avaliar à parte. (2) O thumb do volume recolhido aparecia com o player desabilitado (`data-disabled:opacity-50` do Slider); agora `data-disabled:opacity-0`.
  - Lint: com a rota `/watch` existindo, `@next/next/no-html-link-for-pages` passou a acusar `<a href="/watch/…">` em `components/channel/__tests__/channel-video-grid.test.tsx`; os filhos de teste viraram `<Link>`, sem mudar o que o teste verifica.
  - O header anônimo segue com "Entrar" / "Criar conta" (exception do audit — navbar completa é da Fase 07).

### SI-05.11b — Tela de Página de visualização do vídeo (lógica & wiring)
- **Status:** completed
- **Tests:**
  - Unit: `player-placeholder.test.tsx` 3/3; `video-player.test.tsx` +1 (8/8).
  - E2E (spec `watch.plan.md` → `tests/watch.e2e-spec.ts`): 7/7 contra o build de produção com MSW. Suíte Playwright completa 57/57.
  - Vitest completo 93 arquivos / 597 testes passando; `tsc --noEmit` e lint limpos.
- **Observations:**
  - Rota pública, sem guard: o `proxy.ts` continua restrito a `/studio/**`. A leitura via `publicRead`, o `generateMetadata` e a ligação dos endpoints já tinham entrado na SI-05.11a.
  - Mapeamento de erros na página:
    - vídeo não `ready` (só o dono chega lá; a API daria 409 `VIDEO_NOT_READY`) → `PlayerPlaceholder mode="processing"` com o status (uploading / processing / failed + `describeProcessingError`);
    - falha do playback (503, 429…) → `mode="error"` com "Try again" (`router.refresh()`);
    - 404 do playback (corrida) → `notFound()`;
    - related com erro → sidebar omitida.
  - Rótulos em inglês ("Try again", "This video can't be played right now.") como o resto da UI; o spec cita "tentar novamente" em prosa e o E2E usa o rótulo real.
  - Fixture `tests/fixtures/watch-sample.webm` (46 KB, 2 s, VP9/Opus, 320×240) gerada com o ffmpeg do `nestjs-api` (mesmo `testsrc` + `sine` de `src/test/video-fixtures.ts`).
  - **Bug do player achado pelo E2E e corrigido:** o `expires_at` do playback no MSW era uma data fixa no passado, então todo Play pedia uma URL nova. Como a URL voltava igual, o `<video>` não recarregava, o `loadedmetadata` não chegava e a reprodução nunca começava. O mesmo aconteceria com o relógio do cliente adiantado.
    - Correção no `VideoPlayer`: URL renovada igual à atual → volta ao tempo salvo e toca na hora.
    - URL renovada já vencida pelo relógio local → o player para de confiar em `expiresAt` e passa a depender só do `error` do `<video>`.
    - Teste unitário novo para esse caso.
    - O mock de `/playback` passou a usar `PLAYBACK_EXPIRES_AT` futuro; o `UPLOAD_EXPIRES_AT` dos uploads não mudou.
  - Locators do E2E: o link do canal usa `exact: true` (os cards da sidebar também contêm "Studio Canal"); o alerta fica restrito ao `main` (o anunciador de rota do Next também tem `role="alert"`).

### SI-05.12 — Reusar o VideoPlayer no preview do estúdio
- **Status:** completed
- **Tests:** `video-preview.test.tsx` estendido (player com controles próprios e sem `controls` nativo; nenhum `POST …/views` após 15 s de `timeupdate` + `ended`; placeholder sem URL) — `components/studio` + `components/upload` 22 arquivos / 193 passando; Vitest completo 93 / 598; `tsc --noEmit` e lint limpos; E2E completo 57/57 no build de produção com MSW
- **Observations:**
  - `VideoPreview` recebe `publicId` (obrigatório) e `expiresAt`: com `streamUrl` + `expiresAt` renderiza o `VideoPlayer` com `trackViews={false}`, `key={publicId}`, `role="region"` + `aria-label="Preview of {title}"` (mantém o nome acessível do preview) e `className="size-full rounded-none"` para caber na caixa de 166px do CardVideoConfig. Sem URL, o placeholder com a duração continua.
  - `VideoEditForm` ganhou `streamExpiresAt` (repassado ao preview junto com `video.public_id`); a página de edição lê `playback.data.expires_at` ao lado do `stream_url`. A tela de upload em processamento não passa `streamUrl` (o vídeo ainda não está pronto) e segue com o placeholder.
  - Verificado no build de produção: o dono logado reproduz o preview de `published-01` até o fim e nenhuma requisição a `/views` sai do navegador.

## Final verification (2026-10-19)

- Backend: unit + integração 61 suítes / 529 testes; e2e 18 suítes / 124 testes; `tsc --noEmit` limpo; eslint (`{src,apps,libs,test}/**/*.ts`, `--max-warnings 0`, sem `--fix`) limpo.
- Frontend: Vitest 93 arquivos / 598 testes; `tsc --noEmit` limpo; lint limpo; build de produção ok; Playwright 57/57 contra `next start` com MSW.
- Cadeia OpenAPI: `openapi:export` → `sync-openapi.sh` → `openapi:types` rodada de novo sem diferença (hashes iguais nos dois `openapi.json` e no `types.gen.ts`).
- Correção feita na verificação: `src/videos/videos-ownership.spec.ts` ainda esperava as relações `[upload, category]`; o SI-05.2 incluiu `channel` e o teste unitário não tinha sido rodado. Asserção e nome do teste atualizados (1 tentativa).
