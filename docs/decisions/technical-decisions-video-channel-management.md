---
scope_type: phase
related_phases: [4]
status: decided
date: 2026-10-18
scope_description: "Fase 04 — gerenciamento de vídeos e canal, backend + frontend: modelo de categorias, eixo de publicação/visibilidade e seu contrato de transição, upload e entrega de thumbnails customizadas, contadores exibidos no painel, paginação das listagens, autorização de leitura pública vs. do dono, identificador do canal na URL e política de nickname, exclusão de vídeos com limpeza no storage, cliente de upload multipart no navegador (UI de upload adiada da Fase 03) e estratégia de dados do frontend (RSC, polling de processamento, invalidação pós-mutação)."
---

# Technical Decisions — Fase 04: Gerenciamento de Vídeos e Canal

_Subprojects in scope:_

- `nestjs-project/` — recebe a extensão do `VideosModule` (edição, publicação, visibilidade, thumbnail customizada, listagens, exclusão), o módulo de categorias, os endpoints de canal (leitura pública e edição pelo dono) e as migrations correspondentes. TD-01..TD-10 o afetam.
- `next-frontend/` — recebe as primeiras telas autenticadas com dados (painel de vídeos do canal, edição de vídeo, edição de canal), a página pública do canal e a UI de upload que a Fase 03 adiou explicitamente para esta fase (`project-plan.md`, status da Fase 03: "a UI de upload entra na Fase 04 com o painel do canal"). TD-11 e TD-12 são exclusivos dele; TD-01, TD-03, TD-04, TD-06, TD-08 e TD-10 são contratos que ele consome.
- repositório (raiz) — nenhuma decisão repo-wide aberta: não há serviço novo no `compose.yaml` nem mudança de CI. TD-10 (Option B) acrescenta um comando ao `storage-init` existente, mas isso é consequência de um TD Cross-layer, não um TD próprio.

_Decisões herdadas que esta fase NÃO reabre:_ modelo `Video` + `VideoUpload` com dois eixos de estado (`phase-03-videos/TD-07`), `public_id` de 11 chars (`TD-08`), URLs GET pré-assinadas para stream/download (`TD-09`), protocolo multipart pré-assinado com o navegador falando com `S3_PUBLIC_ENDPOINT` (`TD-03`), pg-boss e contrato do job (`TD-04`, `TD-11`), allowlist de formatos (`TD-14`); sessão BFF com `iron-session`, mutações por Route Handler + `fetch`, sessão servida por RSC + Provider (`phase-02-auth-frontend/TD-01..TD-06`); cadeia OpenAPI → `types.gen.ts` (`next-frontend-openapi-typing/TD-01..TD-05`); MSW por domínio (`next-frontend-msw-foundation`); geração do nickname `[a-z0-9_]` (`phase-02-auth/TD-10`); envelope de erro e `DomainException` (`phase-02-auth/TD-07`).

_Observação sobre o Figma:_ `docs/figma-audit.json` não contém nenhum frame com "canal", "studio", "painel", "upload" ou "thumbnail". O `/screen-inventory 4` precisa confirmar se existem telas desenhadas para esta fase; os TDs de frontend abaixo não dependem disso, mas o `/plan-build` dependerá.

---

## TD-01: Categorias de vídeo — modelo, carga inicial e exposição

**Scope:** Cross-layer

**Capability:** Categorias de vídeo disponíveis na plataforma

**Context:** o plano trata categorias como uma lista fixa da plataforma (nenhuma fase prevê CRUD administrativo). A lista é usada na edição do vídeo (Fase 04), nas sugestões "da mesma categoria" (Fase 05) e no filtro da home (Fase 07). Cross-layer porque define de onde o frontend obtém a lista e seus rótulos (endpoint vs. enum no OpenAPI) e como `videos` referencia a categoria. A carga inicial importa porque `synchronize` está desligado e o `seed.ts` atual está vazio: testes de integração/e2e e produção precisam da lista presente sem passo manual.

**Options:**

### Option A: Tabela `categories` carregada por data migration + `GET /categories`
- Entidade `Category` (`id` uuid, `slug` unique, `name`, `sort_order`); `videos.category_id` FK nullable; uma migration escrita à mão insere a lista inicial (a regra `typeorm-migrations.md` permite SQL manual para data migrations). Endpoint público `GET /categories` devolve `[{ slug, name }]`; o frontend consome via `paths`.
- **Pros:** rótulos e ordem vêm do servidor (sem duplicar nomes no frontend); integridade referencial; lista disponível em qualquer ambiente após `migration:run`; adicionar categoria = nova migration, sem deploy de frontend.
- **Cons:** uma entidade, um módulo (`CategoriesModule`), um endpoint e um join (ou segunda consulta) a mais; o `migration:generate` não gera INSERTs — a migration de dados é manual.

### Option B: Lista constante no código + coluna `videos.category` com allowlist
- `VIDEO_CATEGORIES = ['music', 'education', …] as const` em `videos.constants.ts`; coluna `varchar` validada por `@IsIn`; o DTO expõe `enum` no OpenAPI, então o frontend recebe a união de literais em `types.gen.ts` e mapeia os rótulos localmente.
- **Pros:** o mais simples: sem tabela, sem endpoint, sem join; tipagem forte ponta a ponta pela cadeia OpenAPI já existente.
- **Cons:** rótulos de exibição vivem no frontend (duas fontes para a mesma lista); mudar a lista exige deploy dos dois subprojetos e migração dos dados existentes; sem integridade referencial no banco.

### Option C: Tabela `categories` carregada pelo script `npm run seed`
- Igual à Option A no modelo, mas a carga inicial fica no `src/database/seeds/seed.ts` (hoje vazio), executado manualmente.
- **Pros:** separa schema de dados; reaproveita o entrypoint de seed previsto na Fase 01.
- **Cons:** passo manual que testes e2e/integração e o `storage-init`-like de produção teriam de orquestrar; ambientes podem subir sem categorias (edição de vídeo quebra silenciosamente); duplica o papel do `migration:run` como único bootstrap de banco.

