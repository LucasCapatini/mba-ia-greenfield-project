# StreamTube — Plataforma de Compartilhamento de Vídeos

Projeto da disciplina **Desenvolvimento de Aplicações de IA** do MBA de Engenharia de Software com IA da [Full Cycle](https://fullcycle.com.br).

Este é um projeto greenfield desenvolvido para demonstrar como construir uma aplicação do zero utilizando IA de forma adequada no processo de desenvolvimento.

## Professor

<a href="https://github.com/argentinaluiz">
    <img src="https://avatars.githubusercontent.com/u/4926329?v=4?s=100" width="100px;" alt=""/>
    <br />
    <sub>
        <b>Luiz Carlos</b>
    </sub>
</a>

---

## Quadro Branco

- [Quadro Branco](./whiteboard.svg)

---

## 🎨 Design System (Figma)

- [FC Tube.fig](./FC%20Tube.fig) — arquivo-fonte do **design system** do projeto no Figma.
- [FC Tube sem padrão.fig](./FC%20Tube%20sem%20padr%C3%A3o.fig) — arquivo-fonte puro, sem tokens, cores, tipografia e espaçamento.

Contém os fundamentos visuais do StreamTube — tokens (cores, tipografia, espaçamento, raios), componentes e as telas da plataforma. É a referência de design para a implementação do frontend: os componentes em `next-frontend/components/ui` (shadcn) e os tokens em `next-frontend/app/globals.css` derivam deste arquivo. Abra-o no Figma (`Arquivo → Importar`) para consultar especificações e estados visuais.

---

## 📋 Pré-requisitos

- Docker e Docker Compose
- Node.js 22+ no host (apenas para os testes E2E do Playwright e para `scripts/*.sh`; todo o resto roda dentro dos containers)
- npm

## 🏗️ Arquitetura

O projeto é um monorepo baseado em containers Docker. Cada subprojeto sobe sua própria stack via `docker compose`.

- **Frontend** (Next.js 16, App Router + React Server Components) — interface da plataforma. Segue o **modelo BFF**: o navegador nunca chama a API NestJS diretamente; todo tráfego passa por Route Handlers same-origin em `app/api/**`, que fazem proxy server-side para a API.
- **API** (NestJS 11) — regras de negócio, autenticação (JWT + refresh token rotation), envio de e-mails, acesso ao banco e orquestração do upload de vídeos (multipart pré-assinado direto no storage — nenhum byte de vídeo passa pela API).
- **Database** (PostgreSQL 17) — usuários, canais, tokens de autenticação, vídeos e sessões de upload; também hospeda a fila (schema `pgboss`).
- **Email Service** (Mailpit em dev; provedor SMTP transacional autenticado em produção) — captura os e-mails transacionais (confirmação de conta e recuperação de senha) em uma UI local.
- **Video Worker** (FFmpeg) — segundo entrypoint do `nestjs-project` (`src/worker.ts`, serviço `video-worker`): consome os jobs da fila, valida o formato pelos bytes com `ffprobe`, extrai metadados e thumbnail com `ffmpeg` lendo o vídeo por URL assinada e marca o vídeo como `ready`/`failed`.
- **Object Storage** (S3-compatível; RustFS em dev, AWS S3 em produção) — arquivos de vídeo e thumbnails. O navegador envia e lê direto do storage por URLs pré-assinadas (multipart, `Range`, download).
- **Message Queue** (pg-boss sobre o PostgreSQL) — jobs `video.process`, `upload.expire`, `video.delete` e o agendado `video-views.cleanup` (diário, 03:00 UTC); sem broker adicional.
- **Borda de produção** (Caddy) — termina o TLS (certificado automático), é o único serviço com portas publicadas e sobrescreve o `X-Forwarded-For` com o IP real do visitante antes de repassar ao frontend. Tudo roda num compose único (`deploy/compose.yaml`) numa VPS.

O diagrama de arquitetura completo (C4) está em `docs/diagrams/software-arch.mermaid`.

## 🚀 Como rodar

Os dois subprojetos têm stacks Docker **separadas**. Suba primeiro o backend, rode as migrations e depois o frontend.

### 1. Backend (NestJS + PostgreSQL + Mailpit + RustFS + worker)

```bash
cd nestjs-project

# Cria o .env a partir do exemplo (inclui FRONTEND_URL, destino dos links de e-mail, as chaves S3_* do storage e
# TRUST_PROXY, o IP fixo do next-frontend na rede streamtube — a API só confia no X-Forwarded-For vindo dele)
cp .env.example .env

# Sobe API, banco, Mailpit, RustFS (storage), storage-init (cria o bucket e libera leitura anônima só em thumbnails/*) e o video-worker
docker compose up -d

# Instala dependências no volume nomeado (após o primeiro up e sempre que package.json mudar)
docker compose exec nestjs-api npm install

# Cria o schema do banco (obrigatório — synchronize está desabilitado)
docker compose exec nestjs-api npm run migration:run

# Sobe o servidor de desenvolvimento em watch mode (o video-worker já sobe sozinho com o compose)
docker compose exec -d nestjs-api npm run start:dev
```

Serviços disponíveis:

| Serviço | URL / Porta |
|---------|-------------|
| API NestJS | http://localhost:3000 |
| PostgreSQL | `localhost:5432` (db/user/senha: `streamtube`) |
| Mailpit (UI de e-mails) | http://localhost:8025 |
| RustFS (S3 API / console) | http://localhost:9000 / http://localhost:9001 — login com `S3_ACCESS_KEY`/`S3_SECRET_KEY` do `.env` |
| Video worker | sem porta — `docker compose logs -f video-worker` |
| Swagger (opcional) | http://localhost:3000/api/docs — habilite com `SWAGGER_ENABLED=true` |

### 2. Frontend (Next.js)

```bash
cd next-frontend

# Cria o .env.local a partir do exemplo
# API_URL aponta para o backend pelo nome do serviço; SESSION_PASSWORD protege a sessão (iron-session)
cp .env.example .env.local

docker compose up -d
docker compose exec next-frontend npm install        # após o primeiro up e sempre que package.json mudar
docker compose exec -d next-frontend npm run dev
```

A aplicação ficará disponível em **http://localhost:3001**.

> As stacks são projetos Compose separados que compartilham a rede Docker nomeada `streamtube`, criada pela stack do backend. Por isso o backend deve subir primeiro; o frontend acessa a API pelo nome do serviço (`API_URL=http://nestjs-api:3000` em `next-frontend/.env.local`).
>
> `node_modules` (e, no frontend, também `.next`) ficam em **volumes nomeados** do Docker, não no bind mount do Windows — é o que mantém a compilação do Nest e os testes do Vitest rápidos. Consequências: o `npm install` roda sempre dentro do container, o `node_modules` do host não é o do container, e `docker compose down -v` apaga os volumes (o próximo `up` exige `npm install` de novo).

### 3. Ambiente de produção (opcional)

A Fase 07 entrega o ambiente de produção como **artefatos validados localmente** — o deploy numa VPS real é uma tarefa operacional, conduzida pelo [`docs/deploy/runbook.md`](./docs/deploy/runbook.md). O mesmo compose de produção sobe numa máquina de teste, com RustFS e Mailpit no lugar do AWS S3 e do provedor SMTP:

```bash
cp deploy/.env.example deploy/.env        # GHCR_OWNER=local e IMAGE_TAG=validation; o resto pode ficar como está
docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --env-file deploy/.env --profile local-validation up -d --build
curl -k https://localhost                 # 200 — Caddy com CA local; o migrate termina antes de api/worker subirem
docker compose -f deploy/compose.yaml -f deploy/compose.local.yaml --env-file deploy/.env --profile local-validation down -v
rm deploy/.env
```

Imagens de produção: `nestjs-project/Dockerfile` (uma imagem para `api`, `worker` e `migrate`, com ffmpeg) e `next-frontend/Dockerfile` (Next.js `standalone`). O deploy real só roda no GitHub Actions quando a variável de repositório `DEPLOY_ENABLED` é `true` (ver runbook).

## 🧪 Testes

### Backend (Jest)

```bash
cd nestjs-project
docker compose exec nestjs-api npm test -- --runInBand   # unitários + integração (banco compartilhado → serial)
docker compose exec nestjs-api npm run test:integration  # apenas integração (já em --runInBand)
docker compose exec nestjs-api npm run test:e2e          # end-to-end (HTTP via supertest)
docker compose exec nestjs-api npm run test:cov          # cobertura
```

Sufixos: `*.spec.ts` (unitário), `*.integration-spec.ts` (integração com banco real), `*.e2e-spec.ts` (end-to-end). Testes de integração/e2e rodam em série (banco, bucket e fila compartilhados). O `testTimeout` do Jest é de 30 s (90 s no e2e, que sobe partes de 5 MiB e espera o worker) porque a primeira subida do banco no bind mount do Docker Desktop (Windows) ultrapassa o padrão de 5 s. As suítes das Fases 03 e 04 usam RustFS, pg-boss (schema `pgboss_test`, isolado do worker de dev) e ffmpeg reais; as fixtures de vídeo são geradas pelo próprio ffmpeg em `os.tmpdir()`.

### Frontend (Vitest + Playwright)

```bash
cd next-frontend
docker compose exec next-frontend npm test            # unitários + integração (Vitest + MSW)
```

Os testes E2E (Playwright) rodam **no host** contra um **build de produção** containerizado (`next build` + `next start`) com o MSW ligado no servidor — a API NestJS é simulada, nunca chamada:

```bash
cd next-frontend
docker compose restart next-frontend                  # garante que nenhum next dev está rodando
docker compose exec next-frontend npm run build       # refaça após mudar app/, components/, lib/ ou mocks/
docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run start"
curl --retry 15 --retry-delay 2 --retry-all-errors -I http://localhost:3001
docker compose logs next-frontend | grep "\[msw\]"   # deve mostrar: [msw] server-side mocking enabled
npx playwright test                                   # projetos chromium (todos os specs) e mobile (Pixel 7, shell responsivo)
npx playwright test tests/<arquivo>.e2e-spec.ts       # um spec; --project=mobile só o perfil de celular
```

**Suíte full-stack** (Fase 07): poucas jornadas contra as **duas stacks reais**, sem MSW — cadastro com o link lido do Mailpit, upload processado pelo worker real até aparecer na home e na busca, e comentário, like e inscrição até o feed — mais um smoke somente leitura (`@smoke`), o mesmo que o deploy roda contra produção. Com o backend no ar (`start:dev`) e o frontend em `next build` + `next start` **sem** `MSW_ENABLED`:

```bash
cd next-frontend
npx playwright test -c playwright.full-stack.config.ts                # jornadas + smoke
npx playwright test -c playwright.full-stack.config.ts --grep @smoke  # só o smoke
```

Detalhes (inclusive o limite de 10 req/min por IP das rotas de auth, que permite uma passada por minuto) em `next-frontend/CLAUDE.md`.

### CI

`.github/workflows/ci.yml` roda os mesmos gates do dia a dia, dentro dos containers do Compose: job `backend` (lint, tsc, unitários + integração, e2e), job `frontend` (lint, tsc, Vitest, build de produção + Playwright `chromium` e `mobile`) e, em PRs para `main` e pushes em `dev`, o job `full-stack`. O `openapi-freshness.yml` continua à parte. A proteção de `main` exige os quatro checks; a de `dev`, os três primeiros.

> **Por que `next start` e não `next dev`:** no bind mount do Docker Desktop (Windows), o `next dev` (16.2.6, Turbopack e webpack) responde 404 de forma intermitente em Route Handlers profundos (ex.: `/api/videos/{id}/upload/*`); o build de produção serve todas as rotas de forma determinística. O `playwright.config.ts` usa `workers: 1` porque o store do MSW é um estado em memória por servidor, compartilhado entre os arquivos de spec.
>
> **Windows:** se `npx playwright` falhar por falta do shim `.cmd`, use `node node_modules/@playwright/test/cli.js test`.
>
> O Playwright usa o `node_modules` **do host** (única exceção à regra de nunca rodar `npm` fora do container): quando a versão de `@playwright/test` mudar no `package.json`, rode `npm ci` no host uma vez.

Sufixos: `*.test.ts(x)` (unitário), `*.integration.test.ts(x)` (Route Handlers com MSW), `*.e2e-spec.ts` (Playwright). MSW intercepta as chamadas à API NestJS — os testes nunca batem no backend real.

### Lint

```bash
cd nestjs-project
docker compose exec nestjs-api npm run lint                               # corrige o que der (--fix) e falha com qualquer erro ou warning
docker compose exec nestjs-api npx eslint "{src,apps,libs,test}/**/*.ts"  # só checa, sem reescrever arquivos

cd next-frontend
docker compose exec next-frontend npm run lint
```

Política: lint limpo nos dois subprojetos. No backend o script roda com `--max-warnings 0` — 0 erros e 0 warnings, inclusive em specs (`*.spec.ts`, `*.integration-spec.ts`) e e2e (`test/`); como `npm run lint` aplica `--fix`, use o `npx eslint` acima quando quiser apenas verificar. No frontend, `npm run lint` precisa terminar com 0 problemas.

## ✅ Funcionalidades implementadas

As Fases **01 — Configuração base**, **02 — Autenticação**, **03 — Upload e processamento**, **04 — Gerenciamento de vídeos e canal**, **05 — Página de visualização**, **06 — Interações sociais** e **07 — Página inicial, busca e finalização** estão concluídas. A Fase 03 entregou o backend (API + worker); as telas de upload chegaram com o estúdio da Fase 04.

### Autenticação (Fase 02)

Fluxo completo de **cadastro → confirmação por e-mail → login → recuperação de senha**, com canal criado automaticamente para cada usuário. O nickname do canal vem do prefixo do e-mail; um prefixo reservado ou com menos de 3 caracteres recebe um sufixo aleatório — a mesma regra de nickname do `PATCH /channels/me`.

Endpoints da API (`nestjs-project`):

| Método & Rota | Descrição |
|---------------|-----------|
| `POST /auth/register` | Cadastro de usuário (cria usuário + canal) |
| `GET /auth/confirm-email?token=` | Confirmação de conta via link do e-mail (**idempotente**: reabrir o link de uma conta já confirmada responde 204) |
| `POST /auth/resend-confirmation` | Reenvio do e-mail de confirmação |
| `POST /auth/login` | Login (retorna access + refresh token) |
| `POST /auth/refresh` | Rotação de refresh token (com family + grace period) |
| `POST /auth/logout` | Revoga os refresh tokens da sessão |
| `POST /auth/forgot-password` | Solicita e-mail de recuperação de senha |
| `POST /auth/reset-password` | Redefine a senha via token |
| `GET /auth/me` | Dados do usuário autenticado (protegido por JWT) |

Telas e Route Handlers BFF (`next-frontend`):

- `/(auth)/signup`, `/(auth)/login`, `/(auth)/forgot-password`, `/(auth)/reset-password`, `/(auth)/resend-confirmation` — formulários com React Hook Form + Zod e validação inline.
- `/(auth)/confirm-email` — página RSC que confirma a conta ao abrir o link do e-mail (estados: sucesso, link expirado, link inválido — os dois últimos oferecem o reenvio inline).
- `/(app)` — área da aplicação com o header (`components/layout/app-header.tsx`): na Fase 02 mostrava Entrar/Criar conta e Sair; desde a Fase 07 é o header do Figma — "Sign in" (com volta para a página atual) para anônimos e, com sessão, o atalho de upload e o avatar que abre o menu da conta com "Sign Out".
- `app/api/auth/{signup,login,logout,forgot-password,reset-password,resend-confirmation}` — proxy same-origin para a API.
- Os e-mails transacionais apontam para o frontend: `${FRONTEND_URL}/confirm-email?token=` e `${FRONTEND_URL}/reset-password?token=` (variável obrigatória no `.env` do backend).

Segurança: senhas com **Argon2**, **JWT** com `JwtAuthGuard` global (opt-out via `@Public()`), **rotação de refresh token** com detecção de reuso, **rate limiting** (`ThrottlerGuard`) nos endpoints de auth, e sessão no navegador via **iron-session** (cookies HTTP-only).

### Upload e processamento de vídeos (Fase 03)

Upload **multipart pré-assinado direto no object storage** ("10 GB sem passar pela API"): a API só emite URLs e orquestra; o navegador faz `PUT` das partes no storage, pode retomar após falha (`GET …/upload` lista as partes já aceitas) e o `complete` enfileira o processamento na **mesma transação** que grava o estado. O worker lê o vídeo por URL assinada (sem download), valida o formato pelos bytes (MP4 H.264/AAC e WebM VP8/VP9/AV1/Opus), extrai duração/dimensões/codecs, gera a thumbnail e conclui em `ready` ou `failed` com código. Reprodução e download por URLs GET assinadas (`Range` → 206 e `Content-Disposition` atendidos pelo storage).

Endpoints da API (`nestjs-project`; as rotas de upload exigem JWT e só o dono do canal as usa):

| Método & Rota | Descrição |
|---------------|-----------|
| `POST /videos` | Pré-cadastro do rascunho + abertura do multipart (201) |
| `POST /videos/{publicId}/upload/parts` | URLs pré-assinadas para um lote de partes |
| `GET /videos/{publicId}/upload` | Estado da sessão: partes já aceitas (retomada) |
| `POST /videos/{publicId}/upload/complete` | Fecha o multipart e enfileira `video.process` (202) |
| `DELETE /videos/{publicId}/upload` | Aborta o upload e descarta o rascunho (204) |
| `GET /videos/{publicId}` | Estado do processamento, metadados e `thumbnail_url` (auth opcional desde a Fase 04 — ver abaixo) |
| `GET /videos/{publicId}/playback` | `stream_url` e `download_url` assinadas (só `ready`; auth opcional desde a Fase 04) |

Jobs do worker (`pg-boss`): `video.process` (ffprobe → validação → thumbnail → `ready`/`failed`, com retry e idempotência por guarda de estado) e `upload.expire` (aborta uploads não concluídos após `UPLOAD_TTL` e remove o rascunho). Roteiro manual com `curl` em `nestjs-project/CLAUDE.md`.

### Gerenciamento de vídeos e canal (Fase 04)

Categorias da plataforma, edição e publicação de vídeos, thumbnail customizada, exclusão, painel de vídeos do canal (estúdio), edição do canal e página pública do canal. Decisões em `docs/decisions/technical-decisions-video-channel-management.md` (TD-01…TD-12).

- **Publicação:** o vídeo tem `status` (`draft`/`published`), `visibility` (`public`/`unlisted`) e `published_at`. Publicar exige processamento `ready` e título; título, descrição, categoria e visibilidade podem ser editados em qualquer estado do processamento. Vídeos `unlisted` não aparecem na listagem pública do canal.
- **Leitura pública com auth opcional:** `GET /videos/{publicId}`, `GET /videos/{publicId}/playback` e as rotas públicas de canal aceitam requisições anônimas. O dono vê qualquer status; os demais só vídeos publicados; um rascunho alheio responde 404 sem revelar que existe.
- **Thumbnail customizada:** enviada pela API (`multipart/form-data`, até `THUMBNAIL_MAX_BYTES` = 5 MB), validada pelos bytes (JPEG/PNG/WebP, mínimo 640×360) e normalizada com `sharp` para JPEG 1280×720. A automática fica guardada: remover a customizada volta para ela. Thumbnails são servidas por URL estável (leitura anônima só no prefixo `thumbnails/*` do bucket; os vídeos continuam privados).
- **Exclusão:** hard delete da linha + job `video.delete` no worker, que apaga os objetos do storage.
- **Listagens:** paginação por cursor (keyset). Os contadores `view_count`, `like_count`, `dislike_count` e `comment_count` já existem em `videos` (zerados até as Fases 05/06 os alimentarem).

Endpoints da API (`nestjs-project`):

| Método & Rota | Descrição |
|---------------|-----------|
| `GET /categories` | Lista as categorias (carga inicial por migration) — público |
| `PATCH /videos/{publicId}` | Edita título, descrição, categoria e visibilidade (só o dono; nunca muda o status) |
| `POST /videos/{publicId}/publish` | Publica (exige `ready` + título) |
| `POST /videos/{publicId}/unpublish` | Volta para rascunho, preservando a visibilidade |
| `PUT /videos/{publicId}/thumbnail` | Envia a thumbnail customizada |
| `DELETE /videos/{publicId}/thumbnail` | Remove a customizada (volta para a automática) |
| `DELETE /videos/{publicId}` | Exclui o vídeo e enfileira `video.delete` |
| `GET /channels/me` / `PATCH /channels/me` | Lê e edita o próprio canal (nickname, nome, descrição) |
| `GET /channels/me/videos` | Painel: vídeos do próprio canal, com filtros (`status`, `visibility`, `processing_status`), ordenação (`latest`, `oldest`, `views`) e cursor |
| `GET /channels/{nickname}` | Página pública do canal — público |
| `GET /channels/{nickname}/videos` | Vídeos públicos e publicados do canal, ordenação `latest`/`popular`/`oldest` e cursor — público |

Telas e Route Handlers BFF (`next-frontend`):

- `/studio/upload` e `/studio/upload/{publicId}` — seleção do arquivo, upload multipart direto do navegador para o storage (lotes de URLs, 4 partes em paralelo, retry com backoff, retomada e cancelamento — `lib/upload/multipart-uploader.ts`), acompanhamento do processamento e formulário de detalhes.
- `/studio/videos` — painel de vídeos com filtros, ordenação, "carregar mais", publicar/despublicar e excluir; vídeos em processamento são atualizados por polling (`hooks/use-processing-poll.ts`).
- `/studio/videos/{publicId}/edit` — edição de título, descrição, categoria, visibilidade e thumbnail; salvar um vídeo `ready` também o publica.
- `/studio/channel` — edição do canal (handle, nome e descrição).
- `/channel/{nickname}` — página pública do canal (anônima), com ordenação e, desde a Fase 07, scroll infinito; nickname inexistente responde 404.
- Os atalhos "Meus vídeos" e "Meu canal" que o header ganhou nesta fase viraram, na Fase 07, o item "Your videos" do menu lateral e o "Edit Channel" do menu da conta; toasts de sucesso/erro via Sonner.
- Todo `/studio/**` é protegido por `proxy.ts` (Proxy do Next 16), que redireciona anônimos para `/login?returnTo=…`; o estado do upload sobrevive à navegação dentro do estúdio (`UploadProvider`).
- `app/api/videos/**` e `app/api/channel` — proxy same-origin para a API. Leituras acontecem em Server Components; mutações passam pelo BFF e chamam `router.refresh()`.
- Os cards de vídeo apontam para `/watch/{publicId}`, a página de visualização da Fase 05.

### Página de visualização do vídeo (Fase 05)

Página pública `/watch/{publicId}` com player próprio, descrição, sugestões e download, aberta a visitantes anônimos. Decisões em `docs/decisions/technical-decisions-watch-page.md`.

- **Player:** `<video>` nativo com controles próprios (play/pause, volume, barra de progresso com buffer, tempo e tela cheia). Quando a URL assinada expira, o player pede uma nova pelo BFF e retoma do mesmo ponto. O preview do estúdio usa o mesmo player, sem registrar visualização.
- **Visualizações:** contam após 10 s de reprodução acumulada (ou o fim de um vídeo mais curto), uma vez por carregamento da página. A API deduplica por espectador e por dia UTC — usuário logado pelo id, anônimo por um hash de IP + User-Agent — e não conta o dono nem rascunhos. O job agendado `video-views.cleanup` (03:00 UTC) apaga os registros de dedup vencidos.
- **IP real do visitante:** como toda requisição chega à API pelo BFF, o `next-frontend` tem IP fixo na rede `streamtube` e a API só confia no `X-Forwarded-For` vindo dele (`TRUST_PROXY`). O throttler global passa a contar por visitante.
- **Sugestões:** até 12 vídeos públicos, publicados e prontos — primeiro da mesma categoria, completados pelos mais recentes; vídeos `unlisted` abrem só pelo link direto e nunca aparecem em sugestões.
- **Página:** título, canal (link para `/channel/{nickname}`), Share (copia o link), menu "⋮" com Download, descrição recolhida em 3 linhas com "…more"/"Show less" e a sidebar. Vídeo inexistente ou rascunho alheio → página de não encontrado; o dono vê o status no lugar do player enquanto o vídeo processa; com o storage indisponível aparece "Try again".

Endpoints da API (`nestjs-project`; públicos com auth opcional):

| Método & Rota | Descrição |
|---------------|-----------|
| `GET /videos/{publicId}` | Passa a trazer o canal do vídeo (`channel: { nickname, name }`) |
| `POST /videos/{publicId}/views` | Registra uma visualização (204; conta só na primeira do espectador no dia) |
| `GET /videos/{publicId}/related` | Sugestões da sidebar (`limit` 1..24, padrão 12), lista fechada sem cursor |

Route Handlers BFF (`next-frontend`): `GET /api/videos/{publicId}/playback` (o player renova a URL) e `POST /api/videos/{publicId}/views`; ambos enviam a sessão só quando ela existe e repassam IP e User-Agent do visitante.

### Interações sociais (Fase 06)

Likes/dislikes em vídeos e comentários, comentários com respostas, inscrição em canais e a área de canais seguidos. Ver e ler é livre para anônimos; reagir, comentar e se inscrever exigem login — o anônimo que tenta é levado ao login e volta para a mesma página. Decisões em `docs/decisions/technical-decisions-social-interactions.md`.

- **Reações:** like e dislike são exclusivos; clicar no ativo remove a reação. As escritas são idempotentes e devolvem o estado resultante com as contagens. Contadores e linhas mudam na mesma transação, então ficam consistentes mesmo com cliques concorrentes. A UI mostra só a contagem de likes.
- **Comentários:** texto puro de 1 a 2.000 caracteres, ordenados por `Latest` ou `Top` (mais curtidos), com "Show more comments". As respostas têm um nível só — responder uma resposta grava na raiz com `@nickname` pré-preenchido — e carregam sob demanda em "N replies". Só o autor edita ("(edited)") ou exclui; excluir uma raiz leva as respostas. Só vídeos publicados aceitam comentários e reações, inclusive para o dono.
- **Inscrições:** "Subscribe"/"Subscribed" na watch page e na página do canal, com "N subscribers"; o dono não vê o botão. Com sessão, o menu lateral mostra Home, Subscriptions, Your videos e os canais seguidos em ordem alfabética (7 + "Show more"), atualizado na hora pelo Subscribe — desde a Fase 07 o menu também aparece para o anônimo (Home + convite para entrar) e, na watch page, abre como drawer.
- **Feed:** `/feed/subscriptions` lista os vídeos públicos dos canais seguidos, do mais recente ao mais antigo, com scroll infinito (Fase 07); exige sessão.
- **Interface otimista:** cada interação muda a tela na hora e é reconciliada pela resposta da API, sem recarregar a página; em erro volta ao estado anterior com um toast.

Endpoints da API (`nestjs-project`):

| Método & Rota | Descrição |
|---------------|-----------|
| `PUT` / `DELETE /videos/{publicId}/reaction` | Define (`{ value: "like" \| "dislike" }`) ou remove a reação ao vídeo |
| `PUT` / `DELETE /comments/{commentId}/reaction` | O mesmo para comentários e respostas |
| `PUT` / `DELETE /channels/{nickname}/subscription` | Inscreve ou cancela (`{ subscribed, subscriber_count }`; próprio canal → 422) |
| `GET` / `POST /videos/{publicId}/comments` | Raízes paginadas (`sort=latest\|top`, cursor) e criação |
| `PATCH` / `DELETE /comments/{commentId}` | Edição e exclusão pelo autor (outro usuário → 403) |
| `GET` / `POST /comments/{commentId}/replies` | Respostas em ordem cronológica e criação |
| `GET /me/subscriptions` | Canais seguidos, em ordem alfabética |
| `GET /me/subscriptions/videos` | Feed dos vídeos dos canais seguidos |

`GET /videos/{publicId}` passa a trazer `viewer_reaction` e o canal com `subscriber_count`/`viewer_subscribed`; `GET /channels/{nickname}`, `subscriber_count` e `viewer_subscribed`.

Route Handlers BFF (`next-frontend`): as mesmas rotas sob `/api/**` (`/api/videos/{publicId}/reaction`, `/api/videos/{publicId}/comments`, `/api/comments/{commentId}`, `…/replies`, `…/reaction`, `/api/channels/{nickname}/subscription` e `/api/me/subscriptions`); as leituras de comentários vão com a sessão só quando ela existe, as mutações exigem sessão.

### Página inicial, busca e finalização (Fase 07)

Home com filtro por categoria, busca por título e canal, scroll infinito, o shell de navegação do Figma em todas as larguras de tela e o ambiente de produção. Decisões em `docs/decisions/technical-decisions-home-search-production.md` (TD-01…TD-11).

- **Home (`/`):** chips "All" + categorias (`/?category=<slug>`) e a grade dos vídeos públicos mais recentes. Slug desconhecido mostra a lista geral com "All" ativo e um aviso; falha da API leva a "Try again".
- **Busca (`/results?q=`):** pelo campo do header (Enter ou lupa; no celular, ícone que expande). Casa título ou nome/nickname do canal **sem acento e sem diferenciar maiúsculas** (`pg_trgm` + `unaccent` com índices de trigramas). Termo vazio volta para a home; 1 caractere mostra a regra sem chamar a API; sem resultado, sugestão e link para a home.
- **Scroll infinito:** home, busca, página do canal e feed carregam a página seguinte ao chegar ao fim da grade (com "Load more" acessível por teclado), sem trocar a URL. Ao voltar da watch page, cards e posição de rolagem são restaurados do `sessionStorage`.
- **Shell responsivo:** header com "≡", logo, busca, "+" (upload) e o avatar com o menu da conta (nome, `@nickname`, "Edit Channel", "Sign Out"); "Sign in" para anônimos. Menu lateral expandido ou mini (escolha guardada em cookie e aplicada já no HTML do servidor), drawer abaixo de `lg` e na watch page, também para anônimos. Watch page, canal, feed, telas de auth e estúdio usáveis em 390 px — no estúdio, a tabela vira lista empilhada e os formulários ficam em coluna única.
- **Rate limit por visitante:** listagens, `GET /categories` e as leituras de alta frequência (vídeo, playback, sugestões, comentários e `GET /me/subscriptions`) aceitam 60 req/min por visitante; o resto segue o limite global de 10/min. Toda leitura feita no servidor encaminha o IP do visitante, para que cada pessoa tenha o próprio orçamento.
- **Produção:** SMTP autenticado (`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_SECURE`), migrations executadas a partir do código compilado (`npm run migration:run:prod`), imagens multi-stage, compose de produção com Caddy (TLS automático e `X-Forwarded-For` sobrescrito), PostgreSQL com volume, migration como job único e backup diário para o bucket (`deploy/backup.sh`), CI (`ci.yml`) e deploy por GHCR + SSH com smoke pós-deploy (`deploy.yml`, ativado por `DEPLOY_ENABLED`). Validado localmente — ver [`docs/deploy/runbook.md`](./docs/deploy/runbook.md).

Endpoints da API (`nestjs-project`):

| Método & Rota | Descrição |
|---------------|-----------|
| `GET /videos` | Listagem pública (publicados, públicos e prontos), do mais recente ao mais antigo, com `category` (slug), `q` (2–100 caracteres após `trim`), `cursor` e `limit`; categoria inexistente → 404 `CATEGORY_NOT_FOUND` |

Route Handlers BFF (`next-frontend`), usados pelo scroll infinito: `GET /api/videos`, `GET /api/channels/{nickname}/videos` (sessão opcional) e `GET /api/me/subscriptions/videos` (exige sessão).

## 🛠️ Estrutura do Projeto

```
mba-ia-greenfield-project/
├── .claude/                             # Fundação de IA: rules (por path), skills (pipeline de planejamento), agents, hooks
├── .github/workflows/
│   ├── ci.yml                           # CI: backend, frontend (Vitest + Playwright chromium/mobile) e full-stack, dentro dos containers
│   ├── deploy.yml                       # Push em main: gates → imagens no GHCR → deploy por SSH + smoke (só com DEPLOY_ENABLED)
│   └── openapi-freshness.yml            # CI: garante que o contrato OpenAPI do frontend está em sincronia com o backend
├── _claude-sessions/                    # Transcrições brutas das sessões com o Claude, numeradas NN-slug.txt (ver "Processo com IA")
├── deploy/                              # Produção numa VPS: compose.yaml (Caddy, web, api, worker, migrate, db), Caddyfile, .env.example,
│                                        #   compose.local.yaml (validação local com RustFS + Mailpit) e backup.sh
├── docs/
│   ├── project-plan.md                  # Planejamento geral do projeto
│   ├── design-system-pillars.md         # Pilares do design system
│   ├── design-system-ai-implementable.md # Design system em formato implementável por IA
│   ├── decisions/                       # Decisões técnicas (TDs) por fase/task — technical-decisions-{slug}.md
│   ├── phases/                          # Planos, contexto, validação e progresso por fase
│   │   ├── phase-01-configuracao-base/
│   │   ├── phase-02-auth/               # Auth (backend)
│   │   ├── phase-02-auth-frontend/      # Auth (frontend)
│   │   ├── phase-03-upload-processing/  # Upload multipart, worker e playback (backend)
│   │   ├── phase-04-video-channel-management/ # Gerenciamento de vídeos e canal (backend + frontend) + drift report do Figma
│   │   ├── phase-05-watch-page/         # Página de visualização (backend + frontend) + drift report do Figma
│   │   ├── phase-06-social-interactions/ # Interações sociais (backend + frontend) + drift report do Figma
│   │   └── phase-07-home-search-production/ # Home, busca, shell responsivo e produção (backend + frontend + infra) + drift report
│   ├── tasks/                           # Trabalhos ad-hoc (mesmos artefatos das fases) — ex.: task-saneamento-fase-02-e-infra/
│   ├── deploy/runbook.md                # Do zero ao primeiro deploy: VPS, DNS, S3, SMTP, secrets, backup e rollback
│   ├── inventories/                     # Inventário de telas extraído do Figma (fases 02, 04, 05, 06 e 07)
│   └── diagrams/
│       ├── software-arch.mermaid        # Diagrama de arquitetura (C4)
│       └── skills-workflow.mermaid      # Pipeline de skills de planejamento/implementação
├── scripts/
│   ├── sync-openapi.sh                  # Copia nestjs-project/openapi.json → next-frontend/openapi.json
│   └── export-claude-session.mjs        # Gera _claude-sessions/NN-slug.txt a partir do histórico JSONL do Claude Code
├── nestjs-project/                      # Backend API (NestJS 11)
│   ├── src/
│   │   ├── auth/                        # Cadastro, login, JWT, refresh, confirmação e reset de senha
│   │   ├── users/                       # Entidade e serviço de usuários
│   │   ├── channels/                    # Canal 1:1 por usuário (nickname do e-mail); /channels/me e página pública
│   │   ├── categories/                  # Categorias de vídeo (GET /categories)
│   │   ├── mail/                        # Envio de e-mails (templates Handlebars; links usam FRONTEND_URL)
│   │   ├── videos/                      # Upload multipart, estado, playback, edição/publicação, thumbnail, exclusão, listagens, visualizações, sugestões e feed das inscrições
│   │   ├── reactions/                   # Likes/dislikes em vídeos e comentários (escrita idempotente + contadores)
│   │   ├── comments/                    # Comentários e respostas (um nível), edição/exclusão pelo autor
│   │   ├── subscriptions/               # Inscrição em canais, contagem de inscritos e canais seguidos
│   │   ├── storage/                     # StorageModule: clientes S3 (interno e público) e presigner
│   │   ├── queue/                       # QueueModule: pg-boss sobre o PostgreSQL
│   │   ├── worker/                      # WorkerModule: jobs video.process (ffmpeg), upload.expire, video.delete e video-views.cleanup (cron)
│   │   ├── worker.ts                    # Segundo entrypoint (processo video-worker)
│   │   ├── common/                      # Filtros, pipes, exceptions de domínio e paginação por cursor
│   │   ├── config/                      # Configs namespaced (Joi)
│   │   └── database/                    # data-source, migrations e seeds
│   ├── specs/                           # Test specs (*.plan.md) que originam os testes e2e
│   ├── test/                            # Testes e2e
│   ├── openapi.json                     # Contrato gerado por `npm run openapi:export`
│   ├── .env.example                     # Variáveis de ambiente (copiar para .env)
│   ├── compose.yaml                     # Docker Compose (API + worker + PostgreSQL + Mailpit + RustFS + storage-init)
│   ├── Dockerfile                       # Imagem de produção (api, worker e migrate) com ffmpeg
│   └── Dockerfile.dev                   # Node + ffmpeg/ffprobe
├── next-frontend/                       # Frontend (Next.js 16, App Router)
│   ├── app/
│   │   ├── (auth)/                      # signup, login, forgot-password, reset-password, confirm-email, resend-confirmation
│   │   ├── (app)/                       # Área da aplicação (layout com header, drawer e canais seguidos): (shell)/ — (home), results, channel/[nickname],
│   │   │                                #   studio/** e feed/subscriptions, com o menu lateral — e watch/[publicId], fora do grupo
│   │   └── api/                         # Route Handlers BFF (proxy same-origin para a API): auth/**, videos/**, comments/**, channels/**, me/** e channel
│   ├── components/                      # auth, layout (header, menu da conta, AppShell, menu lateral, drawer, busca), home (chips), videos (grade infinita),
│   │                                    #   upload, studio, channel, video, watch, comments, UI (shadcn) e ícones
│   ├── hooks/                           # Hooks (useSession, useCursorList, useProcessingPoll, useMediaState, useViewRegistration, useOptimisticMutation)
│   ├── lib/                             # env, api (openapi-fetch + types.gen.ts + BFF com sessão opcional + publicRead), auth/session, upload (cliente multipart),
│   │                                    #   home (primeira página da home) e search (normalização do termo)
│   ├── mocks/                           # MSW (handlers + server; também usado server-side via instrumentation.ts)
│   ├── specs/                           # Test specs (*.plan.md) que originam os E2E
│   ├── tests/                           # E2E (Playwright) com MSW no servidor — projetos chromium e mobile
│   ├── full-stack/                      # E2E contra as stacks reais (playwright.full-stack.config.ts); @smoke = smoke pós-deploy
│   ├── instrumentation.ts               # Liga o MSW no servidor quando MSW_ENABLED=true
│   ├── proxy.ts                         # Proxy do Next 16: redireciona anônimos de /studio/** e /feed/** para o login
│   ├── openapi.json                     # Cópia do contrato do backend (fonte de lib/api/types.gen.ts)
│   ├── .env.example                     # Variáveis de ambiente (copiar para .env.local)
│   ├── compose.yaml                     # Docker Compose (dev server)
│   ├── Dockerfile                       # Imagem de produção (Next.js standalone)
│   └── Dockerfile.dev
├── CLAUDE.md                            # Instruções para IA (cada subprojeto tem o seu próprio CLAUDE.md)
├── FC Tube.fig                          # Design system do projeto (Figma)
├── FC Tube sem padrão.fig               # Design system sem tokens (Figma)
├── whiteboard.svg                       # Quadro branco do projeto
└── README.md
```

## 🌿 Fluxo de branches

O repositório segue o Git Flow descrito em [`CLAUDE.md`](./CLAUDE.md) § Git Conventions:

- **`main`** — código estável, pronto para produção. Nunca recebe commits diretos.
- **`dev`** — branch de integração. Toda branch de trabalho nasce de `dev` e volta para `dev` por Pull Request.
- **`feature/*`**, **`bugfix/*`**, **`hotfix/*`**, **`docs/*`** — branches de trabalho, uma por escopo (uma feature, correção ou refatoração por vez).
- Quando `dev` está estável, é mesclada em `main`.

```bash
git checkout dev && git pull
git checkout -b feature/<slug>        # trabalhe aqui
git push -u origin feature/<slug>     # abra o PR para dev
```

## 📚 Fases do Projeto

| Fase | Descrição | Status |
|------|-----------|--------|
| **01** | Configuração Base do Projeto | ✅ Concluída |
| **02** | Cadastro, Login e Gerenciamento de Conta | ✅ Concluída |
| **03** | Upload e Processamento de Vídeos | ✅ Concluída (backend: API + worker; telas na Fase 04) |
| **04** | Gerenciamento de Vídeos e Canal | ✅ Concluída (backend + frontend) |
| **05** | Página de Visualização do Vídeo | ✅ Concluída (backend + frontend) |
| **06** | Interações Sociais (Likes, Comentários, Inscrições) | ✅ Concluída (backend + frontend) |
| **07** | Página Inicial, Busca e Finalização | ✅ Concluída (backend + frontend + infra; produção validada localmente, deploy real opcional) |

Detalhes completos em `docs/project-plan.md`. Pendências da Fase 02 (telas de confirmação/reset, logout, rede Docker compartilhada, CI do contrato OpenAPI) foram saneadas em `docs/tasks/task-saneamento-fase-02-e-infra/`. A Fase 03 entregou o backend (`docs/phases/phase-03-upload-processing/`) e a Fase 04 entregou o estúdio — upload, painel de vídeos, edição, configurações do canal — e a página pública do canal (`docs/phases/phase-04-video-channel-management/`). A dívida de lint do backend em specs/e2e das Fases 02/03 e a validação de nicknames reservados ou curtos no cadastro (`createChannel`) foram saneadas em `docs/tasks/task-saneamento-fase-04/`. Pendência conhecida da Fase 04: a reauditoria de um frame do Figma (154:1724) e do valor escuro do token `--progress-track`, quando a cota do MCP do Figma voltar. A Fase 05 entregou a página de visualização com player próprio, contagem de visualizações, sugestões e download (`docs/phases/phase-05-watch-page/`); a auditoria visual foi feita contra PNGs exportados do Figma, sem o MCP. As pendências pequenas da Fase 05 foram resolvidas em `docs/tasks/task-manutencao-pos-fase-05/` (volume nomeado do banco, `ip_range` na rede `streamtube`, token tipográfico `--text-overlay-md`, `requestOrigin` único e procedimento seguro de install do shadcn); o proxy reverso exigido para o deploy (`watch-page/TD-03`) chegou com o Caddy da Fase 07. A Fase 06 entregou reações, comentários com respostas, inscrições, o menu lateral com os canais seguidos e o feed das inscrições (`docs/phases/phase-06-social-interactions/`), também auditada contra PNGs do Figma. A Fase 07 entregou a home com categorias, a busca, o scroll infinito, o shell responsivo, a suíte full-stack, o CI e o ambiente de produção validado localmente (`docs/phases/phase-07-home-search-production/`); a suíte full-stack revelou limites de requisição que estouravam no uso normal, corrigidos e registrados nas Revisions de `home-search-production/TD-01` e `watch-page/TD-03`. As pendências da Fase 07 (variante do chip de categoria, limite das rotas de autenticação, handles abertos no Jest e limpeza dos usuários da suíte full-stack) estão em `docs/project-plan.md`.

## 🤖 Processo com IA

O objetivo central do desafio é mostrar **como** a aplicação foi construída com IA, não só o resultado. O processo fica registrado no próprio repositório:

- [`CLAUDE.md`](./CLAUDE.md) § *Planning & Implementation Workflow* — o pipeline de skills customizadas (`/research → /plan-context → /plan-validate ⇄ /plan-resolve → /plan-build → /plan-test-specs → /implement`, com `/decide` e `/screen-inventory` como entradas laterais), definido em `.claude/skills/` e ilustrado em `docs/diagrams/skills-workflow.mermaid`.
- `docs/decisions/` — cada decisão técnica (TD) com opções, prós/contras, recomendação e a decisão tomada; revisões posteriores ficam em blocos `Revisions`.
- `docs/phases/` e `docs/tasks/` — por fase ou task: `context.md`, `validation.md`, o plano dividido em SIs e o `progress.md` da execução. Os `specs/*.plan.md` de cada subprojeto derivam os testes e2e desses planos.
- `_claude-sessions/` — transcrições das sessões, numeradas `NN-slug.txt` e commitadas junto do trabalho que produziram. As sessões 01–15 são o `/export` do terminal (após uma compactação de contexto, o `/export` só traz o que ficou na tela — por isso 14 e 15 começam em "Conversation compacted"). A partir da 16, a transcrição é gerada do histórico JSONL do Claude Code com `node scripts/export-claude-session.mjs <session-id> _claude-sessions/NN-slug.txt`, que cobre a sessão inteira (inclusive o que precede as compactações), omite o raciocínio interno e trunca resultados de ferramenta. Lacuna conhecida: as sessões de tipagem OpenAPI, fundação MSW e frontend da Fase 02 não foram arquivadas e não existem mais no histórico local; seus artefatos (`docs/tasks/task-next-frontend-*`, `docs/phases/phase-02-auth-frontend/`) são o registro que restou. Toda transcrição é verificada e sanitizada antes do commit: dados externos ao projeto (de outros projetos, empresas ou clientes) não entram no repositório — regra *Confidentiality* do [`CLAUDE.md`](./CLAUDE.md).

## 📖 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, React Hook Form + Zod, iron-session, openapi-fetch, Sonner (toasts) |
| Backend | NestJS 11, TypeScript, TypeORM, JWT, Argon2, Mailer (Handlebars), AWS SDK S3 (presigner), pg-boss, sharp (thumbnails) |
| Worker de vídeo | NestJS (application context) + FFmpeg/ffprobe |
| Banco de Dados | PostgreSQL 17 (dados + fila pg-boss) |
| Object storage | RustFS (S3-compatível) em dev; AWS S3 em produção |
| E-mail | Mailpit em dev; provedor SMTP transacional em produção |
| Containerização | Docker, Docker Compose (imagens multi-stage de produção; Next.js `standalone`) |
| Produção | Caddy (TLS automático), GHCR, GitHub Actions (CI + deploy por SSH), PostgreSQL com backup para o S3 |
| Testes | Jest, Supertest (backend); Vitest, MSW, Playwright com projeto mobile e suíte full-stack (frontend) |
| Qualidade | ESLint, Prettier |
</content>
