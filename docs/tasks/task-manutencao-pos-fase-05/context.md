---
kind: task
name: task-manutencao-pos-fase-05
sources_mtime:
  docs/decisions/technical-decisions-watch-page.md: "2026-10-20T02:51:17Z"
  docs/decisions/technical-decisions-saneamento-fase-02-e-infra.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-19T20:16:01Z"
  docs/decisions/technical-decisions-saneamento-fase-04.md: "2026-10-19T21:30:21Z"
  docs/phases/phase-05-watch-page/context.md: "2026-10-20T02:42:59Z"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-10-17T13:27:45Z"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-10-19T22:27:48Z"
---

# task-manutencao-pos-fase-05 — Context

## Scope

> manutenção após a Fase 05. (1) nestjs-project/compose.yaml: dar ao serviço db um volume nomeado para os dados do PostgreSQL, para que recriar a rede streamtube ou o container não apague o banco de desenvolvimento; atualizar o aviso de nestjs-project/CLAUDE.md (seção 'IP real do visitante atrás do BFF') que hoje manda rodar migration:run de novo após recriar a rede. (2) nestjs-project/compose.yaml: acrescentar ip_range ao ipam da rede streamtube (sub-rede 172.30.0.0/24), de modo que os IPs dinâmicos dos containers do backend nunca possam ocupar 172.30.0.10, o IP fixo do next-frontend em que a API confia (TRUST_PROXY). (3) next-frontend/app/globals.css: o token tipográfico --text-overlay colide com o token de cor --color-overlay — a classe text-overlay gera tamanho de fonte e cor #00000080 ao mesmo tempo, o que deixou o tempo do player quase invisível na Fase 05; renomear o token tipográfico (ou removê-lo, se continuar sem uso) e registrar o nome novo no extendTailwindMerge de lib/utils.ts, sem regressão visual nas telas existentes. (4) next-frontend: a página app/(app)/studio/videos/[publicId]/edit/page.tsx mantém uma cópia local de requestOrigin(); passar a usar lib/request-origin.ts, criado na Fase 05. (5) next-frontend: investigar por que npx shadcn@latest add slider resolveu o alias de utils como o pacote npm cn (gerou import { cn } from "cn" e o adicionou ao package.json), embora components.json declare utils = @/lib/utils, e corrigir a configuração ou documentar no next-frontend/CLAUDE.md o procedimento seguro para os próximos installs.

## Decisions Index

_No TDs._

## Decisions Detail

_No current-scope TDs._

## Inherited Decisions Detail

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

### saneamento-fase-02-e-infra/TD-01

**Recommendation:** resolve o `host.docker.internal` com duas declarações de rede, mantém intactos todos os comandos documentados e a premissa de `openapi-typing/TD-02`, e deixa a consolidação em compose único (Option C) como candidata natural para a entrada da Fase 03, quando o número de serviços justificar a reescrita da documentação.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-02

**Recommendation:** é a única que executa TD-07 como decidido, com custo de uma variável de ambiente e sem alterar contratos já publicados no `openapi.json`.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-03

**Recommendation:** preserva TD-07 e elimina a falha mais provável do fluxo com uma mudança de poucas linhas, sem reduzir segurança porque o token de confirmação não concede sessão.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-04

**Recommendation:** as primitivas e os tokens já cobrem o visual, e a lista de estados fechada aqui é o que `/plan-build` precisa para gerar os SIs sem inventário.
**Libraries:** —

**Revisions:**
- 2026-10-18 — A lista fechada de estados ganha a tela standalone `/resend-confirmation` (`app/(auth)/resend-confirmation/page.tsx`): mesma composição `Card` + `BrandLogo` + `AuthFooter` e reuso do `ResendConfirmationForm` já entregue no SI-8, servindo de destino ao link que `login-form.tsx` exibe em `403 EMAIL_NOT_CONFIRMED`. Entregue como SI-11 (append-mode manual). Rationale: a revisão de alinhamento com a documentação (README/MBA) encontrou o link apontando para uma rota inexistente (404) desde a Fase 02; a Option A permanece — nenhuma fonte visual nova, só mais um estado derivado do padrão de `/forgot-password`.

### saneamento-fase-02-e-infra/TD-05

**Recommendation:** é o único host que sobrevive às fases seguintes e fecha a capability "Logout" da Fase 02 usando exclusivamente mecanismos já decididos (TD-06 do frontend).
**Libraries:** —

### saneamento-fase-02-e-infra/TD-06

**Recommendation:** entrega a dívida documentada sem ampliar o escopo; registrar as Options B e C como tasks futuras (`ci-backend-openapi-export` e `ci-quality-gates`) a planejar antes da Fase 03, quando o número de endpoints crescer.
**Libraries:** —

### saneamento-fase-02-e-infra/TD-07

**Recommendation:** é o mínimo que torna o Git Flow verificável no histórico; a Option B pode ser aplicada manualmente depois do primeiro PR, quando o status check de TD-06 existir.
**Libraries:** —

