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
}));

const { PATCH, DELETE } = await import("@/app/api/comments/[commentId]/route");
const { setSession } = await import("@/lib/auth/session");

function context(commentId: string) {
  return { params: Promise.resolve({ commentId }) };
}

function patchRequest(commentId: string, body: string): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function deleteRequest(commentId: string): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}`, {
    method: "DELETE",
  });
}

/** Raiz de `tech-01` do seed: do próprio usuário (`self`) ou de outro autor. */
function seedRoot(author: "self" | "other"): string {
  const root = [...studioStore().social.comments.values()].find(
    (comment) =>
      comment.video_id === "tech-01" &&
      comment.parent_id === null &&
      (author === "self" ? comment.author === "self" : comment.author !== "self")
  );
  if (!root) {
    throw new Error("seed without the expected tech-01 root");
  }
  return root.id;
}

function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}`);
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

describe("PATCH /api/comments/[commentId]", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const id = seedRoot("self");
    const calls = recordUpstreamCalls();

    const res = await PATCH(patchRequest(id, '{"text":"x"}'), context(id));

    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("edits the author's own comment and returns edited_at", async () => {
    await login();
    const id = seedRoot("self");

    const res = await PATCH(patchRequest(id, '{"text":"Texto revisto"}'), context(id));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string; edited_at: string | null };
    expect(body.text).toBe("Texto revisto");
    expect(body.edited_at).not.toBeNull();
  });

  it("passes 403 COMMENT_FORBIDDEN through for someone else's comment", async () => {
    await login();
    const id = seedRoot("other");

    const res = await PATCH(patchRequest(id, '{"text":"invasão"}'), context(id));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "COMMENT_FORBIDDEN" });
  });

  it("answers 400 to an invalid JSON body", async () => {
    await login();
    const id = seedRoot("self");

    const res = await PATCH(patchRequest(id, "x"), context(id));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/comments/[commentId]", () => {
  it("deletes the author's comment with 204", async () => {
    await login();
    const id = seedRoot("self");

    const res = await DELETE(deleteRequest(id), context(id));

    expect(res.status).toBe(204);
    expect(studioStore().social.comments.has(id)).toBe(false);
  });

  it("passes 403 COMMENT_FORBIDDEN through for someone else's comment", async () => {
    await login();
    const id = seedRoot("other");

    const res = await DELETE(deleteRequest(id), context(id));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "COMMENT_FORBIDDEN" });
  });

  it("returns 401 without a session", async () => {
    const id = seedRoot("self");

    const res = await DELETE(deleteRequest(id), context(id));

    expect(res.status).toBe(401);
  });
});
