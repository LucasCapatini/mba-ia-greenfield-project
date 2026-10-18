---
subproject: frontend
runner: playwright
scope: task-saneamento-fase-02-e-infra
si: SI-9
target_file: tests/reset-password.e2e-spec.ts
---

# Tela de redefinição de senha — Test Plan

## Application Overview

A tela `/reset-password` é o destino do link de recuperação de senha (`${FRONTEND_URL}/reset-password?token=…`). O RSC (`app/(auth)/reset-password/page.tsx`) é dono do token: sem `token` renderiza o estado de erro com link para `/forgot-password` e nenhum formulário; com token renderiza `ResetPasswordForm` (`"use client"`, react-hook-form + Zod) recebendo o token como prop (per `phase-02-auth-frontend/TD-07`, `TD-04`, `TD-05`). O formulário espelha as regras do backend (mínimo 8, máximo 128, letra e número) e exige confirmação igual; submete `{ token, new_password }` em `POST /api/auth/reset-password` (BFF → upstream). Estados fechados por `saneamento-fase-02-e-infra/TD-04`: `form`, `success` (CTA para `/login`) e erro root — `401` (`INVALID_TOKEN`/`TOKEN_EXPIRED`) vira a mensagem de link inválido ou expirado com link para `/forgot-password` (`mapResetPasswordErrorToForm`). A página nunca cria sessão.

## Test Scenarios

### 1. Redefinir a senha a partir do link do e-mail

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; server-side upstream faked via `instrumentation.ts` — triggers de token `expired-token` → 401 `TOKEN_EXPIRED`, `invalid-token` → 401 `INVALID_TOKEN`, `badrequest-token` → 400, demais → 204; no browser `page.route()` of `/api/**`)

#### 1.1. reset-sucesso-link-para-login

**Covers AC:** #1, #4
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/reset-password?token=ok-token`
    - expect: `h1` "Choose a new password" com os campos "New password" e "Confirm new password"
  2. Usuário preenche uma senha válida nos dois campos e clica em "Reset password"
    - expect: `POST /api/auth/reset-password` é disparada com o corpo `{ token: "ok-token", new_password: "<senha>" }`
  3. Backend responde `204`
    - expect: a mensagem `role="status"` "Senha redefinida" substitui o formulário, com link "Sign in" para `/login`
    - expect: o botão "Reset password" desaparece e nenhum cookie de sessão é criado

#### 1.2. validacao-client-side-bloqueia-submit

**Covers AC:** #2, #3
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário preenche uma senha com menos de 8 caracteres nos dois campos e clica em "Reset password"
    - expect: a mensagem inline "Mínimo 8 caracteres" aparece sob o campo e nenhuma requisição é feita
  2. Usuário preenche uma senha válida e uma confirmação divergente e clica em "Reset password"
    - expect: a mensagem inline "As senhas não coincidem" aparece sob a confirmação
    - expect: a página permanece no formulário (botão "Reset password" visível, sem estado de sucesso)

#### 1.3. token-expirado-erro-root-com-link

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/reset-password?token=expired-token`, preenche senhas válidas e clica em "Reset password"
    - expect: o alerta do formulário (`data-slot="form-error"`, não o route announcer do Next) contém "inválido ou expirou"
    - expect: o alerta contém o link "Request a new link" para `/forgot-password`
    - expect: o formulário permanece renderizado

#### 1.4. token-ausente-sem-formulario

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-18T14:01:31Z

**Steps:**
  1. Usuário navega para `/reset-password` sem `token`
    - expect: `h1` "Invalid reset link" e nenhum campo "New password"
    - expect: o link "Request a new link" aponta para `/forgot-password`
