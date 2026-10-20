---
scope_type: phase
related_phases: [6]
status: decided
date: 2026-10-19
scope_description: "Fase 06 — interações sociais, backend + frontend: modelo de persistência das reações (likes/dislikes em vídeos e comentários), manutenção dos contadores denormalizados sob concorrência, contrato das mutações sociais (reação e inscrição), estado do espectador nas leituras, profundidade e modelo dos comentários aninhados, listagem/paginação de comentários e respostas, ciclo de vida do comentário, área de canais seguidos, estratégia de dados do frontend para as interações (reavaliação de video-channel-management/TD-12) e comportamento das ações sociais para o visitante anônimo."
---

# Technical Decisions — Fase 06: Interações Sociais (Likes, Comentários, Inscrições)

_Subprojects in scope:_

- `nestjs-project/` — recebe as tabelas de reações, comentários e inscrições (migrations), a escrita dos contadores denormalizados já existentes em `videos` (`like_count`, `dislike_count`, `comment_count`) e dos novos (`channels.subscriber_count`, contadores do comentário), os endpoints de reação, comentário, inscrição e feed de inscrições, e os campos de estado do espectador nas leituras públicas. TD-01 e TD-02 são exclusivos dele; TD-03..TD-08 são contratos que ele produz.
- `next-frontend/` — recebe os botões de like/dislike e de inscrição na watch page e na página do canal, a seção de comentários com respostas, o menu lateral com os canais seguidos, a página de feed das inscrições e os BFFs novos. TD-09 e TD-10 são exclusivos dele; TD-03..TD-08 são contratos que ele consome. Sem decisão aberta (composição sobre o que já foi decidido): **leitura das páginas** (RSC via `upstream`/`publicRead`, `video-channel-management/TD-12`), **destino pós-login** (`/login?returnTo=` com `safeReturnTo`, já existente), **formatação compacta de números** (`lib/format.ts`).
- repositório (raiz) — nenhuma decisão repo-wide aberta: nenhum serviço novo no compose, nenhuma chave de ambiente nova, nenhuma mudança de CI.

_Decisões herdadas que esta fase NÃO reabre:_ contadores denormalizados em `videos` com incremento na mesma transação do evento (`video-channel-management/TD-05`); cursor keyset `{ items, next_cursor }` com `DEFAULT_PAGE_LIMIT` 20 / máx. 50 (`TD-06`); autenticação opcional nas leituras públicas com "rascunho alheio → 404" (`TD-07`); nickname na URL do canal, mutável, sem redirecionamento (`TD-08`); hard delete de vídeo + job `video.delete` (`TD-09` — as tabelas novas pendem de `videos` com `ON DELETE CASCADE`); RSC + BFF + `router.refresh()` sem TanStack Query (`TD-12` — **reavaliado** em TD-09 abaixo, como o próprio TD-12 previu); IP real do visitante via `TRUST_PROXY` + `ThrottlerBehindProxyGuard` (`watch-page/TD-03`); sessão `iron-session`, mutações por Route Handler + `fetch`, sessão servida por RSC + Provider (`phase-02-auth-frontend/TD-01..TD-06`); `@nestjs/throttler` (`phase-02-auth/TD-08`); envelope de erro e `DomainException` (`phase-02-auth/TD-07`); validação `class-validator` (`TD-06`); cadeia OpenAPI → `types.gen.ts`; MSW por domínio (`next-frontend-msw-foundation`).

_Observação sobre o Figma:_ o `/screen-inventory 6` ainda não foi feito; os PNGs exportados em `docs/inventories/assets/phase-06/` mostram: na watch page (`Video show`), botão "Subscribe" + "9.88K subscribers" ao lado do canal, par like (com contagem) / dislike (**sem** contagem), "4,256 Comments" + "Sort by: Latest", caixa "Add a comment…" com avatar, e cada comentário com `@nickname`, tempo relativo, like (com contagem) / dislike (sem contagem) e "Reply"; na página do canal (`Channel Show`), "Subscribe" + "2.4M subscribers" (o sino de notificações não tem capability nesta fase); no menu lateral (`Left Menu`), "Home", "Subscriptions", seção "You" ("Your videos", "Liked videos") e seção "Subscriptions" com a lista dos canais seguidos. "Liked videos" e o sino não têm capability correspondente e ficam fora do escopo.

_Observação sobre o throttler:_ o `ThrottlerGuard` do `@nestjs/throttler` 6.5.0 gera a chave como `sha256("{Controller}-{handler}-{throttler}-{tracker}")`, ou seja, o limite global de 10 req/min vale **por rota e por visitante**, não por visitante no total. Isso pesa em TD-03 (rotas de reação disparadas em sequência) e em TD-09 (quantas leituras um `router.refresh()` refaz).

_Pesquisa:_ o MCP `context7` não está disponível neste ambiente; as versões foram conferidas nos manifestos/`node_modules` e no npm registry, e as APIs na documentação empacotada (`node_modules/next/dist/docs/01-app/02-guides/forms.md`, seção "Optimistic updates") e no código instalado do `@nestjs/throttler`. Versões instaladas: `@nestjs/core` 11.1.16, `typeorm` 0.3.28, `@nestjs/throttler` 6.5.0, PostgreSQL 17 (imagem `postgres:17` — sem `RETURNING OLD`, que só chega no 18), `next` 16.2.6, `react` 19.2.4, `radix-ui` ^1.4.3, `msw` ^2.14.6; `@tanstack/react-query` 5.104.5 no registry (não instalado).

