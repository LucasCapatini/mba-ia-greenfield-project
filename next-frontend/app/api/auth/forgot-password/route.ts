import { NextResponse } from "next/server";

import type { ForgotPasswordDto, ApiErrorEnvelope } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

export async function POST(request: Request) {
  const body = await readJson<ForgotPasswordDto>(request);
  if (!body) return invalidBody();

  const { error, response } = await upstream.POST("/auth/forgot-password", {
    body,
  });

  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  // 204 pass-through — identical whether email is registered or not (anti-enumeration).
  return new Response(null, { status: 204 });
}
