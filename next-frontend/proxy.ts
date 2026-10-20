import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";

/**
 * Checagem otimista de sessão para o estúdio e o feed das inscrições (Next 16 Proxy, ex-middleware;
 * `/feed/**` desde a Fase 06 — social-interactions/TD-08): só decifra o
 * cookie do iron-session, sem chamar o upstream. Sem sessão → `/login?returnTo=<rota pedida>`.
 * Roda também nas navegações cliente (requisições RSC), então o `returnTo` está sempre certo —
 * o que o layout de `/studio` não consegue, por não receber o pathname.
 */
export async function proxy(request: NextRequest) {
  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.next();
  }
  const { pathname, search } = request.nextUrl;
  // `/` é válido em query string — mantê-la legível dá `returnTo=/studio/videos`; o resto
  // (`?`, `&`, `=` da query original) continua codificado.
  const returnTo = encodeURIComponent(`${pathname}${search}`).replaceAll("%2F", "/");
  return NextResponse.redirect(
    new URL(`/login?returnTo=${returnTo}`, request.nextUrl),
  );
}

export const config = {
  matcher: ["/studio/:path*", "/feed/:path*"],
};
