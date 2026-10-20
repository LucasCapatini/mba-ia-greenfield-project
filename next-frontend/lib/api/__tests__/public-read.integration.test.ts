import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { publicRead } = await import("@/lib/api/public-read");
const { upstream } = await import("@/lib/api/upstream");
const { setSession } = await import("@/lib/auth/session");
const { env } = await import("@/lib/env");

function readVideo() {
  return publicRead((headers) =>
    upstream.GET("/videos/{publicId}", {
      params: { path: { publicId: "published-01" } },
      headers,
    })
  );
}

beforeEach(() => {
  cookieMap.clear();
  incoming = new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "rsc-agent" });
});

describe("publicRead", () => {
  it("reads anonymously with the visitor headers when there is no session", async () => {
    const seen: (string | null)[][] = [];
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, ({ request }) => {
        seen.push([
          request.headers.get("authorization"),
          request.headers.get("x-forwarded-for"),
          request.headers.get("user-agent"),
        ]);
        return HttpResponse.json({ public_id: "published-01" });
      })
    );

    const { response } = await readVideo();

    expect(response.status).toBe(200);
    expect(seen).toEqual([[null, "203.0.113.7", "rsc-agent"]]);
  });

  it("retries anonymously when the session token is expired (401) and returns the public data", async () => {
    await setSession({
      accessToken: "expired-at",
      refreshToken: "rt",
      userId: "u1",
      email: "viewer@example.com",
      channelSlug: "viewer",
      channelName: "",
    });
    const authorizations: (string | null)[] = [];
    let refreshCalls = 0;
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, ({ request }) => {
        const authorization = request.headers.get("authorization");
        authorizations.push(authorization);
        return authorization
          ? HttpResponse.json(
              { statusCode: 401, error: "TOKEN_EXPIRED", message: "Token expired" },
              { status: 401 }
            )
          : HttpResponse.json({ public_id: "published-01", title: "Aula publicada" });
      }),
      http.post(`${env.API_URL}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json({ access_token: "x", refresh_token: "y" });
      })
    );

    const { data, response } = await readVideo();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ public_id: "published-01", title: "Aula publicada" });
    expect(authorizations).toEqual(["Bearer expired-at", null]);
    // A RSC cannot write the cookie: no refresh is attempted.
    expect(refreshCalls).toBe(0);
  });
});