---

## TD-01: Modelo de persistência das reações (likes/dislikes em vídeos e comentários)

**Scope:** Backend

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Like e dislike em comentários (usuários autenticados)

**Context:** cada usuário autenticado tem no máximo **uma** reação por alvo (like **ou** dislike), e o ponto de atenção "evitar múltiplos likes do mesmo usuário" é resolvido por unicidade no banco. Há dois alvos — vídeo e comentário — e a escolha define quantas tabelas existem, se as chaves estrangeiras são reais (cascata quando o vídeo/comentário é excluído, `video-channel-management/TD-09`) e como as consultas de "minha reação" (TD-04) são indexadas.

**Options:**

### Option A: Uma tabela por alvo — `video_reactions` e `comment_reactions`
- Cada uma com PK composta `(user_id, video_id)` / `(user_id, comment_id)`, coluna `value` (`like` | `dislike`, enum ou `smallint` ±1), `created_at`/`updated_at` e FKs reais com `ON DELETE CASCADE`.
- **Pros:** integridade referencial completa (excluir vídeo/comentário limpa as reações sem job); unicidade garantida pela PK; consultas e índices triviais; entidades TypeORM simples.
- **Cons:** duas entidades e dois serviços quase iguais (mitigável com uma função utilitária compartilhada); um terceiro alvo no futuro exige outra tabela.

### Option B: Tabela polimórfica `reactions(target_type, target_id, user_id, value)`
- Uma tabela única com unicidade em `(user_id, target_type, target_id)`; `target_id` sem FK.
- **Pros:** um único serviço/endpoint genérico; novos alvos sem migration de tabela.
- **Cons:** sem FK — a exclusão de vídeo/comentário precisa limpar reações à mão (no job `video.delete` e na exclusão de comentário); o TypeORM não modela relação polimórfica; integridade fica no código.

### Option C: Arco exclusivo — uma tabela com `video_id` e `comment_id` anuláveis + `CHECK` (exatamente um preenchido)
- FKs reais nas duas colunas e dois índices únicos parciais (`WHERE video_id IS NOT NULL` / `WHERE comment_id IS NOT NULL`).
- **Pros:** uma tabela com integridade referencial; cascata funciona.
- **Cons:** índices parciais e `CHECK` tornam o `ON CONFLICT` mais verboso (precisa repetir o predicado do índice); colunas sempre meio vazias; ganho sobre a Option A só em "número de tabelas".

**Recommendation:** **Option A (uma tabela por alvo)** — são exatamente dois alvos fixos pela capability, a cascata por FK combina com o hard delete de vídeos já decidido e o `INSERT … ON CONFLICT` sobre a PK fica direto; a duplicação é pequena e isolável num helper. Parâmetro a fixar junto: `value` como enum Postgres `reaction_value ('like','dislike')`, compartilhado pelas duas tabelas.

**Decision:** A (`video_reactions` + `comment_reactions` com PK composta `(user_id, alvo)`, enum Postgres `reaction_value ('like','dislike')` compartilhado e FKs `ON DELETE CASCADE`)

---

## TD-02: Manutenção dos contadores denormalizados sob concorrência

**Scope:** Backend

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Comentários em vídeos (usuários autenticados); Like e dislike em comentários (usuários autenticados); Inscrição em canais (seguir/deixar de seguir); Contagem de inscritos na página do canal

**Context:** depende de TD-01. `videos.like_count`/`dislike_count`/`comment_count` existem desde a Fase 04 (zerados) e esta fase passa a escrevê-los; ganham companhia `channels.subscriber_count` e, no comentário, `like_count`/`dislike_count`/`reply_count`. Diferente do `view_count` (Fase 05, só incrementa), uma reação **troca de estado** (nada → like → dislike → nada): o delta depende do valor anterior, e dois cliques concorrentes do mesmo usuário (duplo clique, duas abas) podem ler o mesmo "anterior" e aplicar o delta duas vezes. O PostgreSQL 17 do projeto não tem `RETURNING OLD` (só no 18), então o upsert sozinho não informa o valor anterior.

**Options:**

### Option A: Delta calculado na aplicação, na mesma transação, com lock da linha da reação
- Na transação: `SELECT value … FOR UPDATE` da reação do usuário; se não existir, `INSERT … ON CONFLICT DO NOTHING RETURNING` (e, se perder a corrida, repetir o `SELECT … FOR UPDATE`); aplica a mudança e incrementa os contadores com `col = col + :delta` (`manager.increment`), como `video-views.service.ts` já faz. Comentários e inscrições: `INSERT`/`DELETE … RETURNING` + incremento/decremento pelo número de linhas afetadas.
- **Pros:** segue o padrão já usado na Fase 05; toda a regra visível em TypeScript e coberta por testes de integração (inclusive de concorrência com requisições paralelas); usuários diferentes só disputam o lock curto do `UPDATE` da linha do vídeo.
- **Cons:** o protocolo de lock/retry precisa ser seguido em todo ponto de escrita (um caminho que esqueça gera drift); mais idas ao banco por clique.

