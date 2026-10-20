---
subproject: frontend
runner: playwright
scope: phase-05-watch-page
si: SI-05.11b
target_file: tests/watch.e2e-spec.ts
---

# Página de visualização do vídeo — Test Plan

## Application Overview

`/watch/{publicId}` é a página pública de visualização (`watch-page/TD-06`). O RSC lê `GET /videos/{publicId}` (com `channel`), `GET /videos/{publicId}/playback` e `GET /videos/{publicId}/related` via `publicRead` — com o `Bearer` da sessão quando houver, anônimo caso contrário (`video-channel-management/TD-07`, `TD-12`). A tela mostra o player com controles próprios (só play/pause, volume, barra de progresso, tempo e tela cheia — `watch-page/TD-05`, Revisions 2026-10-19), o título, o canal (avatar de iniciais + nome com link para `/channel/{nickname}`), o botão Share, o menu "⋮" com o item "Download" (`download_url` para qualquer leitor — `TD-08`), a descrição recolhida em 3 linhas com "…more"/"Show less" (`TD-09`) e a sidebar de sugestões da mesma categoria, sem unlisted (`TD-04`). Após 10 s de reprodução acumulada o player chama `POST /api/videos/{publicId}/views` uma vez (`TD-01`). Estados: 404 → página `not-found`; 409 (dono, vídeo processando) → placeholder com o status no lugar do player; 503 → placeholder de erro com "tentar novamente". Subscribe, Like/Dislike, comentários e os chips da sidebar não existem nesta fase.

**Atenção para o implementador (fixtures — SI-05.7):** o seed de `mocks/factories/videos.ts` precisa de, no mínimo: `published-01` (publicado, `public`, `ready`, canal `studio_canal` "Studio Canal", categoria `music`, descrição com mais de 3 linhas, `view_count` conhecido); 2+ outros publicados `public` `music` para a sidebar; `unlisted-01` (publicado, `unlisted`, `music`); `processing-01` do dono `studio_canal`; e um trigger novo `storage-down-id` (publicado) cujo `GET /videos/{id}/playback` responde `503 STORAGE_UNAVAILABLE`. `stream_url`/`download_url` ficam na origem `http://localhost:9000` e são atendidos no spec por `page.route('http://localhost:9000/**')`: `videos/**/source` com `tests/fixtures/watch-sample.webm` (`Content-Type: video/webm`; `route.fulfill` responde 200 com o corpo inteiro — sem `Range`, aceito por `watch-page/TD-07`) e `thumbnails/**` com um PNG pequeno. Nunca interceptar `/api/**`. O login do dono usa o mesmo helper das specs do estúdio (reseta o store do MSW).

## Test Scenarios

### 1. Acesso anônimo e conteúdo da página

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); contexto sem cookie; `page.route('http://localhost:9000/**')` servindo a fixture WebM e o PNG.

#### 1.1. anonymous-sees-full-watch-page

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo navega para `/watch/published-01`
    - expect: `<title>` contém o título do vídeo
    - expect: um `h1` com o título, o link do canal "Studio Canal" apontando para `/channel/studio_canal` e o avatar de iniciais
    - expect: um elemento `video` com `poster` = thumbnail e os botões "Play", "Mute", "Enter full screen" e o slider de progresso; nenhum botão "Subscribe", "Like" ou campo de comentário; nenhum controle de legendas, configurações, miniplayer ou modo teatro
    - expect: o texto "N views • <tempo>" do bloco de descrição e o botão "Share"
    - expect: a sidebar com cards que linkam para `/watch/<public_id>` e não incluem `published-01`

#### 1.2. playback-and-single-view-registration

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo abre `/watch/published-01` e registra um listener de requisições para `/api/videos/published-01/views`
    - expect: o botão rotulado "Play" está visível
  2. Usuário clica em "Play" e aguarda a reprodução da fixture terminar (vídeo mais curto que 10 s)
    - expect: o botão passa a "Pause" enquanto toca e volta a "Play" no fim
    - expect: exatamente uma requisição `POST /api/videos/published-01/views` foi feita, com resposta `204`
  3. Usuário clica em "Play" de novo e deixa tocar até o fim
    - expect: nenhuma nova requisição `POST …/views` (um disparo por carregamento da página)

#### 1.3. description-expands-and-collapses

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo abre `/watch/published-01`
    - expect: a descrição aparece recolhida e o botão "…more" tem `aria-expanded="false"`
  2. Usuário clica em "…more"
    - expect: o texto completo fica visível, com as quebras de linha preservadas e timestamps/URLs como texto puro (sem links)
    - expect: o botão vira "Show less" com `aria-expanded="true"`
  3. Usuário clica em "Show less"
    - expect: a descrição volta a 3 linhas e o botão volta a "…more"

### 2. Download e unlisted

**Setup:** mesmo da seção 1.

#### 2.1. download-item-points-to-download-url

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo abre `/watch/published-01` e clica no botão "⋮"
    - expect: o menu abre com o item "Download"
  2. Inspecionar o item "Download"
    - expect: o destino é a `download_url` devolvida pelo mock de `/playback` (origem `http://localhost:9000`, contendo `X-Amz-Signature=download`)

#### 2.2. unlisted-opens-by-link-and-is-never-suggested

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo navega direto para `/watch/unlisted-01`
    - expect: a página renderiza o título e o player de `unlisted-01`
  2. Usuário navega para `/watch/published-01`
    - expect: nenhum card da sidebar aponta para `/watch/unlisted-01`

### 3. Estados de erro

**Setup:** mesmo da seção 1; o cenário do dono faz login antes (helper das specs do estúdio).

#### 3.1. missing-video-renders-not-found

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Usuário anônimo navega para `/watch/notfound-id`
    - expect: a página `not-found` é exibida e não há elemento `video`
  2. Usuário anônimo navega para `/watch/processing-01` (rascunho de outro usuário para quem não está logado)
    - expect: a mesma página `not-found`

#### 3.2. owner-processing-and-storage-error-placeholders

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T00:09:00Z

**Steps:**
  1. Dono `studio_canal` faz login e navega para `/watch/processing-01`
    - expect: título, canal e descrição renderizam; no lugar do player aparece o placeholder com o status de processamento; não há elemento `video`
  2. Usuário anônimo navega para `/watch/storage-down-id`
    - expect: o placeholder de erro aparece no lugar do player com o botão "tentar novamente"
    - expect: título e canal continuam visíveis
  3. Usuário clica em "tentar novamente"
    - expect: a página é recarregada (nova leitura do RSC) e o placeholder de erro continua, já que o trigger mantém o 503
