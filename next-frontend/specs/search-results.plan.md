---
subproject: frontend
runner: playwright
scope: phase-07-home-search-production
si: SI-07.15b
target_file: tests/search-results.e2e-spec.ts
---

# Resultados da busca Test Plan

## Application Overview

`/results?q=<termo>` é a página de resultados da busca do header (`home-search-production/TD-02`, `TD-03`, `TD-04`): RSC pública que aplica `parseSearchQuery` — `q` ausente, vazio ou só espaços → redirect para `/`; 1 caractere → estado vazio "Enter at least 2 characters" sem chamar a API; acima de 100 → cortado —, lê a primeira página de `GET /videos?q=` via `publicRead` e mostra o título "Results for “{q}”" acima do grid da home (sem os chips), com scroll infinito via `GET /api/videos?q=`. O termo casa por substring, sem acento nem caixa, o título do vídeo ou o nome/nickname do canal, em ordem cronológica. Sem resultados → "No results for “{q}”" com link para a home. O campo de busca do header vem preenchido com o termo atual. Textos em inglês (TD-05, Revisions 2026-10-20).

**Atenção para o implementador (fixtures — SI-07.3):** o handler de `GET /videos` casa `q` com normalização NFD sobre título e `name`/`nickname` do canal. O seed precisa de pelo menos um vídeo elegível com título acentuado contendo "música" (ex.: "Música ao vivo") e mantém o canal público `tech_mastery` (nome "Tech Mastery", 24 vídeos — página de 20 + 4), usado para a busca por canal e o scroll. Imagens em `http://localhost:9000/**` atendidas por `page.route` com PNG; nunca interceptar `/api/**`.

## Test Scenarios

### 1. Busca pelo header

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); `page.route('http://localhost:9000/**')` respondendo um PNG; usuário anônimo.

#### 1.1. header-search-shows-matches-by-title

**Covers AC:** #1, #5
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo em `/` digita "musica" no campo de busca do header e pressiona Enter
    - expect: a URL passa a `/results?q=musica`
    - expect: o primeiro cabeçalho da página é "Results for “musica”"
    - expect: o grid contém o card "Música ao vivo" (casamento sem acento) e nenhum chip de categoria é exibido
    - expect: o campo de busca do header mostra "musica"

#### 1.2. search-by-channel-name-with-infinite-scroll

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo envia "mastery" pelo botão de busca do header
    - expect: a URL passa a `/results?q=mastery` com 20 cards do canal "Tech Mastery"
  2. Usuário rola até o fim do grid
    - expect: uma requisição `GET /api/videos?q=mastery&cursor=…` anexa os 4 cards restantes e o spinner/"Load more" some

### 2. Termos inválidos e sem resultado

**Setup:** mesmo da seção 1.

#### 2.1. empty-query-redirects-home

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/results`
    - expect: a URL passa a `/`
  2. Usuário navega para `/results?q=%20%20%20`
    - expect: a URL passa a `/`
  3. Usuário em `/` pressiona Enter com o campo de busca vazio
    - expect: a URL continua `/`

#### 2.2. one-character-query-shows-rule-without-api-call

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/results?q=a`
    - expect: a página mostra "Enter at least 2 characters" e nenhum card
    - expect: nenhuma requisição `GET /api/videos` é feita pelo navegador (a regra é aplicada antes de qualquer leitura)

#### 2.3. no-results-shows-empty-state

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T17:49:52Z

**Steps:**
  1. Usuário anônimo navega para `/results?q=termo-sem-resultado`
    - expect: a página mostra "No results for “termo-sem-resultado”" e um link para a home
  2. Usuário clica no link para a home
    - expect: a URL passa a `/`
