import { beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";
import { studioStore } from "@/mocks/store";

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
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const { GET, POST } = await import("@/app/api/comments/[commentId]/replies/route");
const { setSession } = await import("@/lib/auth/session");

const UNKNOWN_ID = "00000000-0000-4000-8000-ffffffffffff";

type Page = { items: { id: string; parent_id: string | null }[]; next_cursor: string | null };

function context(commentId: string) {
  return { params: Promise.resolve({ commentId }) };
}

function getRequest(commentId: string, query = ""): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}/replies${query}`);
}

function postRequest(commentId: string, body: string): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

/** Raiz de `tech-01` que já tem respostas no seed (a de `bia`). */
function rootWithReplies(): string {
  const root = [...studioStore().social.comments.values()].find(
    (comment) => comment.video_id === "tech-01" && comment.reply_count > 0
  );
  if (!root) {
    throw new Error("seed without a tech-01 thread");
  }
  return root.id;
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

describe("GET /api/comments/[commentId]/replies", () => {
  it("lists the replies anonymously, paging with the forwarded cursor", async () => {
    const id = rootWithReplies();

    const first = (await (await GET(getRequest(id, "?limit=1"), context(id))).json()) as Page;
    expect(first.items).toHaveLength(1);
    expect(first.next_cursor).not.toBeNull();

    const res = await GET(getRequest(id, `?limit=1&cursor=${first.next_cursor}`), context(id));
    expect(res.status).toBe(200);
    const second = (await res.json()) as Page;
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.items[0].parent_id).toBe(id);
    expect(second.next_cursor).toBeNull();
  });

  it("passes 404 COMMENT_NOT_FOUND through", async () => {
    const res = await GET(getRequest(UNKNOWN_ID), context(UNKNOWN_ID));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "COMMENT_NOT_FOUND" });
  });
});

describe("POST /api/comments/[commentId]/replies", () => {
  it("returns 401 without a session", async () => {
    const id = rootWithReplies();

    const res = await POST(postRequest(id, '{"text":"oi"}'), context(id));

    expect(res.status).toBe(401);
  });

  it("replies with a session and passes the 201 through", async () => {
    await login();
    const id = rootWithReplies();

    const res = await POST(postRequest(id, '{"text":"Concordo"}'), context(id));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ text: "Concordo", parent_id: id });
  });

  it("passes 404 COMMENT_NOT_FOUND through", async () => {
    await login();

    const res = await POST(postRequest(UNKNOWN_ID, '{"text":"oi"}'), context(UNKNOWN_ID));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "COMMENT_NOT_FOUND" });
  });
});
