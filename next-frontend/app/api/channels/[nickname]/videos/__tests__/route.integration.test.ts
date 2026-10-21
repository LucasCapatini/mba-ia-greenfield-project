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
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

const { GET } = await import("@/app/api/channels/[nickname]/videos/route");

type Page = { items: { public_id: string; view_count: number }[]; next_cursor: string | null };

function context(nickname: string) {
  return { params: Promise.resolve({ nickname }) };
}

function getRequest(nickname: string, query = ""): Request {
  return new Request(`http://localhost:3001/api/channels/${nickname}/videos${query}`);
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

describe("GET /api/channels/[nickname]/videos", () => {
  it("forwards sort, cursor and limit and passes the next page through", async () => {
    const calls = recordUpstreamCalls();

    const res = await GET(
      getRequest("tech_mastery", "?sort=popular&cursor=offset-20&limit=20"),
      context("tech_mastery")
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(body.items).toHaveLength(4);
    expect(body.next_cursor).toBeNull();
    const views = body.items.map((item) => item.view_count);
    expect(views).toEqual([...views].sort((a, b) => b - a));
    expect(calls).toEqual([
      "GET /channels/tech_mastery/videos?cursor=offset-20&limit=20&sort=popular",
    ]);
  });

  it("passes 404 CHANNEL_NOT_FOUND through", async () => {
    const res = await GET(getRequest("nobody_here"), context("nobody_here"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "CHANNEL_NOT_FOUND" });
  });
});
