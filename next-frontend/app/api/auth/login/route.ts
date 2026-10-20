import { NextResponse } from "next/server";

import type { LoginDto, LoginTokenPair, ApiErrorEnvelope } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";
import { setSession } from "@/lib/auth/session";

/**
 * Canal do usuário para a sessão: o nickname (`channelSlug`) as páginas públicas comparam com o
 * canal exibido para esconder o Subscribe do dono (social-interactions/TD-03); o nome
 * (`channelName`) dá as iniciais do avatar do campo de comentário. Falha na leitura não impede o
 * login: os dois ficam vazios.
 */
async function ownChannel(
  accessToken: string
): Promise<{ channelSlug: string; channelName: string }> {
  try {
    const { data } = await upstream.GET("/channels/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { channelSlug: data?.nickname ?? "", channelName: data?.name ?? "" };
  } catch {
    return { channelSlug: "", channelName: "" };
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
    ...(await ownChannel(accessToken)),
  });

  // FE-facing body omits access_token / refresh_token (per API Contract).
  return NextResponse.json({}, { status: 200 });
}
