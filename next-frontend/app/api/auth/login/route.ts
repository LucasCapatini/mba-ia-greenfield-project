import { NextResponse } from "next/server";

import type { LoginDto, LoginTokenPair, ApiErrorEnvelope } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";
import { setSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await readJson<LoginDto>(request);
  if (!body) return invalidBody();

  const { data, error, response } = await upstream.POST("/auth/login", {
    body,
  });
  console.log(error, data, response);
  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  const tokens: LoginTokenPair = data;

  // Seal tokens into the iron-session cookie — tokens never cross to the browser.
  await setSession({
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? "",
    userId: "",
    email: body.email,
    channelSlug: "",
  });

  // FE-facing body omits access_token / refresh_token (per API Contract).
  return NextResponse.json({}, { status: 200 });
}
