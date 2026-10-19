// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

function ChannelTabs({
  variant,
  onValueChange,
}: {
  variant?: "default" | "line";
  onValueChange?: (value: string) => void;
}) {
  return (
    <Tabs defaultValue="videos" onValueChange={onValueChange}>
      <TabsList variant={variant} aria-label="Channel sections">
        <TabsTrigger value="videos">Videos</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
        <TabsTrigger value="playlists" disabled>
          Playlists
        </TabsTrigger>
      </TabsList>
      <TabsContent value="videos">Videos panel</TabsContent>
      <TabsContent value="about">About panel</TabsContent>
      <TabsContent value="playlists">Playlists panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders tablist, tabs and the active panel with data-slot anchors", () => {
    const { container } = render(<ChannelTabs />);

    expect(container.querySelector('[data-slot="tabs"]')).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
    const list = screen.getByRole("tablist", { name: "Channel sections" });
    expect(list).toHaveAttribute("data-slot", "tabs-list");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab) => expect(tab).toHaveAttribute("data-slot", "tabs-trigger"));

    const panel = screen.getByRole("tabpanel", { name: "Videos" });
    expect(panel).toHaveAttribute("data-slot", "tabs-content");
    expect(panel).toHaveTextContent("Videos panel");
  });

  it("marks the default tab with aria-selected", () => {
    render(<ChannelTabs />);

    expect(screen.getByRole("tab", { name: "Videos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "false");
  });

  it.each(["default", "line"] as const)(
    "exposes the %s list variant through data-variant",
    (variant) => {
      render(<ChannelTabs variant={variant} />);
      expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", variant);
    },
  );

  it("switches panels on click and calls onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ChannelTabs onValueChange={onValueChange} />);

    await user.click(screen.getByRole("tab", { name: "About" }));

    expect(onValueChange).toHaveBeenCalledWith("about");
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("About panel");
  });

  it("navigates with the arrow keys and skips disabled tabs", async () => {
    const user = userEvent.setup();
    render(<ChannelTabs />);
    await user.click(screen.getByRole("tab", { name: "Videos" }));

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "About" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "About" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Videos" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Playlists" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
