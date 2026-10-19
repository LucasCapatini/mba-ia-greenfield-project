---
subproject: frontend
runner: playwright
scope: task-saneamento-fase-02-e-infra
si: SI-8
target_file: tests/confirm-email.e2e-spec.ts
---

# Tela de confirmação de conta — Test Plan

## Application Overview

A tela `/confirm-email` é o destino do link enviado por e-mail no cadastro (`${FRONTEND_URL}/confirm-email?token=…`, per `saneamento-fase-02-e-infra/TD-02`). É um RSC assíncrono (`app/(auth)/confirm-email/page.tsx`) que lê `searchParams.token` e, no primeiro paint, chama o upstream `GET /auth/confirm-email` pelo cliente tipado `upstream` — sem estado de carregamento intermediário (per `phase-02-auth-frontend/TD-07`). O resultado é mapeado para três estados fechados por `saneamento-fase-02-e-infra/TD-04`: `success` (CTA para `/login`), `expired` e `invalid` (mensagem + `ResendConfirmationForm` inline, que POSTa em `/api/auth/resend-confirmation`). Como o backend tornou a confirmação idempotente (`saneamento-fase-02-e-infra/TD-03`), abrir o link duas vezes (prefetch de e-mail) produz sucesso nas duas visitas. A página nunca cria sessão.

## Test Scenarios

### 1. Confirmar a conta a partir do link do e-mail

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; server-side upstream faked via `instrumentation.ts` — triggers `expired-token` → 401 `TOKEN_EXPIRED`, `invalid-token`/vazio → 401 `INVALID_TOKEN`, demais → 204; no browser `page.route()` of `/api/**`)

#### 1.1. confirmacao-sucesso-primeiro-paint

**Covers AC:** #1, #5
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/confirm-email?token=ok-token`
    - expect: o `h1` "Email confirmed" e a mensagem `role="status"` "Sua conta foi confirmada" aparecem já no primeiro paint
    - expect: o link "Sign in" aponta para `/login`
    - expect: nenhum botão "Resend confirmation link" é renderizado
  2. Inspeção dos cookies do contexto
    - expect: nenhum cookie de sessão foi criado (a página não emite `Set-Cookie`)

#### 1.2. token-expirado-reenvio-inline

**Covers AC:** #2, #3
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/confirm-email?token=expired-token`
    - expect: o `h1` "Confirmation link expired" é renderizado com o botão "Resend confirmation link" visível
  2. Usuário preenche "Email address" com um e-mail válido e clica em "Resend confirmation link"
    - expect: a requisição `POST /api/auth/resend-confirmation` é disparada
    - expect: o bloco `data-slot="resend-confirmation-success"` ("Verifique seu e-mail") substitui o formulário e o botão desaparece
    - expect: a URL permanece em `/confirm-email?token=expired-token` (sem redirect)

#### 1.3. token-invalido-estado-invalid

**Covers AC:** #4 (variante com token inválido — mesmo estado `invalid` de TD-04)
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/confirm-email?token=invalid-token`
    - expect: o `h1` "Invalid confirmation link" é renderizado
    - expect: o botão "Resend confirmation link" está visível

#### 1.4. token-ausente-sem-chamada-upstream

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/confirm-email` sem `token`
    - expect: o `h1` "Invalid confirmation link" é renderizado (o RSC não chama o upstream)
    - expect: o botão "Resend confirmation link" está visível e o link "Sign in" aponta para `/login`

#### 1.5. link-aberto-duas-vezes-prefetch

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/confirm-email?token=ok-token`
    - expect: `h1` "Email confirmed"
  2. Usuário navega de novo para a mesma URL (simula o prefetch do cliente de e-mail seguido do clique real)
    - expect: `h1` "Email confirmed" novamente — a confirmação é idempotente
