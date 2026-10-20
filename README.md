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
- **Email Service** (Mailpit) — captura os e-mails transacionais (confirmação de conta e recuperação de senha) em uma UI local.
- **Video Worker** (FFmpeg) — segundo entrypoint do `nestjs-project` (`src/worker.ts`, serviço `video-worker`): consome os jobs da fila, valida o formato pelos bytes com `ffprobe`, extrai metadados e thumbnail com `ffmpeg` lendo o vídeo por URL assinada e marca o vídeo como `ready`/`failed`.
- **Object Storage** (S3-compatível; RustFS em dev) — arquivos de vídeo e thumbnails. O navegador envia e lê direto do storage por URLs pré-assinadas (multipart, `Range`, download).
- **Message Queue** (pg-boss sobre o PostgreSQL) — jobs `video.process` e `upload.expire`; sem broker adicional.

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
curl --retry 15 --retry-delay 2 --retry-connrefused -I http://localhost:3001
docker compose logs next-frontend | grep "\[msw\]"   # deve mostrar: [msw] server-side mocking enabled
npx playwright test                                   # ou: npx playwright test tests/<arquivo>.e2e-spec.ts
```

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

As Fases **01 — Configuração base**, **02 — Autenticação**, **03 — Upload e processamento**, **04 — Gerenciamento de vídeos e canal** e **05 — Página de visualização** estão concluídas. A Fase 03 entregou o backend (API + worker); as telas de upload chegaram com o estúdio da Fase 04.

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
- `/(app)` — área da aplicação com `AppHeader` (`components/layout/app-header.tsx`): mostra Entrar/Criar conta para anônimos e e-mail + botão Sair (logout) para autenticados.
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
- `/channel/{nickname}` — página pública do canal (anônima), com ordenação e "carregar mais"; nickname inexistente responde 404.
- O `AppHeader` ganhou, para usuários autenticados, os atalhos "Meus vídeos" (`/studio/videos`) e "Meu canal" (`/studio/channel`); toasts de sucesso/erro via Sonner.
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

## 🛠️ Estrutura do Projeto

```
mba-ia-greenfield-project/
├── .claude/                             # Fundação de IA: rules (por path), skills (pipeline de planejamento), agents, hooks
├── .github/workflows/
│   └── openapi-freshness.yml            # CI: garante que o contrato OpenAPI do frontend está em sincronia com o backend
├── _claude-sessions/                    # Transcrições brutas das sessões com o Claude, numeradas NN-slug.txt (ver "Processo com IA")
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
│   │   └── phase-05-watch-page/         # Página de visualização (backend + frontend) + drift report do Figma
│   ├── tasks/                           # Trabalhos ad-hoc (mesmos artefatos das fases) — ex.: task-saneamento-fase-02-e-infra/
│   ├── inventories/                     # Inventário de telas extraído do Figma (fases 02 e 04)
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
│   │   ├── videos/                      # Upload multipart, estado, playback, edição/publicação, thumbnail, exclusão, listagens, visualizações e sugestões
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
│   └── Dockerfile.dev                   # Node + ffmpeg/ffprobe
├── next-frontend/                       # Frontend (Next.js 16, App Router)
│   ├── app/
│   │   ├── (auth)/                      # signup, login, forgot-password, reset-password, confirm-email, resend-confirmation
│   │   ├── (app)/                       # Área da aplicação (layout com AppHeader): home, studio/**, channel/[nickname] e watch/[publicId]
│   │   └── api/                         # Route Handlers BFF (proxy same-origin para a API): auth/**, videos/** e channel
│   ├── components/                      # auth, layout (AppHeader), upload, studio, channel, video(s), watch (player e página), UI (shadcn) e ícones
│   ├── hooks/                           # Hooks (useSession, useProcessingPoll, useMediaState, useViewRegistration)
│   ├── lib/                             # env, api (openapi-fetch + types.gen.ts + BFF com sessão opcional + publicRead), auth/session, upload (cliente multipart)
│   ├── mocks/                           # MSW (handlers + server; também usado server-side via instrumentation.ts)
│   ├── specs/                           # Test specs (*.plan.md) que originam os E2E
│   ├── tests/                           # E2E (Playwright)
│   ├── instrumentation.ts               # Liga o MSW no servidor quando MSW_ENABLED=true
│   ├── proxy.ts                         # Proxy do Next 16: redireciona anônimos de /studio/** para o login
│   ├── openapi.json                     # Cópia do contrato do backend (fonte de lib/api/types.gen.ts)
│   ├── .env.example                     # Variáveis de ambiente (copiar para .env.local)
│   ├── compose.yaml                     # Docker Compose (dev server)
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
| **06** | Interações Sociais (Likes, Comentários, Inscrições) | ⏳ Planejada |
| **07** | Página Inicial, Busca e Finalização | ⏳ Planejada |

Detalhes completos em `docs/project-plan.md`. Pendências da Fase 02 (telas de confirmação/reset, logout, rede Docker compartilhada, CI do contrato OpenAPI) foram saneadas em `docs/tasks/task-saneamento-fase-02-e-infra/`. A Fase 03 entregou o backend (`docs/phases/phase-03-upload-processing/`) e a Fase 04 entregou o estúdio — upload, painel de vídeos, edição, configurações do canal — e a página pública do canal (`docs/phases/phase-04-video-channel-management/`). A dívida de lint do backend em specs/e2e das Fases 02/03 e a validação de nicknames reservados ou curtos no cadastro (`createChannel`) foram saneadas em `docs/tasks/task-saneamento-fase-04/`. Pendência conhecida da Fase 04: a reauditoria de um frame do Figma (154:1724) e do valor escuro do token `--progress-track`, quando a cota do MCP do Figma voltar. A Fase 05 entregou a página de visualização com player próprio, contagem de visualizações, sugestões e download (`docs/phases/phase-05-watch-page/`); a auditoria visual foi feita contra PNGs exportados do Figma, sem o MCP.

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
| Object storage (dev) | RustFS (S3-compatível) |
| E-mail (dev) | Mailpit |
| Containerização | Docker, Docker Compose |
| Testes | Jest, Supertest (backend); Vitest, MSW, Playwright (frontend) |
| Qualidade | ESLint, Prettier |
</content>
