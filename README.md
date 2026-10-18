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
- **Video Worker** (FFmpeg) — processamento de vídeos *(planejado — Fase 03)*.
- **Object Storage** (S3/MinIO) — arquivos de vídeo e thumbnails *(planejado — Fase 03)*.
- **Message Queue** — fila de processamento de vídeos *(planejado — Fase 03)*.

O diagrama de arquitetura completo (C4) está em `docs/diagrams/software-arch.mermaid`.

## 🚀 Como rodar

Os dois subprojetos têm stacks Docker **separadas**. Suba primeiro o backend, rode as migrations e depois o frontend.

### 1. Backend (NestJS + PostgreSQL + Mailpit)

```bash
cd nestjs-project

# Cria o .env a partir do exemplo (inclui FRONTEND_URL, destino dos links de e-mail)
cp .env.example .env

# Sobe API, banco e Mailpit
docker compose up -d

# Instala dependências no volume nomeado (após o primeiro up e sempre que package.json mudar)
docker compose exec nestjs-api npm install

# Cria o schema do banco (obrigatório — synchronize está desabilitado)
docker compose exec nestjs-api npm run migration:run

# Sobe o servidor de desenvolvimento em watch mode
docker compose exec -d nestjs-api npm run start:dev
```

Serviços disponíveis:

| Serviço | URL / Porta |
|---------|-------------|
| API NestJS | http://localhost:3000 |
| PostgreSQL | `localhost:5432` (db/user/senha: `streamtube`) |
| Mailpit (UI de e-mails) | http://localhost:8025 |
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

Sufixos: `*.spec.ts` (unitário), `*.integration-spec.ts` (integração com banco real), `*.e2e-spec.ts` (end-to-end). Testes de integração/e2e rodam com `--runInBand`. O `testTimeout` do Jest é de 30 s porque a primeira subida do banco no bind mount do Docker Desktop (Windows) ultrapassa o padrão de 5 s.

### Frontend (Vitest + Playwright)

```bash
cd next-frontend
docker compose exec next-frontend npm test            # unitários + integração (Vitest + MSW)
```

Os testes E2E (Playwright) rodam **no host** contra o dev server containerizado com o MSW ligado no servidor — a API NestJS é simulada, nunca chamada:

```bash
cd next-frontend
docker compose exec -d next-frontend sh -c "MSW_ENABLED=true npm run dev"
curl --retry 15 --retry-delay 2 --retry-connrefused -I http://localhost:3001
docker compose logs next-frontend | grep "\[msw\]"   # deve mostrar: [msw] server-side mocking enabled
npx playwright test                                   # ou: npx playwright test tests/<arquivo>.e2e-spec.ts
```

> **Windows:** se `npx playwright` falhar por falta do shim `.cmd`, use `node node_modules/@playwright/test/cli.js test`. Ao criar novas pastas de rota, rode `docker compose restart next-frontend` antes dos E2E — o watcher do Turbopack não detecta diretórios novos no bind mount.
>
> O Playwright usa o `node_modules` **do host** (única exceção à regra de nunca rodar `npm` fora do container): quando a versão de `@playwright/test` mudar no `package.json`, rode `npm ci` no host uma vez.

Sufixos: `*.test.ts(x)` (unitário), `*.integration.test.ts(x)` (Route Handlers com MSW), `*.e2e-spec.ts` (Playwright). MSW intercepta as chamadas à API NestJS — os testes nunca batem no backend real.

## ✅ Funcionalidades implementadas

**Fase 01 — Configuração base** e **Fase 02 — Autenticação** estão concluídas (backend + frontend).

### Autenticação (Fase 02)

