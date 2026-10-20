import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

// Cookie store mock for iron-session (same pattern as session.test.ts).
const cookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieMap.set(name, value); },
    delete: (name: string) => { cookieMap.delete(name); },
  }),
}));

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/auth/login/route"));
});

beforeEach(() => {
  cookieMap.clear();
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("writes nothing to the server console on success or on an upstream error (tokens never logged)", async () => {
    const spies = (["log", "info", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {})
    );

    const ok = await POST(makeRequest({ email: "alice@example.com", password: "pw" }));
    expect(ok.status).toBe(200);

    server.use(
      http.post(`${env.API_URL}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, error: "INVALID_CREDENTIALS", message: "Invalid email or password" },
          { status: 401 }
        )
      )
    );
    const failed = await POST(makeRequest({ email: "bad@example.com", password: "wrong" }));
    expect(failed.status).toBe(401);

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  });

  it("returns 400 VALIDATION_ERROR without calling the upstream when the body is not valid JSON", async () => {
    const upstreamCalls: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      upstreamCalls.push(request.url);
    };
    server.events.on("request:start", onRequest);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      })
    );

    server.events.removeListener("request:start", onRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ statusCode: 400, error: "VALIDATION_ERROR" });
    expect(upstreamCalls).toHaveLength(0);
    expect(cookieMap.has("streamtube_session")).toBe(false);
  });

  it("returns 200 with empty body (no tokens) and sets iron-session cookie on success", async () => {
    const res = await POST(makeRequest({ email: "alice@example.com", password: "pw" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("access_token");
    expect(body).not.toHaveProperty("refresh_token");
    // iron-session cookie must be set
    expect(cookieMap.has("streamtube_session")).toBe(true);
  });

  it("stores the user's channel nickname as channelSlug (owner check on public pages — phase 06)", async () => {
    const authorizations: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname === "/channels/me") {
        authorizations.push(request.headers.get("authorization"));
      }
    });

    const res = await POST(makeRequest({ email: "alice@example.com", password: "pw" }));

    expect(res.status).toBe(200);
    const { getSession } = await import("@/lib/auth/session");
    expect((await getSession()).channelSlug).toBe("studio_canal");
    expect(authorizations).toEqual(["Bearer fixture-access-token"]);
    server.events.removeAllListeners();
  });

  it("still logs in with an empty channelSlug when the channel read fails", async () => {
    server.use(
      http.get(`${env.API_URL}/channels/me`, () =>
        HttpResponse.json(
          { statusCode: 500, error: "INTERNAL", message: "boom" },
          { status: 500 }
        )
      )
    );

    const res = await POST(makeRequest({ email: "alice@example.com", password: "pw" }));

    expect(res.status).toBe(200);
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    expect(session.isLoggedIn).toBe(true);
    expect(session.channelSlug).toBe("");
  });

  it("returns 401 without setting cookie for invalid credentials (reserved trigger uses badrequest@ — upstream override for 401)", async () => {
    server.use(
      http.post(`${env.API_URL}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, error: "INVALID_CREDENTIALS", message: "Invalid email or password" },
          { status: 401 }
        )
      )
    );
    const res = await POST(makeRequest({ email: "bad@example.com", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(cookieMap.has("streamtube_session")).toBe(false);
    const body = await res.json();
    expect(body).toMatchObject({ statusCode: 401, error: "INVALID_CREDENTIALS" });
  });

  it("returns 403 without setting cookie for unconfirmed email", async () => {
    server.use(
      http.post(`${env.API_URL}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 403, error: "EMAIL_NOT_CONFIRMED", message: "Email not confirmed" },
          { status: 403 }
        )
      )
    );
    const res = await POST(makeRequest({ email: "unconfirmed@example.com", password: "pw" }));
    expect(res.status).toBe(403);
    expect(cookieMap.has("streamtube_session")).toBe(false);
    const body = await res.json();
    expect(body).toMatchObject({ statusCode: 403 });
  });

  it("returns 400 without setting cookie for validation failure (reserved trigger)", async () => {
    const res = await POST(makeRequest({ email: "badrequest@example.com", password: "" }));
    expect(res.status).toBe(400);
    expect(cookieMap.has("streamtube_session")).toBe(false);
  });
});