### phase-03-videos/TD-01

**Recommendation:** é a única alternativa livre que cobre todas as operações exigidas pelas TDs 03/09/12 (presigned multipart, CORS, `response-content-disposition`, lifecycle) com um container, um volume e console web, mantendo o backend acoplado apenas à API S3 (TD-02) para que produção use S3 real ou outro servidor sem mudar código. O risco de maturidade é mitigado por um smoke test obrigatório na primeira SI de storage; **Garage (B) é o fallback** se o smoke test falhar. Contrato de ambiente proposto (chaves canônicas para Joi + compose + `.env.example`): `S3_ENDPOINT` (interno, `http://rustfs:9000`), `S3_PUBLIC_ENDPOINT` (voltado ao navegador, `http://localhost:9000` em dev — base das URLs pré-assinadas de upload/stream), `S3_REGION` (`us-east-1`, exigido pelo SDK), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (`streamtube-videos`), `S3_FORCE_PATH_STYLE=true`.
**Libraries:** —

### phase-03-videos/TD-02

**Recommendation:** mantém o backend acoplado somente à API S3, o que é a razão de ser de TD-01, e tem o ecossistema de mocks que TD-13 usa nos unit tests. A configuração obrigatória (`forcePathStyle`, `WHEN_REQUIRED` nos dois checksums, cliente interno vs. cliente de assinatura pública) vira parte do contrato do `StorageModule`.
**Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

### phase-03-videos/TD-03

**Recommendation:** é a única que cumpre literalmente "10 GB sem impacto na performance" e "retomar após falha", porque o backend só orquestra metadados e o storage recebe os bytes; o custo (CORS + endpoint público + fatiamento no cliente) é pago uma vez pela fatia de UI. A exceção ao Strict BFF fica explícita e limitada: o navegador só fala com `S3_PUBLIC_ENDPOINT` usando URLs assinadas que a API emite via BFF — nunca com `nestjs-api`. Parâmetros propostos: `UPLOAD_PART_SIZE` (default 64 MiB, mínimo 5 MiB, configurável para que TD-13 teste multipart com partes de 5 MiB), `UPLOAD_MAX_BYTES` (10 GiB), `UPLOAD_URL_TTL` (ex.: 1 h por lote de partes).
**Libraries:** —

### phase-03-videos/TD-04

**Recommendation:** entrega todos os primitivos que TD-11 e TD-12 pedem (chave singleton por vídeo, retry com backoff, `startAfter` para limpeza, expiração de jobs travados) sobre o PostgreSQL já presente, sem novo container em dev/testes/produção e sem apostar em um backend de três meses (B). **A (BullMQ + Redis) é uma escolha igualmente válida** se o time preferir a integração Nest nativa e já antever dashboards/escala horizontal; o custo é um serviço a mais em cada ambiente e no `cleanAllTables` dos testes. B fica como candidato a supersede quando `nestjs/bull#2924` for lançado.
**Libraries:** pg-boss

### phase-03-videos/TD-05

**Recommendation:** mantém um só código-base para entidades, config e testes (sem introduzir workspaces nesta fase) e, ao mesmo tempo, isola o processamento em um container próprio como o C4 prevê. O custo do ffmpeg na imagem compartilhada é aceitável em dev; a imagem de produção pode usar build arg/stage para omiti-lo na API, decisão que pertence à Fase 07.
**Libraries:** —

### phase-03-videos/TD-06

**Recommendation:** evita qualquer cópia do vídeo, usa o binário mantido pela distro e segue a orientação do próprio autor do `fluent-ffmpeg` (chamar o processo sem wrapper). A thumbnail nasce em `/tmp` do worker e sobe para `thumbnails/{publicId}/auto.jpg` via TD-02. A versão 5.1.9 do bookworm é suficiente; migrar para `trixie-slim` (7.1.5) fica como ajuste opcional registrado na SI do Dockerfile, não como TD.
**Libraries:** —

### phase-03-videos/TD-07

**Recommendation:** os dois eixos de estado são obrigatórios para não bloquear a Fase 04, e separar a sessão multipart mantém `videos` como aggregate limpo para as Fases 04/05 enquanto TD-12 e a retomada (TD-03) trabalham só na tabela transitória, em linha com o princípio de responsabilidade única do projeto. A diferença de custo para A é uma entidade e um join; se o time preferir minimalismo, A é aceitável desde que mantenha os dois eixos.
**Libraries:** —

### phase-03-videos/TD-08

**Recommendation:** atende "curta e única" sem dependência, reusa o padrão de retry por SAVEPOINT já existente e evita a incompatibilidade de `engines` do `nanoid` com o Node 25 do container. A PK continua UUID (regra de entidades); `public_id` é a chave externa de URL e de storage.
**Libraries:** —

### phase-03-videos/TD-09

