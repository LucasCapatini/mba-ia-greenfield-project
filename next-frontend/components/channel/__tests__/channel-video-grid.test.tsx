// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelVideoGrid } from "../channel-video-grid";

describe("ChannelVideoGrid", () => {
  it("renders the empty state when there are no cards", () => {
    const { container } = render(<ChannelVideoGrid />);

    expect(screen.getByText("This channel has no public videos yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-state", "empty");
  });

  it("ignores the footer in the empty state", () => {
    render(<ChannelVideoGrid footer={<button type="button">Load more</button>} />);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("accepts a custom empty message", () => {
    render(<ChannelVideoGrid emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("wraps every card in a list item of the labelled grid", () => {
    const { container } = render(
      <ChannelVideoGrid>
        <a key="a" href="/watch/a">Video A</a>
        <a key="b" href="/watch/b">Video B</a>
        <a key="c" href="/watch/c">Video C</a>
      </ChannelVideoGrid>,
    );

    const list = screen.getByRole("list", { name: "Channel videos" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]).toContainElement(screen.getByRole("link", { name: "Video B" }));
    expect(container.firstElementChild).toHaveAttribute("data-state", "filled");
    expect(screen.queryByText("This channel has no public videos yet")).not.toBeInTheDocument();
  });

  it("renders the Load more slot below the grid", () => {
    render(
      <ChannelVideoGrid footer={<button type="button">Load more</button>}>
        <a href="/watch/a">Video A</a>
      </ChannelVideoGrid>,
    );

    const button = screen.getByRole("button", { name: "Load more" });
    expect(screen.getByRole("list")).not.toContainElement(button);
  });

  it("treats null children as empty", () => {
    render(<ChannelVideoGrid>{[null, false]}</ChannelVideoGrid>);
    expect(screen.getByText("This channel has no public videos yet")).toBeInTheDocument();
  });
});
