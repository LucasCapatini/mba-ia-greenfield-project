import { NextResponse } from "next/server";

import type { LoginDto, LoginTokenPair, ApiErrorEnvelope } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";
import { setSession } from "@/lib/auth/session";

/**
 * Nickname do canal do usuário para `session.channelSlug` — as páginas públicas o comparam com o
 * canal exibido para esconder o Subscribe do dono (social-interactions/TD-03). Falha na leitura não
 * impede o login: o slug fica vazio, como antes.
 */
async function ownChannelSlug(accessToken: string): Promise<string> {
  try {
    const { data } = await upstream.GET("/channels/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data?.nickname ?? "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const body = await readJson<LoginDto>(request);
  if (!body) return invalidBody();

  const { data, error, response } = await upstream.POST("/auth/login", {
    body,
  });
  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  const tokens: LoginTokenPair = data;
  const accessToken = tokens.access_token ?? "";

  // Seal tokens into the iron-session cookie — tokens never cross to the browser.
  await setSession({
    accessToken,
    refreshToken: tokens.refresh_token ?? "",
    userId: "",
    email: body.email,
    channelSlug: await ownChannelSlug(accessToken),
  });

  // FE-facing body omits access_token / refresh_token (per API Contract).
  return NextResponse.json({}, { status: 200 });
}
