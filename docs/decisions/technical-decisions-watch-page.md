---
scope_type: phase
related_phases: [5]
status: decided
date: 2026-10-19
scope_description: "Fase 05 — página de visualização do vídeo, backend + frontend: gatilho e contrato da contagem de visualizações, deduplicação anti-inflação, IP real do cliente atrás do BFF (throttling das leituras anônimas e chave do espectador), contrato e critério das sugestões da mesma categoria, implementação do player (play/pause, volume, progresso), rota pública da watch page (OQ-5 herdado da Fase 04) e estratégia de testes do player/reprodução com o E2E sobre MSW."
---

# Technical Decisions — Fase 05: Página de Visualização do Vídeo

_Subprojects in scope:_

- `nestjs-project/` — recebe o registro de visualização e sua deduplicação, o endpoint de sugestões e o ajuste de identificação do cliente real no `ThrottlerGuard`. TD-01, TD-02, TD-03 e TD-04 o afetam. As leituras `GET /videos/{publicId}` e `GET /videos/{publicId}/playback` já existem com autenticação opcional e a regra de visibilidade (`video-channel-management/TD-07`) — não há decisão aberta sobre elas.
- `next-frontend/` — recebe a watch page (RSC), o player, a sidebar de sugestões, a descrição expansível, o botão de download e os BFFs novos. TD-05, TD-06, TD-07 e TD-09 são exclusivos dele; TD-01, TD-03, TD-04 e TD-08 são contratos que ele consome. Sem decisão aberta (composição sobre o que já foi decidido): **leitura da página** (RSC via `upstream`, `video-channel-management/TD-12`). _(2026-10-19: a descrição expansível e o download, antes listados aqui como composição, ganharam TD-09 e TD-08 a partir de MD-1/MD-2 do `/plan-validate 5`.)_
- repositório (raiz) — nenhuma decisão repo-wide aberta: nenhum serviço novo no compose nem mudança de CI. A chave de ambiente introduzida por TD-03 (Option A) é consequência de um TD Cross-layer, não um TD próprio.

_Decisões herdadas que esta fase NÃO reabre:_ URLs GET pré-assinadas para stream/download com `PLAYBACK_URL_TTL` (`phase-03-upload-processing/TD-09`); `public_id` de 11 caracteres (`TD-08`); allowlist de formatos MP4/WebM com H.264/VP8/VP9/AV1 (`TD-14`); pg-boss (`TD-04`); `status` + `visibility` + `published_at` (`video-channel-management/TD-02`); contadores denormalizados `view_count`/`like_count`/… em `videos` (`TD-05` — esta fase passa a escrever `view_count`); cursor keyset `{ items, next_cursor }` (`TD-06`); autenticação opcional nas leituras públicas com "rascunho alheio → 404" (`TD-07`); thumbnails com URL estável anônima (`TD-10`); RSC + BFF + `router.refresh()` sem TanStack Query (`TD-12`); sessão `iron-session`, mutações por Route Handler + `fetch` (`phase-02-auth-frontend/TD-01..TD-06`); `@nestjs/throttler` como mecanismo de rate limit (`phase-02-auth/TD-08`); cadeia OpenAPI → `types.gen.ts`; MSW por domínio com `setupServer` server-side no E2E (`next-frontend-msw-foundation`).

_Observação sobre o Figma:_ `docs/figma-audit.json` contém apenas tokens; o inventário da Fase 04 registra que o `CardVideoConfig` exibe o link `streamtube.com/v/{id}` e que "o player em si é escopo da fase 05". O `/screen-inventory 5` precisa confirmar o frame da watch page (controles do player, layout da sidebar) — TD-05 e TD-06 dependem dessa leitura para fechar.

_Pesquisa:_ o MCP `context7` não está disponível neste ambiente; as versões foram conferidas no npm registry e as APIs na documentação oficial via WebFetch (NestJS rate limiting — seção "Proxies"; Video.js v10; guia `videos.md` empacotado em `node_modules/next/dist/docs/`). Versões instaladas: `@nestjs/throttler` ^6.5.0, `@nestjs/platform-express` ^11, `next` 16.2.6, `react` 19.2.4, `tailwindcss` 4.2.4, `radix-ui` 1.4.3 (`@radix-ui/react-slider` 1.3.6), `@playwright/test` 1.60.0, `msw` ^2.14.6.

---

## TD-01: Gatilho e contrato do registro de visualização

**Scope:** Cross-layer

**Capability:** Contagem de visualizações

**Context:** `videos.view_count` existe desde a Fase 04 e é exibido como 0 no painel, no card do canal e (agora) na watch page; esta fase decide **o que conta como uma visualização** e **quem dispara o incremento**. A watch page é um RSC dinâmico que já buscará `GET /videos/{id}` e `GET /playback` a cada render (inclusive `router.refresh()` e prefetch de `<Link>`), então "renderizar a página" e "assistir" são eventos diferentes. Cross-layer: define se existe um endpoint de escrita novo (API + BFF + OpenAPI) e se o player no navegador participa.

