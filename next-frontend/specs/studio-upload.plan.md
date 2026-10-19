---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.15b
target_file: tests/studio-upload.e2e-spec.ts
---

# Upload de vídeo (escolha do arquivo) — Test Plan

## Application Overview

`/studio/upload` é a entrada do fluxo de upload adiado da Fase 03. A página vive sob `app/(app)/studio/`, cujo layout exige sessão (sem cookie → `redirect('/login?returnTo=/studio/upload')`) e monta o `UploadProvider` (`video-channel-management/TD-11`, `TD-12`). O `upload-dropzone` (`"use client"`) valida o arquivo localmente (MP4/WebM, até 10 GiB, nome 1..255 — `phase-03-upload-processing/TD-03`, `TD-14`), chama `POST /api/videos` (BFF → `POST /videos`), entrega o `File` ao `UploadProvider` e navega para `/studio/upload/{public_id}` com o envio já em andamento.

**Atenção para o implementador (fixtures — SI-04.10):** o handler `POST /videos` de `mocks/handlers/videos.ts` devolve `VideoCreatedResponse` com `public_id: "new-upload-id"`, `part_size: 5242880` e `part_count = ceil(size_bytes / part_size)`; `POST /videos/new-upload-id/upload/parts` devolve URLs na origem `http://localhost:9000` (o `S3_PUBLIC_ENDPOINT` de dev). Os `PUT` das partes são do **navegador para o storage** (não `/api/**`), então o spec os atende com `page.route('http://localhost:9000/**', …)` respondendo `200` com headers `ETag: "\"etag-<n>\""` e `Access-Control-Expose-Headers: ETag` — nunca intercepte `/api/**`. Arquivos de teste via `setInputFiles({ name, mimeType, buffer })`, gerados em memória.

## Test Scenarios

### 1. Selecionar arquivo e iniciar o upload

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; upstream faked server-side via `instrumentation.ts`). `beforeEach` — login em `/login` com `studio-upload@example.com` (o handler de login também reseta o store de vídeos do MSW) e `page.route('http://localhost:9000/**')` para os `PUT` de partes.

#### 1.1. valid-mp4-creates-upload-and-navigates

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário logado navega para `/studio/upload`
    - expect: título "Upload video" e o dropzone com "MP4 or WebM, up to 10 GB" e o botão "Select file"
  2. Usuário seleciona `aula.mp4` (`video/mp4`, 12 MiB) no input de arquivo
    - expect: `POST /api/videos` é disparada com corpo `{ original_filename: "aula.mp4", content_type: "video/mp4", size_bytes: 12582912 }`
    - expect: a URL passa a `/studio/upload/new-upload-id`
    - expect: ao menos um `PUT` para `http://localhost:9000/…` é observado (o envio já começou)

#### 1.2. unsupported-file-is-rejected-locally

**Covers AC:** #2, #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Em `/studio/upload`, usuário seleciona `clipe.mov` (`video/quicktime`)
    - expect: mensagem inline "Only MP4 and WebM files are supported"
    - expect: nenhuma requisição a `/api/videos` foi feita; a URL continua `/studio/upload`
  2. Usuário seleciona `aula.webm` (`video/webm`, 1 MiB)
    - expect: a mensagem some e `POST /api/videos` é disparada com `content_type: "video/webm"`

### 2. Acesso sem sessão

**Setup:** `next-frontend/tests/fixtures.ts`; contexto sem cookie de sessão.

#### 2.1. anonymous-is-redirected-to-login

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário anônimo navega para `/studio/upload`
    - expect: a URL final é `/login?returnTo=%2Fstudio%2Fupload` (ou `returnTo=/studio/upload`)
    - expect: a tela de login é renderizada
  2. Usuário faz login com credenciais válidas
    - expect: a navegação volta para `/studio/upload`
