import "server-only";

import { clientHeaders, type ClientHeaders } from "@/lib/api/client-headers";
import type { ApiErrorEnvelope } from "@/lib/api/contracts";
import { withRefresh } from "@/lib/auth/refresh";
import { getSession } from "@/lib/auth/session";

/** O que o `openapi-fetch` devolve: corpo já lido (`data`/`error`) + a resposta crua. */
type UpstreamResult = { data?: unknown; error?: unknown; response: Response };

export type SessionHeaders = { Authorization: string };

/** Leituras públicas: o `Bearer` só vai quando há sessão; os headers do visitante sempre. */
export type OptionalSessionHeaders = ClientHeaders & { Authorization?: string };

function errorResponse(statusCode: number, error: string, message: string): Response {
  return Response.json(
    { statusCode, error, message } satisfies ApiErrorEnvelope,
    { status: statusCode }
  );
}

/**
 * Reemite o resultado do upstream com o mesmo status e corpo (envelope de erro incluso). O
 * `openapi-fetch` já consumiu o corpo da resposta original, então ele é reserializado aqui.
 */
export function passThrough(result: UpstreamResult): Response {
  const body = result.error ?? result.data;
  if (body === undefined) {
    return new Response(null, { status: result.response.status });
  }
  return Response.json(body, { status: result.response.status });
}

/**
 * Chama o upstream com o `Authorization: Bearer` da sessão iron-session. Sem sessão → 401 sem
 * tocar o upstream; 401 do upstream → refresh single-flight e nova tentativa com o token
 * renovado (per phase-02-auth-frontend/TD-03); refresh falho → sessão destruída e 401.
 */
export async function withSession(
  call: (headers: SessionHeaders) => Promise<UpstreamResult>
): Promise<Response> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return errorResponse(401, "UNAUTHORIZED", "Not authenticated");
  }
  return withRefresh(async () => {
    // Relido a cada tentativa: depois do refresh a sessão traz o access token novo.
    const { accessToken } = await getSession();
    return passThrough(await call({ Authorization: `Bearer ${accessToken}` }));
  });
}

/**
 * Chamada pública com autenticação opcional (video-channel-management/TD-07). Sem sessão → upstream
 * anônimo. Com sessão → `Bearer` + refresh single-flight como em `withSession`; se o refresh
 * falha (sessão destruída) a chamada é refeita anônima e devolve a resposta pública. Sempre
 * repassa IP e `User-Agent` do visitante (watch-page/TD-03).
 */
export async function withOptionalSession(
  call: (headers: OptionalSessionHeaders) => Promise<UpstreamResult>
): Promise<Response> {
  const client = await clientHeaders();
  const anonymous = async () => passThrough(await call(client));
  const session = await getSession();
  if (!session.isLoggedIn) {
    return anonymous();
  }
  const response = await withRefresh(async () => {
    // Relido a cada tentativa: depois do refresh a sessão traz o access token novo.
    const { accessToken } = await getSession();
    return passThrough(await call({ ...client, Authorization: `Bearer ${accessToken}` }));
  });
  // 401 aqui = token recusado mesmo após o refresh: a requisição não foi processada, então
  // repeti-la anônima é seguro (o guard do upstream recusa antes do handler).
  return response.status === 401 ? anonymous() : response;
}

/** Corpo JSON da requisição do navegador; `null` quando não é JSON válido (vira 400). */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * `cursor`/`limit` da query do navegador para repassar ao upstream nas listagens keyset; os
 * ausentes ficam de fora (o upstream aplica os padrões e valida — 400 passa direto).
 */
export function cursorQuery(request: Request): { cursor?: string; limit?: number } {
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  const limit = params.get("limit");
  return {
    ...(cursor !== null && { cursor }),
    ...(limit !== null && { limit: Number(limit) }),
  };
}

export function invalidBody(message = "Request body must be valid JSON"): Response {
  return errorResponse(400, "VALIDATION_ERROR", message);
}

/** Contexto das rotas `app/api/videos/[publicId]/**` (no Next 16 `params` é uma Promise). */
export type PublicIdContext = { params: Promise<{ publicId: string }> };

/** Contexto das rotas `app/api/comments/[commentId]/**`. */
export type CommentIdContext = { params: Promise<{ commentId: string }> };

/** Contexto das rotas `app/api/channels/[nickname]/**`. */
export type NicknameContext = { params: Promise<{ nickname: string }> };
