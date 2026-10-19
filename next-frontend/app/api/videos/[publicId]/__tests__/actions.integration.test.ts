import { describe, it, expect, beforeEach, vi } from "vitest";

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

const { POST: publish } = await import("@/app/api/videos/[publicId]/publish/route");
const { POST: unpublish } = await import("@/app/api/videos/[publicId]/unpublish/route");
const { DELETE: remove } = await import("@/app/api/videos/[publicId]/route");
const { setSession } = await import("@/lib/auth/session");

beforeEach(async () => {
  cookieMap.clear();
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
  });
});

function context(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function post(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/videos/[publicId]/publish", () => {
  it("passes the published video through with 200", async () => {
    const res = await publish(post("/api/videos/ready-draft-01/publish"), context("ready-draft-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ public_id: "ready-draft-01", status: "published" });
  });

  it("passes 409 VIDEO_NOT_PUBLISHABLE through", async () => {
    const res = await publish(post("/api/videos/failed-01/publish"), context("failed-01"));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_PUBLISHABLE" });
  });

  it("passes 403 VIDEO_FORBIDDEN through", async () => {
    const res = await publish(post("/api/videos/forbidden-id/publish"), context("forbidden-id"));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "VIDEO_FORBIDDEN" });
  });

  it("returns 401 without a session", async () => {
    cookieMap.clear();

    const res = await publish(post("/api/videos/ready-draft-01/publish"), context("ready-draft-01"));

    expect(res.status).toBe(401);
  });
});

describe("POST /api/videos/[publicId]/unpublish", () => {
  it("passes the draft video through with 200", async () => {
    const res = await unpublish(post("/api/videos/published-01/unpublish"), context("published-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ public_id: "published-01", status: "draft" });
  });
});

describe("DELETE /api/videos/[publicId]", () => {
  it("returns 204 with no body", async () => {
    const res = await remove(
      new Request("http://localhost:3001/api/videos/published-01", { method: "DELETE" }),
      context("published-01")
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("passes 404 VIDEO_NOT_FOUND through", async () => {
    const res = await remove(
      new Request("http://localhost:3001/api/videos/notfound-id", { method: "DELETE" }),
      context("notfound-id")
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });
});
