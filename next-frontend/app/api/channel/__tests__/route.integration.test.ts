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

const { PATCH } = await import("@/app/api/channel/route");
const { setSession, getSession } = await import("@/lib/auth/session");

function patchRequest(body: unknown): Request {
  return new Request("http://localhost:3001/api/channel", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
    channelName: "Studio Canal",
  });
});

describe("PATCH /api/channel", () => {
  it("passes the channel through and rewrites channelSlug in the session when the nickname changes", async () => {
    const before = cookieMap.get("streamtube_session");

    const res = await PATCH(patchRequest({ nickname: "novo" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ nickname: "novo", name: "Studio Canal" });
    const session = await getSession();
    expect(session.channelSlug).toBe("novo");
    expect(session.accessToken).toBe("active-at");
    expect(cookieMap.get("streamtube_session")).not.toBe(before);
  });

  it("rewrites channelName in the session when the channel name changes", async () => {
    const before = cookieMap.get("streamtube_session");

    const res = await PATCH(patchRequest({ name: "Outro nome" }));

    expect(res.status).toBe(200);
    const session = await getSession();
    expect(session.channelName).toBe("Outro nome");
    expect(session.channelSlug).toBe("studio_canal");
    expect(cookieMap.get("streamtube_session")).not.toBe(before);
  });

  it("keeps the session cookie untouched when neither the nickname nor the name changes", async () => {
    const before = cookieMap.get("streamtube_session");

    const res = await PATCH(patchRequest({ name: "Studio Canal" }));

    expect(res.status).toBe(200);
    expect(cookieMap.get("streamtube_session")).toBe(before);
  });

  it("passes 409 NICKNAME_TAKEN through and leaves the session alone", async () => {
    const res = await PATCH(patchRequest({ nickname: "taken_nick" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "NICKNAME_TAKEN" });
    expect((await getSession()).channelSlug).toBe("studio_canal");
  });

  it("returns 401 without a session", async () => {
    cookieMap.clear();

    const res = await PATCH(patchRequest({ nickname: "novo" }));

    expect(res.status).toBe(401);
  });

  it("never exposes session tokens in the body", async () => {
    const res = await PATCH(patchRequest({ nickname: "novo" }));

    const text = await res.text();
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("active-at");
  });
});
