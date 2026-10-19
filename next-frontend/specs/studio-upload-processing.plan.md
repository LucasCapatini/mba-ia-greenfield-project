---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.16b
target_file: tests/studio-upload-processing.e2e-spec.ts
---

# Upload em processamento — Test Plan

## Application Overview

`/studio/upload/{publicId}` acompanha o upload e o processamento do vídeo e permite preencher os metadados no meio do caminho. A linha de status lê o progresso do `UploadProvider` enquanto há envio em voo (`video-channel-management/TD-11`) e, depois do `complete`, faz polling de `GET /api/videos/{publicId}` a cada 3 s até `ready|failed`, chamando `router.refresh()` ao terminar (`TD-12`). "Save Changes" chama `PATCH /api/videos/{publicId}` com `publish: true`: com o vídeo `ready`, o BFF encadeia o `publish` e a UI mostra "Video published"; antes disso, só salva e avisa "Changes saved — the video stays a draft until processing finishes" (`TD-03`, Revisions 2026-10-18). "Cancel" pede confirmação e aborta o envio (`DELETE /api/videos/{publicId}/upload`) ou, com o envio concluído, descarta o rascunho (`DELETE /api/videos/{publicId}`).

**Atenção para o implementador (fixtures — SI-04.10):** o store de vídeos do MSW (resetado pelo handler de login) precisa de: `new-upload-id` (criado pelo `POST /videos`; `GET` responde `processing` nas duas primeiras chamadas após o `complete` e `ready` a partir da terceira), `ready-draft-01` (`draft` + `ready`, título "Aula pronta"), `processing-01` (`draft` + `processing`, permanece `processing`) e `other-channel-01` (pertence a outro canal → upstream `404 VIDEO_NOT_FOUND`). Mutações (`PATCH`, `publish`, `DELETE`) atualizam o store. Os `PUT` das partes vão para `http://localhost:9000` e são atendidos por `page.route('http://localhost:9000/**')` (nunca `/api/**`); para o cenário de cancelamento, essa rota segura a resposta (atraso de 5 s) para que o envio esteja em andamento.

## Test Scenarios

### 1. Progresso e processamento

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied). `beforeEach` — login em `/login` com `studio-proc@example.com` (reseta o store) e `page.route('http://localhost:9000/**')` respondendo `200` com `ETag`.

#### 1.1. upload-progress-then-processing-then-ready

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário seleciona `aula.mp4` (12 MiB) em `/studio/upload`
    - expect: a URL passa a `/studio/upload/new-upload-id` com título "Upload video"
    - expect: um `role="progressbar"` com `aria-valuenow` crescente e o texto "Uploading… {n}%"
  2. Aguardar o fim dos `PUT`
    - expect: `POST /api/videos/new-upload-id/upload/complete` é disparada com as 3 partes
    - expect: a linha de status mostra "Processing…"
  3. Aguardar até 15 s sem recarregar a página
    - expect: a linha de status mostra "Ready" e o status de verificações indica sucesso

### 2. Salvar metadados durante e depois do processamento

**Setup:** mesmo da seção 1.

#### 2.1. save-while-processing-keeps-draft

**Covers AC:** #2, #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário abre `/studio/upload/processing-01`, apaga o título e clica em "Save Changes"
    - expect: erro inline no título; nenhuma `PATCH /api/videos/processing-01` foi disparada
  2. Usuário preenche o título "Minha aula", escolhe a categoria "Education", marca "Unlisted" e clica em "Save Changes"
    - expect: `PATCH /api/videos/processing-01` com `title: "Minha aula"`, `visibility: "unlisted"`, o `category_id` de Education e `publish: true`
    - expect: toast "Changes saved — the video stays a draft until processing finishes"
    - expect: após o refresh, o campo título continua "Minha aula" e o status exibido é de rascunho

#### 2.2. save-when-ready-publishes

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário abre `/studio/upload/ready-draft-01`, altera a descrição e clica em "Save Changes"
    - expect: `PATCH /api/videos/ready-draft-01` é disparada e responde `{ published: true }`
    - expect: toast "Video published"
    - expect: o status exibido passa a "Published"

### 3. Cancelar o upload

**Setup:** mesmo da seção 1, com a rota do storage atrasando 5 s cada `PUT`.

#### 3.1. cancel-during-upload-aborts-and-returns

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário inicia o upload de `aula.mp4` e, em `/studio/upload/new-upload-id`, clica em "Cancel"
    - expect: diálogo "Cancel upload? The file and this draft will be discarded."
  2. Usuário clica em "Keep uploading"/fecha o diálogo
    - expect: nenhuma requisição `DELETE` é feita; o progresso continua
  3. Usuário clica em "Cancel" e confirma
    - expect: `DELETE /api/videos/new-upload-id/upload` é disparada
    - expect: a URL passa a `/studio/videos` e não há linha `new-upload-id` na lista

### 4. Proteção da rota

**Setup:** `next-frontend/tests/fixtures.ts`.

#### 4.1. anonymous-redirects-and-foreign-video-404

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário anônimo navega para `/studio/upload/ready-draft-01`
    - expect: redirecionado para `/login` com `returnTo=/studio/upload/ready-draft-01`
  2. Usuário logado navega para `/studio/upload/other-channel-01`
    - expect: a página de não encontrado é exibida (status de navegação 404)
