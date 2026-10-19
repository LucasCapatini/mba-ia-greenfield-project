// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoStats } from "../video-stats";

const NOW = new Date("2026-10-19T12:00:00Z");

function renderStats(overrides: Partial<ComponentProps<typeof VideoStats>> = {}) {
  return render(
    <VideoStats
      viewCount={124000}
      likeCount={5200}
      commentCount={432}
      publishedAt="2026-10-17T12:00:00Z"
      now={NOW}
      {...overrides}
    />,
  );
}

function slot(container: HTMLElement, name: string) {
  return container.querySelector(`[data-slot="video-stats-${name}"]`);
}

describe("VideoStats", () => {
  it("formats the counters compactly with accessible units", () => {
    const { container } = renderStats();

    expect(slot(container, "views")).toHaveTextContent("124K views");
    expect(slot(container, "likes")).toHaveTextContent("5.2K likes");
    expect(slot(container, "comments")).toHaveTextContent("432 comments");
    expect(container.firstElementChild).toHaveTextContent(
      "124K views 5.2K likes 432 comments • 2 days ago",
    );
  });

  it("keeps the likes and comments units visually hidden, as in the design", () => {
    const { container } = renderStats();

    expect(screen.getByText("likes")).toHaveClass("sr-only");
    expect(screen.getByText("comments")).toHaveClass("sr-only");
    expect(slot(container, "views")?.querySelector(".sr-only")).toBeNull();
  });

  it("uses singular units for a count of one", () => {
    const { container } = renderStats({ viewCount: 1, likeCount: 1, commentCount: 1 });

    expect(slot(container, "views")).toHaveTextContent("1 view");
    expect(slot(container, "likes")).toHaveTextContent("1 like");
    expect(slot(container, "comments")).toHaveTextContent("1 comment");
  });

  it("shows the relative publication time in a <time> element", () => {
    const { container } = renderStats();

    const time = slot(container, "published");
    expect(time?.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-17T12:00:00Z");
    expect(time).toHaveTextContent("2 days ago");
  });

  it("shows Draft when the video was never published", () => {
    const { container } = renderStats({ publishedAt: null });

    const published = slot(container, "published");
    expect(published?.tagName).toBe("SPAN");
    expect(published).toHaveTextContent("Draft");
  });

  it("appends extra items after a bullet", () => {
    const { container } = renderStats({ children: <span data-testid="status">Public</span> });

    expect(screen.getByTestId("status")).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });
});
