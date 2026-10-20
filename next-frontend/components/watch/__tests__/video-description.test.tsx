// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VideoDescription } from "../video-description";

const NOW = new Date("2026-10-19T12:00:00Z");
const LONG_DESCRIPTION = [
  "Learn how to build a complete full-stack application.",
  "Topics covered:",
  "0:00 - Introduction & Project Setup",
  "15:30 - Backend: Node.js & Express API",
  "GitHub Repo: https://github.com/example/fullstack-app",
].join("\n");

// jsdom has no layout: scrollHeight/clientHeight are 0. Simulate a clamped text that overflows.
function simulateOverflow(overflowing: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(overflowing ? 200 : 60);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(60);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoDescription", () => {
  it("renders the formatted views and relative publication time", () => {
    simulateOverflow(false);
    render(
      <VideoDescription viewCount={10000} publishedAt="2026-09-28T12:00:00Z" description="Hi" now={NOW} />
    );

    const meta = screen.getByText("10K views").parentElement;
    expect(meta).toHaveTextContent("10K views • 3 weeks ago");
    expect(screen.getByRole("region", { name: "Description" })).toBeInTheDocument();
  });

  it("uses the singular for one view and omits the time for an unpublished video", () => {
    simulateOverflow(false);
    render(<VideoDescription viewCount={1} publishedAt={null} description={null} now={NOW} />);

    expect(screen.getByText("1 view")).toBeInTheDocument();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
  });

  it("preserves line breaks and keeps timestamps and URLs as plain text", () => {
    simulateOverflow(false);
    const { container } = render(
      <VideoDescription viewCount={5} publishedAt={null} description={LONG_DESCRIPTION} now={NOW} />
    );

    const text = container.querySelector('[data-slot="video-description-text"]');
    expect(text).toHaveClass("whitespace-pre-line", "line-clamp-3");
    expect(text?.textContent).toBe(LONG_DESCRIPTION);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no expand control when the text fits in 3 lines or there is no description", async () => {
    simulateOverflow(false);
    render(<VideoDescription viewCount={5} publishedAt={null} description="Short" now={NOW} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("expands and collapses an overflowing description", async () => {
    const user = userEvent.setup();
    simulateOverflow(true);
    const { container } = render(
      <VideoDescription viewCount={5} publishedAt={null} description={LONG_DESCRIPTION} now={NOW} />
    );

    const more = await screen.findByRole("button", { name: "…more" });
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);
    const less = screen.getByRole("button", { name: "Show less" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector('[data-slot="video-description-text"]')).not.toHaveClass("line-clamp-3");

    await user.click(less);
    expect(screen.getByRole("button", { name: "…more" })).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector('[data-slot="video-description-text"]')).toHaveClass("line-clamp-3");
  });
});