Fluxo completo de **cadastro → confirmação por e-mail → login → recuperação de senha**, com canal criado automaticamente para cada usuário (a partir do prefixo do e-mail).

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
│   │   └── phase-02-auth-frontend/      # Auth (frontend)
│   ├── tasks/                           # Trabalhos ad-hoc (mesmos artefatos das fases) — ex.: task-saneamento-fase-02-e-infra/
│   ├── inventories/                     # Inventário de telas extraído do Figma
│   └── diagrams/
│       ├── software-arch.mermaid        # Diagrama de arquitetura (C4)
│       └── skills-workflow.mermaid      # Pipeline de skills de planejamento/implementação
├── scripts/
│   └── sync-openapi.sh                  # Copia nestjs-project/openapi.json → next-frontend/openapi.json
├── nestjs-project/                      # Backend API (NestJS 11)
│   ├── src/
│   │   ├── auth/                        # Cadastro, login, JWT, refresh, confirmação e reset de senha
│   │   ├── users/                       # Entidade e serviço de usuários
│   │   ├── channels/                    # Canal 1:1 por usuário (nickname do e-mail)
│   │   ├── mail/                        # Envio de e-mails (templates Handlebars; links usam FRONTEND_URL)
│   │   ├── common/                      # Filtros, pipes e exceptions de domínio
│   │   ├── config/                      # Configs namespaced (Joi)
│   │   └── database/                    # data-source, migrations e seeds
│   ├── specs/                           # Test specs (*.plan.md) que originam os testes e2e
│   ├── test/                            # Testes e2e
│   ├── openapi.json                     # Contrato gerado por `npm run openapi:export`
│   ├── .env.example                     # Variáveis de ambiente (copiar para .env)
│   ├── compose.yaml                     # Docker Compose (API + PostgreSQL + Mailpit)
│   └── Dockerfile.dev
├── next-frontend/                       # Frontend (Next.js 16, App Router)
│   ├── app/
│   │   ├── (auth)/                      # signup, login, forgot-password, reset-password, confirm-email, resend-confirmation
│   │   ├── (app)/                       # Área da aplicação (layout com AppHeader)
│   │   └── api/auth/                    # Route Handlers BFF (proxy same-origin para a API)
│   ├── components/                      # auth, layout (AppHeader), UI (shadcn) e ícones
│   ├── hooks/                           # Hooks (useSession)
│   ├── lib/                             # env, api (openapi-fetch + types.gen.ts), auth/session
│   ├── mocks/                           # MSW (handlers + server; também usado server-side via instrumentation.ts)
│   ├── specs/                           # Test specs (*.plan.md) que originam os E2E
│   ├── tests/                           # E2E (Playwright)
│   ├── instrumentation.ts               # Liga o MSW no servidor quando MSW_ENABLED=true
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
| **03** | Upload e Processamento de Vídeos | ⏳ Planejada |
| **04** | Gerenciamento de Vídeos e Canal | ⏳ Planejada |
| **05** | Página de Visualização do Vídeo | ⏳ Planejada |
| **06** | Interações Sociais (Likes, Comentários, Inscrições) | ⏳ Planejada |
| **07** | Página Inicial, Busca e Finalização | ⏳ Planejada |

Detalhes completos em `docs/project-plan.md`. Pendências da Fase 02 (telas de confirmação/reset, logout, rede Docker compartilhada, CI do contrato OpenAPI) foram saneadas em `docs/tasks/task-saneamento-fase-02-e-infra/`.

## 🤖 Processo com IA

O objetivo central do desafio é mostrar **como** a aplicação foi construída com IA, não só o resultado. O processo fica registrado no próprio repositório:

- [`CLAUDE.md`](./CLAUDE.md) § *Planning & Implementation Workflow* — o pipeline de skills customizadas (`/research → /plan-context → /plan-validate ⇄ /plan-resolve → /plan-build → /plan-test-specs → /implement`, com `/decide` e `/screen-inventory` como entradas laterais), definido em `.claude/skills/` e ilustrado em `docs/diagrams/skills-workflow.mermaid`.
- `docs/decisions/` — cada decisão técnica (TD) com opções, prós/contras, recomendação e a decisão tomada; revisões posteriores ficam em blocos `Revisions`.
- `docs/phases/` e `docs/tasks/` — por fase ou task: `context.md`, `validation.md`, o plano dividido em SIs e o `progress.md` da execução. Os `specs/*.plan.md` de cada subprojeto derivam os testes e2e desses planos.
- `_claude-sessions/` — transcrições brutas das sessões, numeradas `NN-slug.txt` e commitadas junto do trabalho que produziram. Lacuna conhecida: as sessões de tipagem OpenAPI, fundação MSW e frontend da Fase 02 não foram arquivadas.

## 📖 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, React Hook Form + Zod, iron-session, openapi-fetch |
| Backend | NestJS 11, TypeScript, TypeORM, JWT, Argon2, Mailer (Handlebars) |
| Banco de Dados | PostgreSQL 17 |
| E-mail (dev) | Mailpit |
| Containerização | Docker, Docker Compose |
| Testes | Jest, Supertest (backend); Vitest, MSW, Playwright (frontend) |
| Qualidade | ESLint, Prettier |
</content>
