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
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

const { GET } = await import("@/app/api/videos/route");
const { setSession } = await import("@/lib/auth/session");

type Page = {
  items: { public_id: string; title: string; channel: { nickname: string; name: string } }[];
  next_cursor: string | null;
};

function getRequest(query = ""): Request {
  return new Request(`http://localhost:3001/api/videos${query}`);
}

/** Método, URL (com query), `Authorization` e `X-Forwarded-For` de cada chamada ao upstream. */
function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    calls.push(
      `${request.method} ${url.pathname}${url.search} ${request.headers.get("authorization") ?? "-"} ${request.headers.get("x-forwarded-for") ?? "-"}`
    );
  });
  return calls;
}

beforeEach(() => {
  server.events.removeAllListeners();
  cookieMap.clear();
});

describe("GET /api/videos", () => {
  it("forwards category, q, cursor and limit and passes the page through", async () => {
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest("?category=technology&q=mastery&cursor=offset-20&limit=20"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(body.items).toHaveLength(4);
    expect(body.items.every((item) => item.channel.nickname === "tech_mastery")).toBe(true);
    expect(body.next_cursor).toBeNull();
    expect(calls).toEqual([
      "GET /videos?cursor=offset-20&limit=20&category=technology&q=mastery - 203.0.113.9",
    ]);
  });

  it("serves the first page of the global listing anonymously", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(body.items).toHaveLength(20);
    expect(body.next_cursor).toEqual(expect.any(String));
  });

  it("passes 404 CATEGORY_NOT_FOUND through", async () => {
    const res = await GET(getRequest("?category=unknown-category"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "CATEGORY_NOT_FOUND" });
  });

  it("passes 400 VALIDATION_ERROR through for a one-character term", async () => {
    const res = await GET(getRequest("?q=a"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("sends the session Bearer when there is a session", async () => {
    await setSession({
      accessToken: "active-at",
      refreshToken: "active-rt",
      userId: "u1",
      email: "studio@example.com",
      channelSlug: "studio_canal",
      channelName: "",
    });
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest("?limit=5"));

    expect(res.status).toBe(200);
    expect(calls).toEqual(["GET /videos?limit=5 Bearer active-at 203.0.113.9"]);
  });

  it("refreshes on an upstream 401 and retries with the renewed token", async () => {
    await setSession({
      accessToken: "expired-at",
      refreshToken: "active-rt",
      userId: "u1",
      email: "studio@example.com",
      channelSlug: "studio_canal",
      channelName: "",
    });
    server.use(
      http.get(`${env.API_URL}/videos`, ({ request: upstreamRequest }) =>
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
      "GET /videos Bearer expired-at 203.0.113.9",
      "POST /auth/refresh - -",
      "GET /videos Bearer renewed-at 203.0.113.9",
    ]);
  });
});