**Recommendation:** **Option A (tabela carregada por migration + `GET /categories`)** — categorias são dado de plataforma com rótulo exibido em três fases; mantê-las no banco com carga via migration faz `migration:run` continuar sendo o único passo de bootstrap (regra já seguida por testes e CLAUDE.md) e evita duplicar a lista no frontend. Option B é aceitável se o time quiser o mínimo de código — a diferença real é "rótulos no servidor + FK" contra "zero infraestrutura".

**Decision:** A (tabela carregada por migration + `GET /categories`)

**Revisions:**
- 2026-10-18 — Lista inicial de categorias fixada para a data migration (slug → nome, nesta ordem): music → Music, gaming → Gaming, education → Education, entertainment → Entertainment, sports → Sports, news → News, technology → Technology, travel → Travel, cooking → Cooking, other → Other. Rationale: AMB-3 do plan-validate da Fase 04 — o conteúdo da lista não existia em nenhum artefato e a migration de dados depende dele.

---

## TD-02: Modelo de publicação e visibilidade do vídeo

**Scope:** Backend

**Capability:** Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link); Fluxo de rascunho → publicação

**Context:** `videos.status` existe desde a Fase 03 com o único valor `draft` (eixo de publicação, `phase-03-videos/TD-07`). A Fase 04 precisa representar "publicado", "público vs. unlisted" e o "tempo de publicação" exibido no painel; a Fase 05 filtra o que aparece em listagens (unlisted só por link) e a Fase 07 lista só o público. A pergunta é como os três conceitos se distribuem em colunas e quais transições existem — isso condiciona TD-03, TD-06 (ordenação), TD-07 (regras de leitura) e as fases seguintes.

**Options:**

### Option A: `status` (`draft | published`) + `visibility` (`public | unlisted`) + `published_at`
- Estende o enum existente com `published`; nova coluna `visibility` (default `public`, editável a qualquer momento, só tem efeito quando `published`); `published_at` gravado na primeira publicação. Transições: `draft → published` exige `processing_status = ready` e título não vazio; `published → draft` (despublicar) permitido e preserva `visibility`.
- **Pros:** mantém o eixo decidido na Fase 03 sem renomear nada; despublicar não perde a escolha de visibilidade; filtros das Fases 05/07 são `status = published AND visibility = public`; `published_at` dá o "tempo de publicação" e a ordenação estável de TD-06.
- **Cons:** duas colunas para um conceito que o usuário vê como um seletor só; combinação `draft + unlisted` existe no banco mas é inerte (precisa de comentário/regra).

### Option B: Enum único `status` (`draft | public | unlisted`) + `published_at`
- A visibilidade é absorvida pelo status; publicar = escolher `public` ou `unlisted`; despublicar = voltar a `draft`.
- **Pros:** uma coluna, um seletor na UI, filtros triviais.
- **Cons:** despublicar apaga a escolha de visibilidade; reintroduz o acoplamento que TD-07 da Fase 03 evitou (Option C lá); `VIDEO_STATUSES` muda de semântica ("draft" deixa de ser o único não-publicado possível no futuro, ex.: `scheduled`).

### Option C: `published_at` nullable como flag de publicação + `visibility`
- Sem alterar `status`: publicado ⇔ `published_at IS NOT NULL`.
- **Pros:** menos uma transição de enum; "tempo de publicação" e flag na mesma coluna.
- **Cons:** `status: 'draft'` já é contrato público (`VideoResponse`) e passaria a mentir para vídeos publicados; despublicar exige anular `published_at` e perder o histórico; estado derivado em vez de explícito.

**Recommendation:** **Option A (`status` + `visibility` + `published_at`)** — é a extensão natural do eixo de publicação decidido em `phase-03-videos/TD-07`, preserva a visibilidade ao despublicar e fornece a coluna de ordenação/tempo que o painel e TD-06 precisam. Regra de negócio a fixar junto: publicar exige `ready` + título; editar título/descrição/categoria/visibilidade é permitido em qualquer `processing_status`.

**Decision:** A (`status` + `visibility` + `published_at`)

---

## TD-03: Contrato de transição rascunho ↔ publicado

**Scope:** Cross-layer

**Capability:** Fluxo de rascunho → publicação; Edição de vídeos a partir do painel

**Context:** depende de TD-02. O painel e a tela de edição precisam disparar "publicar" e "despublicar" além de salvar campos editoriais. O contrato é cross-layer: define a forma do Route Handler BFF e do formulário no frontend. `nestjs-controllers.md` fixa métodos/códigos REST mas não diz como modelar transições de estado, por isso a escolha é aberta.

**Options:**

### Option A: Endpoints de ação dedicados + `PATCH` para campos editoriais
- `PATCH /videos/{publicId}` (título, descrição, categoria, visibilidade — parcial); `POST /videos/{publicId}/publish` e `POST /videos/{publicId}/unpublish` (200 com `VideoResponse`; 409 `VIDEO_NOT_PUBLISHABLE` quando `processing_status ≠ ready` ou sem título).
- **Pros:** intenção explícita e pré-condições documentadas por rota no Swagger; o `PATCH` nunca muda estado por efeito colateral; segue o estilo já usado em `POST …/upload/complete`; no frontend, "Publicar" é um botão com um Route Handler próprio.
- **Cons:** duas rotas a mais; "salvar e publicar" na mesma tela vira duas chamadas sequenciais (ou o frontend salva antes).

### Option B: `PATCH /videos/{publicId}` com `status` no corpo
- O mesmo `PATCH` aceita `status: 'published' | 'draft'`; o serviço valida pré-condições quando o campo vem.
- **Pros:** um endpoint, um formulário, um Route Handler; "salvar e publicar" é uma chamada.
- **Cons:** erro 409 de pré-condição mistura-se com validação de campos na mesma resposta; a semântica de `PATCH` fica condicional ("este campo tem regras, os outros não"); mais difícil de documentar e de testar matriz de estados.

### Option C: Sub-recurso de estado `PUT /videos/{publicId}/status`
- Corpo `{ status }`; o `PATCH` cuida só dos campos editoriais.
- **Pros:** separa estado de campos como Option A com uma rota só.
- **Cons:** `PUT` de um valor escalar é pouco idiomático; perde a nomeação da intenção (publicar/despublicar) e as pré-condições por ação.