### Option B: Triggers no banco (`AFTER INSERT/UPDATE/DELETE` nas tabelas de reação, comentário e inscrição)
- Uma função plpgsql calcula o delta a partir de `OLD`/`NEW` e atualiza os contadores; a aplicação só faz upsert/delete.
- **Pros:** correto por construção sob concorrência (o delta vem da mudança real da linha, serializada pela PK); impossível esquecer em algum caminho, inclusive em cascatas de `DELETE`.
- **Cons:** regra de negócio escondida do código e do TypeORM (só aparece nas migrations); testável apenas em integração; primeira lógica plpgsql do projeto, fora das convenções das `.claude/rules` de serviço.

### Option C: Recontagem após cada mudança (`UPDATE videos SET like_count = (SELECT count(*) …)`)
- Depois de gravar a reação, recalcula o contador inteiro a partir da tabela.
- **Pros:** autocorretivo — um drift anterior é apagado na próxima escrita; sem cálculo de delta.
- **Cons:** `COUNT` proporcional ao volume por clique; em `READ COMMITTED` duas transações concorrentes ainda podem gravar uma contagem que não vê a reação da outra (precisa de lock na linha do alvo antes de contar); vira gargalo em vídeos populares.

**Recommendation:** **Option A (delta na aplicação, mesma transação, lock da linha da reação)** — mantém o padrão de escrita já adotado para `view_count`, deixa a regra no código revisado e testado e resolve a corrida do mesmo usuário com o lock da própria linha da reação; a Option B só compensa se o número de caminhos de escrita crescer a ponto de o drift se tornar provável. Parâmetro a fixar junto: um teste de integração com N requisições paralelas do mesmo usuário provando contador == `COUNT(*)` ao final; job de reconciliação fica fora até existir drift observado.

**Decision:** A (delta calculado na aplicação na mesma transação: `SELECT … FOR UPDATE` da reação + `INSERT … ON CONFLICT DO NOTHING` com retry + `increment`/`decrement` atômicos; teste de integração com requisições paralelas provando contador == `COUNT(*)`; sem job de reconciliação)

---

## TD-03: Contrato das mutações sociais — reação e inscrição

**Scope:** Cross-layer

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Like e dislike em comentários (usuários autenticados); Inscrição em canais (seguir/deixar de seguir); Interface completa de comentários, likes e inscrições

**Context:** depende de TD-01 e TD-02. Os botões de like/dislike (vídeo e comentário) e "Subscribe" são alternâncias: o cliente precisa saber o resultado final (estado + contadores) para reconciliar a UI otimista (TD-09). A semântica — "defina o estado" vs "inverta o estado" — decide se repetir uma requisição (retry de rede, duplo clique) é seguro. Cross-layer: rotas Nest, Route Handlers BFF, `types.gen.ts` e handlers MSW.

**Options:**

### Option A: Set-state idempotente (`PUT` / `DELETE` sobre o sub-recurso)
- `PUT /videos/{publicId}/reaction` com `{ value: 'like' | 'dislike' }` e `DELETE /videos/{publicId}/reaction`; idem `PUT|DELETE /comments/{commentId}/reaction` e `PUT|DELETE /channels/{nickname}/subscription`. Todas respondem `200` com o estado resultante: `{ viewer_reaction, like_count, dislike_count }` ou `{ subscribed, subscriber_count }`.
- **Pros:** repetir a mesma requisição não muda nada (idempotência HTTP real); o cliente sempre declara a intenção, então cliques rápidos convergem para o último; a resposta reconcilia contadores sem nova leitura.
- **Cons:** quatro verbos×recursos a documentar no OpenAPI; o cliente precisa saber o estado atual para escolher `PUT` vs `DELETE` (já o tem por TD-04).

### Option B: Toggle (`POST .../like`, `POST .../dislike`, `POST .../subscribe`)
- O servidor inverte o estado atual a cada chamada.
- **Pros:** o cliente não precisa conhecer o estado; menos campos no corpo.
- **Cons:** não idempotente — um retry ou duplo clique desfaz a ação; cliques rápidos com UI otimista divergem do servidor; semântica "like quando já há dislike" precisa ser definida à parte.

### Option C: Recurso genérico `POST /reactions` / `DELETE /reactions/{id}`
- Corpo `{ target_type, target_id, value }`, espelhando um modelo polimórfico.
- **Pros:** uma rota para todos os alvos.
- **Cons:** expõe IDs internos e o tipo do alvo ao cliente; acopla o contrato à Option B de TD-01; autorização por alvo vira `switch`; não cobre inscrição.

**Recommendation:** **Option A (set-state idempotente com o estado resultante na resposta)** — a única em que retry e clique repetido são seguros, o que é pré-requisito para a UI otimista de TD-09; a resposta com contadores elimina uma leitura extra por clique. Parâmetros a fixar junto: reagir/comentar exige vídeo legível e `published` (rascunho → 404, coerente com `video-channel-management/TD-07`); inscrever-se no próprio canal → 422 `CANNOT_SUBSCRIBE_OWN_CHANNEL` (o dono pode curtir o próprio vídeo); `@Throttle` próprio nas rotas de reação (ex.: 60/min por visitante), já que o limite global de 10/min por rota esgota ao curtir vários comentários seguidos.

