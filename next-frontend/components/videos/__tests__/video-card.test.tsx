// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoCard, type VideoCardData } from "../video-card";

const NOW = new Date("2026-10-19T12:00:00Z");

function makeVideo(overrides: Partial<VideoCardData> = {}): VideoCardData {
  return {
    public_id: "pub-01",
    title: "React 19 Complete Crash Course - Everything New",
    thumbnail_url: "http://localhost:9000/streamtube/thumbnails/pub-01/auto.jpg?v=1",
    view_count: 212000,
    published_at: "2026-10-19T10:00:00Z",
    channel: { nickname: "tech_mastery", name: "Tech Mastery Plus" },
    ...overrides,
  };
}

describe("VideoCard", () => {
  it("links the whole card to /watch/{publicId}", () => {
    render(<VideoCard video={makeVideo()} now={NOW} />);

    const link = screen.getByRole("link", { name: /React 19 Complete Crash Course/ });
    expect(link).toHaveAttribute("href", "/watch/pub-01");
  });

  it("renders the thumbnail as a decorative image, since the title names the link", () => {
    const { container } = render(<VideoCard video={makeVideo()} now={NOW} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("src", "http://localhost:9000/streamtube/thumbnails/pub-01/auto.jpg?v=1");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the full title accessible on the clamped heading", () => {
    render(<VideoCard video={makeVideo()} now={NOW} />);

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveAttribute("title", "React 19 Complete Crash Course - Everything New");
    expect(heading).toHaveClass("line-clamp-2");
  });

  it("formats views compactly with the relative publication time", () => {
    const { container } = render(<VideoCard video={makeVideo()} now={NOW} />);

    const meta = container.querySelector('[data-slot="video-card-meta"]');
    expect(meta).toHaveTextContent("212K views • 2 hours ago");
    expect(meta?.querySelector("time")).toHaveAttribute("dateTime", "2026-10-19T10:00:00Z");
  });

  it("uses the singular for a single view and omits a missing date", () => {
    const { container } = render(
      <VideoCard video={makeVideo({ view_count: 1, published_at: null })} now={NOW} />,
    );

    const meta = container.querySelector('[data-slot="video-card-meta"]');
    expect(meta).toHaveTextContent(/^1 view$/);
    expect(meta?.querySelector("time")).toBeNull();
  });

  it("shows the channel line by default and hides it on the channel page variant", () => {
    const { container, rerender } = render(<VideoCard video={makeVideo()} now={NOW} />);
    expect(container.querySelector('[data-slot="video-card-channel"]')).toHaveTextContent(
      "Tech Mastery Plus",
    );

    rerender(<VideoCard video={makeVideo()} now={NOW} showChannel={false} />);
    expect(container.querySelector('[data-slot="video-card-channel"]')).toBeNull();
  });

  it("renders the thumbnail box without an image when there is no thumbnail", () => {
    const { container } = render(<VideoCard video={makeVideo({ thumbnail_url: null })} now={NOW} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