**Recommendation:** **Option A (ações dedicadas + `PATCH`)** — torna as pré-condições de publicação um contrato visível (OpenAPI → `types.gen.ts` → MSW), mantém `PATCH` previsível para o `react-hook-form` da tela de edição e replica o padrão de ação já existente no `VideosController`. O custo é um `fetch` a mais no fluxo "salvar e publicar", irrelevante aqui.

**Decision:** A (ações dedicadas + `PATCH`)

**Revisions:**
- 2026-10-18 — Na UI desta fase, o Route Handler de "Save Changes" (telas de edição de vídeo e de upload em processamento) encadeia o `PATCH` de campos com a ação dedicada `publish` quando `status = draft`, `processing_status = ready` e o título está preenchido; se o vídeo ainda não está `ready`, apenas salva e avisa que continua rascunho (publicação ocorre num novo "Save" após o processamento). `unpublish` só pelo kebab do painel. A API mantém as ações dedicadas da Option A. Rationale: decisão de UI registrada no inventário da Fase 04 (IC-1/OQ-2 do plan-validate); o Figma não tem botão "Publish".

---

## TD-04: Thumbnail customizada — caminho de upload, validação e convivência com a automática

**Scope:** Cross-layer

**Capability:** Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada

**Context:** o worker já grava `thumbnails/{publicId}/auto.jpg` em `thumbnail_key`. A thumbnail customizada é um arquivo pequeno (imagem de poucos MB) enviado pelo dono a partir da tela de edição. Precisa-se decidir por onde os bytes passam, onde a imagem é validada (uma imagem é um vetor clássico de payload malicioso) e como a customizada convive com a automática (reverter?). Cross-layer: define o contrato que o formulário e o Route Handler BFF implementam. A exceção ao Strict BFF aberta na Fase 03 (navegador → `S3_PUBLIC_ENDPOINT`) foi explicitamente "limitada" ao upload de vídeo.

**Options:**

### Option A: `multipart/form-data` pela API, validação e normalização em processo
- `PUT /videos/{publicId}/thumbnail` com `FileInterceptor` (memória, limite ~5 MB), validação pelos bytes e re-encode para JPEG 1280×720 com `sharp` 0.35 (Node ≥ 20.9, binários prebuilt N-API — compatível com o `node:25-slim`), `putObject` em `thumbnails/{publicId}/custom.jpg`; `DELETE …/thumbnail` reverte para a automática. Passa pelo Route Handler do Next (BFF) como qualquer mutação.
- **Pros:** um request, sem sessão de upload nem "complete"; a re-codificação descarta metadados e payloads escondidos; nenhuma nova exceção ao Strict BFF; mesmo padrão de teste dos Route Handlers.
- **Cons:** bytes passam por Nest e Next (aceitável para ≤ 5 MB — o princípio "nenhum byte pela API" era sobre 10 GB); dependência nativa nova (`sharp`) na imagem da API — alternativa sem dependência é reaproveitar o `ffmpeg` já instalado via `execFile`, ao custo de mover `FfmpegService` para fora de `src/worker/`.

### Option B: PUT pré-assinado direto no storage + confirmação
- `POST …/thumbnail/upload` devolve URL pré-assinada; o navegador faz `PUT`; `POST …/thumbnail/complete` faz `headObject`, confere tamanho/`Content-Type` e grava `custom_thumbnail_key`. Opcionalmente um job normaliza a imagem no worker.
- **Pros:** reutiliza `StorageService`/CORS da Fase 03; zero bytes em Nest/Next.
- **Cons:** três round-trips para um arquivo pequeno; amplia a exceção ao Strict BFF para um segundo fluxo; a validação por `headObject` confia no `Content-Type` declarado — validar pelos bytes exigiria um job de worker só para isso; estado intermediário (objeto enviado, não confirmado) a limpar.

### Option C: POST policy pré-assinado (`@aws-sdk/s3-presigned-post`)
- Formulário HTML com condições (`content-length-range`, `Content-Type`) assinadas; o storage valida ao receber.
- **Pros:** validação de tamanho/tipo no próprio storage, um request do navegador.
- **Cons:** dependência nova; suporte a POST policy no RustFS não verificado (TD-01 da Fase 03 só testou multipart/CORS/Range); mesmos problemas de confirmação e de exceção ao BFF da Option B.

**Recommendation:** **Option A (pela API, validada e normalizada em processo)** — para um arquivo de poucos MB o custo de atravessar Nest/Next é nulo, e é o único caminho que valida pelos bytes sem criar um job dedicado nem alargar a exceção ao Strict BFF. Modelo: segunda coluna `custom_thumbnail_key` (a automática fica intacta para reverter); `thumbnail_url` resolve `custom ?? auto`. Sub-escolha para o `/plan-build`: `sharp` (dedicado, API síncrona simples) salvo objeção a dependência nativa — nesse caso, `ffmpeg` por `execFile` com o serviço movido para um módulo compartilhado.

**Decision:** A (pela API, validada e normalizada em processo)

---

## TD-05: Contadores de engajamento exibidos no painel

**Scope:** Backend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** o painel mostra visualizações, likes e comentários, mas quem os produz são as Fases 05 (views) e 06 (likes, comentários). A Fase 04 precisa decidir a forma persistida desses números agora, porque a listagem do painel (e depois home/watch) os lê por vídeo em lote — e a escolha dita como as fases seguintes escrevem.

**Options:**

### Option A: Colunas denormalizadas em `videos` (`view_count`, `like_count`, `dislike_count`, `comment_count`, default 0)
- Lidas direto na listagem; as Fases 05/06 incrementam atomicamente (`UPDATE … SET like_count = like_count + 1` na mesma transação do voto/comentário).
- **Pros:** listagens sem join nem subquery; ordenação por popularidade barata; padrão de leitura único para painel, home e watch.
- **Cons:** risco de drift se um incremento ficar fora da transação (mitigado por regra de "mesma transação" e por um job de reconciliação opcional no futuro); migration agora para colunas que a Fase 04 só exibe como zero.

### Option B: Calcular na leitura a partir das tabelas de likes/comentários/views
- Nesta fase as tabelas não existem → o serviço devolve 0 literal; as Fases 05/06 trocam por `COUNT` em subqueries.
- **Pros:** sempre exato; nada a reconciliar; nenhuma coluna especulativa.
- **Cons:** `COUNT` por linha em listagens paginadas (painel, home, canal) cresce com o volume; a Fase 04 entrega um contrato (`view_count` etc.) cuja implementação muda duas vezes.

