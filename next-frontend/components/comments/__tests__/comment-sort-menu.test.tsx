// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommentSortMenu } from "../comment-sort-menu";

describe("CommentSortMenu", () => {
  it("labels the trigger with the current sort", () => {
    const { rerender } = render(<CommentSortMenu value="latest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sort by: Latest" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );

    rerender(<CommentSortMenu value="top" onValueChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sort by: Top" })).toBeInTheDocument();
  });

  it("offers Latest and Top with the current one checked", async () => {
    const user = userEvent.setup();
    render(<CommentSortMenu value="latest" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Sort by: Latest" }));

    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Latest", "Top"]);
    expect(screen.getByRole("menuitemradio", { name: "Latest" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("reports the new sort when Top is chosen", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CommentSortMenu value="latest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Sort by: Latest" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Top" }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("top");
  });

  it("does not report when the current sort is chosen again", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CommentSortMenu value="top" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Sort by: Top" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Top" }));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