**Decision:** A (`PUT`/`DELETE` idempotentes em `/videos/{publicId}/reaction`, `/comments/{commentId}/reaction` e `/channels/{nickname}/subscription`, `200` com o estado resultante; reagir/comentar só em vídeo legível e `published`; auto-inscrição → 422 `CANNOT_SUBSCRIBE_OWN_CHANNEL`; `@Throttle` próprio ~60/min nas rotas de reação)

**Revisions:**
- 2026-10-20 — Listar comentários (`GET /videos/{publicId}/comments`) também exige vídeo `published` (rascunho/processamento → 404, mesmo para o dono); na watch page de um vídeo não publicado aberto pelo dono, o par like/dislike e a seção de comentários não são renderizados (canal e contagem de inscritos continuam). Rationale: AMB-2 do `/plan-validate 6`, escolha do usuário (ocultar até publicar).

---

## TD-04: Estado do espectador e contagem de inscritos nas leituras

**Scope:** Cross-layer

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Like e dislike em comentários (usuários autenticados); Inscrição em canais (seguir/deixar de seguir); Contagem de inscritos na página do canal; Interface completa de comentários, likes e inscrições

**Context:** para renderizar os botões no estado certo, a watch page precisa de "minha reação ao vídeo" e "estou inscrito no canal?", a página do canal precisa de "estou inscrito?" e `subscriber_count`, e cada comentário precisa de "minha reação". As leituras já usam autenticação opcional (`video-channel-management/TD-07`) e são dinâmicas por sessão, então o dado pessoal pode viajar nelas ou em chamadas próprias. Cross-layer: muda (ou não) shapes já consumidos — `VideoResponse` (watch page e estúdio) e `ChannelPublicResponse`.

**Options:**

### Option A: Campos do espectador nas respostas existentes
- `GET /videos/{publicId}` ganha `viewer_reaction` (`'like' | 'dislike' | null`) e o `channel` embutido ganha `subscriber_count` + `viewer_subscribed`; `GET /channels/{nickname}` ganha `subscriber_count` + `viewer_subscribed`; cada item de comentário (TD-06) traz `viewer_reaction`. Anônimo recebe `null`/`false`.
- **Pros:** zero chamada extra por página (importa com o limite por rota do throttler); o RSC renderiza o estado correto já no HTML, sem flicker; uma consulta por PK por campo.
- **Cons:** respostas deixam de ser iguais para todos os leitores (já não eram: o dono vê rascunhos); o polling do estúdio passa a pagar duas consultas pequenas à toa.

### Option B: Endpoints dedicados de estado
- `GET /videos/{publicId}/reaction` e `GET /channels/{nickname}/subscription`, chamados pelo RSC só quando há sessão; comentários com um `GET /videos/{publicId}/comments/reactions?ids=` em lote.
- **Pros:** shapes públicos intocados; dado pessoal separado do dado compartilhável.
- **Cons:** 2–3 chamadas a mais por render da watch page; o lote de reações dos comentários precisa acompanhar cada página carregada no cliente; mais BFFs e handlers MSW.

### Option C: Estado buscado no cliente após a hidratação
- O HTML sai neutro; componentes cliente consultam o estado via BFF ao montar.
- **Pros:** páginas idênticas para todos (cacheáveis no futuro).
- **Cons:** botões "piscam" do neutro para o estado real; contraria o RSC-first de `video-channel-management/TD-12`; mesmas chamadas extras da Option B, agora do navegador.

**Recommendation:** **Option A (campos do espectador nas respostas existentes)** — as leituras já são personalizadas por sessão, o estado chega correto no primeiro HTML e o custo é uma consulta por PK, sem multiplicar chamadas sob o throttler por rota. `subscriber_count` é público e pertence ao shape do canal de qualquer forma (capability "Contagem de inscritos"). Observação para o `/screen-inventory 6`: o Figma não exibe a contagem de dislikes (vídeo nem comentário); o contrato mantém `dislike_count` (já existe desde a Fase 04) e a UI decide não exibi-lo.

**Decision:** A (`viewer_reaction` em `GET /videos/{publicId}` e nos itens de comentário; `subscriber_count` + `viewer_subscribed` no canal embutido do vídeo e em `GET /channels/{nickname}`; anônimo recebe `null`/`false`; `dislike_count` segue no contrato, a UI não o exibe)

---

## TD-05: Profundidade das respostas e modelo dos comentários aninhados

**Scope:** Cross-layer

**Capability:** Respostas a comentários (comentários aninhados)

**Context:** o ponto de atenção do plano pede explicitamente "definir até quantos níveis de resposta serão permitidos para manter a interface organizada". A profundidade dita o modelo de dados (`parent_id` simples, caminho materializado ou CTE recursiva), o formato da listagem (TD-06), a regra de exclusão (TD-07) e o layout da thread no frontend — por isso é Cross-layer.

**Options:**

### Option A: Um nível (modelo YouTube)
- `comments.parent_id` só pode apontar para um comentário raiz; "Reply" numa resposta cria outra resposta **na mesma thread**, com `@nickname` do destinatário pré-preenchido no texto. A raiz guarda `reply_count`.
- **Pros:** consulta e paginação triviais (raízes por vídeo; respostas por raiz); layout fixo com um recuo; exclusão e contadores simples; o que o Figma sugere (lista plana com "Reply").
- **Cons:** conversas longas dentro de uma thread perdem a estrutura de "quem respondeu a quem" (mitigado pela menção).

