---
subproject: frontend
runner: playwright
scope: phase-04-video-channel-management
si: SI-04.19b
target_file: tests/studio-channel.e2e-spec.ts
---

# Edição do canal — Test Plan

## Application Overview

`/studio/channel` edita nickname, nome e descrição do canal do usuário. O RSC lê `GET /channels/me` e passa `initialChannel` por props; o formulário (`react-hook-form` + Zod) mostra o handle com `@` como prefixo visual fora do valor, valida `^[a-z0-9_]{3,50}$` e a lista de reservados antes do envio, e só habilita "Save Changes" quando dirty e válido. "Save Changes" chama `PATCH /api/channel` (BFF → `PATCH /channels/me`); quando o nickname muda, o Route Handler reescreve `channelSlug` na sessão e a UI faz `router.refresh()`, então o header passa a usar o novo nickname (`video-channel-management/TD-08`, `phase-02-auth-frontend/TD-02`). Conflito → erro inline "This handle is already taken".

**Atenção para o implementador (fixtures — SI-04.10):** o store de canal do MSW (resetado pelo login) devolve em `GET /channels/me` `{ nickname: "studio_canal", name: "Studio Canal", description: "Canal de testes", video_count: 3, … }`; `PATCH /channels/me` atualiza o store e responde `409 NICKNAME_TAKEN` para o trigger reservado `taken_nick`; `GET /channels/{nickname}` responde a partir do store (nickname antigo → `404 CHANNEL_NOT_FOUND`).

## Test Scenarios

### 1. Visualizar e editar o canal

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied). `beforeEach` — login em `/login` com `studio-canal@example.com` (reseta o store).

#### 1.1. settings-show-current-channel

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário logado clica em "Meu canal" no header
    - expect: a URL é `/studio/channel` com título "Channel Settings"
    - expect: o cabeçalho mostra "Studio Canal", "@studio_canal" e "3 videos"; nenhum contador de inscritos
    - expect: o campo handle mostra `studio_canal` com o prefixo `@` fora do input, "Display name" mostra "Studio Canal" e a descrição "Canal de testes"
    - expect: "Save Changes" desabilitado

#### 1.2. changing-handle-updates-header-and-public-url

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário troca o handle para `novo_canal` e clica em "Save Changes"
    - expect: `PATCH /api/channel` com corpo contendo apenas `nickname: "novo_canal"`
    - expect: toast "Channel updated" e o cabeçalho passa a "@novo_canal"
  2. Usuário navega para `/channel/novo_canal`
    - expect: a página pública do canal renderiza "Studio Canal"
  3. Usuário navega para `/channel/studio_canal`
    - expect: página de não encontrado

#### 1.3. taken-and-invalid-handles-are-blocked

**Covers AC:** #3, #5
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário digita o handle `admin`
    - expect: erro inline de handle reservado; "Save Changes" desabilitado; nenhuma `PATCH /api/channel`
  2. Usuário digita `Ab`
    - expect: erro inline de formato
  3. Usuário apaga o "Display name"
    - expect: erro inline "required" no nome
  4. Usuário restaura o nome, digita o handle `taken_nick` e clica em "Save Changes"
    - expect: `PATCH /api/channel` é disparada e o erro inline "This handle is already taken" aparece no handle
    - expect: o cabeçalho continua "@studio_canal"

### 2. Proteção da rota

**Setup:** `next-frontend/tests/fixtures.ts`; contexto sem cookie.

#### 2.1. anonymous-is-redirected

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-19T03:27:58Z

**Steps:**
  1. Usuário anônimo navega para `/studio/channel`
    - expect: redirecionado para `/login` com `returnTo=/studio/channel`
