---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.20b
target_file: tests/channel-public.e2e-spec.ts
---

# Página pública do canal — Test Plan

## Application Overview

`/channel/{nickname}` é uma página pública renderizada no servidor: o RSC chama `GET /channels/{nickname}` e `GET /channels/{nickname}/videos` via `upstream` **sem** token, e `generateMetadata` define o título "{name} (@{nickname}) — StreamTube" (`video-channel-management/TD-07`, `TD-08`, `TD-12`). A página mostra banner e avatar placeholder, nome, `@nickname`, "{video_count} videos", descrição, as abas (só "Videos" nesta fase), os chips Latest/Popular/Oldest (escrevem `?sort=`) e a grade de cards dos vídeos `published` + `public`, cada um com link para `/watch/{public_id}` e thumbnail por URL pública estável (`TD-10`). "Load more" pagina por `?cursor=` (`TD-06`). Nickname inexistente → página 404. Inscrição, sino e contador de inscritos ficam para a Fase 06.

**Atenção para o implementador (fixtures — SI-04.10):** os handlers de `channels.ts` devolvem para `GET /channels/tech_mastery` `{ nickname: "tech_mastery", name: "Tech Mastery", description: "Tutoriais de tecnologia", video_count: 24, created_at }` e, em `GET /channels/tech_mastery/videos`, 24 `VideoCardItem` (página de 20, `next_cursor` para os 4 restantes) com `view_count` distintos e `thumbnail_url` em `http://localhost:9000/streamtube-videos/thumbnails/<id>/auto.jpg?v=1`; `sort=popular` ordena por `view_count`. `GET /channels/nao_existe` → `404 CHANNEL_NOT_FOUND`. As imagens são atendidas no spec por `page.route('http://localhost:9000/**')` com um PNG pequeno (nunca `/api/**`). A página não depende de login.

## Test Scenarios

### 1. Renderização anônima

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); contexto sem cookie; `page.route('http://localhost:9000/**')` para as thumbnails.

#### 1.1. anonymous-sees-channel-info-and-videos

**Covers AC:** #1, #4
**Source:** manual
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário anônimo navega para `/channel/tech_mastery`
    - expect: `<title>` contém "Tech Mastery (@tech_mastery)"
    - expect: um `h1` "Tech Mastery", o texto "@tech_mastery", "24 videos" e "Tutoriais de tecnologia"
    - expect: botão "Subscribe" (`aria-pressed="false"`) e "1.2K subscribers" na meta row (Fase 06 — `social-interactions/TD-04`; antes: nenhum botão nem contador)
    - expect: 20 cards de vídeo; a aba "Videos" selecionada e o chip "Latest" ativo
  2. Inspecionar o primeiro card
    - expect: o link do card aponta para `/watch/<public_id>`
    - expect: a imagem do card tem `alt` com o título e `src` sem parâmetros `X-Amz-*`

### 2. Ordenação e paginação

**Setup:** mesmo da seção 1.

#### 2.1. sort-popular-and-load-more

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário clica no chip "Popular"
    - expect: a URL passa a conter `sort=popular` (sem `cursor`) e o chip "Popular" fica ativo
    - expect: o primeiro card é o de maior número de visualizações
  2. Usuário clica em "Load more"
    - expect: a URL ganha `cursor=` mantendo `sort=popular`
    - expect: os 4 cards restantes aparecem e o botão "Load more" some
  3. Usuário abre `/channel/tech_mastery?sort=invalido`
    - expect: a página renderiza com o chip "Latest" ativo (valor inválido ignorado)

### 3. Canal inexistente

**Setup:** `next-frontend/tests/fixtures.ts`.

#### 3.1. unknown-nickname-shows-not-found

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário navega para `/channel/nao_existe`
    - expect: a página de não encontrado é exibida com link para a home
    - expect: a resposta da navegação tem status 404