**Recommendation:** mantém os bytes fora de Nest/Next como em TD-03, dá `Range` e download por configuração do storage e concentra a autorização no endpoint que emite a URL, o que absorve drafts privados hoje e unlisted/published na Fase 04 sem mudar o mecanismo. Verificação concreta na SI: `curl -r 0-1023 <streamUrl>` → 206 e `curl -I <downloadUrl>` → `Content-Disposition: attachment`.
**Libraries:** —

### phase-03-videos/TD-10

**Recommendation:** segue a topologia já decidida, deixa o ambiente pronto para integração/e2e com um único `up` e mantém a API sem privilégios de administração do storage. Entregáveis concretos: `Dockerfile.dev` com `ffmpeg`, `compose.yaml` com `rustfs`, `storage-init`, `video-worker` (e `redis` só se TD-04 = A), `.env.example` com as chaves de TD-01/TD-03/TD-09 e `nestjs-project/CLAUDE.md` com os novos probes (`curl http://localhost:9000/health`, console em `:9001`).
**Libraries:** —

### phase-03-videos/TD-11

**Recommendation:** é a única opção portável entre servidores de storage e filas, e a combinação chave única + guarda de estado garante que retries e entregas duplicadas não corrompam o vídeo. Com TD-04 = C ou B (fila em Postgres) o `send` entra na mesma transação do update, fechando a janela de falha apontada nos Cons.
**Libraries:** —

### phase-03-videos/TD-12

**Recommendation:** resolve o caso comum com o primitivo mais simples da fila escolhida, sem cron nem varredura, e com política explícita (`UPLOAD_TTL`, default 24 h). A regra de lifecycle de B pode ser adicionada no `storage-init` (TD-10) como rede de segurança opcional, com TTL maior que `UPLOAD_TTL` para nunca abortar antes do job.
**Libraries:** —

### phase-03-videos/TD-13

**Recommendation:** é a continuação direta do padrão atual (Postgres e Mailpit reais nas integrações, mocks nas unit) e a única que valida os contratos de storage e ffmpeg que TD-01 e TD-06 assumem. `UPLOAD_PART_SIZE` configurável é o que permite provar multipart com 15 MiB em vez de 10 GiB.
**Libraries:** aws-sdk-client-mock

### phase-03-videos/TD-14

**Recommendation:** sem transcodificação, a única política honesta é "aceitar o que os navegadores tocam", e checar duas vezes custa uma constante compartilhada: a allowlist declarada poupa o usuário de subir 10 GB de um arquivo errado, e o `ffprobe` pega o que a declaração não revela. HEVC e MOV ficam de fora por suporte parcial (reavaliar quando houver transcodificação). Contrato de erro: `POST /videos` responde 400 com código de domínio `VIDEO_UNSUPPORTED_MEDIA_TYPE` (filtro de `phase-02-auth/TD-07`); no processamento, `processing_status = failed` com `processing_error = UNSUPPORTED_FORMAT` e o detalhe do ffprobe. Depende de TD-03 (onde o tipo declarado entra), TD-06 (ffprobe), TD-07 (coluna `processing_error`) e TD-11 (transição para `failed`).
**Libraries:** —

### saneamento-fase-04/TD-01

**Recommendation:** todos os problemas são `any` vindo de `res.body` e de mocks, que a Fase 04 já resolveu tipando; manter a mesma régua em produção e teste preserva o princípio de Type Safety sem dependência nova. Os 19 `unbound-method` ficam em um único spec e somem guardando os `jest.fn()` em variáveis. C é a alternativa se esse refactor de mocks se mostrar invasivo.
**Libraries:** —

**Revisions:**
- 2026-10-19 — Meta fixada em 0 problemas (os 217 erros e também os 54 warnings `no-unsafe-argument`) e o script `lint` do `package.json` ganha `--max-warnings 0` para impedir regressão; `eslint.config.mjs` continua igual. Rationale: AMB-2 do plan-validate da task (critério de pronto indefinido entre exit 0 e 0 problemas).

### saneamento-fase-04/TD-02

**Recommendation:** mantém o vínculo com o prefixo do e-mail exigido pelo project-plan, reusa `appendRandomSuffix` e reduz a correção a uma condição a mais na derivação, com a validação apoiada nas mesmas constantes do `PATCH` (`NICKNAME_PATTERN` e `RESERVED_NICKNAMES`), o que fecha a divergência entre cadastro e edição.
**Libraries:** —

### saneamento-fase-04/TD-03

**Recommendation:** o claro já coincide com `muted` e no escuro o DS usa `#3d3d3d` para `muted`/`border`/`accent`, então o valor inferido é o mais coerente com a paleta existente; fica registrado como inferência a confirmar na reauditoria do Figma (ajuste via `/decide` como Revision se o Figma divergir).
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
Run /screen-inventory manutencao-pos-fase-05 if a UI surface is added in a future revision._

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
