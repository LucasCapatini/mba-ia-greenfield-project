import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { env } from "@/lib/env";
import { server } from "@/mocks/server";

const cookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieMap.set(name, value);
    },
    delete: (name: string) => {
      cookieMap.delete(name);
    },
  }),
}));

const { PUT, DELETE } = await import("@/app/api/videos/[publicId]/reaction/route");
const { setSession } = await import("@/lib/auth/session");

function context(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function putRequest(publicId: string, body: string): Request {
  return new Request(`http://localhost:3001/api/videos/${publicId}/reaction`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function deleteRequest(publicId: string): Request {
  return new Request(`http://localhost:3001/api/videos/${publicId}/reaction`, {
    method: "DELETE",
  });
}

/** Método + path + `Authorization` de cada chamada ao upstream durante o teste. */
function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push(
      `${request.method} ${new URL(request.url).pathname} ${request.headers.get("authorization") ?? "-"}`
    );
  });
  return calls;
}

async function login() {
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
    channelName: "",
  });
}

beforeEach(() => {
  server.events.removeAllListeners();
  cookieMap.clear();
});

describe("PUT /api/videos/[publicId]/reaction", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await PUT(putRequest("tech-01", '{"value":"like"}'), context("tech-01"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(calls).toEqual([]);
  });

  it("forwards the session Bearer and passes the resulting state through", async () => {
    await login();
    const calls = recordUpstreamCalls();

    const res = await PUT(putRequest("tech-01", '{"value":"dislike"}'), context("tech-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      viewer_reaction: "dislike",
      like_count: 1200,
      dislike_count: 15,
    });
    expect(calls).toEqual(["PUT /videos/tech-01/reaction Bearer active-at"]);
  });

  it("answers 400 to an invalid JSON body without calling the upstream", async () => {
    await login();
    const calls = recordUpstreamCalls();

    const res = await PUT(putRequest("tech-01", "{not json"), context("tech-01"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
    expect(calls).toEqual([]);
  });

  it("passes the upstream 400 of an unknown value through", async () => {
    await login();

    const res = await PUT(putRequest("tech-01", '{"value":"love"}'), context("tech-01"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("passes 404 VIDEO_NOT_FOUND through for a draft", async () => {
    await login();

    const res = await PUT(
      putRequest("ready-draft-01", '{"value":"like"}'),
      context("ready-draft-01")
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("passes the upstream 429 through", async () => {
    await login();
    server.use(
      http.put(`${env.API_URL}/videos/:publicId/reaction`, () =>
        HttpResponse.json(
          { statusCode: 429, error: "ThrottlerException", message: "Too Many Requests" },
          { status: 429 }
        )
      )
    );

    const res = await PUT(putRequest("tech-01", '{"value":"like"}'), context("tech-01"));

    expect(res.status).toBe(429);
  });
});

describe("DELETE /api/videos/[publicId]/reaction", () => {
  it("returns 401 without a session", async () => {
    const calls = recordUpstreamCalls();

    const res = await DELETE(deleteRequest("tech-01"), context("tech-01"));

    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("removes the reaction and returns the counters", async () => {
    await login();
    await PUT(putRequest("tech-01", '{"value":"like"}'), context("tech-01"));

    const res = await DELETE(deleteRequest("tech-01"), context("tech-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      viewer_reaction: null,
      like_count: 1200,
      dislike_count: 14,
    });
  });
});
