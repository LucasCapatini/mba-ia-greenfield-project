---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.17b
target_file: tests/studio-videos.e2e-spec.ts
---

# Painel de gerenciamento de vídeos — Test Plan

## Application Overview

`/studio/videos` é o painel do dono: um RSC lê `GET /channels/me/videos` via `upstream` com o token da sessão e os filtros da URL (`status`, `visibility`, `q`, `sort`, `from`, `to`, `cursor`), sem fetch cliente (`video-channel-management/TD-06`, `TD-12`). Cada linha mostra thumbnail, título, métricas, tempo de publicação e um badge de status (`Public`, `Unlisted`, `Draft`, `Processing`, `Failed`). O menu kebab oferece Edit, Publish/Unpublish e Delete com confirmação, todos via BFF seguidos de `router.refresh()` (`TD-02`, `TD-03`, `TD-09`). Linhas `uploading|processing` são acompanhadas por polling até ficarem terminais. O layout do estúdio exige sessão.

**Atenção para o implementador (fixtures — SI-04.10):** o handler de `GET /channels/me/videos` lê o store de vídeos do MSW (resetado pelo login) e aplica `status`, `visibility`, `q` (case-insensitive em `title`), `sort` e `cursor` (página de 20, `total` do filtro). Seed do store para este spec: 22 vídeos — `ready-draft-01` ("Aula pronta", `draft` + `ready`), `published-01` ("Aula publicada", `published` + `public`), `becomes-ready-02` ("Aula processando", `draft`, `processing` nas duas primeiras leituras de `GET /videos/becomes-ready-02` e `ready` depois), `failed-01` ("Arquivo inválido", `failed` com `UNSUPPORTED_FORMAT`), "Aula 2"/"aula 3" em `draft`, e o restante "Video NN" `published`. `publish`, `unpublish` e `DELETE` atualizam o store.

## Test Scenarios

### 1. Listagem e filtros

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied). `beforeEach` — login em `/login` com `studio-list@example.com` (reseta o store).

#### 1.1. list-renders-with-total-and-states

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário logado clica em "Meus vídeos" no header
    - expect: a URL é `/studio/videos`, com título "Channel content" e o contador "22 videos"
    - expect: 20 linhas renderizadas e um botão "Load more"
    - expect: os badges "Draft", "Public", "Processing" e "Failed" aparecem nas linhas correspondentes, com texto (não só cor)
  2. Usuário clica em "Load more"
    - expect: a URL ganha `cursor=`; as 2 linhas restantes aparecem e o botão some

#### 1.2. filters-and-search-are-reflected

**Covers AC:** #1, #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário escolhe o filtro de status "Draft" e digita "aula" na busca
    - expect: após o debounce, a URL contém `status=draft` e `q=aula` (sem `cursor`)
    - expect: só aparecem "Aula pronta", "Aula 2", "aula 3" e "Aula processando"; o contador mostra o total filtrado
  2. Usuário abre a URL `/studio/videos?status=draft&q=aula` diretamente
    - expect: o chip de status e o campo de busca já aparecem preenchidos com esses valores
  3. Usuário escolhe no filtro "Date" uma data inicial posterior à final
    - expect: mensagem de validação; a URL não ganha `from`/`to`
  4. Usuário clica em "Clear filters"
    - expect: a URL volta a `/studio/videos` e o contador "22 videos"

### 2. Ações por linha

**Setup:** mesmo da seção 1.

#### 2.1. publish-and-delete-from-kebab

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário abre o menu da linha "Aula pronta" e clica em "Publish"
    - expect: `POST /api/videos/ready-draft-01/publish` é disparada
    - expect: sem recarga manual, o badge da linha passa a "Public"
  2. Usuário abre o menu da linha "Aula publicada" e clica em "Delete"
    - expect: diálogo de confirmação aberto; nenhuma requisição ainda
  3. Usuário confirma a exclusão
    - expect: `DELETE /api/videos/published-01` é disparada
    - expect: a linha "Aula publicada" some e o contador passa a "21 videos"
  4. Usuário abre o menu da linha "Arquivo inválido"
    - expect: o item "Publish" está desabilitado (vídeo não está `ready`)

#### 2.2. processing-row-updates-automatically

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário observa a linha "Aula processando" com badge "Processing"
    - expect: requisições periódicas a `GET /api/videos/becomes-ready-02`
  2. Aguardar até 15 s sem interagir
    - expect: o badge da linha passa a "Draft" (pronto, ainda não publicado)
    - expect: as requisições de polling cessam

### 3. Proteção da rota

**Setup:** `next-frontend/tests/fixtures.ts`; contexto sem cookie.

#### 3.1. anonymous-is-redirected

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário anônimo navega para `/studio/videos`
    - expect: redirecionado para `/login` com `returnTo=/studio/videos`
    - expect: o header anônimo não mostra "Meus vídeos" nem "Meu canal"
