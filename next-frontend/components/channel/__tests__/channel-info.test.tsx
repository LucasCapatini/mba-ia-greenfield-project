// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelInfo, formatSubscriberCount, formatVideoCount } from "../channel-info";

describe("ChannelInfo", () => {
  it("renders the channel name as the page h1", () => {
    render(<ChannelInfo name="Tech Mastery Plus" nickname="tech_mastery" videoCount={12} />);

    expect(screen.getByRole("heading", { level: 1, name: "Tech Mastery Plus" })).toHaveClass(
      "text-h1",
    );
  });

  it("shows the @nickname and the video count in the meta row", () => {
    const { container } = render(
      <ChannelInfo name="Tech Mastery Plus" nickname="tech_mastery" videoCount={12} />,
    );

    expect(container.querySelector('[data-slot="channel-info-nickname"]')).toHaveTextContent(
      "@tech_mastery",
    );
    expect(container.querySelector('[data-slot="channel-info-videos"]')).toHaveTextContent(
      "12 videos",
    );
    expect(container.querySelector('[data-slot="channel-info-nickname"]')?.parentElement).toHaveTextContent(
      "@tech_mastery • 12 videos",
    );
  });

  it.each([
    [0, "0 videos"],
    [1, "1 video"],
    [2, "2 videos"],
    [1200, "1.2K videos"],
  ])("pluralizes %d as %s", (count, expected) => {
    expect(formatVideoCount(count)).toBe(expected);
  });

  it("renders the description when present", () => {
    render(
      <ChannelInfo
        name="Tech Mastery Plus"
        nickname="tech_mastery"
        videoCount={1}
        description="Your ultimate guide to modern web development."
      />,
    );
    expect(screen.getByText("Your ultimate guide to modern web development.")).toBeInTheDocument();
  });

  it("omits the description and the subscriber count", () => {
    const { container } = render(
      <ChannelInfo name="Tech Mastery Plus" nickname="tech_mastery" videoCount={1} description={null} />,
    );

    expect(container.querySelector('[data-slot="channel-info-description"]')).toBeNull();
    expect(container).not.toHaveTextContent(/subscriber/i);
  });

  it("shows the subscriber count between the nickname and the videos (phase 06)", () => {
    const { container } = render(
      <ChannelInfo
        name="Tech Mastery Plus"
        nickname="tech_mastery"
        videoCount={24}
        subscriberCount={2_400_000}
      />,
    );

    expect(container.querySelector('[data-slot="channel-info-subscribers"]')).toHaveTextContent(
      "2.4M subscribers",
    );
    expect(container.querySelector('[data-slot="channel-info-nickname"]')?.parentElement).toHaveTextContent(
      "@tech_mastery • 2.4M subscribers • 24 videos",
    );
  });

  it.each([
    [0, "0 subscribers"],
    [1, "1 subscriber"],
    [2, "2 subscribers"],
    [1200, "1.2K subscribers"],
  ])("formats %d subscribers as %s", (count, expected) => {
    expect(formatSubscriberCount(count)).toBe(expected);
  });
});
