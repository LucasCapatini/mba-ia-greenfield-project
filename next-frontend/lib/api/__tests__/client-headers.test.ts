import { beforeEach, describe, expect, it, vi } from "vitest";

let incoming = new Headers();

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(incoming)),
}));

const { clientHeaders } = await import("@/lib/api/client-headers");

beforeEach(() => {
  incoming = new Headers();
});

describe("clientHeaders", () => {
  it("forwards only the first IP of an x-forwarded-for list and the user-agent", async () => {
    incoming = new Headers({
      "x-forwarded-for": " 203.0.113.7 , 10.0.0.1, 172.30.0.1",
      "user-agent": "Mozilla/5.0 (test)",
    });

    await expect(clientHeaders()).resolves.toEqual({
      "X-Forwarded-For": "203.0.113.7",
      "User-Agent": "Mozilla/5.0 (test)",
    });
  });

  it("omits the keys whose incoming headers are missing", async () => {
    await expect(clientHeaders()).resolves.toEqual({});
  });

  it("omits an empty x-forwarded-for but keeps the user-agent", async () => {
    incoming = new Headers({ "x-forwarded-for": " ", "user-agent": "curl/8" });

    await expect(clientHeaders()).resolves.toEqual({ "User-Agent": "curl/8" });
  });
});
