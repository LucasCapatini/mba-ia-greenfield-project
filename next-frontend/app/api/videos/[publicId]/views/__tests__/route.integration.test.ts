import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";
import { studioStore } from "@/mocks/store";

const cookieMap = new Map<string, string>();
let incoming = new Headers();

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
  headers: vi.fn(() => Promise.resolve(incoming)),
}));

const { POST } = await import("@/app/api/videos/[publicId]/views/route");

function recordView(publicId: string): Promise<Response> {
  return POST(
    new Request(`http://localhost:3001/api/videos/${publicId}/views`, { method: "POST" }),
    { params: Promise.resolve({ publicId }) }
  );
}

function viewCount(publicId: string): number | undefined {
  return studioStore().videos.get(publicId)?.video.view_count;
}

beforeEach(() => {
  cookieMap.clear();
  incoming = new Headers({
    "x-forwarded-for": "203.0.113.7, 172.30.0.1",
    "user-agent": "Mozilla/5.0 (watch)",
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe("POST /api/videos/[publicId]/views", () => {
  it("returns 204 to an anonymous visitor and the upstream counts the view once", async () => {
    const before = viewCount("published-01")!;

    const first = await recordView("published-01");
    const second = await recordView("published-01");

    expect(first.status).toBe(204);
    expect(await first.text()).toBe("");
    expect(second.status).toBe(204);
    expect(viewCount("published-01")).toBe(before + 1);
  });

  it("forwards the visitor IP and User-Agent without Authorization", async () => {
    const seen: (string | null)[][] = [];
    server.events.on("request:start", ({ request }) => {
      seen.push([
        request.headers.get("authorization"),
        request.headers.get("x-forwarded-for"),
        request.headers.get("user-agent"),
      ]);
    });

    await recordView("published-01");

    expect(seen).toEqual([[null, "203.0.113.7", "Mozilla/5.0 (watch)"]]);
  });

  it("passes 404 VIDEO_NOT_FOUND through for an unknown video", async () => {
    const res = await recordView("notfound-id");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });
});
