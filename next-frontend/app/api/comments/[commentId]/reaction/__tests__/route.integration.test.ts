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

const { PUT, DELETE } = await import("@/app/api/comments/[commentId]/reaction/route");
const { setSession } = await import("@/lib/auth/session");

const UNKNOWN_ID = "00000000-0000-4000-8000-ffffffffffff";

function context(commentId: string) {
  return { params: Promise.resolve({ commentId }) };
}

function putRequest(commentId: string, body: string): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}/reaction`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function deleteRequest(commentId: string): Request {
  return new Request(`http://localhost:3001/api/comments/${commentId}/reaction`, {
    method: "DELETE",
  });
}

function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return calls;
}

/** Uma raiz de `tech-01` do seed do MSW, lida do store (sem depender do id gerado). */
function firstRootOfTech(): { id: string; like_count: number } {
  const root = [...studioStore().social.comments.values()].find(
    (comment) => comment.video_id === "tech-01" && comment.parent_id === null
  );
  if (!root) {
    throw new Error("seed without tech-01 comments");
  }
  return root;
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

describe("PUT /api/comments/[commentId]/reaction", () => {
  it("returns 401 without a session and never calls the upstream", async () => {
    const calls = recordUpstreamCalls();

    const res = await PUT(putRequest(UNKNOWN_ID, '{"value":"like"}'), context(UNKNOWN_ID));

    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("likes a comment and passes the resulting state through", async () => {
    const root = firstRootOfTech();
    await login();

    const res = await PUT(putRequest(root.id, '{"value":"like"}'), context(root.id));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      viewer_reaction: "like",
      like_count: root.like_count + 1,
      dislike_count: 0,
    });
  });

  it("answers 400 to an invalid JSON body", async () => {
    await login();

    const res = await PUT(putRequest(UNKNOWN_ID, "nope"), context(UNKNOWN_ID));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });
});

describe("DELETE /api/comments/[commentId]/reaction", () => {
  it("passes 404 COMMENT_NOT_FOUND through for an unknown comment", async () => {
    await login();

    const res = await DELETE(deleteRequest(UNKNOWN_ID), context(UNKNOWN_ID));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "COMMENT_NOT_FOUND" });
  });

  it("removes the reaction and restores the counter", async () => {
    const root = firstRootOfTech();
    await login();
    await PUT(putRequest(root.id, '{"value":"like"}'), context(root.id));

    const res = await DELETE(deleteRequest(root.id), context(root.id));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      viewer_reaction: null,
      like_count: root.like_count,
      dislike_count: 0,
    });
  });
});