### Option C: Tabela `video_stats` 1:1 com os contadores
- Mesmo conteúdo da Option A em tabela separada (join na listagem).
- **Pros:** `videos` só com dados editoriais; escrita de alta frequência (views) isolada da linha editorial.
- **Cons:** join em toda listagem; linha a criar junto com o vídeo; ganho de isolamento irrelevante no volume deste projeto.

**Recommendation:** **Option A (colunas denormalizadas em `videos`)** — a listagem do painel, a home e a watch leem os mesmos números em lote, e a Fase 06 já terá de escrever em transação; manter os contadores na própria linha evita `COUNT` por item em páginas paginadas sem introduzir uma tabela a mais. O contrato (`view_count`, `like_count`, `dislike_count`, `comment_count` na resposta de listagem) nasce agora e não muda depois.

**Decision:** A (colunas denormalizadas em `videos`)

---

## TD-06: Paginação das listagens de vídeos

**Scope:** Cross-layer

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status); Página pública do canal com informações e listagem de vídeos

**Context:** esta fase cria as duas primeiras listagens (painel do dono, página pública do canal); a Fase 07 acrescenta home e busca e deixa em aberto "paginação ou scroll infinito". O formato (query params + envelope de resposta) é decidido uma vez e herdado — trocá-lo depois quebra o contrato OpenAPI e todos os consumidores.

**Options:**

### Option A: Cursor keyset (`?limit=&cursor=`) com envelope `{ items, next_cursor }`
- Cursor opaco (base64 de `published_at`/`created_at` + `id`), ordenação estável por `(sort_col DESC, id DESC)`; o painel acrescenta `total` quando precisar ("12 vídeos").
- **Pros:** sem duplicatas/saltos quando itens entram durante a navegação (comum em feeds); custo constante por página; serve tanto "carregar mais"/scroll infinito quanto botões anterior/próximo.
- **Cons:** sem salto para a página N; cursor por ordenação (mudar a ordem = novo cursor); um pouco mais de código no serviço (decode/encode).

### Option B: Offset por página (`?page=&per_page=`) com `{ items, total, page, per_page }`
- `LIMIT/OFFSET` + `COUNT(*)`.
- **Pros:** o mais simples; página numerada e `total` grátis; qualquer ordenação.
- **Cons:** drift em scroll infinito (item repetido/pulado quando a lista muda); `OFFSET` degrada com páginas profundas; `COUNT` em toda chamada.

### Option C: `limit/offset` sem `total`
- Variante da B sem o `COUNT`.
- **Pros:** barata.
- **Cons:** mantém o drift da B e perde o `total` que o painel quer exibir; pior dos dois mundos.

**Recommendation:** **Option A (cursor keyset)** — no volume deste projeto A e B custam o mesmo; a diferença decisiva é que A permanece correta se a Fase 07 escolher scroll infinito e não precisa ser reaberta, enquanto B obriga a aceitar drift ou migrar o contrato. O `total` do painel é uma consulta `COUNT` separada, só nesse endpoint.

**Decision:** A (cursor keyset)

---

## TD-07: Leitura pública vs. do dono — autenticação opcional nas rotas de vídeo e canal

**Scope:** Backend

**Capability:** Página pública do canal com informações e listagem de vídeos; Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link); Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** depende de TD-02. Hoje todo `/videos/**` exige JWT (guard global) e `VideosOwnership` responde 403 a quem não é dono. A Fase 04 abre leituras anônimas (canal público, e — na Fase 05 — `GET /videos/{id}` e `/playback` de vídeos publicados), enquanto o dono continua vendo seus rascunhos e unlisted. O `JwtAuthGuard` atual, em rota `@Public()`, retorna antes de ler o header: `request.user` fica vazio mesmo com token válido. Nenhuma regra em `.claude/rules/auth-jwt.md`/`nestjs-controllers.md` define "autenticação opcional", por isso a escolha é aberta e condiciona a matriz de autorização das Fases 05/06.

**Options:**

### Option A: Autenticação opcional nas rotas públicas (uma rota por recurso)
- O guard, em rota `@Public()`, ainda verifica um `Bearer` se presente e popula `request.user` (token inválido/expirado → 401, para o BFF acionar o refresh). O serviço aplica a regra: dono vê tudo; terceiros/anônimos veem `published` (`public` em listagens, `unlisted` só por `public_id`); rascunho de outro → 404 (não revela existência).
- **Pros:** um caminho por recurso (`GET /videos/{id}`, `/playback`, `/channels/{nickname}/videos`); o dono pode pré-visualizar o próprio rascunho/unlisted pela mesma URL que o público usará; matriz de autorização centralizada no serviço.
- **Cons:** o guard global ganha um ramo a mais a testar; "público mas com token inválido → 401" precisa ficar documentado para não surpreender.

### Option B: Superfícies separadas — `/channels/me/**` (autenticado) e rotas públicas sem noção de usuário
- O dono lista/edita/pré-visualiza só por `/channels/me/videos/**`; `GET /videos/{id}` e `/channels/{nickname}/**` são `@Public()` puros e devolvem apenas `published`.
- **Pros:** sem autenticação opcional; cada rota tem uma matriz simples; prefixo `me` deixa óbvio o que exige sessão.
- **Cons:** duplica endpoints de leitura (`/videos/{id}` público vs. `/channels/me/videos/{id}`), inclusive playback na Fase 05; o dono não consegue abrir a watch page de um rascunho para conferir; o frontend precisa escolher a rota conforme o usuário.

### Option C: Todas as leituras autenticadas, anônimo só pelo BFF com "token de serviço"
- O Next usa uma credencial de serviço para leituras anônimas.
- **Pros:** nenhuma rota `@Public()` de leitura.
- **Cons:** contraria "acesso anônimo" como regra de negócio explícita do plano; credencial compartilhada a gerir; esconde no BFF uma decisão de autorização que pertence à API.

**Recommendation:** **Option A (autenticação opcional)** — é a única que entrega "mesma URL para dono e público" sem duplicar rotas nas Fases 05/06, e o custo é um ramo bem delimitado no `JwtAuthGuard` (ou um decorator `@OptionalAuth()` equivalente) mais testes de matriz. As rotas de escrita continuam exigindo JWT e `VideosOwnership`.

