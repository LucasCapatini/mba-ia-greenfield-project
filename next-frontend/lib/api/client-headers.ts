import "server-only";

import { headers } from "next/headers";

/** Headers do visitante repassados ao upstream; ausentes na requisição de entrada → omitidos. */
export type ClientHeaders = {
  "X-Forwarded-For"?: string;
  "User-Agent"?: string;
};

/**
 * IP real e `User-Agent` do navegador para o upstream (watch-page/TD-03, Revisions 2026-10-19).
 * Toda requisição chega à API pelo BFF, então sem isso o throttler e a deduplicação de
 * visualizações veriam um único visitante. O `next start` preenche `x-forwarded-for` com o IP
 * do socket quando o header não vem; de uma lista, só o primeiro IP (o cliente original) segue.
 */
export async function clientHeaders(): Promise<ClientHeaders> {
  const incoming = await headers();
  const forwardedFor = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = incoming.get("user-agent");
  return {
    ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
    ...(userAgent ? { "User-Agent": userAgent } : {}),
  };
}