**Options:**

### Option A: Contar na emissão das URLs de reprodução (`GET /videos/{id}/playback`)
- O serviço incrementa `view_count` sempre que emite `stream_url` para um vídeo `published`; nada muda no frontend.
- **Pros:** zero contrato novo; impossível "esquecer" de contar; uma única escrita por render.
- **Cons:** conta render, não reprodução — refresh, prefetch, bots e o próprio `router.refresh()` inflam o número; transforma uma leitura `GET` idempotente em escrita (cache/retry passam a ter efeito colateral); o dono pré-visualizando o rascunho contaria (precisa de exceção).

### Option B: Endpoint dedicado `POST /videos/{publicId}/views` disparado pelo player após um limiar de reprodução
- O player chama o BFF (`POST /api/videos/{id}/views`, 204) uma única vez por carregamento da página quando o tempo efetivamente reproduzido atinge um limiar (ex.: 10 s, ou o vídeo inteiro se for mais curto); a API aplica a deduplicação (TD-02) e incrementa `view_count` na mesma transação. O número exibido continua vindo do RSC (não atualiza ao vivo).
- **Pros:** mede reprodução real, como as plataformas de referência; `GET` continuam sem efeito colateral; o ponto único de escrita concentra regras (dono não conta, rascunho não conta, dedup); autenticação opcional reaproveitada de `video-channel-management/TD-07`.
- **Cons:** contrato novo nas três camadas (rota Nest, Route Handler, `types.gen.ts`, handler MSW); depende de JavaScript no cliente (aceitável — o player já depende); o limiar é uma política a documentar e testar.

### Option C: Beacon de saída (`navigator.sendBeacon`) com o tempo assistido
- Ao sair/ocultar a página, o cliente envia `{ watched_seconds }`; a API decide se conta.
- **Pros:** dado mais rico (permite métricas de retenção futuras); uma requisição por sessão de página.
- **Cons:** `pagehide`/`visibilitychange` são perdidos com frequência (fechamento abrupto, mobile), subcontando; `sendBeacon` não carrega o header `Authorization` — exige BFF lendo a sessão e um corpo `text/plain`/`Blob`; complexidade sem consumidor para as métricas extras no plano.

**Recommendation:** **Option B (`POST …/views` após limiar de reprodução)** — é a única que mede "assistiu" em vez de "renderizou", mantém as leituras `GET` puras (o RSC da watch page re-renderiza com frequência por `router.refresh()`) e dá à API um ponto único para dedup e exclusões (dono, rascunho). Parâmetro a fixar junto: limiar de 10 s de reprodução acumulada (ou fim do vídeo, se mais curto), um disparo por carregamento da página. Depende de TD-02 (dedup) e TD-03 (identidade do anônimo).

**Decision:** B (`POST /videos/{publicId}/views` disparado pelo player via BFF após 10 s de reprodução acumulada — ou fim do vídeo, se mais curto —, um disparo por carregamento da página; `GET` continuam sem efeito colateral)

---

## TD-02: Deduplicação e anti-inflação da contagem de visualizações

**Scope:** Backend

**Capability:** Contagem de visualizações

**Context:** depende de TD-01 e TD-03. Qualquer pessoa — inclusive anônima — pode assistir; sem deduplicação, um `for` em `curl` (ou recarregar a página) infla `view_count` indefinidamente. A decisão é **qual identidade** representa um espectador e **qual janela** separa duas visualizações contáveis. A escolha cria (ou não) uma tabela nova e condiciona o volume de escrita por visualização.

**Options:**

### Option A: Sem deduplicação — incremento atômico + rate limit
- `UPDATE videos SET view_count = view_count + 1` a cada `POST …/views`; o abuso é contido apenas pelo throttler (TD-03).
- **Pros:** uma escrita, nenhuma tabela nova, trivial de testar.
- **Cons:** cada recarga conta; o throttler limita a taxa, não a repetição (10/min por IP ainda são 14 mil views/dia de um único cliente); não atende ao espírito do ponto de atenção "evitar abusos".

### Option B: Tabela `video_views` com chave de espectador + janela (ex.: 24 h)
- Chave = `user:{id}` quando autenticado, senão `anon:{hash(salt diário + IP real + User-Agent)}`; `INSERT … ON CONFLICT (video_id, viewer_key, window_start) DO NOTHING` e só incrementa `view_count` se a linha entrou, na mesma transação. Linhas de janelas vencidas são apagadas por um job periódico do pg-boss.
- **Pros:** recarregar/insistir não infla; o hash com salt rotativo não guarda IP em claro; contagem continua O(1) na leitura (o contador denormalizado de `video-channel-management/TD-05` permanece a fonte da exibição); base para métricas futuras.
- **Cons:** tabela nova + índice único + job de limpeza; depende do IP real do cliente chegar à API (TD-03); NAT compartilhado (escritório, rede móvel) subconta anônimos distintos na mesma janela.

