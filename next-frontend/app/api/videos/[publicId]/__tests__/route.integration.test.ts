import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { env } from "@/lib/env";
import { server } from "@/mocks/server";

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

const { GET, PATCH } = await import("@/app/api/videos/[publicId]/route");
const { setSession, getSession } = await import("@/lib/auth/session");

function context(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function patchRequest(publicId: string, body: unknown): Request {
  return new Request(`http://localhost:3001/api/videos/${publicId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** URLs (método + path) que chegaram ao upstream durante o teste. */
function recordUpstreamCalls(): string[] {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return calls;
}

beforeEach(async () => {
  server.events.removeAllListeners();
  cookieMap.clear();
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
  });
});

describe("PATCH /api/videos/[publicId]", () => {
  it("chains publish when the saved video is a ready draft with a title", async () => {
    const calls = recordUpstreamCalls();

    const res = await PATCH(
      patchRequest("ready-draft-01", { title: "x" }),
      context("ready-draft-01")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(true);
    expect(body.video).toMatchObject({ title: "x", status: "published" });
    expect(calls).toEqual([
      "PATCH /videos/ready-draft-01",
      "POST /videos/ready-draft-01/publish",
    ]);
  });

  it("only saves when the video is still processing", async () => {
    const calls = recordUpstreamCalls();

    const res = await PATCH(
      patchRequest("processing-01", { title: "Novo título" }),
      context("processing-01")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      published: false,
      video: { title: "Novo título", status: "draft", processing_status: "processing" },
    });
    expect(calls).toEqual(["PATCH /videos/processing-01"]);
  });

  it("does not chain publish when the body says publish: false (and strips the field upstream)", async () => {
    const calls = recordUpstreamCalls();
    let forwarded: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PATCH") {
        forwarded = await request.clone().json();
      }
    });

    const res = await PATCH(
      patchRequest("ready-draft-01", { title: "x", publish: false }),
      context("ready-draft-01")
    );

    const body = await res.json();
    expect(body).toMatchObject({ published: false, video: { status: "draft" } });
    expect(calls).toEqual(["PATCH /videos/ready-draft-01"]);
    expect(forwarded).toEqual({ title: "x" });
  });

  it("turns VIDEO_NOT_PUBLISHABLE from the chained publish into published: false", async () => {
    server.use(
      http.post(`${env.API_URL}/videos/:publicId/publish`, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            error: "VIDEO_NOT_PUBLISHABLE",
            message: "Video cannot be published: title is empty",
          },
          { status: 409 }
        )
      )
    );

    const res = await PATCH(
      patchRequest("ready-draft-01", { description: "d" }),
      context("ready-draft-01")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      published: false,
      video: { status: "draft", description: "d" },
    });
  });

  it("passes upstream errors of the save through with the same status", async () => {
    const res = await PATCH(
      patchRequest("forbidden-id", { title: "x" }),
      context("forbidden-id")
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "VIDEO_FORBIDDEN" });
  });

  it("refreshes the session once on upstream 401 and retries with the new token", async () => {
    const tokens: string[] = [];
    server.use(
      http.patch(
        `${env.API_URL}/videos/:publicId`,
        ({ request }) => {
          tokens.push(request.headers.get("authorization") ?? "");
          return HttpResponse.json(
            { statusCode: 401, error: "UNAUTHORIZED", message: "Unauthorized" },
            { status: 401 }
          );
        },
        { once: true }
      )
    );
    server.events.on("request:start", ({ request }) => {
      if (request.method === "PATCH") {
        tokens.push(request.headers.get("authorization") ?? "");
      }
    });

    const res = await PATCH(
      patchRequest("processing-01", { title: "y" }),
      context("processing-01")
    );

    expect(res.status).toBe(200);
    expect(tokens.filter((token, i) => tokens.indexOf(token) === i)).toEqual([
      "Bearer active-at",
      "Bearer new-fixture-access-token",
    ]);
    const session = await getSession();
    expect(session.accessToken).toBe("new-fixture-access-token");
  });

  it("returns 401 without a session and never reaches the upstream", async () => {
    cookieMap.clear();
    const calls = recordUpstreamCalls();

    const res = await PATCH(
      patchRequest("ready-draft-01", { title: "x" }),
      context("ready-draft-01")
    );

    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("rejects a body that is not JSON with 400", async () => {
    const res = await PATCH(
      new Request("http://localhost:3001/api/videos/ready-draft-01", {
        method: "PATCH",
        body: "not json",
      }),
      context("ready-draft-01")
    );

    expect(res.status).toBe(400);
  });

  it("never exposes session tokens in the body", async () => {
    const res = await PATCH(
      patchRequest("ready-draft-01", { title: "x" }),
      context("ready-draft-01")
    );

    const text = await res.text();
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("refresh_token");
    expect(text).not.toContain("active-at");
  });
});

describe("GET /api/videos/[publicId]", () => {
  it("returns the upstream video as-is", async () => {
    const res = await GET(new Request("http://localhost:3001/api/videos/failed-01"), context("failed-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      public_id: "failed-01",
      processing_status: "failed",
      processing_error: "UNSUPPORTED_FORMAT",
    });
  });

  it("passes 404 VIDEO_NOT_FOUND through", async () => {
    const res = await GET(new Request("http://localhost:3001/api/videos/notfound-id"), context("notfound-id"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });
});
