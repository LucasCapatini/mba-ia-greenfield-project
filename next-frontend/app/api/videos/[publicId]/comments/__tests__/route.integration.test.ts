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

const { GET, POST } = await import("@/app/api/videos/[publicId]/comments/route");
const { setSession } = await import("@/lib/auth/session");

type Page = {
  items: { id: string; like_count: number; viewer_is_author: boolean }[];
  next_cursor: string | null;
};

function context(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function getRequest(publicId: string, query = ""): Request {
  return new Request(`http://localhost:3001/api/videos/${publicId}/comments${query}`);
}

function postRequest(publicId: string, body: string): Request {
  return new Request(`http://localhost:3001/api/videos/${publicId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

/** URL completa (com query) e `Authorization` de cada chamada ao upstream. */
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

async function login() {
  await setSession({
    accessToken: "active-at",
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

describe("GET /api/videos/[publicId]/comments", () => {
  it("serves the next top page anonymously, forwarding sort/cursor/limit", async () => {
    const first = (await (
      await GET(getRequest("tech-01", "?sort=top&limit=20"), context("tech-01"))
    ).json()) as Page;
    const calls = recordUpstreamCalls();

    const res = await GET(
      getRequest("tech-01", `?sort=top&limit=20&cursor=${first.next_cursor}`),
      context("tech-01")
    );

    expect(res.status).toBe(200);
    const page = (await res.json()) as Page;
    expect(page.items).toHaveLength(3);
    expect(page.next_cursor).toBeNull();
    const firstIds = new Set(first.items.map((item) => item.id));
    expect(page.items.some((item) => firstIds.has(item.id))).toBe(false);
    expect(calls).toEqual([
      `GET /videos/tech-01/comments?cursor=${first.next_cursor}&limit=20&sort=top -`,
    ]);
  });

  it("sends the session Bearer so viewer_is_author is filled", async () => {
    await login();
    const calls = recordUpstreamCalls();

    const res = await GET(getRequest("tech-01"), context("tech-01"));

    const page = (await res.json()) as Page;
    expect(page.items.filter((item) => item.viewer_is_author)).toHaveLength(1);
    expect(calls).toEqual(["GET /videos/tech-01/comments Bearer active-at"]);
  });

  it("passes 404 VIDEO_NOT_FOUND through for a draft", async () => {
    const res = await GET(getRequest("ready-draft-01"), context("ready-draft-01"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });
});

describe("POST /api/videos/[publicId]/comments", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await POST(postRequest("tech-01", '{"text":"oi"}'), context("tech-01"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(calls).toEqual([]);
  });

  it("answers 400 to an invalid JSON body", async () => {
    await login();

    const res = await POST(postRequest("tech-01", "{"), context("tech-01"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("creates the comment and passes the 201 through", async () => {
    await login();

    const res = await POST(
      postRequest("tech-01", '{"text":"  Ótimo conteúdo  "}'),
      context("tech-01")
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      text: "Ótimo conteúdo",
      parent_id: null,
      viewer_is_author: true,
      author: { nickname: "studio_canal" },
    });
  });
});
