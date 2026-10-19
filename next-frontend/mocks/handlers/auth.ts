import { http, HttpResponse } from "msw";

import type {
  RegisterResponse,
  LoginTokenPair,
  RefreshTokenPair,
  ResetPasswordDto,
  ResendConfirmationDto,
  ApiErrorEnvelope,
} from "@/lib/api/contracts";
import { env } from "@/lib/env";

import { resetStudioStore } from "../store";

// Reserved trigger table (shared with E2E — trigger values must not collide across test suites).
const CONFLICT_EMAIL = "conflict@example.com";
const BAD_REQUEST_EMAIL = "badrequest@example.com";
const INVALID_CREDENTIALS_EMAIL = "invalid@example.com";
const UNCONFIRMED_EMAIL = "unconfirmed@example.com";
// Token triggers (reset-password / confirm-email flows). Error codes mirror the NestJS domain exceptions.
const EXPIRED_TOKEN = "expired-token";
const INVALID_TOKEN = "invalid-token";
const BAD_REQUEST_TOKEN = "badrequest-token";

function errorEnvelope(
  statusCode: number,
  error: string,
  message: string
): ApiErrorEnvelope {
  return { statusCode, error, message, code: null };
}

export const handlers = [
  // POST /auth/register
  http.post(`${env.API_URL}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";

    if (email === CONFLICT_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(409, "EMAIL_ALREADY_REGISTERED", "Email already registered"),
        { status: 409 }
      );
    }
    if (email === BAD_REQUEST_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(400, "VALIDATION_FAILED", "Validation failed"),
        { status: 400 }
      );
    }
    return HttpResponse.json<RegisterResponse>(
      { id: "user-fixture-id", email },
      { status: 201 }
    );
  }),

  // POST /auth/login
  http.post(`${env.API_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";

    if (email === BAD_REQUEST_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(400, "VALIDATION_FAILED", "Validation failed"),
        { status: 400 }
      );
    }
    if (email === INVALID_CREDENTIALS_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(401, "INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      );
    }
    if (email === UNCONFIRMED_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(403, "EMAIL_NOT_CONFIRMED", "Email not confirmed"),
        { status: 403 }
      );
    }
    // Cada E2E do Studio começa logando: o login devolve o store de vídeos/canal ao seed.
    resetStudioStore();
    return HttpResponse.json<LoginTokenPair>(
      { access_token: "fixture-access-token", refresh_token: "fixture-refresh-token" },
      { status: 200 }
    );
  }),

  // POST /auth/logout
  http.post(`${env.API_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /auth/forgot-password
  http.post(`${env.API_URL}/auth/forgot-password`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";

    if (email === BAD_REQUEST_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(400, "VALIDATION_FAILED", "Validation failed"),
        { status: 400 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /auth/refresh
  http.post(`${env.API_URL}/auth/refresh`, () => {
    return HttpResponse.json<RefreshTokenPair>(
      { access_token: "new-fixture-access-token", refresh_token: "new-fixture-refresh-token" },
      { status: 200 }
    );
  }),

  // GET /auth/confirm-email — idempotent (per saneamento-fase-02-e-infra/TD-03); token triggers via query
  http.get(`${env.API_URL}/auth/confirm-email`, ({ request }) => {
    const token = new URL(request.url).searchParams.get("token") ?? "";

    if (token === EXPIRED_TOKEN) {
      return HttpResponse.json(
        errorEnvelope(401, "TOKEN_EXPIRED", "Token has expired"),
        { status: 401 }
      );
    }
    if (token === INVALID_TOKEN || token === "") {
      return HttpResponse.json(
        errorEnvelope(401, "INVALID_TOKEN", "Token is invalid"),
        { status: 401 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /auth/reset-password — single-use token; 204 on success
  http.post(`${env.API_URL}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as ResetPasswordDto;

    if (body.token === EXPIRED_TOKEN) {
      return HttpResponse.json(
        errorEnvelope(401, "TOKEN_EXPIRED", "Token has expired"),
        { status: 401 }
      );
    }
    if (body.token === INVALID_TOKEN) {
      return HttpResponse.json(
        errorEnvelope(401, "INVALID_TOKEN", "Token is invalid"),
        { status: 401 }
      );
    }
    if (body.token === BAD_REQUEST_TOKEN) {
      return HttpResponse.json(
        errorEnvelope(
          400,
          "VALIDATION_ERROR",
          "new_password must be longer than or equal to 8 characters"
        ),
        { status: 400 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /auth/resend-confirmation — 204 whether or not the e-mail exists / is confirmed
  http.post(`${env.API_URL}/auth/resend-confirmation`, async ({ request }) => {
    const body = (await request.json()) as ResendConfirmationDto;

    if (body.email === BAD_REQUEST_EMAIL) {
      return HttpResponse.json(
        errorEnvelope(400, "VALIDATION_ERROR", "email must be an email"),
        { status: 400 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
