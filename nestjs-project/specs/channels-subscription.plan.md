---
subproject: backend
runner: jest+supertest
scope: phase-06-social-interactions
si: SI-06.3
target_file: nestjs-project/test/channels-subscription.e2e-spec.ts
---

# PUT / DELETE /channels/{nickname}/subscription Test Plan

## Application Overview

`PUT /channels/{nickname}/subscription` inscreve o usuário no canal e `DELETE` cancela a inscrição. As duas são set-state idempotentes e respondem `200` com `SubscriptionStateResponse` (`subscribed`, `subscriber_count`) (`social-interactions/TD-03`). Exigem JWT; inscrever-se no próprio canal → `422 CANNOT_SUBSCRIBE_OWN_CHANNEL`; nickname inexistente → `404 CHANNEL_NOT_FOUND`. `channels.subscriber_count` muda na mesma transação só quando a linha de `subscriptions` entra ou sai (`TD-02`). Este plano cobre o SI-06.3 em `test/channels-subscription.e2e-spec.ts`, com `describe` único e um `it` por cenário.

## Test Scenarios

### 1. Inscrever e desinscrever

**Setup:** `beforeAll` — bootstrap do `AppModule` com `ValidationPipe` + `DomainExceptionFilter` + `ValidationExceptionFilter`; obter `DataSource` e `Repository<Channel>`. `beforeEach` — `cleanAllTables(dataSource)` (inclui `subscriptions`), `throttlerStorage.storage.clear()`. Helpers: `authenticate(email)` (o nickname do canal deriva do prefixo do e-mail); `subscriberCount(nickname)` lê o contador direto do repositório.

#### 1.1. subscribe-is-idempotent

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('criador@example.com')` (canal `criador`); `authenticate('ana@example.com')`
    - expect: `subscriberCount('criador')` = 0
  2. `PUT /channels/criador/subscription` com o `Bearer` de `ana`
    - expect: status `200` com `{ subscribed: true, subscriber_count: 1 }`
  3. Repetir a requisição
    - expect: status `200` com o mesmo corpo e `subscriptions` tem 1 linha

#### 1.2. unsubscribe-is-idempotent

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `ana` inscrita em `criador` (`PUT` do cenário 1.1)
    - expect: `subscriber_count` = 1
  2. `DELETE /channels/criador/subscription` com o `Bearer` de `ana`
    - expect: status `200` com `{ subscribed: false, subscriber_count: 0 }`
  3. Repetir o `DELETE`
    - expect: status `200` com o mesmo corpo e `subscriptions` vazia

### 2. Recusas

**Setup:** mesmo da seção 1.

#### 2.1. own-channel-returns-422

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `authenticate('criador@example.com')`
    - expect: canal `criador` criado
  2. `PUT /channels/criador/subscription` com o `Bearer` do próprio `criador`
    - expect: status `422` com `error = "CANNOT_SUBSCRIBE_OWN_CHANNEL"`
    - expect: `subscriberCount('criador')` continua 0

#### 2.2. unknown-channel-and-missing-token

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-20T04:50:00Z

**Steps:**
  1. `PUT /channels/nao_existe/subscription` com `Bearer` válido
    - expect: status `404` com `error = "CHANNEL_NOT_FOUND"`
  2. `PUT /channels/criador/subscription` sem `Authorization`
    - expect: status `401`
