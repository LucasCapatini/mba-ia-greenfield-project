import { describe, expect, it, vi } from "vitest";

import type { PublicVideosPage } from "@/lib/api/contracts";

import { loadHomeListing, type ListingRead } from "../home-listing";

const generalPage: PublicVideosPage = { items: [], next_cursor: "offset-20" };
const musicPage: PublicVideosPage = { items: [], next_cursor: null };

function ok(data: PublicVideosPage): ListingRead {
  return { data, response: new Response(null, { status: 200 }) };
}

function fail(status: number, error: unknown): ListingRead {
  return { error, response: new Response(null, { status }) };
}

describe("loadHomeListing", () => {
  it("reads the general listing when there is no category", async () => {
    const read = vi.fn().mockResolvedValue(ok(generalPage));

    const listing = await loadHomeListing(undefined, read);

    expect(read).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(listing).toEqual({ page: generalPage, activeCategory: null, categoryNotFound: false });
  });

  it("passes a valid category through and keeps it active", async () => {
    const read = vi.fn().mockResolvedValue(ok(musicPage));

    const listing = await loadHomeListing("music", read);

    expect(read).toHaveBeenCalledExactlyOnceWith("music");
    expect(listing).toEqual({ page: musicPage, activeCategory: "music", categoryNotFound: false });
  });

  it("falls back to the general listing with a notice on CATEGORY_NOT_FOUND", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(fail(404, { statusCode: 404, error: "CATEGORY_NOT_FOUND", message: "x" }))
      .mockResolvedValueOnce(ok(generalPage));

    const listing = await loadHomeListing("unknown-category", read);

    expect(read.mock.calls).toEqual([["unknown-category"], [undefined]]);
    expect(listing).toEqual({ page: generalPage, activeCategory: null, categoryNotFound: true });
  });

  it("throws on an upstream 5xx so the error boundary offers Try again", async () => {
    const read = vi.fn().mockResolvedValue(fail(500, { statusCode: 500, error: "INTERNAL", message: "x" }));

    await expect(loadHomeListing("upstream-error", read)).rejects.toThrow(/status 500/);
    expect(read).toHaveBeenCalledOnce();
  });

  it("throws when the fallback read also fails", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(fail(404, { error: "CATEGORY_NOT_FOUND" }))
      .mockResolvedValueOnce(fail(503, { error: "UNAVAILABLE" }));

    await expect(loadHomeListing("unknown-category", read)).rejects.toThrow(/status 503/);
  });

  it("does not treat any other 404 as an unknown category", async () => {
    const read = vi.fn().mockResolvedValue(fail(404, { error: "NOT_FOUND" }));

    await expect(loadHomeListing("music", read)).rejects.toThrow(/status 404/);
    expect(read).toHaveBeenCalledOnce();
  });
});