**Decision:** A (autenticação opcional)

---

## TD-08: Identificador do canal na URL pública e política de alteração do nickname

**Scope:** Cross-layer

**Capability:** Edição das informações do canal: nickname, nome e descrição; Página pública do canal com informações e listagem de vídeos

**Context:** o nickname nasce do prefixo do e-mail (`phase-02-auth/TD-10`), é `unique`, e a Fase 04 o torna editável ao mesmo tempo em que cria a página pública do canal. É preciso decidir o que identifica o canal na URL (nickname mutável vs. id estável), como a API o localiza, e o que acontece com links antigos quando o nickname muda. Cross-layer: define a rota do Next, o parâmetro do endpoint e o campo `channelSlug` guardado na sessão BFF.

**Options:**

### Option A: Nickname na URL (`/channel/{nickname}`), mutável, sem redirecionamento
- `GET /channels/{nickname}` e `GET /channels/{nickname}/videos`; `PATCH /channels/me` valida o novo nickname com a mesma allowlist da geração (`^[a-z0-9_]{3,50}$`, lista de reservados), 409 `NICKNAME_TAKEN` em conflito; o antigo é liberado na hora; links antigos passam a 404; o BFF reescreve `channelSlug` na sessão após o `PATCH`.
- **Pros:** URL legível e estável enquanto o usuário não a muda (comportamento de "handle" conhecido); sem tabela extra; lookup por índice único já existente.
- **Cons:** quem muda o nickname quebra links compartilhados; o nickname liberado pode ser tomado por outro (possível confusão de identidade) — mitigável depois com carência, se virar problema.

### Option B: Identificador estável na URL (`/channel/{channelId}`) e nickname só exibido
- `channels.public_id` curto (padrão de `phase-03/TD-08`) ou o próprio UUID; nickname vira só rótulo.
- **Pros:** links nunca quebram; renomear é trivial.
- **Cons:** URL opaca contraria o propósito do nickname ("o prefixo do e-mail se torna o nome do canal"); coluna/índice a mais; a busca por canal (Fase 07) ainda precisa do nickname.

### Option C: Nickname na URL + histórico com redirecionamento 301
- Tabela `channel_nickname_history`; a API responde 301/308 (ou o Next redireciona) do nickname antigo para o atual por N dias; nicknames em histórico não podem ser reutilizados.
- **Pros:** links antigos continuam funcionando; evita reutilização por terceiros.
- **Cons:** entidade, migration e regra de expiração a mais para um cenário que o plano não pede; redirecionamento cruza BFF e API.

**Recommendation:** **Option A (nickname na URL, mutável, sem redirecionamento)** — satisfaz os dois bullets com o modelo já existente e a mesma allowlist da Fase 02; o custo (links antigos quebram) é o comportamento padrão de handles e pode ser endurecido depois com a Option C como extensão aditiva. Forma da rota: `/channel/{nickname}` (um segmento `@handle` na raiz colidiria com a convenção de parallel routes `@slot` do App Router e com as demais rotas de topo).

**Decision:** A (nickname na URL, mutável, sem redirecionamento)

---

## TD-09: Exclusão de vídeos e limpeza no storage

**Scope:** Backend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status) — _bullet implícito: "gerenciamento" inclui remover; o plano da Fase 03 adiou explicitamente "deletion of ready videos is Phase 04 scope" (`docs/phases/phase-03-videos/phase-03-videos.md`, erro 409 de `DELETE …/upload`). Se o usuário considerar exclusão fora do escopo da Fase 04, este TD cai._

**Context:** hoje só existe `DELETE /videos/{id}/upload` para sessões ativas. Excluir um vídeo pronto envolve a linha em `videos` (e, nas Fases 06+, likes/comentários em cascata) e dois objetos no storage (`source`, thumbnails). O plano destaca custo de armazenamento como ponto de atenção, então "apagar a linha e esquecer os bytes" não serve. A escolha condiciona como as Fases 05/06 filtram vídeos e se existe "lixeira".

**Options:**

### Option A: Hard delete transacional + job `video.delete` para o storage
- `DELETE /videos/{publicId}` (dono; 204) apaga a linha em transação e, na mesma transação (opção `db` do pg-boss já usada no `complete`), enfileira `video.delete` com as chaves; o worker remove os objetos com retry/backoff e tolera `NoSuchKey`.
- **Pros:** o vídeo some imediatamente de todas as listagens sem filtro adicional; limpeza garantida pelo mesmo mecanismo de retentativa da Fase 03; sem estado "excluído" a propagar para as Fases 05/06.
- **Cons:** irreversível; um handler de fila a mais no worker; FK em cascata precisa estar prevista quando likes/comentários chegarem.

### Option B: Soft delete (`deleted_at`, `@DeleteDateColumn`) + expurgo agendado
- A linha fica; um job periódico apaga objetos e linha após N dias; "restaurar" é possível.
- **Pros:** lixeira/arrependimento; auditoria.
- **Cons:** todo `find`/QueryBuilder das Fases 05/06/07 precisa excluir `deleted_at` (TypeORM só filtra automaticamente nos métodos de repositório, não em `createQueryBuilder` sem `withDeleted` cuidado); `public_id`/`nickname` únicos presos até o expurgo; job periódico (cron do pg-boss) a mais; funcionalidade que o plano não pede.

### Option C: Exclusão síncrona dos objetos e depois da linha
- O endpoint chama `deleteObject` (×2) e então `DELETE` da linha.
- **Pros:** sem job novo; mais simples de ler.
- **Cons:** falha no storage após apagar um objeto deixa estado inconsistente; latência do endpoint depende do storage; contraria o padrão da fase anterior (efeitos no storage via fila com retry).

**Recommendation:** **Option A (hard delete + job `video.delete`)** — reaproveita o padrão transacional "linha + job na mesma transação" de `phase-03-videos/TD-11` e garante que os bytes sejam liberados sem bloquear a resposta nem espalhar um filtro `deleted_at` por todas as fases seguintes. Option B só compensa se o produto pedir lixeira.

**Decision:** A (hard delete + job `video.delete`)

---

## TD-10: Entrega de thumbnails em páginas públicas

**Scope:** Cross-layer