### Option B: Árvore ilimitada (adjacency list + CTE recursiva)
- Qualquer comentário pode ser respondido; a leitura monta a árvore com `WITH RECURSIVE`.
- **Pros:** estrutura fiel da conversa.
- **Cons:** paginação de árvore é difícil (paginar em que nível?); recuo infinito quebra o layout, sobretudo no mobile (Fase 07); exclusão de nós internos complica contadores e cascata.

### Option C: Profundidade limitada (ex.: 3 níveis) com caminho materializado
- Coluna `path`/`depth`; respostas além do limite viram irmãs no último nível.
- **Pros:** alguma estrutura sem recuo infinito.
- **Cons:** combina a complexidade de leitura da Option B com regras de "achatamento" no limite; mais casos de teste e de UI para pouco ganho.

**Recommendation:** **Option A (um nível, respostas agrupadas na raiz com menção)** — responde o ponto de atenção com o modelo das plataformas de referência, mantém a paginação no padrão keyset já existente e cabe no layout do Figma. Parâmetro a fixar junto: `videos.comment_count` conta raízes **e** respostas (como "4,256 Comments" no Figma); `reply_count` da raiz conta só as respostas.

**Decision:** A (um nível: `parent_id` só aponta para raiz, "Reply" numa resposta cria resposta na mesma thread com `@nickname` pré-preenchido; `comment_count` do vídeo conta raízes + respostas, `reply_count` da raiz só respostas)

---

## TD-06: Listagem de comentários e respostas — contrato, ordenação e paginação

**Scope:** Cross-layer

**Capability:** Transversal — covers: Comentários em vídeos (usuários autenticados); Respostas a comentários (comentários aninhados); Interface completa de comentários, likes e inscrições

**Context:** depende de TD-05. Um vídeo pode ter milhares de comentários (o Figma mostra 4.256), então a lista é paginada; o Figma mostra "Sort by: Latest", sugerindo mais de uma ordenação. Leitura pública (anônimos leem comentários), com `viewer_reaction` por item conforme TD-04. Cross-layer: rotas, envelope, ordenação e quando as respostas são carregadas.

**Options:**

### Option A: Raízes paginadas + respostas sob demanda
- `GET /videos/{publicId}/comments?sort=latest|top&cursor=&limit=` devolve só raízes no envelope keyset `{ items, next_cursor }` (`video-channel-management/TD-06`), cada item com `reply_count`; `GET /comments/{commentId}/replies?cursor=` devolve respostas em ordem cronológica (mais antigas primeiro), carregadas ao clicar em "N replies". Item: `{ id, text, author: { nickname, name }, created_at, edited_at, like_count, dislike_count, reply_count, viewer_reaction }`.
- **Pros:** cada requisição é limitada e indexável (`(video_id, created_at, id)` e `(video_id, like_count, id)` para raízes; `(parent_id, created_at, id)` para respostas); a watch page carrega só a primeira página de raízes; reaproveita `encodeCursor`/`decodeCursor` (que já suportam ordenações nomeadas).
- **Cons:** uma ida ao servidor por thread expandida; duas rotas e dois BFFs.

### Option B: Raízes com as primeiras N respostas embutidas + continuação
- Cada raiz traz até 2–3 respostas; "ver mais" usa a rota de respostas.
- **Pros:** threads curtas aparecem sem clique.
- **Cons:** consulta lateral por página (N+1 ou `LATERAL JOIN`); o cursor de continuação das respostas precisa partir da última embutida; o Figma não mostra respostas pré-expandidas.

### Option C: Threads completas numa única rota
- Cada página de raízes já vem com todas as respostas.
- **Pros:** uma chamada; nenhum estado de expansão no cliente.
- **Cons:** tamanho de resposta ilimitado (uma thread popular com centenas de respostas); paginação só no nível de raiz.

**Recommendation:** **Option A (raízes paginadas + respostas sob demanda)** — segue o envelope keyset já adotado, mantém cada resposta limitada e casa com o "Reply"/"N replies" da interface. Parâmetro a fixar junto: ordenações `latest` (default, como no Figma) e `top` (`like_count DESC`, desempate por `created_at`/`id`); se a ordenação `top` não for desejada nesta fase, o `/screen-inventory 6` pode reduzir o seletor a `latest`.

**Decision:** A (`GET /videos/{publicId}/comments?sort=latest|top&cursor=&limit=` só com raízes no envelope keyset, `latest` default; `GET /comments/{commentId}/replies?cursor=` em ordem cronológica, carregado sob demanda)

**Revisions:**
- 2026-10-20 — Item de comentário (raiz e resposta) ganha `viewer_is_author: boolean` por espectador (anônimo → `false`), no mesmo espírito de `viewer_reaction` (TD-04); a UI usa o campo para mostrar o menu "⋮" (Edit/Delete) e a API continua validando a autoria (403 para não autor). Rationale: AMB-1 do `/plan-validate 6`, escolha do usuário.

---

## TD-07: Ciclo de vida do comentário — edição, exclusão e regras de escrita

**Scope:** Cross-layer

