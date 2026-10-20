// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Category } from "@/lib/api/contracts";

import { CategoryChips } from "../category-chips";

const categories: Category[] = [
  { id: "c1", slug: "music", name: "Music", sort_order: 1 },
  { id: "c2", slug: "gaming", name: "Gaming", sort_order: 2 },
  { id: "c3", slug: "education", name: "Education", sort_order: 3 },
];

function chips() {
  const nav = screen.getByRole("navigation", { name: "Categories" });
  return within(nav).getAllByRole("link");
}

describe("CategoryChips", () => {
  it("renders All followed by the categories in the received order", () => {
    render(<CategoryChips categories={categories} activeSlug={null} />);

    expect(chips().map((chip) => chip.textContent)).toEqual([
      "All",
      "Music",
      "Gaming",
      "Education",
    ]);
  });

  it("links each chip to its category filter and All to the home", () => {
    render(<CategoryChips categories={categories} activeSlug={null} />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Music" })).toHaveAttribute("href", "/?category=music");
    expect(screen.getByRole("link", { name: "Education" })).toHaveAttribute(
      "href",
      "/?category=education"
    );
  });

  it("marks All as current when no category is active", () => {
    render(<CategoryChips categories={categories} activeSlug={null} />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Music" })).not.toHaveAttribute("aria-current");
  });

  it("marks the active category as current", () => {
    render(<CategoryChips categories={categories} activeSlug="gaming" />);

    const gaming = screen.getByRole("link", { name: "Gaming" });
    expect(gaming).toHaveAttribute("aria-current", "page");
    expect(gaming).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("falls back to All when the active slug is unknown", () => {
    render(<CategoryChips categories={categories} activeSlug="unknown-category" />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });
});