**Capability:** Página pública do canal com informações e listagem de vídeos; Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** depende de TD-04 (chaves). Hoje `thumbnail_url` é um GET pré-assinado por vídeo (TTL `PLAYBACK_URL_TTL`), emitido para o dono. A partir desta fase thumbnails aparecem em grades anônimas (canal público; depois home/busca/sugestões), dezenas por página, renderizadas em RSC. URLs assinadas mudam a cada render (sem cache de navegador/CDN) e páginas anônimas não têm quem autorizar. Cross-layer: define o que a API devolve em `thumbnail_url` e como `<img>`/`next/image` consomem. `phase-03/TD-09` (Option C rejeitada) proibiu bucket público para **vídeos** — thumbnails são outro recurso, com outra sensibilidade.

**Options:**

### Option A: Manter GET pré-assinado por thumbnail (status quo)
- A API assina cada `thumbnail_url` (HMAC local, custo desprezível) para dono e anônimo.
- **Pros:** nenhuma mudança de infra; mesmo mecanismo de autorização dos vídeos; a assinatura expira.
- **Cons:** URL diferente a cada render → sem cache de navegador/CDN e `next/image` não pode otimizar de forma estável; páginas anônimas assinam dezenas de URLs por request; a expiração não compra nada para uma imagem pública.

### Option B: Leitura anônima do prefixo `thumbnails/*` por bucket policy + URL estável
- `storage-init` aplica `put-bucket-policy` (`Principal: "*"`, `s3:GetObject` em `arn:aws:s3:::${S3_BUCKET}/thumbnails/*` — RustFS aceita o principal curinga desde `1.0.0-alpha.79`, issue #1336; o `1.0.3` pinado é posterior). A API devolve `${S3_PUBLIC_ENDPOINT}/${bucket}/${key}?v=${updated_at}` para cache-busting.
- **Pros:** URL cacheável e estável (navegador, CDN futura, `next/image`); zero assinatura em páginas públicas; vídeos continuam privados (prefixo `videos/*` fora da policy).
- **Cons:** thumbnail de rascunho/unlisted fica legível por quem souber o `public_id` (64 bits de entropia — mesma classe de exposição do próprio unlisted); comando a mais no `storage-init` e smoke test de GET anônimo; em dev, `localhost:9000` não é alcançável de dentro do container do Next, então `next/image` precisa de `unoptimized`/loader próprio (vale para A também).

### Option C: Proxy pela API (`GET /videos/{publicId}/thumbnail`) com cache headers
- A API faz `GetObject` e repassa os bytes com `Cache-Control`; no Strict BFF, o Next também os repassa.
- **Pros:** uma origem só; autorizável por request; cacheável por `ETag`.
- **Cons:** bytes de imagem atravessam Nest e Next em toda grade; implementação de `ETag`/`If-None-Match` própria; contraria o princípio de entrega direta pelo storage adotado na Fase 03.

**Recommendation:** **Option B (prefixo `thumbnails/*` com leitura anônima e URL estável)** — thumbnails são conteúdo público por natureza nas Fases 04/05/07 e a URL estável é o que torna cache e `next/image` possíveis; a policy fica restrita ao prefixo, então a decisão de `phase-03/TD-09` para vídeos permanece intacta. Verificação na SI: `curl -sI $S3_PUBLIC_ENDPOINT/$BUCKET/thumbnails/x/auto.jpg` → 200 sem credenciais e `…/videos/x/source` → 403. Se a policy falhar no RustFS, A é o fallback sem mudança de contrato além do cache.

**Decision:** B (prefixo `thumbnails/*` com leitura anônima e URL estável)

---

## TD-11: Cliente de upload multipart no navegador

**Scope:** Frontend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status) — _a UI de upload foi adiada da Fase 03 para "a Fase 04 com o painel do canal" (`project-plan.md`, status da Fase 03); o painel é o ponto de entrada do upload._

**Context:** o protocolo está decidido (`phase-03/TD-03`): `POST /videos` → lotes de URLs por parte → `PUT` direto em `S3_PUBLIC_ENDPOINT` → `GET …/upload` para retomar → `POST …/upload/complete` (que grava sessão, vídeo e job na mesma transação). As chamadas à API passam pelo BFF; só os `PUT` das partes vão ao storage. Falta decidir quem orquestra isso no navegador (fatiamento, concorrência, retry, retomada, progresso) e onde vive o estado do upload.

**Options:**

### Option A: Módulo próprio (`lib/upload/multipart-uploader.ts`)
- ~200 linhas: `File.slice` por `part_size`, pool de N uploads concorrentes, retry com backoff por parte, retomada via `GET …/upload` (pula partes já aceitas), coleta de `ETag`, progresso agregado, `AbortController`. Estado em um Provider no layout do estúdio para o upload sobreviver à navegação interna, com aviso `beforeunload`.
- **Pros:** mapeia 1:1 os endpoints existentes sem adaptação; zero dependência; totalmente testável com MSW (BFF) e `fetch` mockado (storage); UI livre para seguir o design system.
- **Cons:** código próprio para casos de borda (rede intermitente, expiração de URL de parte → repedir lote); sem UI pronta.

### Option B: Uppy 5.x com `@uppy/aws-s3` em modo callbacks
- A API de callbacks (`createMultipartUpload`, `signPart`, `listParts`, `completeMultipartUpload`, `abortMultipartUpload`) corresponde exatamente aos endpoints da Fase 03; `@uppy/react` para progresso/estado.
- **Pros:** retomada, concorrência e retry maduros; `useUppyState` para UI própria (sem o Dashboard).
- **Cons:** é a **major anterior**: o Uppy 6 (out/2026) removeu todos esses callbacks (migration guide) — adotar 5.x é adotar uma API já descontinuada; pacotes ESM pesados para um único fluxo; estilo próprio a sobrescrever se o Dashboard for usado.

### Option C: Uppy 6.x com `signRequest`
- Modo atual: o navegador executa ele próprio `CreateMultipartUpload`, `UploadPart`, `ListParts`, `CompleteMultipartUpload` e `AbortMultipartUpload` contra o S3; o servidor só pré-assina cada request; a chave do objeto é gerada no cliente.
- **Pros:** biblioteca atual e suportada.
- **Cons:** **incompatível com o contrato decidido**: a API precisa abrir a sessão (pré-cadastro gera `public_id`/chave) e fechar o multipart dentro da transação que enfileira `video.process` (`TD-03`/`TD-11`); com o navegador fazendo `Complete` direto, a API perderia o ponto de validação e enfileiramento — exigiria reabrir dois TDs da Fase 03.

