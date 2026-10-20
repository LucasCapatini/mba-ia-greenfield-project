import "server-only";

import { getSession } from "@/lib/auth/session";

import { clientHeaders, type ClientHeaders } from "./client-headers";

export type PublicReadHeaders = ClientHeaders & { Authorization?: string };

/**
 * Leitura pública para RSC (video-channel-management/TD-07, TD-12): envia o `Bearer` da sessão
 * quando há uma (o dono vê o próprio rascunho) e sempre os headers do visitante. Um RSC não grava
 * cookie, então não há refresh: `401` do upstream (token expirado) → repete a leitura anônima e
 * devolve os dados públicos em vez de propagar o erro.
 */
export async function publicRead<T extends { response: Response }>(
  call: (headers: PublicReadHeaders) => Promise<T>
): Promise<T> {
  const client = await clientHeaders();
  const session = await getSession();
  if (session.isLoggedIn) {
    const result = await call({
      ...client,
      Authorization: `Bearer ${session.accessToken}`,
    });
    if (result.response.status !== 401) {
      return result;
    }
  }
  return call(client);
}
