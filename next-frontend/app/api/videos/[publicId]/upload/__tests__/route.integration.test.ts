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

const { POST: createVideo } = await import("@/app/api/videos/route");
const {
  GET: getUpload,
  DELETE: abortUpload,
  POST: postUpload,
} = await import("@/app/api/videos/[publicId]/upload/[[...action]]/route");
const { setSession } = await import("@/lib/auth/session");

const NEW_ID = "new-upload-id";

// Optional catch-all: `action` is absent for /upload, ["parts"] / ["complete"] for the children.
function context(publicId: string, action?: string[]) {
  return { params: Promise.resolve({ publicId, action }) };
}

const presignParts = (request: Request, publicId: string) =>
  postUpload(request, context(publicId, ["parts"]));
const completeUpload = (request: Request, publicId: string) =>
  postUpload(request, context(publicId, ["complete"]));

function jsonRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3001${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  cookieMap.clear();
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
  });
  // Abre a sessão multipart de `new-upload-id` no store dos fixtures.
  const created = await createVideo(
    jsonRequest("POST", "/api/videos", {
      original_filename: "aula.mp4",
      content_type: "video/mp4",
      size_bytes: 6_000_000,
    })
  );
  expect(created.status).toBe(201);
});

describe("upload routes", () => {
  it("POST parts passes the presigned URLs (public storage origin) through", async () => {
    const res = await presignParts(
      jsonRequest("POST", `/api/videos/${NEW_ID}/upload/parts`, { part_numbers: [1, 2] }),
      NEW_ID
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parts).toHaveLength(2);
    expect(body.parts[0].url).toMatch(/^http:\/\/localhost:9000\//);
  });

  it("GET upload passes the session state through", async () => {
    const res = await getUpload(
      new Request(`http://localhost:3001/api/videos/${NEW_ID}/upload`),
      context(NEW_ID)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: "active", part_count: 2 });
  });

  it("POST complete passes 202 through", async () => {
    const res = await completeUpload(
      jsonRequest("POST", `/api/videos/${NEW_ID}/upload/complete`, {
        parts: [
          { part_number: 1, etag: '"etag-1"' },
          { part_number: 2, etag: '"etag-2"' },
        ],
      }),
      NEW_ID
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      public_id: NEW_ID,
      processing_status: "processing",
    });
  });

  it("DELETE upload passes 204 through", async () => {
    const res = await abortUpload(
      new Request(`http://localhost:3001/api/videos/${NEW_ID}/upload`, { method: "DELETE" }),
      context(NEW_ID)
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("passes 409 UPLOAD_NOT_ACTIVE through when the session is already completed", async () => {
    const res = await completeUpload(
      jsonRequest("POST", "/api/videos/ready-draft-01/upload/complete", { parts: [] }),
      "ready-draft-01"
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "UPLOAD_NOT_ACTIVE" });
  });

  it("returns 401 without a session", async () => {
    cookieMap.clear();

    const res = await abortUpload(
      new Request(`http://localhost:3001/api/videos/${NEW_ID}/upload`, { method: "DELETE" }),
      context(NEW_ID)
    );

    expect(res.status).toBe(401);
  });
});

describe("upload catch-all dispatch", () => {
  it("answers 405 for a method the action does not support", async () => {
    const getParts = await getUpload(
      new Request(`http://localhost:3001/api/videos/${NEW_ID}/upload/parts`),
      context(NEW_ID, ["parts"])
    );
    const postBase = await postUpload(
      jsonRequest("POST", `/api/videos/${NEW_ID}/upload`, {}),
      context(NEW_ID)
    );

    expect(getParts.status).toBe(405);
    expect(postBase.status).toBe(405);
  });

  it("answers 404 for an unknown action", async () => {
    const res = await postUpload(
      jsonRequest("POST", `/api/videos/${NEW_ID}/upload/other`, {}),
      context(NEW_ID, ["other"])
    );

    expect(res.status).toBe(404);
  });
});
