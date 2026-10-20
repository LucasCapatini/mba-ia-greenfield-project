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

const { PUT, DELETE } = await import("@/app/api/channels/[nickname]/subscription/route");
const { setSession, getSession } = await import("@/lib/auth/session");

function context(nickname: string) {
  return { params: Promise.resolve({ nickname }) };
}

function request(method: "PUT" | "DELETE", nickname: string): Request {
  return new Request(`http://localhost:3001/api/channels/${nickname}/subscription`, {
    method,
  });
}

function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request: upstreamRequest }) => {
    calls.push(
      `${upstreamRequest.method} ${new URL(upstreamRequest.url).pathname} ${upstreamRequest.headers.get("authorization") ?? "-"}`
    );
  });
  return calls;
}

async function login(accessToken = "active-at") {
  await setSession({
    accessToken,
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
  });
}

beforeEach(() => {
  server.events.removeAllListeners();
  cookieMap.clear();
});

describe("PUT|DELETE /api/channels/[nickname]/subscription", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await PUT(request("PUT", "tech_mastery"), context("tech_mastery"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(calls).toEqual([]);
  });

  it("unsubscribes and resubscribes, passing { subscribed, subscriber_count } through", async () => {
    await login();

    const left = await DELETE(request("DELETE", "tech_mastery"), context("tech_mastery"));
    expect(left.status).toBe(200);
    expect(await left.json()).toEqual({ subscribed: false, subscriber_count: 1199 });

    const back = await PUT(request("PUT", "tech_mastery"), context("tech_mastery"));
    expect(back.status).toBe(200);
    expect(await back.json()).toEqual({ subscribed: true, subscriber_count: 1200 });
  });

  it("passes 422 CANNOT_SUBSCRIBE_OWN_CHANNEL through", async () => {
    await login();

    const res = await PUT(request("PUT", "studio_canal"), context("studio_canal"));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "CANNOT_SUBSCRIBE_OWN_CHANNEL" });
  });

  it("passes 404 CHANNEL_NOT_FOUND through", async () => {
    await login();

    const res = await PUT(request("PUT", "nao_existe"), context("nao_existe"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "CHANNEL_NOT_FOUND" });
  });

  it("refreshes on an upstream 401 and retries with the renewed token", async () => {
    await login("expired-at");
    server.use(
      http.put(`${env.API_URL}/channels/:nickname/subscription`, ({ request: upstreamRequest }) =>
        upstreamRequest.headers.get("authorization") === "Bearer expired-at"
          ? HttpResponse.json(
              { statusCode: 401, error: "UNAUTHORIZED", message: "Unauthorized" },
              { status: 401 }
            )
          : HttpResponse.json({ subscribed: true, subscriber_count: 1200 })
      ),
      http.post(`${env.API_URL}/auth/refresh`, () =>
        HttpResponse.json({ access_token: "renewed-at", refresh_token: "renewed-rt" })
      )
    );
    const calls = recordUpstreamCalls();

    const res = await PUT(request("PUT", "tech_mastery"), context("tech_mastery"));

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      "PUT /channels/tech_mastery/subscription Bearer expired-at",
      "POST /auth/refresh -",
      "PUT /channels/tech_mastery/subscription Bearer renewed-at",
    ]);
    expect((await getSession()).accessToken).toBe("renewed-at");
  });
});
