---
subproject: backend
runner: jest+supertest
scope: task-saneamento-fase-02-e-infra
si: SI-5
target_file: nestjs-project/test/auth-confirm-email.e2e-spec.ts
---

# GET /auth/confirm-email (idempotente) Test Plan

## Application Overview

`GET /auth/confirm-email?token=` valida o token recebido no link do e-mail de confirmação e marca o usuário como confirmado. A partir de `saneamento-fase-02-e-infra/TD-03`, o endpoint passa a ser idempotente: um token já consumido por um usuário já confirmado responde `204` em vez de `401 INVALID_TOKEN`, para que o prefetch de links por clientes de e-mail não inutilize a confirmação. O token de reset de senha (`POST /auth/reset-password`) permanece single-use. Este plano cobre o contrato HTTP completo do SI-5 em um arquivo E2E próprio (`test/auth-confirm-email.e2e-spec.ts`), com `test.describe` único e um `it` por cenário.

**Atenção para o implementador:** `test/auth.e2e-spec.ts` → `describe('GET /auth/confirm-email')` contém o teste `returns 401 with INVALID_TOKEN on an already-used token`, que contradiz o cenário 1.2 abaixo. O SI-5 deve remover ou inverter esse `it` no arquivo existente; caso contrário a suíte E2E fica inconsistente (um arquivo espera `401`, outro espera `204`).

## Test Scenarios

### 1. GET /auth/confirm-email

**Setup:** `beforeAll` — `Test.createTestingModule({ imports: [AppModule] }).compile()`, `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`, `app.useGlobalFilters(new DomainExceptionFilter(), new ValidationExceptionFilter())` (reproduz `main.ts`, que o módulo de teste não executa); obter `DataSource` e `Repository<VerificationToken>` via `app.get`. `beforeEach` — `cleanAllTables(dataSource)` (`src/test/create-test-data-source.ts`) e `throttlerStorage.storage.clear()`. Helper `captureConfirmationToken(email)` — `jest.spyOn(mailService, 'sendConfirmationEmail').mockImplementationOnce(...)` capturando o terceiro argumento (token bruto) durante `POST /auth/register` (mesmo padrão de `test/auth.e2e-spec.ts`). Suíte roda com `--runInBand` (banco compartilhado).

#### 1.1. valid-token-confirms-account

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-17T15:32:36Z

**Steps:**
  1. `POST /auth/register` com `{ email: "confirm-ok@example.com", password: "password123" }`, capturando o token de confirmação via spy do `MailService`
    - expect: resposta `201`
  2. `GET /auth/confirm-email?token=<token capturado>`
    - expect: status `204`
    - expect: body vazio
  3. Consultar `users` por `email = 'confirm-ok@example.com'`
    - expect: `is_confirmed = true`
  4. Consultar `verification_tokens` por `token_hash = sha256(token)` e `type = EMAIL_CONFIRMATION`
    - expect: `used_at` preenchido (não nulo)

#### 1.2. repeated-token-is-idempotent

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-17T15:32:36Z

**Steps:**
  1. `POST /auth/register` com `{ email: "confirm-twice@example.com", password: "password123" }`, capturando o token
    - expect: resposta `201`
  2. `GET /auth/confirm-email?token=<token>` (primeira chamada)
    - expect: status `204`
  3. Ler `used_at` do registro em `verification_tokens` (`token_hash = sha256(token)`) e guardar como `firstUsedAt`
    - expect: `firstUsedAt` não nulo
  4. `GET /auth/confirm-email?token=<token>` (segunda chamada — simula prefetch do cliente de e-mail seguido do clique real)
    - expect: status `204`
    - expect: body vazio
  5. Reler o registro em `verification_tokens`
    - expect: `used_at` igual a `firstUsedAt` (nenhuma reescrita)
  6. Consultar `users` por `email = 'confirm-twice@example.com'`
    - expect: `is_confirmed = true`

#### 1.3. unknown-token-returns-invalid-token

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-17T15:32:36Z

**Steps:**
  1. `GET /auth/confirm-email?token=does-not-exist-<uuid>` sem nenhum registro correspondente em `verification_tokens`
    - expect: status `401`
    - expect: body `{ statusCode: 401, error: "INVALID_TOKEN", message: <string> }`
  2. Consultar `users`
    - expect: nenhum usuário alterado (tabela vazia após `cleanAllTables`)

#### 1.4. expired-unused-token-returns-token-expired

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-17T15:32:36Z

**Steps:**
  1. `POST /auth/register` com `{ email: "confirm-expired@example.com", password: "password123" }`, capturando o token
    - expect: resposta `201`
  2. `verificationTokenRepository.update({ token_hash: sha256(token) }, { expires_at: new Date(0) })` — token expirado e ainda não usado
    - expect: 1 linha afetada
  3. `GET /auth/confirm-email?token=<token>`
    - expect: status `401`
    - expect: body `error: "TOKEN_EXPIRED"`
  4. Consultar `users` por `email = 'confirm-expired@example.com'`
    - expect: `is_confirmed = false`
  5. Reler o registro em `verification_tokens`
    - expect: `used_at` nulo (token expirado não é consumido)

### 2. POST /auth/reset-password — regressão single-use

**Setup:** mesmo bootstrap da seção 1. Helper `captureResetToken(email)` — registrar e confirmar o usuário (`captureConfirmationToken` + `GET /auth/confirm-email`), depois `jest.spyOn(mailService, 'sendPasswordResetEmail').mockImplementationOnce(...)` capturando o token bruto durante `POST /auth/forgot-password`.

#### 2.1. reset-token-reuse-stays-single-use

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-17T15:32:36Z

**Steps:**
  1. Registrar e confirmar `reset-once@example.com`; `POST /auth/forgot-password` com `{ email: "reset-once@example.com" }`, capturando o token de reset
    - expect: resposta `204`
  2. `POST /auth/reset-password` com `{ token: <token>, new_password: "newpassword123" }` (primeira chamada)
    - expect: status `204`
  3. `POST /auth/reset-password` com `{ token: <mesmo token>, new_password: "anotherpass123" }` (segunda chamada)
    - expect: status `401`
    - expect: body `error: "INVALID_TOKEN"`
  4. `POST /auth/login` com `{ email: "reset-once@example.com", password: "newpassword123" }`
    - expect: status `200` (a primeira redefinição permanece válida; a segunda não alterou a senha)
  5. `POST /auth/login` com `{ email: "reset-once@example.com", password: "anotherpass123" }`
    - expect: status `401` com `error: "INVALID_CREDENTIALS"`
