---
subproject: frontend
runner: playwright
scope: phase-07-home-search-production
si: SI-07.14b
target_file: tests/home.e2e-spec.ts
---

# Página inicial (Home) Test Plan

## Application Overview

`/` é a página inicial pública (`home-search-production/TD-01`, `TD-04`): RSC que lê `GET /categories` e a primeira página de `GET /videos?category=` via `publicRead`, mostra a barra de chips ("All" + categorias em `sort_order`, cada chip um link para `/?category=<slug>`) e o grid de cards com avatar do canal; as páginas seguintes chegam pelo scroll infinito (`InfiniteVideoGrid` + sentinela, "Load more" de fallback) via `GET /api/videos`, sem nova requisição de RSC. `?category=<slug>` desconhecido (upstream 404 `CATEGORY_NOT_FOUND`) cai para a lista geral com "All" ativo e o aviso "Category not found" (TD-01, Revisions 2026-10-20); falha do upstream na primeira página leva ao `error.tsx` com "Try again". Voltar da watch page restaura cards e rolagem do `sessionStorage` (TD-04, Revisions 2026-10-20). Textos da UI em inglês (TD-05, Revisions 2026-10-20).

**Atenção para o implementador (fixtures — SI-07.3):** o handler de `GET /videos` lista os vídeos elegíveis do store (mais de 20, para haver segunda página) por `published_at` decrescente; `category=unknown-category` → 404 `CATEGORY_NOT_FOUND`. Para o cenário de erro da primeira página, acrescentar em SI-07.3 o trigger reservado `category=upstream-error` → 500 (sem colidir com fixtures do Vitest). Imagens em `http://localhost:9000/**` atendidas por `page.route` com PNG; nunca interceptar `/api/**`.

## Test Scenarios

### 1. Grid e categorias

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); `page.route('http://localhost:9000/**')` respondendo um PNG; usuário anônimo (sem login).

#### 1.1. anonymous-sees-chips-and-recent-grid

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/`
    - expect: a barra de chips mostra "All" seguido das categorias na ordem de `GET /categories` ("Music", "Gaming", "Education", …), com "All" marcado `aria-current="page"`
    - expect: o grid mostra 20 cards do mais recente ao mais antigo; cada card tem thumbnail, título, avatar de iniciais, nome do canal e "N views • tempo"
    - expect: o header mostra "Sign in" e o menu lateral mostra "Home" com o convite para entrar
  2. Usuário clica no título do primeiro card
    - expect: a URL passa a `/watch/<public_id>`

#### 1.2. chip-filters-by-category

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo em `/` clica no chip "Music"
    - expect: a URL passa a `/?category=music`
    - expect: o chip "Music" tem `aria-current="page"` e todos os cards exibidos são de vídeos `music`
  2. Usuário clica no chip "All"
    - expect: a URL volta a `/` e o grid volta à lista geral

#### 1.3. unknown-category-falls-back-to-all

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/?category=unknown-category`
    - expect: a página renderiza (sem 404) com o aviso "Category not found"
    - expect: o chip "All" tem `aria-current="page"` e o grid mostra a lista geral

### 2. Scroll infinito

**Setup:** mesmo da seção 1.

#### 2.1. scrolling-loads-next-page-without-rsc

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/` e começa a observar as requisições da página
    - expect: 20 cards visíveis
  2. Usuário rola até o fim do grid
    - expect: uma requisição `GET /api/videos?cursor=…` é feita e os cards seguintes são anexados, sem repetir títulos
    - expect: nenhuma navegação nem requisição de RSC (`?_rsc=` / cabeçalho `RSC`) acontece para carregar a página seguinte
  3. Usuário continua rolando até acabar a lista
    - expect: o spinner/"Load more" some quando não há mais páginas

#### 2.2. load-more-works-from-keyboard

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo em `/` move o foco por Tab até o botão "Load more" abaixo do grid e pressiona Enter
    - expect: os cards seguintes são anexados ao grid

#### 2.3. back-from-watch-restores-cards-and-scroll

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo em `/` rola até carregar a segunda página e clica num card da segunda página
    - expect: a URL passa a `/watch/<public_id>`
  2. Usuário volta pelo botão "voltar" do navegador
    - expect: a URL volta a `/` e o grid mostra os mesmos cards da segunda página, com o card clicado visível na tela
    - expect: nenhuma nova requisição `GET /api/videos` é feita para refazer as páginas já carregadas

### 3. Erros

**Setup:** mesmo da seção 1.

#### 3.1. first-page-failure-shows-try-again

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/?category=upstream-error`
    - expect: a página de erro da rota aparece com o botão "Try again"
  2. Usuário clica no logo do header (link para `/`)
    - expect: a URL passa a `/` e o grid volta a renderizar normalmente