**Capability:** Transversal — covers: Comentários em vídeos (usuários autenticados); Respostas a comentários (comentários aninhados); Interface completa de comentários, likes e inscrições

**Context:** depende de TD-05 e TD-02. A capability pede "interface completa de comentários", mas não diz se o autor pode editar ou apagar. Apagar uma raiz com respostas obriga a decidir o que acontece com a thread e com `comment_count`/`reply_count`. Cross-layer: rotas `PATCH`/`DELETE`, campo `edited_at`, menu "⋮" por comentário e estados de "comentário removido" na UI.

**Options:**

### Option A: Somente criação
- Comentários e respostas são imutáveis; sem edição nem exclusão.
- **Pros:** menor superfície (nenhuma rota extra, nenhuma regra de cascata nos contadores).
- **Cons:** autor não corrige erro de digitação nem remove algo que se arrependeu de publicar; dificilmente atende "interface completa".

### Option B: Autor edita e exclui; exclusão física com cascata
- `PATCH /comments/{id}` (só o autor; grava `edited_at`, exibido como "(edited)") e `DELETE /comments/{id}` (só o autor); apagar uma raiz apaga as respostas por FK `ON DELETE CASCADE`, decrementando `comment_count` em `1 + reply_count` na mesma transação; apagar uma resposta decrementa `reply_count` da raiz e `comment_count` do vídeo.
- **Pros:** cobre o ciclo básico com uma regra simples; nada de "fantasmas" na lista; coerente com o hard delete de vídeos.
- **Cons:** apagar uma raiz remove respostas de outras pessoas.

### Option C: Autor edita e exclui; exclusão lógica quando há respostas
- Raiz com respostas vira placeholder "Comment deleted" (`deleted_at`, texto apagado) e a thread continua; sem respostas, exclusão física.
- **Pros:** preserva a conversa dos outros participantes.
- **Cons:** dois caminhos de exclusão; placeholders a renderizar, paginar e contar (contam em `comment_count`?); mais casos de teste.

**Recommendation:** **Option B (autor edita e exclui; exclusão física com cascata)** — fecha a "interface completa" com o menor número de regras e reaproveita a cascata por FK de TD-01 e o padrão de hard delete do projeto; a perda das respostas ao apagar a raiz é o mesmo comportamento das plataformas de referência. Parâmetros a fixar junto: texto puro de 1 a 2.000 caracteres após `trim` (sem HTML/markdown; quebras de linha preservadas); comentar só em vídeos `published` (público ou unlisted); moderação pelo dono do vídeo fica fora desta fase (sem capability).

**Decision:** B (autor edita — `edited_at` — e exclui; exclusão física com cascata das respostas e decremento de `1 + reply_count`; texto puro de 1 a 2.000 caracteres após `trim`; só em vídeos `published`; moderação pelo dono do vídeo fora desta fase)

---

## TD-08: Área de canais seguidos com acesso rápido aos vídeos

**Scope:** Cross-layer

**Capability:** Área de canais seguidos com acesso rápido aos vídeos

**Context:** a capability não diz a forma da "área". O Figma (`Left Menu`, `Channel Show`) traz um menu lateral com a entrada "Subscriptions" e uma seção "Subscriptions" listando os canais seguidos. Hoje o `(app)/layout.tsx` só tem o `AppHeader` — não há menu lateral. A navegação geral (header, busca, responsividade) é da Fase 07, então esta decisão também fixa **quanto** do menu lateral nasce agora. Cross-layer: define os endpoints de leitura das inscrições (lista de canais e/ou feed de vídeos) e as rotas do frontend.

**Options:**

### Option A: Menu lateral com a lista de canais + página de feed das inscrições
- Menu lateral no layout autenticado com "Subscriptions" (→ `/feed/subscriptions`) e a seção com os canais seguidos (→ `/channel/{nickname}`); a página `/feed/subscriptions` lista os vídeos públicos recentes dos canais seguidos. API: `GET /me/subscriptions` (canais, cursor) e `GET /me/subscriptions/videos` (keyset por `published_at`, itens `VideoCardItem`, montado na leitura por join com `subscriptions`).
- **Pros:** é o desenho do Figma; "acesso rápido aos vídeos" literal (um clique para ver o que saiu de novo); o feed por join na leitura é uma consulta indexada, sem fan-out na escrita.
- **Cons:** dois endpoints e uma página nova; o menu lateral é uma peça de layout que a Fase 07 vai estender (colapso, responsivo).

### Option B: Página `/subscriptions` com os canais e os N vídeos mais recentes de cada
- Sem menu lateral; a página agrupa por canal.
- **Pros:** um endpoint; nenhuma mudança de layout.
- **Cons:** consulta "top-N por grupo" (`LATERAL`) e paginação por canal; diverge do Figma; o acesso exige navegar até a página.

### Option C: Só a lista de canais no menu lateral
- Os links levam à página pública do canal (Fase 04), que já lista os vídeos.
- **Pros:** um endpoint, reaproveita a página do canal.
- **Cons:** não há visão consolidada do que é novo — "acesso rápido aos vídeos" vira "acesso rápido aos canais"; a entrada "Subscriptions" do Figma fica sem destino.

