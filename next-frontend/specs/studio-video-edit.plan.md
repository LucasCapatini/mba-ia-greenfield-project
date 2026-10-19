---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.18b
target_file: tests/studio-video-edit.e2e-spec.ts
---

# Edição de vídeo — Test Plan

## Application Overview

`/studio/videos/{publicId}/edit` edita título, descrição, categoria, visibilidade e thumbnail customizada. O RSC carrega `GET /videos/{publicId}` (dono), `GET /categories` e, quando `ready`, `GET /videos/{publicId}/playback`, passando tudo por props; o formulário (`react-hook-form` + Zod) só habilita "Save Changes" quando dirty e válido. "Save Changes" chama `PATCH /api/videos/{publicId}` com `publish: true` — com o vídeo `ready`, o BFF encadeia o `publish` ("Video published"); com `processing`, só salva e avisa que o vídeo continua rascunho (`video-channel-management/TD-03`, Revisions 2026-10-18). "Change Thumbnail" envia a imagem por `PUT /api/videos/{publicId}/thumbnail` (`TD-04`) e a prévia passa a usar a nova URL pública com `?v=` (`TD-10`); "Remove custom thumbnail" volta à automática. Vídeo inexistente ou de outro canal → página 404; sem sessão → login.

**Atenção para o implementador (fixtures — SI-04.10):** store de vídeos do MSW (resetado pelo login) com `ready-draft-01` ("Aula pronta", `draft` + `ready`, categoria Music, `thumbnail_url` automática com `?v=1`), `processing-01` (`draft` + `processing`) e `other-channel-01` (upstream `404`). `GET /categories` devolve as 10 categorias da seed (Music … Other). O handler de `PUT /videos/{id}/thumbnail` marca `has_custom_thumbnail: true` e troca o `?v=`; arquivo `huge.png` > 5 MiB é barrado no cliente antes do envio. As imagens de thumbnail são carregadas de `http://localhost:9000`; o spec as atende com `page.route('http://localhost:9000/**')` devolvendo um PNG pequeno (nunca `/api/**`). Arquivos de teste via `setInputFiles({ name, mimeType, buffer })`.

## Test Scenarios

### 1. Carregar e salvar

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied). `beforeEach` — login em `/login` com `studio-edit@example.com` (reseta o store) e `page.route('http://localhost:9000/**')` para as imagens.

#### 1.1. form-is-prefilled-with-video-and-categories

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário navega para `/studio/videos/ready-draft-01/edit`
    - expect: título da página "Edit video"
    - expect: o campo Title contém "Aula pronta", a categoria selecionada é "Music" e a opção "Public" está marcada
    - expect: o select de categorias lista as 10 categorias, de "Music" a "Other"
    - expect: o card lateral mostra o link `http://localhost:3001/watch/ready-draft-01` e "Save Changes" está desabilitado

#### 1.2. save-ready-video-publishes

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário altera o título para "Aula final" e clica em "Save Changes"
    - expect: `PATCH /api/videos/ready-draft-01` com `title: "Aula final"` e `publish: true`
    - expect: toast "Video published"
    - expect: após o refresh, o título é "Aula final" e o status exibido é "Published on …"

#### 1.3. save-processing-video-keeps-draft-and-validates

**Covers AC:** #2, #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário navega para `/studio/videos/processing-01/edit`, apaga o título
    - expect: erro inline no título e "Save Changes" desabilitado
  2. Usuário cola uma descrição com 5001 caracteres
    - expect: erro inline de tamanho na descrição
  3. Usuário preenche título "Em processamento", descrição curta e clica em "Save Changes"
    - expect: `PATCH /api/videos/processing-01` é disparada e responde `{ published: false }`
    - expect: toast "Changes saved — the video stays a draft until processing finishes"; status exibido continua de processamento

### 2. Thumbnail customizada

**Setup:** mesmo da seção 1.

#### 2.1. change-and-remove-custom-thumbnail

**Covers AC:** #3, #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Em `/studio/videos/ready-draft-01/edit`, usuário escolhe `huge.png` (6 MiB) em "Change Thumbnail"
    - expect: mensagem "Max 5 MB"; nenhuma requisição `PUT /api/videos/ready-draft-01/thumbnail`
  2. Usuário escolhe `capa.png` (`image/png`, 200 KiB)
    - expect: `PUT /api/videos/ready-draft-01/thumbnail` com corpo multipart contendo o campo `file`
    - expect: a imagem da prévia passa a ter `src` com `?v=` diferente do anterior e aparece "Remove custom thumbnail"
  3. Usuário clica em "Remove custom thumbnail"
    - expect: `DELETE /api/videos/ready-draft-01/thumbnail` é disparada e a prévia volta à URL automática

### 3. Proteção da rota

**Setup:** `next-frontend/tests/fixtures.ts`.

#### 3.1. foreign-video-404-and-anonymous-redirect

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário logado navega para `/studio/videos/other-channel-01/edit`
    - expect: a página de não encontrado é exibida
  2. Usuário anônimo (novo contexto) navega para `/studio/videos/ready-draft-01/edit`
    - expect: redirecionado para `/login` com `returnTo=/studio/videos/ready-draft-01/edit`
