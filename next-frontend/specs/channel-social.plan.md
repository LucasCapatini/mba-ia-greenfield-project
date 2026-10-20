---
subproject: frontend
runner: playwright
scope: phase-06-social-interactions
si: SI-06.16b
target_file: tests/channel-social.e2e-spec.ts
---

# Página do canal — inscrição e menu lateral Test Plan

## Application Overview

Na Fase 06 a página pública do canal (`/channel/{nickname}`) passa a mostrar "N subscribers" na meta row e o botão Subscribe no slot de ações, com o estado vindo de `viewer_subscribed` (`social-interactions/TD-04`); o dono não vê o botão (decisão do inventário; `TD-03`). Inscrever-se e desinscrever é otimista e reconciliado pela resposta de `PUT|DELETE /api/channels/{nickname}/subscription`, sem `router.refresh()` (`TD-09`). As rotas do grupo `(shell)` — home, canal, estúdio e feed — ganham, **com sessão**, o menu lateral (Home, Subscriptions, Your videos e a lista dos canais seguidos, 7 primeiros em ordem alfabética + "Show more"), que reflete a inscrição na hora pelo contexto compartilhado (`TD-08`, Revisions 2026-10-20; `TD-09`); a watch page fica fora do grupo e sem menu. Anônimo vê só o conteúdo, e clicar em Subscribe leva a `/login?returnTo=/channel/{nickname}` (`TD-10`).

**Atenção para o implementador (fixtures — SI-06.9):** o store do MSW precisa de `GET /channels/tech_mastery` com `subscriber_count: 1200` e `viewer_subscribed` calculado pelo store; o usuário do store (`studio-canal@example.com`, canal `studio_canal`) começa **seguindo `tech_mastery`**; `GET /me/subscriptions` lê as inscrições do store em ordem alfabética; `PUT|DELETE /channels/:nickname/subscription` mutam o store (próprio canal → `422 CANNOT_SUBSCRIBE_OWN_CHANNEL`). O login (helper `login(page)` das specs do estúdio) reseta o store. Imagens em `http://localhost:9000/**` atendidas por `page.route` com um PNG pequeno; nunca interceptar `/api/**`.

## Test Scenarios

### 1. Menu lateral

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); `page.route('http://localhost:9000/**')` com PNG; helper `login(page)` (`studio-canal@example.com` / `secret123`).

#### 1.1. side-nav-only-with-session

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo navega para `/channel/tech_mastery`
    - expect: nenhum `navigation` com nome "Main"; o conteúdo do canal aparece normalmente
  2. Usuário faz login e navega para `/channel/tech_mastery`
    - expect: um `navigation` "Main" com os links "Home" (`/`), "Subscriptions" (`/feed/subscriptions`) e "Your videos" (`/studio/videos`) e sem "Liked videos"
    - expect: a seção "Subscriptions" lista "Tech Mastery" com link para `/channel/tech_mastery`

#### 1.2. side-nav-scope-across-routes

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado navega para `/studio/videos` e depois para `/`
    - expect: o menu lateral "Main" aparece nas duas rotas, com "Your videos" marcado `aria-current="page"` em `/studio/videos` e "Home" em `/`
  2. Usuário logado navega para `/watch/published-01`
    - expect: nenhum `navigation` "Main" na página (a URL continua `/watch/published-01`)

### 2. Inscrição

**Setup:** mesmo da seção 1.

#### 2.1. subscriber-count-and-button-state

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo navega para `/channel/tech_mastery`
    - expect: a meta row mostra "@tech_mastery • 1.2K subscribers • 24 videos"
    - expect: botão "Subscribe" com `aria-pressed="false"`
  2. Usuário logado (segue `tech_mastery` no seed) navega para `/channel/tech_mastery`
    - expect: botão "Subscribed" com `aria-pressed="true"`
  3. Usuário logado navega para o próprio canal `/channel/studio_canal`
    - expect: nenhum botão "Subscribe"/"Subscribed"; a contagem de inscritos continua visível

#### 2.2. unsubscribe-and-resubscribe-update-count-and-nav

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado em `/channel/tech_mastery` clica em "Subscribed"
    - expect: o botão vira "Subscribe" e a contagem cai para "1.2K subscribers" conforme a resposta (`subscriber_count` devolvido)
    - expect: "Tech Mastery" sai da seção "Subscriptions" do menu lateral sem recarregar a página
  2. Usuário clica em "Subscribe"
    - expect: o botão volta a "Subscribed" e "Tech Mastery" reaparece na lista do menu lateral
  3. Usuário recarrega a página
    - expect: o estado persistido é "Subscribed" (o store do MSW foi atualizado)

#### 2.3. anonymous-subscribe-goes-to-login

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo em `/channel/tech_mastery` clica em "Subscribe"
    - expect: a URL passa a `/login?returnTo=/channel/tech_mastery`