**Recommendation:** **Option A (módulo próprio)** — o contrato da Fase 03 é pequeno e já está fechado; a única biblioteca que o espelha (Uppy 5) acaba de ser descontinuada pela própria Uppy 6, cujo modelo conflita com a orquestração pela API. Um módulo de ~200 linhas com pool, retry e retomada é menor que a adaptação de qualquer uma das duas e fica coberto pelos testes de MSW já padronizados. Estado no layout do estúdio (Provider) para a navegação interna não cancelar o envio.

**Decision:** A (módulo próprio)

---

## TD-12: Estratégia de dados do frontend — leitura em RSC, polling de processamento e invalidação pós-mutação

**Scope:** Frontend

**Capability:** Transversal — covers: Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status); Edição de vídeos a partir do painel; Edição das informações do canal: nickname, nome e descrição; Página pública do canal com informações e listagem de vídeos

**Context:** é a primeira fase com telas autenticadas de dados mutáveis: o painel precisa refletir `processing_status` mudando (uploading → processing → ready) sem recarga, as edições precisam aparecer ao voltar à lista, e a página pública é anônima e deve renderizar no servidor. `phase-02-auth-frontend/TD-06` fixou "RSC lê, Client consome; após mutação, `router.refresh()`", mas não decidiu se a camada de dados ganha uma biblioteca de cache/polling. No Next 16 sem `cacheComponents`, `fetch` não é cacheado por padrão — páginas com `cookies()` são dinâmicas e `router.refresh()` re-renderiza o RSC.

**Options:**

### Option A: RSC via `upstream` + Route Handlers BFF + `router.refresh()` + hook de polling restrito
- Páginas (painel, edição, canal público) leem no servidor com `upstream` (token da sessão quando houver); mutações continuam em Route Handlers (`TD-05` da Fase 02); após sucesso, `router.refresh()`; um hook `useProcessingPoll(publicIds)` faz `fetch('/api/videos/{id}')` a cada poucos segundos **só** enquanto houver vídeos fora de `ready|failed`, e chama `router.refresh()` quando mudam.
- **Pros:** zero dependência; segue exatamente o padrão da Fase 02 e a recomendação do próprio TanStack ("use framework-native data fetching em apps RSC"); sem flicker (dados já no HTML); testes continuam sendo "Route Handler como função + MSW".
- **Cons:** `router.refresh()` re-renderiza a rota inteira (aceitável para listas pequenas); polling e estados de "salvando" são artesanais; sem cache cliente entre navegações.

### Option B: TanStack Query 5 (`@tanstack/react-query` 5.104, peer React 18/19)
- `QueryClientProvider` no layout, `prefetchQuery` + `HydrationBoundary` nos RSC, `useQuery` com `refetchInterval` condicional para processamento, `useMutation` + `invalidateQueries` após editar/publicar.
- **Pros:** polling, invalidação seletiva, estados de mutação e cache entre navegações prontos; caminho natural para os likes/comentários otimistas da Fase 06.
- **Cons:** dependência + Provider + padrão de hidratação novos (a própria documentação alerta para "data ownership" quando RSC e Client renderizam a mesma query); dobra os caminhos de leitura (RSC prefetch + queryFn no cliente via BFF) que precisam ficar sincronizados; testes de componentes passam a precisar de `QueryClient` de teste.

### Option C: Leitura só no cliente (`useEffect` + `fetch` ao BFF)
- RSC não lê dados; componentes cliente buscam ao montar.
- **Pros:** um só caminho de leitura.
- **Cons:** flicker e spinner em toda tela; página pública do canal perde SSR real (SEO/metadata); contraria `TD-06` da Fase 02 e o modelo RSC-first do `next-frontend/CLAUDE.md`.

**Recommendation:** **Option A (RSC + BFF + `router.refresh()` + polling restrito)** — as necessidades desta fase são estreitas (um polling condicional e invalidação por recarga de rota), o padrão já existe desde a Fase 02 e a documentação do TanStack recomenda não adotá-lo em apps RSC sem necessidade concreta. Reavaliar na Fase 06 (likes/comentários otimistas), quando a Option B passa a pagar seu custo; a migração é aditiva (Provider + hooks), não substitui os Route Handlers.

**Decision:** A (RSC + BFF + `router.refresh()` + polling restrito)

**Renders in:** frontend-runtime

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Cross-layer | Categorias de vídeo — modelo, carga inicial e exposição | A — tabela `categories` carregada por data migration + `GET /categories` | **A** |
| TD-02 | Backend | Modelo de publicação e visibilidade | A — `status` (`draft\|published`) + `visibility` (`public\|unlisted`) + `published_at` | **A** |
| TD-03 | Cross-layer | Contrato de transição rascunho ↔ publicado | A — `POST …/publish` / `POST …/unpublish` + `PATCH` para campos | **A** |
| TD-04 | Cross-layer | Thumbnail customizada — upload, validação e convivência | A — `multipart/form-data` pela API, validada/normalizada em processo; `custom_thumbnail_key` separada | **A** |
| TD-05 | Backend | Contadores de engajamento no painel | A — colunas denormalizadas em `videos` (default 0) | **A** |
| TD-06 | Cross-layer | Paginação das listagens | A — cursor keyset `{ items, next_cursor }` (+ `total` só no painel) | **A** |
| TD-07 | Backend | Leitura pública vs. do dono | A — autenticação opcional em rotas `@Public()`; regra de visibilidade no serviço | **A** |
| TD-08 | Cross-layer | Identificador do canal na URL e política de nickname | A — `/channel/{nickname}`, mutável, sem redirecionamento; 409 `NICKNAME_TAKEN` | **A** |
| TD-09 | Backend | Exclusão de vídeos e limpeza no storage | A — hard delete transacional + job `video.delete` | **A** |
| TD-10 | Cross-layer | Entrega de thumbnails em páginas públicas | B — leitura anônima do prefixo `thumbnails/*` por bucket policy + URL estável | **B** |
| TD-11 | Frontend | Cliente de upload multipart no navegador | A — módulo próprio (pool, retry, retomada), estado no layout do estúdio | **A** |
| TD-12 | Frontend | Estratégia de dados do frontend | A — RSC + BFF + `router.refresh()` + polling restrito (sem TanStack Query nesta fase) | **A** |

