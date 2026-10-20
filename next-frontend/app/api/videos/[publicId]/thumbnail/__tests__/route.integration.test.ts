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

const { PUT, DELETE } = await import("@/app/api/videos/[publicId]/thumbnail/route");
const { setSession } = await import("@/lib/auth/session");

function context(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function thumbnailRequest(form: FormData): Request {
  return new Request("http://localhost:3001/api/videos/ready-draft-01/thumbnail", {
    method: "PUT",
    body: form,
  });
}

function pngForm(field = "file"): FormData {
  const form = new FormData();
  form.append(field, new File([new Uint8Array([137, 80, 78, 71])], "capa.png", { type: "image/png" }));
  return form;
}

beforeEach(async () => {
  cookieMap.clear();
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "studio@example.com",
    channelSlug: "studio_canal",
    channelName: "",
  });
});

describe("PUT /api/videos/[publicId]/thumbnail", () => {
  it("forwards a multipart body with the file field and passes the video through", async () => {
    let forwarded: { contentType: string | null; name: string | null; type: string | null } | null =
      null;
    server.use(
      http.put(`${env.API_URL}/videos/:publicId/thumbnail`, async ({ request }) => {
        const contentType = request.headers.get("content-type");
        const file = (await request.formData()).get("file");
        forwarded = {
          contentType,
          name: file instanceof File ? file.name : null,
          type: file instanceof File ? file.type : null,
        };
        return HttpResponse.json({ public_id: "ready-draft-01", has_custom_thumbnail: true });
      })
    );

    const res = await PUT(thumbnailRequest(pngForm()), context("ready-draft-01"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ has_custom_thumbnail: true });
    expect(forwarded).toMatchObject({ name: "capa.png", type: "image/png" });
    expect(forwarded!.contentType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it("uses the default handler to bump the thumbnail version", async () => {
    const res = await PUT(thumbnailRequest(pngForm()), context("ready-draft-01"));

    expect(res.status).toBe(200);
    expect((await res.json()).thumbnail_url).toMatch(/custom\.jpg\?v=2$/);
  });

  it("passes 413 THUMBNAIL_TOO_LARGE through with the envelope", async () => {
    server.use(
      http.put(`${env.API_URL}/videos/:publicId/thumbnail`, () =>
        HttpResponse.json(
          { statusCode: 413, error: "THUMBNAIL_TOO_LARGE", message: "Thumbnail exceeds 5 MiB" },
          { status: 413 }
        )
      )
    );

    const res = await PUT(thumbnailRequest(pngForm()), context("ready-draft-01"));

    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "THUMBNAIL_TOO_LARGE" });
  });

  it("rejects a form without the file field with 400", async () => {
    const res = await PUT(thumbnailRequest(pngForm("image")), context("ready-draft-01"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("returns 401 without a session", async () => {
    cookieMap.clear();

    const res = await PUT(thumbnailRequest(pngForm()), context("ready-draft-01"));

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/videos/[publicId]/thumbnail", () => {
  it("passes 204 through", async () => {
    const res = await DELETE(
      new Request("http://localhost:3001/api/videos/ready-draft-01/thumbnail", { method: "DELETE" }),
      context("ready-draft-01")
    );

    expect(res.status).toBe(204);
  });
});
