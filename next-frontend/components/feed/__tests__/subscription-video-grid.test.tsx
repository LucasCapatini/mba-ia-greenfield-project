// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VideoCardData } from "@/components/videos/video-card";

import { SubscriptionVideoGrid } from "../subscription-video-grid";

const now = new Date("2026-10-20T12:00:00Z");

function video(publicId: string, title: string): VideoCardData {
  return {
    public_id: publicId,
    title,
    thumbnail_url: null,
    view_count: 10,
    published_at: "2026-10-19T12:00:00Z",
    channel: { nickname: "tech_mastery", name: "Tech Mastery" },
  };
}

describe("SubscriptionVideoGrid", () => {
  it("renders one card per video, in the order received", () => {
    render(
      <SubscriptionVideoGrid
        now={now}
        videos={[video("v-new", "Newest video"), video("v-mid", "Middle video"), video("v-old", "Oldest video")]}
      />,
    );

    const list = screen.getByRole("list", { name: "Subscription videos" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Newest video");
    expect(items[2]).toHaveTextContent("Oldest video");
  });

  it("each card links to the watch page and shows the channel name", () => {
    render(<SubscriptionVideoGrid now={now} videos={[video("v-1", "A video")]} />);

    expect(screen.getByRole("link", { name: /A video/ })).toHaveAttribute("href", "/watch/v-1");
    expect(screen.getByText("Tech Mastery")).toBeInTheDocument();
  });

  it("renders an empty list when there are no videos (the page owns the empty state)", () => {
    render(<SubscriptionVideoGrid videos={[]} />);
    expect(within(screen.getByRole("list")).queryAllByRole("listitem")).toHaveLength(0);
  });
});