**Recommendation:** **Option A (menu lateral + feed `/feed/subscriptions`)** — é a leitura direta do Figma e da capability, e o feed por join na leitura não exige nada além de índices. Parâmetro a fixar junto: o menu lateral nasce nesta fase visível apenas com sessão e só com o que existe ("Home", "Subscriptions", "Your videos" → `/studio/videos` e a seção de canais seguidos); "Liked videos" não tem capability e fica de fora; colapso pelo ícone "≡" e comportamento mobile ficam para a Fase 07.

**Decision:** A (menu lateral visível com sessão — Home, Subscriptions, Your videos e a lista de canais seguidos — + página `/feed/subscriptions`; `GET /me/subscriptions` e `GET /me/subscriptions/videos` por join na leitura; "Liked videos" fora; colapso/mobile na Fase 07)

**Revisions:**
- 2026-10-20 — Lista de canais seguidos do menu lateral: `GET /me/subscriptions` ordenado por nome do canal (alfabético, desempate por id) em cursor keyset; o menu mostra os 7 primeiros e um "Show more" carrega/expande o restante. Rationale: OQ-3 do `/plan-validate 6`, escolha do usuário.
- 2026-10-20 — Fase 07 (`home-search-production/TD-05`): o menu lateral passa a ser visível também para o visitante anônimo, com "Home" e um convite para entrar; "Subscriptions", "Your videos" e a lista de canais seguidos continuam só com sessão. Colapso pelo "≡" e drawer mobile entram na mesma fase. Rationale: ICC-1 do `/plan-validate 7`, escolha do usuário.

---

## TD-09: Estratégia de dados do frontend para as interações (reavaliação de `video-channel-management/TD-12`)

**Scope:** Frontend

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Comentários em vídeos (usuários autenticados); Respostas a comentários (comentários aninhados); Like e dislike em comentários (usuários autenticados); Inscrição em canais (seguir/deixar de seguir); Interface completa de comentários, likes e inscrições

**Context:** `video-channel-management/TD-12` fixou RSC + BFF + `router.refresh()` após mutação e pediu reavaliação nesta fase ("likes/comentários otimistas"). Na watch page, um `router.refresh()` refaz `GET /videos/{id}`, `/playback` (nova URL assinada), `/related` e a primeira página de comentários — e, com o throttler limitando 10 req/min **por rota e por visitante**, uma dezena de cliques num minuto faria a própria página receber 429. Além disso, respostas expandidas e páginas extras de comentários carregadas no cliente não fazem parte do payload do RSC. A decisão é como os componentes refletem mutações e paginam listas sem recarregar a rota.

**Options:**

### Option A: Estado local com `useOptimistic` + reconciliação pela resposta; sem `router.refresh()` nas interações
- Botões de reação/inscrição: estado inicial vindo do RSC (TD-04), `useOptimistic` dentro de `startTransition` durante a requisição ao BFF, e o estado confirmado substituído pela resposta da mutação (TD-03); erro reverte e exibe toast. Comentários: primeira página renderizada no RSC; "mais comentários", respostas e o comentário recém-criado gerenciados em estado local do componente cliente via BFF. A lista do menu lateral (TD-08) é atualizada por um contexto cliente compartilhado com o botão "Subscribe".
- **Pros:** zero dependência nova; `useOptimistic` é o padrão documentado no guia `forms.md` do Next 16; nenhuma leitura refeita por clique (respeita o throttler); o resto da app continua no padrão de TD-12.
- **Cons:** estado de lista (paginação, inserção, remoção) escrito à mão no componente de comentários; sincronização entre botões que mostram o mesmo dado (ex.: dois "Subscribe" na mesma página) fica a cargo do contexto.

### Option B: Adotar TanStack Query 5 (`@tanstack/react-query` 5.104.5)
- `QueryClientProvider` no layout, `useInfiniteQuery` para comentários/respostas, `useMutation` com `onMutate` otimista e `setQueryData` a partir da resposta.
- **Pros:** paginação infinita, cache compartilhado entre componentes e rollback otimista prontos; o "Subscribe" e o menu lateral leem a mesma query.
- **Cons:** dependência + Provider + hidratação (`HydrationBoundary`) novos para uma fração da app; dois caminhos de leitura (RSC e `queryFn` via BFF) a manter coerentes; testes de componente passam a precisar de `QueryClient`.

### Option C: Manter `router.refresh()` após cada mutação
- Os botões aguardam o BFF e chamam `router.refresh()`; a página re-renderiza com os dados novos.
- **Pros:** nenhum padrão novo; um único caminho de leitura.
- **Cons:** cada clique refaz 4–5 leituras upstream (incluindo nova URL assinada de playback) e esgota o throttler por rota; latência visível no botão; comentários carregados no cliente não são atualizados pelo refresh.

**Recommendation:** **Option A (`useOptimistic` + reconciliação pela resposta, sem `router.refresh()` nas interações)** — atende a UI otimista com primitivos do React 19 já usados pelo Next 16, não multiplica leituras sob o throttler e mantém TD-12 válido para o resto da app; a Option B passa a se pagar se a Fase 07 (home com scroll infinito, busca) trouxer mais listas paginadas no cliente, e a migração continua aditiva.

**Decision:** A (`useOptimistic` + reconciliação pela resposta da mutação, sem `router.refresh()` nas interações; primeira página de comentários no RSC e o resto paginado no cliente via BFF; contexto cliente compartilhado entre "Subscribe" e o menu lateral; TanStack Query reavaliado na Fase 07)

