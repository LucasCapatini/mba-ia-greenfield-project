import { describe, expect, it } from "vitest";

import { cn } from "../utils";

describe("cn", () => {
  it("treats text-overlay-md as a font size: the last font-size utility wins", () => {
    expect(cn("text-body-lg", "text-overlay-md")).toBe("text-overlay-md");
    expect(cn("text-overlay-md", "text-caption")).toBe("text-caption");
  });

  it("keeps text-overlay-md next to text color utilities", () => {
    expect(cn("text-overlay-md text-neutral-100 tabular-nums")).toBe(
      "text-overlay-md text-neutral-100 tabular-nums"
    );
  });

  it("no longer treats text-overlay as a font size: it is the overlay color, not a text style", () => {
    // Before the rename, `overlay` sat in the font-size group and `cn` merged it with real sizes.
    expect(cn("text-overlay-md", "text-overlay")).toBe("text-overlay-md text-overlay");
    expect(cn("text-neutral-100", "text-overlay")).toBe("text-overlay");
  });
});
