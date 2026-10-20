import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { GET } = await import("@/app/api/me/subscriptions/route");
const { setSession } = await import("@/lib/auth/session");

function getRequest(query = ""): Request {
  return new Request(`http://localhost:3001/api/me/subscriptions${query}`);
}

function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    calls.push(`${request.method} ${url.pathname}${url.search}`);
  });
  return calls;
}

beforeEach(() => {
  server.events.removeAllListeners();
  cookieMap.clear();
});

describe("GET /api/me/subscriptions", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(calls).toEqual([]);
  });

  it("returns the followed channels page, forwarding cursor and limit", async () => {
    await setSession({
      accessToken: "active-at",
      refreshToken: "active-rt",
      userId: "u1",
      email: "studio@example.com",
      channelSlug: "studio_canal",
      channelName: "",
    });
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest("?cursor=offset-0&limit=7"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [{ nickname: "tech_mastery", name: "Tech Mastery" }],
      next_cursor: null,
    });
    expect(calls).toEqual(["GET /me/subscriptions?cursor=offset-0&limit=7"]);
  });
});
