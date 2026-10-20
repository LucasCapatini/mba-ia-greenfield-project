import type { ApiErrorEnvelope } from "@/lib/api/contracts"

export const COMMENT_GONE_MESSAGE = "This comment is no longer available"
export const VIDEO_GONE_MESSAGE = "This video is no longer available"
export const COMMENT_GENERIC_ERROR = "Something went wrong, try again"
export const COMMENT_TOO_MANY = "Too many actions, try again in a moment"

/**
 * `fetch` das rotas BFF de comentários; uma falha de rede vira resposta 503 para os chamadores
 * tratarem tudo pelo status (social-interactions — Error Catalog → UX mapping).
 */
export function requestComments(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<Response> {
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  return fetch(url, init).catch(() => new Response(null, { status: 503 }))
}

/** `error` do envelope (`COMMENT_NOT_FOUND`, `VALIDATION_ERROR`…), `null` sem corpo JSON. */
export async function errorCodeOf(res: Response): Promise<string | null> {
  const envelope = (await res
    .clone()
    .json()
    .catch(() => null)) as Partial<ApiErrorEnvelope> | null
  return typeof envelope?.error === "string" ? envelope.error : null
}

/** Mensagem do envelope para o composer (400 de texto), com fallback genérico. */
export async function composerErrorOf(res: Response): Promise<string> {
  if (res.status === 429) return COMMENT_TOO_MANY
  if (res.status === 400) {
    const envelope = (await res
      .clone()
      .json()
      .catch(() => null)) as Partial<ApiErrorEnvelope> | null
    const message = envelope?.message
    if (typeof message === "string" && message) return message
    if (Array.isArray(message) && typeof message[0] === "string") return message[0]
  }
  return COMMENT_GENERIC_ERROR
}
