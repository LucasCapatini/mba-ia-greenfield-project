import { beforeEach, describe, expect, it, vi } from "vitest";

let incoming = new Headers();

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(incoming)),
}));

const { requestOrigin } = await import("../request-origin");

beforeEach(() => {
  incoming = new Headers();
});

describe("requestOrigin", () => {
  it("prefers the forwarded host and protocol set by a proxy in front of the app", async () => {
    incoming = new Headers({
      "x-forwarded-host": "streamtube.example",
      "x-forwarded-proto": "https",
      host: "next-frontend:3000",
    });

    await expect(requestOrigin()).resolves.toBe("https://streamtube.example");
  });

  it("falls back to the Host header over http without a proxy", async () => {
    incoming = new Headers({ host: "localhost:3001" });

    await expect(requestOrigin()).resolves.toBe("http://localhost:3001");
  });

  it("defaults to http://localhost:3001 when no host header is present", async () => {
    await expect(requestOrigin()).resolves.toBe("http://localhost:3001");
  });
});
