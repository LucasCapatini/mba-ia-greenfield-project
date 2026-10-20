---
subproject: frontend
runner: playwright
scope: phase-06-social-interactions
si: SI-06.17b
target_file: tests/watch-social.e2e-spec.ts
---

# Watch page — interações sociais Test Plan

## Application Overview

Na Fase 06 a watch page (`/watch/{publicId}`) ganha o par like/dislike do vídeo (like com contagem, dislike sem), o Subscribe com "N subscribers" ao lado do canal e a seção de comentários: cabeçalho "N Comments", "Sort by" (Latest/Top), composer "Add a comment…", raízes paginadas com "Show more comments", like/dislike por comentário, "Reply" com respostas num único nível ("N replies" carregado sob demanda) e menu "⋮" (Edit/Delete) só para o autor (`social-interactions/TD-03`–`TD-07`; `viewer_is_author` per `TD-06`, Revisions 2026-10-20). O RSC entrega o estado do espectador e a primeira página de comentários (`TD-04`, `TD-09`); as interações são otimistas e reconciliadas pelas respostas do BFF, **sem** `router.refresh()` (`TD-09`). Anônimo vê tudo e é levado a `/login?returnTo=/watch/{publicId}` ao interagir (`TD-10`). O dono abrindo o próprio vídeo não publicado não vê o par like/dislike nem a seção de comentários (`TD-03`, Revisions 2026-10-20).

**Atenção para o implementador (fixtures — SI-06.9):** o seed do MSW precisa de `tech-01` (publicado, `public`, `ready`, canal `tech_mastery`, `like_count: 1200`, `comment_count` coerente) com raízes de outro autor (`bia`, uma com 2 respostas e `like_count` alto, outra sem respostas) e uma raiz do usuário do store; mais de 20 raízes para provar "Show more comments"; um trigger `comments-down-id` (publicado de `tech_mastery`) cujo `GET /videos/{id}/comments` responde `500`; `ready-draft-01` (rascunho `ready` de `studio_canal`, o próprio usuário). Qualquer `Bearer` é o usuário do store (`studio_canal`), que segue `tech_mastery`. `stream_url`/thumbnail em `http://localhost:9000/**` atendidos por `page.route` (fixture WebM de `tests/fixtures/watch-sample.webm` e PNG); nunca interceptar `/api/**`.

## Test Scenarios

### 1. Estado inicial e anônimo

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); `page.route('http://localhost:9000/**')`; helper `login(page)`.

#### 1.1. page-arrives-with-viewer-state

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado navega para `/watch/tech-01`
    - expect: botão "Like, 1.2K" e botão "Dislike" sem número; nenhum com `aria-pressed="true"`
    - expect: "Tech Mastery" com "1.2K subscribers" e botão "Subscribed" (`aria-pressed="true"`)
    - expect: cabeçalho "N Comments", seletor "Sort by: Latest", campo "Add a comment" e 20 raízes; só a raiz do próprio usuário tem o botão "⋮"
  2. Usuário anônimo navega para `/watch/tech-01`
    - expect: os mesmos controles visíveis, botão "Subscribe" e, no lugar do campo, o link "Sign in to comment"

#### 1.2. anonymous-interaction-goes-to-login

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo em `/watch/tech-01` registra um listener de requisições para `/api/**` e clica em "Like"
    - expect: a URL passa a `/login?returnTo=/watch/tech-01` e nenhuma requisição `/api/**` foi feita
  2. Volta para `/watch/tech-01` e clica em "Subscribe", em "Reply" e em "Sign in to comment" (um por vez, voltando à página entre eles)
    - expect: cada clique leva a `/login?returnTo=/watch/tech-01`

#### 1.3. owner-draft-hides-social-section

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado navega para `/watch/ready-draft-01`
    - expect: o player e o canal "Studio Canal" com "N subscribers" aparecem, sem botão Subscribe (dono)
    - expect: nenhum botão "Like"/"Dislike" e nenhum cabeçalho "Comments" nem campo de comentário

### 2. Reações e inscrição

**Setup:** mesmo da seção 1; listener de requisições do navegador para detectar recarga do RSC (requisições com header `RSC` para `/watch/tech-01`).

#### 2.1. like-dislike-and-subscribe-without-refresh

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado em `/watch/tech-01` clica em "Like"
    - expect: o botão fica `aria-pressed="true"` e a contagem vira o `like_count` devolvido pela resposta `200` de `PUT /api/videos/tech-01/reaction`
  2. Usuário clica em "Dislike"
    - expect: "Dislike" fica `aria-pressed="true"`, "Like" volta a `false` e a contagem de likes cai
  3. Usuário clica em "Dislike" de novo
    - expect: requisição `DELETE /api/videos/tech-01/reaction` e nenhum dos dois fica pressionado
  4. Usuário clica em "Subscribed"
    - expect: o botão vira "Subscribe" e "N subscribers" reflete a resposta
    - expect: em todos os passos, nenhuma requisição de recarga do RSC de `/watch/tech-01` foi feita

### 3. Comentários

**Setup:** mesmo da seção 1.

#### 3.1. comment-reply-edit-delete-flow

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário logado em `/watch/tech-01` foca "Add a comment", digita "  Ótimo conteúdo  " e clica em "Comment"
    - expect: o comentário "Ótimo conteúdo" aparece no topo da lista com "@studio_canal" e o cabeçalho soma 1
  2. Usuário clica em "Reply" na raiz de `bia` que tem respostas, digita "Concordo" e envia
    - expect: "2 replies" vira "3 replies", a thread fica aberta com a nova resposta no fim e o cabeçalho soma 1
  3. Usuário clica em "Reply" numa resposta de `bia`
    - expect: o composer abre na thread da raiz com "@bia " pré-preenchido
  4. Usuário abre o "⋮" do próprio comentário, escolhe "Edit", troca o texto e salva
    - expect: o texto novo aparece com "(edited)"
  5. Usuário abre o "⋮" do próprio comentário, escolhe "Delete" e confirma no diálogo
    - expect: o comentário some e o cabeçalho cai 1, sem recarregar a página

#### 3.2. sort-and-pagination

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo em `/watch/tech-01` clica em "Show more comments"
    - expect: novas raízes são anexadas sem repetir as anteriores e o botão some quando não há mais páginas
  2. Usuário escolhe "Top" no "Sort by"
    - expect: a lista recomeça com a raiz de maior `like_count` no topo
  3. Usuário clica em "2 replies" na raiz de `bia`
    - expect: as 2 respostas aparecem da mais antiga para a mais nova; recolher e reabrir não dispara nova requisição `GET /api/comments/…/replies`

#### 3.3. comments-error-keeps-page-usable

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. Usuário anônimo navega para `/watch/comments-down-id`
    - expect: o player, o título e o canal renderizam normalmente
    - expect: o bloco de comentários mostra a mensagem de erro e o botão "Try again"
