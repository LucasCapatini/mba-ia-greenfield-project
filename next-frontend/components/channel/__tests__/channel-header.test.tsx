// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getInitials } from "../channel-avatar";
import { ChannelHeader } from "../channel-header";
import { ChannelHeaderCard } from "../channel-header-card";

describe("getInitials", () => {
  it.each([
    ["Tech Mastery Plus", "TM"],
    ["techmaster", "T"],
    ["  flux   academy ", "FA"],
    ["", ""],
  ])("turns %j into %j", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe("ChannelHeader", () => {
  it("renders the decorative banner, the named avatar and the channel info", () => {
    const { container } = render(
      <ChannelHeader name="Tech Mastery Plus" nickname="tech_mastery" videoCount={3} />,
    );

    expect(container.querySelector('[data-slot="channel-banner"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("img", { name: "Tech Mastery Plus" })).toHaveTextContent("TM");
    expect(screen.getByRole("heading", { level: 1, name: "Tech Mastery Plus" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tech Mastery Plus channel" })).toBeInTheDocument();
  });

  it("renders the actions slot", () => {
    render(
      <ChannelHeader
        name="Tech Mastery Plus"
        nickname="tech_mastery"
        videoCount={3}
        actions={<button type="button">Share</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });
});

describe("ChannelHeaderCard", () => {
  it("shows the name as h2, the nickname and the video count without subscribers", () => {
    const { container } = render(
      <ChannelHeaderCard name="TechMaster Studio" nickname="techmaster2024" videoCount={342} />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "TechMaster Studio" })).toBeInTheDocument();
    expect(screen.getByText("@techmaster2024")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="channel-header-card-videos"]')).toHaveTextContent(
      "342 videos",
    );
    expect(container).not.toHaveTextContent(/subscriber/i);
    expect(screen.getByRole("img", { name: "TechMaster Studio" })).toHaveTextContent("TS");
  });
});
