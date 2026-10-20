import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

// Same cookie-store mock as the route handler tests, plus the incoming request headers.
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

const { withOptionalSession } = await import("@/lib/api/bff");
const { upstream } = await import("@/lib/api/upstream");
const { getSession, setSession } = await import("@/lib/auth/session");
const { env } = await import("@/lib/env");

const VIDEO_URL = `${env.API_URL}/videos/:publicId`;

type Seen = {
  authorization: string | null;
  forwardedFor: string | null;
  userAgent: string | null;
};

/** Records the headers of every upstream read; answers 401 to `rejectedToken`, 200 otherwise. */
function recordReads(rejectedToken?: string): Seen[] {
  const seen: Seen[] = [];
  server.use(
    http.get(VIDEO_URL, ({ request }) => {
      const authorization = request.headers.get("authorization");
      seen.push({
        authorization,
        forwardedFor: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      if (rejectedToken && authorization === `Bearer ${rejectedToken}`) {
        return HttpResponse.json(
          { statusCode: 401, error: "UNAUTHORIZED", message: "Unauthorized" },
          { status: 401 }
        );
      }
      return HttpResponse.json({
        public_id: "published-01",
        viewer: authorization ?? "anonymous",
      });
    })
  );
  return seen;
}

function readVideo() {
  return withOptionalSession((headers) =>
    upstream.GET("/videos/{publicId}", {
      params: { path: { publicId: "published-01" } },
      headers,
    })
  );
}

async function login(accessToken: string) {
  await setSession({
    accessToken,
    refreshToken: "refresh-token",
    userId: "u1",
    email: "viewer@example.com",
    channelSlug: "viewer",
    channelName: "",
  });
}

beforeEach(() => {
  cookieMap.clear();
  incoming = new Headers({
    "x-forwarded-for": "203.0.113.7, 172.30.0.1",
    "user-agent": "e2e-agent",
  });
});

describe("withOptionalSession", () => {
  it("calls the upstream without Authorization when there is no session, forwarding the visitor headers", async () => {
    const seen = recordReads();

    const res = await readVideo();

    expect(res.status).toBe(200);
    expect(seen).toEqual([
      { authorization: null, forwardedFor: "203.0.113.7", userAgent: "e2e-agent" },
    ]);
  });

  it("sends the session Bearer when there is a session", async () => {
    await login("active-at");
    const seen = recordReads();

    const res = await readVideo();

    expect(res.status).toBe(200);
    expect(seen.map((s) => s.authorization)).toEqual(["Bearer active-at"]);
    expect(seen[0].forwardedFor).toBe("203.0.113.7");
  });

  it("refreshes on 401 and retries with the new token", async () => {
    await login("expired-at");
    const seen = recordReads("expired-at");
    server.use(
      http.post(`${env.API_URL}/auth/refresh`, () =>
        HttpResponse.json({ access_token: "renewed-at", refresh_token: "renewed-rt" })
      )
    );

    const res = await readVideo();

    expect(res.status).toBe(200);
    expect(seen.map((s) => s.authorization)).toEqual([
      "Bearer expired-at",
      "Bearer renewed-at",
    ]);
    expect((await getSession()).accessToken).toBe("renewed-at");
  });

  it("destroys the session and retries anonymously when the refresh fails", async () => {
    await login("expired-at");
    const seen = recordReads("expired-at");
    server.use(
      http.post(`${env.API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          { statusCode: 401, error: "INVALID_TOKEN", message: "Invalid refresh token" },
          { status: 401 }
        )
      )
    );

    const res = await readVideo();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ viewer: "anonymous" });
    expect(seen.map((s) => s.authorization)).toEqual(["Bearer expired-at", null]);
    expect(seen[1].forwardedFor).toBe("203.0.113.7");
    expect((await getSession()).isLoggedIn).toBeFalsy();
  });
});
