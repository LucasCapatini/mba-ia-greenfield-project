// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";

function ActionsMenu({ onEdit = vi.fn(), onDelete = vi.fn(), publishDisabled = false }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Video actions">⋮</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={publishDisabled}>Publish</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("opens a role=menu with its items when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<ActionsMenu />);
    const trigger = screen.getByRole("button", { name: "Video actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("data-slot", "dropdown-menu-content");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Edit",
      "Publish",
      "Delete",
    ]);
  });

  it("opens from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ActionsMenu />);
    screen.getByRole("button", { name: "Video actions" }).focus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("calls onSelect and closes when an item is chosen", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ActionsMenu onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Video actions" }));

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("marks the destructive item through data-variant", async () => {
    const user = userEvent.setup();
    render(<ActionsMenu />);
    await user.click(screen.getByRole("button", { name: "Video actions" }));

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("data-variant", "default");
  });

  it("exposes disabled items as aria-disabled", async () => {
    const user = userEvent.setup();
    render(<ActionsMenu publishDisabled />);
    await user.click(screen.getByRole("button", { name: "Video actions" }));

    expect(screen.getByRole("menuitem", { name: "Publish" })).toHaveAttribute("aria-disabled", "true");
  });
});
