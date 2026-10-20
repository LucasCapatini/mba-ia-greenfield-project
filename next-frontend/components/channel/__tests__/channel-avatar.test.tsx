// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelAvatar } from "../channel-avatar";

describe("ChannelAvatar", () => {
  it("is an image named after the channel showing its initials", () => {
    render(<ChannelAvatar name="Tech Mastery Plus" />);

    const avatar = screen.getByRole("img", { name: "Tech Mastery Plus" });
    expect(avatar).toHaveAttribute("data-slot", "channel-avatar");
    expect(avatar).toHaveTextContent("TM");
  });

  it("defaults to the large (128px) variant", () => {
    render(<ChannelAvatar name="Tech Mastery" />);

    expect(screen.getByRole("img", { name: "Tech Mastery" })).toHaveAttribute(
      "data-avatar-size",
      "lg",
    );
  });

  it.each(["sm", "md", "lg"] as const)("exposes the %s variant", (size) => {
    render(<ChannelAvatar name="Tech Mastery" size={size} />);

    const avatar = screen.getByRole("img", { name: "Tech Mastery" });
    expect(avatar).toHaveAttribute("data-avatar-size", size);
    expect(avatar).toHaveTextContent("TM");
  });

  it("keeps the primitive's own data-size untouched", () => {
    render(<ChannelAvatar name="Tech Mastery" size="sm" />);

    expect(screen.getByRole("img", { name: "Tech Mastery" })).toHaveAttribute(
      "data-size",
      "default",
    );
  });
});
