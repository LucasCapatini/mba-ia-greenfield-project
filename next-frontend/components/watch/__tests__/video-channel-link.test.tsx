// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoChannelLink } from "../video-channel-link";

describe("VideoChannelLink", () => {
  it("links to the public channel page with the channel name", () => {
    render(<VideoChannelLink channel={{ nickname: "studio_canal", name: "Studio Canal" }} />);

    const link = screen.getByRole("link", { name: "Studio Canal" });
    expect(link).toHaveAttribute("href", "/channel/studio_canal");
  });

  it("shows the channel initials in a decorative avatar", () => {
    render(<VideoChannelLink channel={{ nickname: "studio_canal", name: "Studio Canal" }} />);

    const link = screen.getByRole("link", { name: "Studio Canal" });
    const avatar = link.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveTextContent("SC");
  });
});
