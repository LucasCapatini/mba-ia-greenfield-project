// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VideoCardItem } from "@/lib/api/contracts";

import { RelatedVideos } from "../related-videos";

const NOW = new Date("2026-10-19T12:00:00Z");

function makeItem(publicId: string, title: string): VideoCardItem {
  return {
    public_id: publicId,
    title,
    thumbnail_url: `http://localhost:9000/streamtube-videos/thumbnails/${publicId}/auto.jpg?v=1`,
    duration_seconds: 751,
    view_count: 212000,
    published_at: "2026-10-19T10:00:00Z",
    channel: { nickname: "studio_canal", name: "Studio Canal" },
  };
}

describe("RelatedVideos", () => {
  it("renders one card per item, each linking to its watch page", () => {
    render(
      <RelatedVideos
        now={NOW}
        items={[makeItem("rel-01", "Advanced React Patterns"), makeItem("rel-02", "Mastering CSS Grid")]}
      />
    );

    const section = screen.getByRole("region", { name: "Related videos" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section).getByRole("link", { name: /Advanced React Patterns/ })).toHaveAttribute(
      "href",
      "/watch/rel-01"
    );
    expect(within(section).getByRole("link", { name: /Mastering CSS Grid/ })).toHaveAttribute(
      "href",
      "/watch/rel-02"
    );
  });

  it("shows the channel name on each card", () => {
    render(<RelatedVideos now={NOW} items={[makeItem("rel-01", "Advanced React Patterns")]} />);

    expect(screen.getByText("Studio Canal")).toBeInTheDocument();
  });

  it("renders nothing when there are no suggestions", () => {
    const { container } = render(<RelatedVideos now={NOW} items={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: "Related videos" })).not.toBeInTheDocument();
  });
});