**Renders in:** frontend-runtime

---

## TD-10: Ações sociais para o visitante anônimo

**Scope:** Frontend

**Capability:** Transversal — covers: Like e dislike em vídeos (usuários autenticados); Comentários em vídeos (usuários autenticados); Like e dislike em comentários (usuários autenticados); Inscrição em canais (seguir/deixar de seguir); Interface completa de comentários, likes e inscrições

**Context:** a watch page e a página do canal são públicas (Fase 05), mas reagir, comentar, responder e inscrever-se exigem sessão. O mesmo comportamento precisa valer em seis controles (like/dislike do vídeo, like/dislike do comentário, caixa de comentário, "Reply", "Subscribe"), e o Figma só desenha o estado autenticado. O destino pós-login já existe (`/login?returnTo=` com `safeReturnTo`).

**Options:**

### Option A: Controles visíveis; clique leva ao login com `returnTo`
- Contadores e botões aparecem iguais para todos; para o anônimo, o clique navega para `/login?returnTo=/watch/{id}` (ou a página do canal); a caixa de comentário vira um link "Sign in to comment".
- **Pros:** nenhum componente novo; reaproveita `returnTo`; o anônimo vê os números (contagem de inscritos é capability).
- **Cons:** o usuário sai da página sem aviso prévio do motivo; o clique original não é reaplicado após o login (precisa clicar de novo).

### Option B: Popover "Sign in to …" ancorado no controle (padrão YouTube)
- O clique abre um `Popover` (Radix) com uma frase curta e o botão "Sign in" (`returnTo` da página atual).
- **Pros:** explica o motivo sem tirar o usuário da página; padrão familiar.
- **Cons:** componente/estado novo em seis controles sem desenho no Figma; mais testes de interação.

### Option C: Ocultar ou desabilitar os controles para o anônimo
- Botões desabilitados (com tooltip) e caixa de comentário ausente.
- **Pros:** o mais simples de implementar.
- **Cons:** controles desabilitados não comunicam o caminho para habilitá-los; perde a conversão para cadastro; a caixa ausente muda o layout entre os dois estados.

**Recommendation:** **Option A (controles visíveis; clique → `/login?returnTo=`)** — reaproveita o fluxo de `returnTo` já implementado, mantém o layout idêntico ao desenhado e não exige um componente sem referência no Figma; a Option B é uma evolução de UX que pode vir depois sem mudar contrato.

**Decision:** A (controles e contadores visíveis para todos; clique do anônimo → `/login?returnTo=<página atual>`; caixa de comentário vira link "Sign in to comment")

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Backend | Modelo de persistência das reações | A — `video_reactions` + `comment_reactions` com PK composta e FK em cascata | **A** |
| TD-02 | Backend | Contadores denormalizados sob concorrência | A — delta na aplicação, mesma transação, lock da linha da reação | **A** |
| TD-03 | Cross-layer | Contrato das mutações sociais (reação e inscrição) | A — `PUT`/`DELETE` idempotentes devolvendo o estado resultante | **A** |
| TD-04 | Cross-layer | Estado do espectador e contagem de inscritos nas leituras | A — `viewer_reaction`/`viewer_subscribed`/`subscriber_count` nas respostas existentes | **A** |
| TD-05 | Cross-layer | Profundidade das respostas | A — um nível, respostas agrupadas na raiz com `@menção` | **A** |
| TD-06 | Cross-layer | Listagem de comentários e respostas | A — raízes paginadas (`latest`/`top`) + respostas sob demanda | **A** |
| TD-07 | Cross-layer | Ciclo de vida do comentário | B — autor edita e exclui; exclusão física com cascata | **B** |
| TD-08 | Cross-layer | Área de canais seguidos | A — menu lateral com canais + feed `/feed/subscriptions` | **A** |
| TD-09 | Frontend | Estratégia de dados das interações (reavalia `video-channel-management/TD-12`) | A — `useOptimistic` + reconciliação pela resposta, sem `router.refresh()` | **A** |
| TD-10 | Frontend | Ações sociais para o visitante anônimo | A — controles visíveis; clique → `/login?returnTo=` | **A** |

_Dependências entre TDs:_ TD-02 → TD-01 (o que é contado) e `video-channel-management/TD-05` (colunas existentes); TD-03 → TD-01/TD-02 (a resposta carrega os contadores) e `video-channel-management/TD-07`/`TD-08` (regra de leitura; nickname na rota de inscrição); TD-04 → `video-channel-management/TD-07` (autenticação opcional); TD-06 → TD-05 (o que é raiz e o que é resposta), TD-04 (`viewer_reaction` por item) e `video-channel-management/TD-06` (envelope keyset); TD-07 → TD-05 (cascata só em um nível) e TD-02 (decremento); TD-08 → `video-channel-management/TD-06` (feed paginado) e reaproveita `VideoCardItem` (`watch-page/TD-04`); TD-09 → TD-03 (reconciliação pela resposta), TD-04 (estado inicial no RSC), TD-06 (paginação no cliente) e TD-08 (lista do menu lateral atualizada pelo "Subscribe"); TD-10 → TD-04 (o anônimo recebe `null`/`false`).