_Dependências entre TDs:_ TD-03 → TD-02 (quais transições existem); TD-07 → TD-02 (regra de visibilidade) e condiciona a matriz de autorização das Fases 05/06; TD-06 → TD-02 (`published_at` como chave de ordenação) e é herdado pela Fase 07; TD-10 → TD-04 (chaves `auto`/`custom`) e TD-04 → `phase-03/TD-06` (thumbnail automática); TD-09 → `phase-03/TD-04`/`TD-11` (fila e transação); TD-11 → `phase-03/TD-03` (contrato multipart) e `phase-02-auth-frontend/TD-05` (mutações por Route Handler); TD-12 → `phase-02-auth-frontend/TD-06` (RSC + Provider) e TD-11 (o polling é o que leva o painel de `processing` a `ready`); TD-08 → `phase-02-auth/TD-10` (allowlist do nickname) e `phase-02-auth-frontend/TD-02` (`channelSlug` na sessão).

## Notes for downstream pipeline

- **Fatiamento.** Este documento é monolítico (sem `covers_capabilities`) e cobre backend + frontend. Se o time preferir entregar a Fase 04 em duas fatias como a Fase 02 (backend primeiro, telas depois), basta declarar `covers_capabilities` aqui e criar a fatia irmã com `/research` — nenhum TD precisa ser reescrito, pois cada um já cita seus bullets.
- **Capability implícita.** TD-09 (exclusão) e TD-11 (UI de upload) não têm bullet literal na Fase 04; apoiam-se, respectivamente, no adiamento registrado no plano da Fase 03 e no status da Fase 03 no `project-plan.md`. O `plan-validate` pode sinalizá-los; a decisão de mantê-los é do usuário.
- **Detalhes que ficam para o `/plan-build` (não são TDs):** título do vídeo nasce no pré-cadastro como `original_filename` sem extensão (nullable até lá não é necessário); limites de campos (`title` ≤ 100, `description` ≤ 5000, `channels.name` ≤ 50, `description` do canal ≤ 1000); códigos de erro novos no catálogo (`VIDEO_NOT_PUBLISHABLE` 409, `NICKNAME_TAKEN` 409, `THUMBNAIL_INVALID` 400/422, `CATEGORY_NOT_FOUND` 400); reserva de nicknames (`me`, `admin`, `channel`, `api`…); `images.remotePatterns`/`unoptimized` para `S3_PUBLIC_ENDPOINT`; atualização de `channelSlug` na sessão no Route Handler de `PATCH /api/channel`; novos handlers MSW em `mocks/handlers/{videos,channels,categories}.ts`; primitivos shadcn a instalar (`table`, `dialog`, `select`, `textarea`, `badge`, `progress`, `dropdown-menu`).
- **Contrato OpenAPI.** Toda mudança de DTO/controller desta fase exige a cadeia `openapi:export` → `scripts/sync-openapi.sh` → `openapi:types` no mesmo SI (regra já vigente; nenhum TD novo sobre isso).
- **Supersede candidates:** nenhum. TD-10 não contradiz `phase-03/TD-09` (que trata de vídeos); TD-07 estende o `JwtAuthGuard` sem alterar `phase-02-auth/TD-02`.

Sources consulted during research:

- [Uppy — @uppy/aws-s3 (v6)](https://uppy.io/docs/aws-s3/) — modo `signRequest`: o navegador executa Create/UploadPart/ListParts/Complete/Abort; callbacks por operação removidos.
- [Uppy — Migration guides (5 → 6)](https://uppy.io/docs/guides/migration-guides/) — remoção de `createMultipartUpload`, `signPart`, `listParts`, `completeMultipartUpload`, `abortMultipartUpload`; chave do objeto gerada no cliente.
- [Uppy 6.0 release notes](https://uppy.io/blog/uppy-6.0/) — reescrita do plugin S3; consolidação de pacotes em `@uppy/core`.
- npm registry (2026-10-18): `@uppy/aws-s3` 6.3.0 / `@uppy/react` 6.1.0 (peer React 18/19), `sharp` 0.35.5 (`node >= 20.9.0`), `@tanstack/react-query` 5.104.4 (peer React 18/19).
- [sharp — Installation](https://sharp.pixelplumbing.com/install/) — N-API v9, binários prebuilt por `optionalDependencies`, glibc ≥ 2.28 em Linux x64.
- [TanStack Query — Advanced SSR (App Router)](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — `HydrationBoundary`, "treat Server Components as a place to prefetch", recomendação de preferir data fetching nativo do framework em apps RSC.
- [RustFS — Bucket Policy](https://docs.rustfs.com/en/administration/data/bucket/policy), [issue #1336](https://github.com/rustfs/rustfs/issues/1336) (Principal `"*"` corrigido em `1.0.0-alpha.79`) e [issue #1874](https://github.com/rustfs/rustfs/issues/1874) (acesso anônimo por policy suportado).
- Next.js 16 docs locais (`next-frontend/node_modules/next/dist/docs/01-app/`): `02-guides/caching-without-cache-components.md` (`fetch` não cacheado por padrão), `03-api-reference/04-functions/use-router.md` (`router.refresh()` re-renderiza RSC sem perder estado cliente), `01-getting-started/12-images.md` (`images.remotePatterns`).
- Em repositório: `docs/decisions/technical-decisions-phase-03-videos.md` (TD-03, TD-06..TD-09, TD-11, TD-12), `technical-decisions-phase-02-auth-frontend.md` (TD-02, TD-05, TD-06), `technical-decisions-phase-02-auth.md` (TD-07, TD-10), `nestjs-project/src/videos/**`, `src/channels/**`, `src/auth/guards/jwt-auth.guard.ts`, `nestjs-project/compose.yaml` (`storage-init`), `next-frontend/lib/auth/session.ts`, `.claude/rules/{nestjs-controllers,auth-jwt,typeorm-migrations,next-frontend-bff-api}.md`.
