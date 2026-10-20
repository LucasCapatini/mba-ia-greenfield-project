import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "../search-query";

describe("parseSearchQuery", () => {
  it.each([[undefined], [""], ["   "], [["", "music"]]])("redirects home for %j", (raw) => {
    expect(parseSearchQuery(raw)).toEqual({ kind: "redirect" });
  });

  it("flags a one-character term as too short (after trim)", () => {
    expect(parseSearchQuery("  a  ")).toEqual({ kind: "too-short", q: "a" });
  });

  it("searches the trimmed term from 2 characters", () => {
    expect(parseSearchQuery("  ab ")).toEqual({ kind: "search", q: "ab" });
  });

  it("keeps a 100-character term as is", () => {
    const term = "x".repeat(100);
    expect(parseSearchQuery(term)).toEqual({ kind: "search", q: term });
  });

  it("caps a 101-character term at 100", () => {
    expect(parseSearchQuery("y".repeat(101))).toEqual({ kind: "search", q: "y".repeat(100) });
  });

  it("uses the first value when the parameter repeats", () => {
    expect(parseSearchQuery(["lofi", "jazz"])).toEqual({ kind: "search", q: "lofi" });
  });

  it("keeps inner spaces and accents", () => {
    expect(parseSearchQuery(" música ao vivo ")).toEqual({ kind: "search", q: "música ao vivo" });
  });
});
