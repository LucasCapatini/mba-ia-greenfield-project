import { NextResponse } from "next/server";

import type { RegisterDto, RegisterResponse, ApiErrorEnvelope } from "@/lib/api/contracts";
import { invalidBody, readJson } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

export async function POST(request: Request) {
  const body = await readJson<RegisterDto>(request);
  if (!body) return invalidBody();

  const { data, error, response } = await upstream.POST("/auth/register", {
    body,
  });

  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error, {
      status: response.status,
    });
  }

  return NextResponse.json<RegisterResponse>(data, { status: 201 });
}