### Option C: Cookie anônimo de espectador emitido pelo BFF + mesma tabela
- O BFF cria um cookie `httpOnly` `viewer_id` (UUID) e o encaminha como chave dos anônimos; autenticados usam o `user.id`.
- **Pros:** não depende de IP (sem subcontagem por NAT); independente de TD-03.
- **Cons:** um cliente sem cookies (bot, `curl`) gera uma chave nova por requisição — a inflação volta a ser limitada só pelo throttler; contrato extra BFF↔API (header com o `viewer_id`) e um cookie novo a documentar.

**Recommendation:** **Option B (`video_views` com chave por usuário ou hash de IP+UA, janela de 24 h)** — é a única das três em que repetir a requisição não move o contador, e reaproveita o pg-boss já presente para a limpeza; a subcontagem por NAT é o erro aceitável (conservador) para um contador público. Combina com TD-03 Option A, que entrega o IP real; com TD-03 Option B (sem IP real), a Option C passa a ser a alternativa coerente.

**Decision:** B (tabela `video_views` com chave `user:{id}` ou `anon:{hash(salt diário + IP real + User-Agent)}`, janela de 24 h, `INSERT … ON CONFLICT DO NOTHING` + incremento de `view_count` na mesma transação, limpeza periódica por pg-boss)

**Revisions:**
- 2026-10-19 — "Janela de 24 h" = balde fixo por dia UTC: `window_start` é a data UTC da visualização, alinhada à rotação diária do salt do hash anônimo; um job agendado do pg-boss roda uma vez por dia e apaga linhas de `video_views` com `window_start` anterior a 2 dias. Rationale: AMB-1 do `/plan-validate 5`, escolha do usuário.

---

## TD-03: IP real do cliente atrás do BFF — throttling das leituras anônimas e identidade do espectador

**Scope:** Cross-layer

**Capability:** Transversal — covers: Acesso anônimo à visualização de vídeos; Contagem de visualizações

