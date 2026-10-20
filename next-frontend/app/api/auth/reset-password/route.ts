import { NextResponse } from "next/server";

import type { ApiErrorEnvelope, ResetPasswordDto } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

/**
 * BFF proxy for the reset-password destination screen (per saneamento-fase-02-e-infra/TD-04).
 * Pure pass-through: 204 on success, upstream ApiErrorEnvelope with the same status otherwise.
 * Never touches the session cookie — resetting a password does not sign the user in.
 */
export async function POST(request: Request) {
  const body = await readJson<ResetPasswordDto>(request);
  if (!body) return invalidBody();

  const { error, response } = await upstream.POST("/auth/reset-password", {
    body,
  });

  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  return new Response(null, { status: 204 });
}
