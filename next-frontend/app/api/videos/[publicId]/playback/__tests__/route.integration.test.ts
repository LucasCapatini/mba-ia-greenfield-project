import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

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

const { GET } = await import("@/app/api/videos/[publicId]/playback/route");
const { setSession } = await import("@/lib/auth/session");

function playback(publicId: string): Promise<Response> {
  return GET(
    new Request(`http://localhost:3001/api/videos/${publicId}/playback`),
    { params: Promise.resolve({ publicId }) }
  );
}

async function loginAsOwner() {
  await setSession({
    accessToken: "owner-at",
    refreshToken: "owner-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
    channelName: "",
  });
}

/** Authorization headers of the upstream playback calls, observed without overriding the handlers. */
function observeAuthorization(): (string | null)[] {
  const seen: (string | null)[] = [];
  server.events.on("request:start", ({ request }) => {
    if (new URL(request.url).pathname.endsWith("/playback")) {
      seen.push(request.headers.get("authorization"));
    }
  });
  return seen;
}

beforeEach(() => {
  cookieMap.clear();
  incoming = new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "player-agent" });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe("GET /api/videos/[publicId]/playback", () => {
  it("returns the signed URLs to an anonymous visitor of a published video", async () => {
    const seen = observeAuthorization();

    const res = await playback("published-01");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      stream_url: expect.stringContaining("/videos/published-01/source"),
      download_url: expect.stringContaining("/videos/published-01/source"),
      expires_at: expect.any(String),
    });
    expect(seen).toEqual([null]);
  });

  it("passes 404 VIDEO_NOT_FOUND through for an unknown video", async () => {
    const res = await playback("notfound-id");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("passes 404 VIDEO_NOT_FOUND through for someone else's draft read anonymously", async () => {
    const res = await playback("processing-01");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("forwards the session Bearer and passes 409 VIDEO_NOT_READY through for the owner", async () => {
    await loginAsOwner();
    const seen = observeAuthorization();

    const res = await playback("processing-01");

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_READY" });
    expect(seen).toEqual(["Bearer owner-at"]);
  });

  it("passes 503 STORAGE_UNAVAILABLE through", async () => {
    const res = await playback("storage-down-id");

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "STORAGE_UNAVAILABLE" });
  });
});