**Context:** o `ThrottlerGuard` global (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` em `AuthModule`) rastreia por `req.ip`, e no Strict BFF **toda** requisição chega à API vinda do container `next-frontend` — o `upstream` não encaminha nenhum header de cliente e a API não configura `trust proxy`. Na prática, cada rota pública tem um orçamento de 10 requisições/minuto **compartilhado por todos os visitantes do site**: com a watch page fazendo `GET /videos/{id}` + `GET /playback` + sugestões a cada render, algumas visitas por minuto já produzem 429 para qualquer anônimo. A página pública do canal (Fase 04) já está exposta a isso; a Fase 05 torna o problema bloqueante. A mesma informação (IP real) é a chave do anônimo em TD-02 Option B. Cross-layer: o BFF precisa enviar o dado e a API precisa decidir em quem confiar.

**Options:**

### Option A: BFF encaminha `X-Forwarded-For`; API com `trust proxy` restrito e `getTracker` sobrescrito
- O `upstream` (e os Route Handlers) repassam o IP do cliente lido em `headers()`; a API faz `app.set('trust proxy', TRUST_PROXY)` (lista/sub-rede do BFF, nova chave validada no Joi + `compose.yaml` + `.env.example`) e registra um `ThrottlerBehindProxyGuard` cujo `getTracker` devolve `req.ips[0] ?? req.ip` — exatamente o padrão da documentação do NestJS (seção "Proxies").
- **Pros:** padrão documentado do framework; o throttler volta a ser por visitante em todas as rotas (efeito colateral positivo nas rotas de auth, que sofrem do mesmo problema); fornece o IP para TD-02.
- **Cons:** spoofing se `TRUST_PROXY` for amplo demais — em dev a porta 3000 é publicada no host e o gateway da rede Docker fica dentro da sub-rede (mitigação: confiar só no IP/nome do serviço `next-frontend` e documentar que em produção a API não é exposta); todo ponto de chamada do `upstream` precisa receber o IP (RSC e Route Handlers).

### Option B: `@SkipThrottle()` nas leituras públicas; throttling só em escrita/auth
- `GET /videos/{id}`, `/playback`, sugestões e `/channels/{nickname}/**` deixam de ser limitados; `POST …/views` continua limitado pelo IP do BFF (global).
- **Pros:** mudança mínima, sem contrato novo; resolve o 429 da navegação anônima imediatamente.
- **Cons:** leituras públicas sem nenhuma proteção contra scraping; o `POST …/views` limitado globalmente volta a ser um gargalo compartilhado (ou fica sem limite); TD-02 perde o IP e cai para a Option C; o problema idêntico nas rotas de auth continua sem resposta estrutural.

### Option C: Header assinado pelo BFF (`X-Client-IP` + segredo compartilhado)
- O BFF envia o IP do cliente num header próprio acompanhado de um segredo (`BFF_SHARED_SECRET`); um guard/middleware na API só aceita o header se o segredo conferir, sem `trust proxy`.
- **Pros:** imune a spoofing mesmo com a API exposta (o segredo, não a topologia de rede, autentica o BFF); explícito no código.
- **Cons:** segredo novo a gerir nos dois `.env` e no compose; mecanismo próprio em vez do suportado pelo framework/Express; precisa de cuidado para não vazar o header em logs.

**Recommendation:** **Option A (`X-Forwarded-For` + `trust proxy` restrito + `getTracker`)** — corrige a causa (o rastreador vê o BFF, não o visitante) com o padrão oficial do `@nestjs/throttler` 6, preserva o rate limit nas leituras públicas e entrega a identidade que TD-02 precisa. O risco de spoofing é tratado restringindo `TRUST_PROXY` ao endereço do serviço `next-frontend`; a Option C fica como endurecimento caso a API venha a ser exposta publicamente em produção (Fase 07).

**Decision:** A (BFF encaminha `X-Forwarded-For`; API com `trust proxy` restrito ao serviço `next-frontend` via nova chave `TRUST_PROXY` + `ThrottlerBehindProxyGuard.getTracker`; header assinado (Option C) fica como endurecimento para produção)

**Revisions:**
- 2026-10-19 — `TRUST_PROXY` = IP fixo do `next-frontend`: a rede `streamtube` ganha sub-rede fixa (`ipam`) no `compose.yaml` do backend e o serviço `next-frontend` recebe `ipv4_address` nela; a API confia só nesse IP (o gateway do host não é confiável). Variável ausente → `trust proxy` desligado (sem confiança em proxy, tracker = IP do socket). Chave validada no Joi + `.env.example`. Rationale: AMB-2 do `/plan-validate 5` — o Express não aceita nome de serviço do Compose.
- 2026-10-19 — Fonte do IP no BFF: a SI verifica que `next start` preenche `x-forwarded-for` (lido via `headers()` em RSC e Route Handlers); se o header faltar, o BFF não envia `X-Forwarded-For` e a API cai no IP do BFF, registrando a visualização normalmente. Rationale: AMB-3 do `/plan-validate 5` — o Next 16 não expõe `request.ip`.
- 2026-10-19 — `next start` mantém um `X-Forwarded-For` enviado pelo navegador (só preenche com o IP do socket, no formato `::ffff:x.x.x.x`, quando o header não vem). Como a API confia no `next-frontend` (`TRUST_PROXY`), o deploy exige um proxy reverso na frente do frontend que **sobrescreva** o `X-Forwarded-For` com o IP real do cliente; sem ele, um visitante pode forjar o IP e escapar do throttler e da deduplicação anônima de visualizações (TD-02). Em dev o risco é aceito: todos os visitantes chegam pela porta publicada como o gateway do Docker. Sem mudança de código; a Option C (header assinado) continua como endurecimento. Rationale: verificação do passo 2 da SI-05.8 (rota sonda + `next start`), registrada no `next-frontend/CLAUDE.md`.
- 2026-10-20 — Alcance da regra: **toda** leitura de RSC encaminha o IP do visitante via `clientHeaders()` (direto ou por `publicRead`/`withOptionalSession`) — inclusive confirmação de e-mail, layout `(app)`, feed, canal, estúdio e home —; uma leitura sem esses headers cai no orçamento único do IP do BFF. Rationale: suíte full-stack (SI-07.18) — a confirmação de e-mail tinha 10/min para a plataforma inteira; detalhes em `home-search-production/TD-01`, Revisions 2026-10-20.

---

## TD-04: Sugestões da mesma categoria — contrato e critério de seleção

**Scope:** Cross-layer

**Capability:** Transversal — covers: Sugestões de vídeos da mesma categoria na sidebar; Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Context:** a sidebar lista vídeos da mesma categoria do vídeo aberto. `videos.category_id` é **nullable** (vídeos sem categoria existem) e categorias pouco populadas podem render zero sugestões. As regras de elegibilidade são fixas (`status = published`, `visibility = public`, `processing_status = ready`, excluir o próprio vídeo — unlisted nunca aparece), mas é preciso decidir **onde** a seleção vive e **como** ordenar/preencher. A Fase 07 precisará de um filtro por categoria na home, o que pesa a favor ou contra um endpoint genérico agora. Cross-layer: define a rota, o envelope e quantas chamadas a watch page faz.

**Options:**

### Option A: Endpoint dedicado `GET /videos/{publicId}/related?limit=`
- A API resolve a categoria do vídeo de origem e devolve até `limit` (default 12, máx. 24) itens no shape `VideoCardItem` já existente: mesma categoria por `published_at DESC`; se faltar, completa com os públicos mais recentes de outras categorias (sem repetir). Sem cursor — lista fechada. Herda a autenticação opcional (`video-channel-management/TD-07`): um vídeo de origem não legível → 404.
- **Pros:** uma chamada; regra de seleção e de preenchimento num único serviço testável; o frontend não conhece categorias nem o fallback; a ordenação pode evoluir (popularidade, mesmo canal) sem mudar o contrato.
- **Cons:** endpoint específico que a home (Fase 07) não reaproveita; sem "carregar mais" na sidebar.

### Option B: Listagem pública genérica `GET /videos?category_id=&exclude=&cursor=` (envelope de `TD-06`)
- A watch page chama a listagem filtrada pela categoria do vídeo e, se vier curta, faz uma segunda chamada sem filtro para completar.
- **Pros:** o mesmo endpoint serve a home e o filtro por categoria da Fase 07; "carregar mais" gratuito via cursor.
- **Cons:** antecipa um contrato da Fase 07 (que ainda decidirá ordenação/filtros da home); a regra de fallback e a exclusão de duplicatas migram para o frontend; até duas chamadas por render — pesa no orçamento do throttler (TD-03).

### Option C: Sugestões embutidas na resposta do vídeo (`GET /videos/{publicId}` com `related[]`)
- O próprio `VideoResponse` passa a carregar as sugestões.
- **Pros:** uma chamada a menos; dados da página chegam juntos.
- **Cons:** acopla um recurso editorial a uma consulta de descoberta; o polling do estúdio e o editor (que usam o mesmo `GET`) passariam a pagar a consulta à toa; muda o shape de um contrato já consumido pela Fase 04.

**Recommendation:** **Option A (`GET /videos/{publicId}/related`)** — mantém a regra "mesma categoria + preenchimento" num único lugar da API, custa uma chamada por render e não antecipa decisões da home; a Fase 07 decide sua própria listagem sem herdar um filtro desenhado para a sidebar. Parâmetros a fixar: `limit` default 12 (máx. 24), ordenação `published_at DESC`, preenchimento com públicos recentes quando a categoria tiver menos que `limit` ou o vídeo não tiver categoria.

**Decision:** A (`GET /videos/{publicId}/related?limit=` — default 12, máx. 24, mesma categoria por `published_at DESC`, preenchimento com públicos recentes, shape `VideoCardItem`)

**Revisions:**
- 2026-10-19 — Resposta de `GET /videos/{publicId}/related` no mesmo envelope das listagens, `{ items }` com itens `VideoCardItem`, **sem** `next_cursor` (lista fechada, documentada como tal no OpenAPI) — exceção explícita ao cursor keyset de `video-channel-management/TD-06`, que segue valendo para listagens paginadas. Rationale: ICC-1 do `/plan-validate 5`, escolha do usuário.

---

## TD-05: Implementação do player de vídeo

**Scope:** Frontend

**Capability:** Player de vídeo com controles: play/pause, volume e barra de progresso

**Context:** o storage serve `stream_url` com `Range` (206), então qualquer abordagem usa o `<video>` nativo como motor; a decisão é **quem desenha e opera os controles**. O design system (Figma, Tailwind v4 + shadcn/Radix) tem identidade própria e o `/screen-inventory 5` ainda vai confirmar o frame do player. Requisitos de borda que qualquer opção precisa cobrir: teclado/leitores de tela, tela cheia, estado de buffering e a expiração da URL assinada (`PLAYBACK_URL_TTL`, 12 h — ao receber `error`, rebuscar `/playback` pelo BFF e retomar do `currentTime`). O guia `videos.md` do Next 16 recomenda controles nativos pela acessibilidade e players de terceiros "para necessidades avançadas".

**Options:**

### Option A: `<video controls>` nativo
- Os controles do navegador cobrem play/pause, volume, progresso e tela cheia.
- **Pros:** zero dependência e zero código de controle; acessibilidade e teclado garantidos pelo navegador; nada a testar além de atributos.
- **Cons:** aparência diferente por navegador e impossível de alinhar ao Figma; nenhum gancho visual para estados próprios (erro de URL expirada, overlay de play); fica destoante do design system no componente central da fase.

### Option B: Controles próprios sobre o `<video>` nativo com os primitivos do design system
- Componente cliente com hook de estado de mídia (`paused`, `currentTime`, `duration`, `buffered`, `volume`, `muted`) e controles feitos com `IconButton` existente e o `Slider` do `radix-ui` 1.4.3 (já instalado, com ARIA/teclado) para progresso e volume; tela cheia via Fullscreen API.
- **Pros:** fidelidade total ao Figma e aos tokens; sem dependência nova; escopo pequeno (os três controles pedidos + tela cheia); o Slider do Radix entrega o grosso da acessibilidade dos controles deslizantes.
- **Cons:** atalhos de teclado do player, buffering, `waiting`/`stalled` e diferenças entre navegadores ficam a cargo do projeto; jsdom não implementa reprodução — testes de componente precisam de stubs de `HTMLMediaElement`; legendas/velocidade/PiP, se pedidos depois, são trabalho próprio.

### Option C: Video.js 10 (`@videojs/react` 10.1.0, GA em 2026-10-01)
- Reescrita que unificou Video.js, Vidstack, Media Chrome e Plyr; componentes React compostos, skins "default"/"minimal" e fonte de skin em React + Tailwind para customização (peer React ^18 || ^19).
- **Pros:** acessibilidade, teclado, buffering e tela cheia prontos e mantidos por um projeto grande; bundle default pequeno (~51 kB); caminho aberto para legendas/HLS se o projeto crescer.
- **Cons:** major com semanas de vida (APIs e skins ainda assentando; o Vidstack 1.x, alternativa natural antes, está em migração para ele); a fonte da skin Tailwind exige Tailwind ≥ 4.3 e o projeto tem 4.2.4 (upgrade fora do escopo de uma página); estilizar a skin para os tokens do Figma é trabalho comparável ao da Option B, somado à curva de aprendizado.

**Recommendation:** **Option B (controles próprios com `IconButton` + `Slider` do Radix)** — a capability pede três controles, os primitivos acessíveis já estão instalados e o player precisa seguir o design system; a Option C só se paga quando surgirem requisitos avançados (legendas, velocidade, streaming adaptativo) e hoje exigiria upgrade do Tailwind e adoção de um major recém-lançado. Confirmar no `/screen-inventory 5`: se o frame do Figma trouxer controles além de play/pause/volume/progresso/tela cheia, reavaliar a favor da Option C.

**Decision:** B (controles próprios sobre `<video>` nativo com `IconButton` + `Slider` do `radix-ui`; reavaliar a favor da Option C se o frame do Figma trouxer controles além de play/pause/volume/progresso/tela cheia)

**Renders in:** ui-contracts

**Revisions:**
- 2026-10-19 — O frame do Figma (152:2219) trouxe controles além da capability (próximo vídeo, capítulos, autoplay, legendas, configurações/HD, miniplayer, modo teatro); o escopo do player fica fixado em play/pause, volume (mudo + slider), barra de progresso com busca, tempo atual/duração e tela cheia — os extras não são renderizados, e a Option B se mantém (o gatilho de reavaliação para a Option C não se aplica). Rationale: decisão do usuário no `/screen-inventory 5`, registrada a partir de IC-1 do `/plan-validate 5`.

---

## TD-06: Rota pública da watch page (`/watch/{publicId}` vs. `/v/{publicId}`)

**Scope:** Frontend

**Capability:** Transversal — covers: Layout da página: vídeo principal + informações + sidebar com sugestões; Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Context:** a Fase 04 deixou o path em aberto como OQ-5 e, enquanto isso, implementou `/watch/{publicId}` em cinco pontos (`video-config-card`, `video-edit-form`, `channel-video-grid`/`video-card`, páginas do estúdio e seus testes). O Figma (`CardVideoConfig`) mostra `streamtube.com/v/{id}`, e o plano lista "URLs curtas e únicas" como ponto de atenção. Para vídeos unlisted o link **é** o mecanismo de acesso — uma vez copiado e compartilhado, mudar o path quebra links em circulação. A API não constrói URLs de watch, por isso a decisão é só do frontend, mas é citada em vários componentes e precisa ser fechada antes da página existir.

**Options:**

### Option A: Manter `/watch/{publicId}`
- A rota nova vira `app/(app)/watch/[publicId]/page.tsx`; nada muda nos links existentes.
- **Pros:** zero retrabalho; path autoexplicativo; o identificador já é curto (11 caracteres).
- **Cons:** diverge do Figma (o texto do link exibido no estúdio precisa de ajuste no design, não no código); URL ~5 caracteres mais longa.

### Option B: Adotar `/v/{publicId}` conforme o Figma
- A rota nasce em `app/(app)/v/[publicId]`; os cinco pontos e testes passam a `/v/`.
- **Pros:** alinhado ao design e ao "URL curta"; decisão tomada antes de qualquer link público circular em produção.
- **Cons:** refactor de links/testes da Fase 04 misturado à fase nova (ou numa task separada antes dela); path menos descritivo.

### Option C: `/v/{publicId}` como link curto que redireciona (308) para `/watch/{publicId}`
- O estúdio exibe/copia o link curto; a página canônica continua em `/watch`.
- **Pros:** link compartilhável curto e página com path descritivo; ambos estáveis.
- **Cons:** dois paths para manter e testar; um salto de redirecionamento em todo acesso por link compartilhado; `metadata.alternates.canonical` precisa apontar para `/watch`.

**Recommendation:** **Option A (manter `/watch/{publicId}`)** — o `public_id` já cumpre o requisito de URL curta e única (`phase-03-upload-processing/TD-08`), o path já está implementado e testado em cinco pontos e ainda não há links em produção que justifiquem um alias; a divergência é só textual no Figma e se resolve registrando-a no `/screen-inventory 5`.

**Decision:** A (manter `/watch/{publicId}`; a divergência com o `/v/{id}` do Figma é registrada no `/screen-inventory 5`)

---

## TD-07: Estratégia de testes do player e da reprodução (E2E sobre MSW)

**Scope:** Frontend

**Capability:** Player de vídeo com controles: play/pause, volume e barra de progresso

**Context:** depende de TD-05. O E2E roda em `next build` + `next start` com MSW **server-side** (`setupServer`), e o handler de `/playback` devolve `stream_url` apontando para a origem fictícia do storage. O `<video src>` é buscado **pelo navegador**, fora do alcance do MSW — hoje a reprodução não tem mídia real em nenhum nível de teste. Em Vitest/jsdom, `HTMLMediaElement.play()`/`pause()` não estão implementados. Além disso, o Chromium do Playwright é um build open-source sem codecs proprietários (H.264/AAC), o que pesa na escolha do arquivo de fixture (verificar na SI; WebM/VP9 evita a questão). A decisão é **onde** o comportamento do player é provado e **como** a mídia chega ao navegador no E2E.

**Options:**

### Option A: Fixture WebM servida por `page.route()` no Playwright + stubs de mídia no Vitest
- Uma fixture curta (poucos segundos, VP9/Opus, alguns KB) em `tests/fixtures/`; os specs de watch interceptam a origem do storage com `page.route()` e respondem com o arquivo. Em componente, stubs de `HTMLMediaElement.prototype` e eventos sintéticos (`play`, `timeupdate`, `volumechange`) cobrem a lógica dos controles e o limiar de TD-01.
- **Pros:** reprodução real no navegador (play/pause, seek, volume, disparo do `POST …/views` após o limiar) sem tocar no build de produção; o handler MSW mantém o shape de produção (URL na origem do storage).
- **Cons:** `route.fulfill` não implementa `Range` (responde 200 com o corpo inteiro) — aceitável para uma fixture pequena, mas não prova o 206 (já coberto pelo backend em `phase-03/TD-09`); um fixture binário no repositório.

### Option B: Fixture em `public/` e handler MSW devolvendo URL same-origin quando `MSW_ENABLED`
- O mock de `/playback` aponta `stream_url` para `/e2e/sample.webm` servido pelo próprio Next.
- **Pros:** nenhuma interceptação no Playwright; `next start` serve `Range` em arquivos estáticos.
- **Cons:** o arquivo vai para o build de produção; o mock deixa de imitar o contrato real (origem do storage); acopla o handler à flag de E2E.

### Option C: Sem mídia real no E2E — só atributos; comportamento só em testes de componente
- O E2E verifica `src`, `download href` e a presença dos controles; toda a lógica fica nos testes Vitest com stubs.
- **Pros:** o mais simples; nenhum binário nem interceptação.
- **Cons:** play/seek/volume e o registro de visualização nunca são exercitados num navegador real — exatamente onde jsdom é cego; regressões de integração `<video>` ↔ controles passam despercebidas.

**Recommendation:** **Option A (fixture WebM via `page.route()` + stubs no Vitest)** — é a única que exercita o player num navegador real sem distorcer o mock de produção nem publicar fixture no build; o 206 já é provado no backend, então a falta de `Range` no `route.fulfill` não deixa lacuna. Usar WebM/VP9 elimina a dependência de codecs proprietários no Chromium do Playwright.

**Decision:** A (fixture WebM/VP9 curta em `tests/fixtures/` servida por `page.route()` sobre a origem do storage + stubs de `HTMLMediaElement` no Vitest)

---

## TD-08: Política de acesso ao download do vídeo

**Scope:** Cross-layer

**Capability:** Botão de download do vídeo

**Context:** _(acrescentado em 2026-10-19 a partir de MD-2 do `/plan-validate 5`)_ o mecanismo de download já existe — `GET /videos/{publicId}/playback` devolve `download_url` assinada com `Content-Disposition: attachment` (`phase-03-upload-processing/TD-09`) para quem passa na regra de leitura de `video-channel-management/TD-07` —, mas nenhuma decisão fixou **quem** pode baixar. O inventário põe o download como item do menu "⋮" da watch page, inclusive para visitante anônimo. Cross-layer: a política decide se a API emite `download_url` para todo leitor e se o item aparece/habilita no frontend.

**Options:**

### Option A: Quem pode assistir pode baixar (inclusive anônimo)
- A API continua emitindo `download_url` junto com `stream_url` para qualquer leitor autorizado; o item "Download" do menu "⋮" abre essa URL.
- **Pros:** nenhum contrato novo; coerente com "acesso anônimo à visualização"; uma regra de autorização só (a de leitura).
- **Cons:** qualquer visitante obtém o arquivo original; não há como o dono impedir o download de um vídeo específico.

### Option B: Download só para usuários autenticados
- `download_url` só é emitida quando há sessão; o anônimo vê o item desabilitado ou que leva ao login.
- **Pros:** reduz download em massa anônimo; incentiva cadastro.
- **Cons:** separa duas regras de autorização no mesmo endpoint (ou exige endpoint próprio); proteção fraca — o `stream_url` público já entrega os mesmos bytes.

### Option C: Opção do dono por vídeo (`allow_download`, default `true`)
- Nova coluna editável no estúdio; a API omite `download_url` quando desligada.
- **Pros:** controle do criador sobre o próprio conteúdo.
- **Cons:** migration, `PATCH`, tela de edição e testes novos para um requisito que a capability não pede; mesma fragilidade da B frente ao `stream_url`.

**Recommendation:** **Option A (quem pode assistir pode baixar)** — o `stream_url` assinado já entrega os bytes a qualquer leitor, então restringir só o `download_url` (B/C) adiciona regra e contrato sem proteção real; a capability pede o botão, não uma política de restrição.

**Decision:** A (quem pode assistir pode baixar, inclusive anônimo — `download_url` do `/playback` emitida para todo leitor autorizado por `video-channel-management/TD-07`; item "Download" no menu "⋮" da watch page)

---

## TD-09: Recolhimento e expansão da descrição

**Scope:** Frontend

**Capability:** Descrição do vídeo com expansão/recolhimento

**Context:** _(acrescentado em 2026-10-19 a partir de MD-1 do `/plan-validate 5`)_ a descrição (`text`, sem limite prático) é exibida no bloco de descrição da watch page; o Figma desenha só o estado expandido. A decisão é onde o recolhimento acontece — no cliente sobre o texto completo, ou no servidor com um trecho.

**Options:**

### Option A: Texto completo no HTML + `line-clamp` e alternância local
- O RSC entrega a descrição inteira; um componente cliente aplica `line-clamp` (recolhido) e alterna o estado ao clicar no controle; o controle só aparece quando o texto excede o limite.
- **Pros:** nenhum contrato novo; expandir é instantâneo; texto completo indexável.
- **Cons:** descrições muito longas pesam no HTML (aceitável no volume do projeto); detectar "excede o limite" exige medir o elemento no cliente.

### Option B: Trecho do servidor + texto completo sob demanda
- A API devolve um `description_excerpt`; o texto completo vem em outra chamada ao expandir.
- **Pros:** HTML menor para descrições enormes.
- **Cons:** campo/endpoint novo e uma ida ao servidor por expansão; corte por caracteres não respeita linhas visuais.

**Recommendation:** **Option A (`line-clamp` sobre o texto completo)** — é estado de UI puro sobre dados já carregados; a Option B só se justifica com descrições desproporcionais, que o projeto não tem.

**Decision:** A (texto completo entregue pelo RSC; recolhido com `line-clamp` e alternância local no cliente)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Cross-layer | Gatilho e contrato do registro de visualização | B — `POST /videos/{publicId}/views` pelo player após 10 s de reprodução (ou fim do vídeo) | **B** |
| TD-02 | Backend | Deduplicação da contagem de visualizações | B — `video_views` com chave `user:{id}` ou hash(salt diário + IP + UA), janela de 24 h, limpeza por pg-boss | **B** |
| TD-03 | Cross-layer | IP real do cliente atrás do BFF (throttling e identidade) | A — BFF encaminha `X-Forwarded-For`; `trust proxy` restrito (`TRUST_PROXY`) + `getTracker` | **A** |
| TD-04 | Cross-layer | Sugestões da mesma categoria — contrato e critério | A — `GET /videos/{publicId}/related?limit=` com preenchimento por públicos recentes | **A** |
| TD-05 | Frontend | Implementação do player de vídeo | B — controles próprios com `IconButton` + `Slider` do Radix sobre `<video>` nativo | **B** |
| TD-06 | Frontend | Rota pública da watch page | A — manter `/watch/{publicId}` | **A** |
| TD-07 | Frontend | Estratégia de testes do player e da reprodução | A — fixture WebM via `page.route()` no Playwright + stubs de mídia no Vitest | **A** |
| TD-08 | Cross-layer | Política de acesso ao download do vídeo | A — quem pode assistir pode baixar (inclusive anônimo) | **A** |
| TD-09 | Frontend | Recolhimento e expansão da descrição | A — texto completo + `line-clamp` e alternância local | **A** |

_Dependências entre TDs:_ TD-02 → TD-01 (o que é deduplicado é o evento definido em TD-01) e TD-03 (a chave anônima da Option B exige o IP real; com TD-03 = B, TD-02 tende à Option C); TD-01 → `video-channel-management/TD-05` (escreve `view_count`) e `TD-07` (autenticação opcional para excluir o dono); TD-04 → `video-channel-management/TD-02` (filtros `published`/`public`) e reaproveita o shape `VideoCardItem`; TD-07 → TD-05 (o que é testado) e TD-01 (o limiar de reprodução é provado no E2E); TD-05 → `phase-03-upload-processing/TD-09` (expiração da URL assinada a tratar no player); TD-08 → `phase-03-upload-processing/TD-09` (`download_url`) e `video-channel-management/TD-07` (regra de leitura).
