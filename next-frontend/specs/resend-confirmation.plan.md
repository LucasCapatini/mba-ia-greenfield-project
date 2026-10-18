---
subproject: frontend
runner: playwright
scope: task-saneamento-fase-02-e-infra
si: SI-11
target_file: tests/resend-confirmation.e2e-spec.ts
---

# Tela de reenvio de confirmação — Test Plan

## Application Overview

A tela `/resend-confirmation` é o destino standalone do link "Reenviar e-mail de confirmação" que o formulário de login exibe quando o upstream responde `403 EMAIL_NOT_CONFIRMED` — link que existia desde a Fase 02 mas apontava para uma rota inexistente (404) até a revisão de alinhamento desta task (`saneamento-fase-02-e-infra/TD-04` — Revisions, 2026-10-18). A página (`app/(auth)/resend-confirmation/page.tsx`) segue a composição das telas de auth (`Card` + `BrandLogo` + `h1` + `AuthFooter` para `/login`) e reutiliza o mesmo `ResendConfirmationForm` renderizado nos estados `invalid`/`expired` de `/confirm-email`: `POST /api/auth/resend-confirmation` (BFF → upstream, resposta `204` anti-enumeração) e sucesso inline que substitui o formulário. Não cria sessão.

## Test Scenarios

### 1. Solicitar um novo e-mail de confirmação

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; server-side upstream faked via `instrumentation.ts` — `POST /auth/resend-confirmation` → 204 para qualquer e-mail, 400 `VALIDATION_ERROR` para o trigger `badrequest@example.com`; no browser `page.route()` of `/api/**`)

#### 1.1. resend-sucesso-inline

**Covers AC:** #1, #2, #4
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/resend-confirmation`
    - expect: `h1` "Resend confirmation e-mail" e o botão "Resend confirmation link" visíveis (a rota existe — o link do login não resulta em 404)
  2. Usuário preenche "Email address" com um e-mail válido e clica em "Resend confirmation link"
    - expect: `POST /api/auth/resend-confirmation` é disparada
    - expect: o bloco `data-slot="resend-confirmation-success"` ("Verifique seu e-mail") substitui o formulário e o botão desaparece
    - expect: o link "Sign in" aponta para `/login` e nenhum cookie de sessão é criado

#### 1.2. resend-erro-400-mantem-formulario

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário preenche "Email address" com `badrequest@example.com` e clica em "Resend confirmation link"
    - expect: o campo recebe `aria-invalid="true"` com a mensagem do envelope de erro
    - expect: o formulário permanece renderizado e nenhum bloco de sucesso aparece
