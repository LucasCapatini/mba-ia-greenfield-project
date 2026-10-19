// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

// Radix Select relies on pointer capture and scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

function CategorySelect({
  value,
  onValueChange,
  size,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label="Category" size={size}>
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="music">Music</SelectItem>
        <SelectItem value="gaming">Gaming</SelectItem>
        <SelectItem value="news" disabled>
          News
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function ControlledCategorySelect() {
  const [value, setValue] = useState("music");
  return <CategorySelect value={value} onValueChange={setValue} />;
}

describe("Select", () => {
  it("renders a collapsed combobox with the placeholder and data-slot anchors", () => {
    render(<CategorySelect />);

    const trigger = screen.getByRole("combobox", { name: "Category" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveAttribute("data-size", "default");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Select a category");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("exposes the sm size through data-size", () => {
    render(<CategorySelect size="sm" />);
    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "sm");
  });

  it("opens the listbox on click and selects an option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CategorySelect onValueChange={onValueChange} />);
    const trigger = screen.getByRole("combobox", { name: "Category" });

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("data-slot", "select-content");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Music",
      "Gaming",
      "News",
    ]);

    await user.click(screen.getByRole("option", { name: "Gaming" }));

    expect(onValueChange).toHaveBeenCalledWith("gaming");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens from the keyboard", async () => {
    const user = userEvent.setup();
    render(<CategorySelect />);
    screen.getByRole("combobox", { name: "Category" }).focus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("reflects the controlled value and marks the selected option", async () => {
    const user = userEvent.setup();
    render(<ControlledCategorySelect />);
    const trigger = screen.getByRole("combobox", { name: "Category" });
    expect(trigger).toHaveTextContent("Music");

    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Music" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Gaming" }));

    expect(trigger).toHaveTextContent("Gaming");
  });

  it("exposes disabled options as aria-disabled", async () => {
    const user = userEvent.setup();
    render(<CategorySelect />);
    await user.click(screen.getByRole("combobox", { name: "Category" }));

    expect(screen.getByRole("option", { name: "News" })).toHaveAttribute("aria-disabled", "true");
  });
});
