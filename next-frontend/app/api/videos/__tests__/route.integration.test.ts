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

const { POST } = await import("@/app/api/videos/route");
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

function post(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/videos", () => {
  it("passes the 201 draft + upload session through", async () => {
    const res = await POST(
      post("/api/videos", {
        original_filename: "aula.mp4",
        content_type: "video/mp4",
        size_bytes: 12_000_000,
      })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      public_id: "new-upload-id",
      status: "draft",
      processing_status: "uploading",
      upload: { part_size: 5_242_880, part_count: 3 },
    });
  });

  it("returns 401 without a session", async () => {
    cookieMap.clear();

    const res = await POST(
      post("/api/videos", { original_filename: "a.mp4", content_type: "video/mp4", size_bytes: 1 })
    );

    expect(res.status).toBe(401);
  });

  it("rejects a body that is not JSON with 400", async () => {
    const res = await POST(
      new Request("http://localhost:3001/api/videos", { method: "POST", body: "{" })
    );

    expect(res.status).toBe(400);
  });
});
