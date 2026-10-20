import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { GET } = await import("@/app/api/me/subscriptions/videos/route");
const { setSession } = await import("@/lib/auth/session");

type Page = { items: { channel: { nickname: string } }[]; next_cursor: string | null };

function getRequest(query = ""): Request {
  return new Request(`http://localhost:3001/api/me/subscriptions/videos${query}`);
}

function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    calls.push(
      `${request.method} ${url.pathname}${url.search} ${request.headers.get("authorization") ?? "-"}`
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
    channelName: "",
  });
}

beforeEach(() => {
  server.events.removeAllListeners();
  cookieMap.clear();
});

describe("GET /api/me/subscriptions/videos", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(calls).toEqual([]);
  });

  it("passes the next feed page through with the session Bearer, forwarding cursor and limit", async () => {
    await login();
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest("?cursor=offset-20&limit=20"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(body.items).toHaveLength(4);
    expect(body.items.every((item) => item.channel.nickname === "tech_mastery")).toBe(true);
    expect(body.next_cursor).toBeNull();
    expect(calls).toEqual(["GET /me/subscriptions/videos?cursor=offset-20&limit=20 Bearer active-at"]);
  });

  it("refreshes on an upstream 401 and retries with the renewed token", async () => {
    await login("expired-at");
    server.use(
      http.get(`${env.API_URL}/me/subscriptions/videos`, ({ request: upstreamRequest }) =>
        upstreamRequest.headers.get("authorization") === "Bearer expired-at"
          ? HttpResponse.json(
              { statusCode: 401, error: "UNAUTHORIZED", message: "Unauthorized" },
              { status: 401 }
            )
          : HttpResponse.json({ items: [], next_cursor: null })
      ),
      http.post(`${env.API_URL}/auth/refresh`, () =>
        HttpResponse.json({ access_token: "renewed-at", refresh_token: "renewed-rt" })
      )
    );
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      "GET /me/subscriptions/videos Bearer expired-at",
      "POST /auth/refresh -",
      "GET /me/subscriptions/videos Bearer renewed-at",
    ]);
  });
});
