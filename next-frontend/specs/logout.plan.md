---
subproject: frontend
runner: playwright
scope: task-saneamento-fase-02-e-infra
si: SI-10
target_file: tests/logout.e2e-spec.ts
---

# Header session-aware e logout — Test Plan

## Application Overview

As rotas de aplicação vivem no grupo `app/(app)/`, cujo layout renderiza o `AppHeader` (`components/layout/app-header.tsx`, `"use client"`). O header lê a sessão hidratada pelo `SessionProvider` no layout raiz (per `phase-02-auth-frontend/TD-06`) — sem round-trip — e expõe `data-session="anonymous|authenticated"`: anônimo mostra os links "Entrar" (`/login`) e "Criar conta" (`/signup`); logado mostra o e-mail e o botão "Sair", que chama `POST /api/auth/logout` (o BFF destrói o cookie `iron-session` incondicionalmente) e então `router.push("/")` + `router.refresh()` (per `saneamento-fase-02-e-infra/TD-05`). O grupo `(auth)` não recebe o header. A home `app/(app)/page.tsx` é um placeholder mínimo que substituiu o boilerplate do `create-next-app`; o login redireciona para `/` após o `200`, de modo que o header logado é a primeira tela pós-login.

## Test Scenarios

### 1. Encerrar a sessão a partir do header

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; server-side upstream faked via `instrumentation.ts` — `POST /auth/login` devolve o par de tokens para qualquer e-mail sem trigger, `POST /auth/logout` → 204; no browser `page.route()` of `/api/**`)

#### 1.1. home-anonima-sem-boilerplate

**Covers AC:** #1, #5
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário anônimo navega para `/`
    - expect: `[data-slot="app-header"]` tem `data-session="anonymous"`
    - expect: links "Entrar" → `/login` e "Criar conta" → `/signup`; nenhum botão "Sair"
    - expect: nenhum texto ou link do template `create-next-app` ("To get started, edit the page.tsx file.", "Templates", "Learning")

#### 1.2. login-header-logado-sair

**Covers AC:** #2, #3
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário faz login em `/login` com credenciais válidas
    - expect: a navegação termina em `/` com `data-session="authenticated"`
    - expect: o header mostra o e-mail do usuário e o botão "Sair"; existe um cookie de sessão
  2. Usuário clica em "Sair"
    - expect: `POST /api/auth/logout` é disparada
    - expect: o header volta a `data-session="anonymous"` com o link "Entrar", a URL permanece `/`
    - expect: o cookie de sessão deixa de existir no contexto do navegador

#### 1.3. telas-de-auth-sem-header

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/login`, `/signup` e `/forgot-password`
    - expect: cada tela renderiza o `Card` de auth
    - expect: nenhum `[data-slot="app-header"]` está presente
