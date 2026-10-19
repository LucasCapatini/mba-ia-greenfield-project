import { NextResponse } from "next/server";

import type {
  ApiErrorEnvelope,
  ResendConfirmationDto,
} from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

/**
 * BFF proxy used by the confirm-email screen's resend form (per saneamento-fase-02-e-infra/TD-04).
 * Pure pass-through: 204 whether or not the e-mail exists / is already confirmed (upstream
 * anti-enumeration), upstream ApiErrorEnvelope on validation errors. No session side effects.
 */
export async function POST(request: Request) {
  const body = await readJson<ResendConfirmationDto>(request);
  if (!body) return invalidBody();

  const { error, response } = await upstream.POST(
    "/auth/resend-confirmation",
    { body },
  );

  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  return new Response(null, { status: 204 });
}
