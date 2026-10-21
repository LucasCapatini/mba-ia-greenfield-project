---
subproject: frontend
runner: playwright
scope: phase-06-social-interactions
si: SI-06.18b
target_file: tests/subscriptions-feed.e2e-spec.ts
---

# Feed das inscrições Test Plan

## Application Overview

`/feed/subscriptions` é a área de acesso rápido aos vídeos dos canais seguidos (`social-interactions/TD-08`): página autenticada (o `proxy.ts` redireciona o anônimo para `/login?returnTo=/feed/subscriptions`), lida no RSC via `GET /me/subscriptions/videos` com o `Bearer` da sessão, com o grid do frame Home (cards com avatar e nome do canal), scroll infinito via `GET /api/me/subscriptions/videos` (`home-search-production/TD-04`; "Load more" como fallback de teclado) e estado vazio com link para a home. A página vive no grupo `(shell)`, então o item "Subscriptions" do menu lateral fica ativo.

**Atenção para o implementador (fixtures — SI-06.9):** o handler de `GET /me/subscriptions/videos` monta o feed a partir das inscrições do store (o usuário `studio_canal` segue `tech_mastery`, que tem 24 vídeos públicos — página de 20 + 4) por `published_at` decrescente; desinscrever-se de `tech_mastery` pela página do canal deixa o feed vazio. Imagens em `http://localhost:9000/**` atendidas por `page.route` com PNG; nunca interceptar `/api/**`.

## Test Scenarios

### 1. Acesso

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); `page.route('http://localhost:9000/**')`; helper `login(page)`.

#### 1.1. anonymous-is-redirected-to-login

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo navega para `/feed/subscriptions`
    - expect: a URL passa a `/login?returnTo=/feed/subscriptions`
  2. Usuário faz login pelo formulário
    - expect: a URL volta para `/feed/subscriptions`

### 2. Conteúdo

**Setup:** mesmo da seção 1.

#### 2.1. feed-lists-followed-channel-videos

**Covers AC:** #2, #5
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado navega para `/feed/subscriptions`
    - expect: título "Subscriptions" e 20 cards, do mais recente para o mais antigo
    - expect: cada card tem o avatar de iniciais e o nome "Tech Mastery" com link para `/channel/tech_mastery` e o card linka para `/watch/<public_id>`
    - expect: no menu lateral, "Subscriptions" tem `aria-current="page"`

#### 2.2. load-more-appends-and-disappears

**Covers AC:** #3
**Source:** manual
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado em `/feed/subscriptions` rola até o sentinela abaixo do grid (scroll infinito — `home-search-production/TD-04`)
    - expect: o grid passa a 24 cards, sem repetidos, sem trocar a URL
    - expect: o sentinela some quando não há mais páginas

#### 2.3. empty-state-without-subscriptions

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado em `/channel/tech_mastery` clica em "Subscribed" (deixa de seguir o único canal)
    - expect: o botão vira "Subscribe"
  2. Usuário navega para `/feed/subscriptions`
    - expect: nenhum card; o texto do estado vazio com um link para `/`
