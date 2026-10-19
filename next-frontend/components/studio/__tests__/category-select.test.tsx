// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CategorySelect, type CategoryOption } from "../category-select";

// Radix Select relies on pointer capture and scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const CATEGORIES: CategoryOption[] = [
  { id: "c1", name: "Music" },
  { id: "c2", name: "Gaming" },
  { id: "c3", name: "Technology" },
];

function Controlled({
  initial = null,
  onChange,
}: {
  initial?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <CategorySelect
      categories={CATEGORIES}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("CategorySelect", () => {
  it("associates a (visually hidden) label with the trigger", () => {
    render(<Controlled />);

    const trigger = screen.getByRole("combobox", { name: "Category" });
    expect(trigger).toHaveAttribute("id", "category");
    expect(screen.getByText("Category", { selector: "label" })).toHaveClass("sr-only");
  });

  it("shows the placeholder when no category is selected", () => {
    render(<Controlled />);
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent(
      "Select a category",
    );
  });

  it("lists every category plus the No category option", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No category",
      "Music",
      "Gaming",
      "Technology",
    ]);
  });

  it("reflects the controlled value and reports the chosen id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="c1" onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Category" });
    expect(trigger).toHaveTextContent("Music");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Technology" }));

    expect(onChange).toHaveBeenCalledWith("c3");
    expect(trigger).toHaveTextContent("Technology");
  });

  it("reports null when No category is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="c2" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "No category" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent(
      "Select a category",
    );
  });

  it("forwards custom id, label and aria attributes", () => {
    render(
      <>
        <CategorySelect
          id="video-category"
          label="Video category"
          categories={CATEGORIES}
          value={null}
          onValueChange={() => {}}
          aria-invalid
          aria-describedby="category-error"
        />
        <p id="category-error">Category not found</p>
      </>,
    );

    const trigger = screen.getByRole("combobox", { name: "Video category" });
    expect(trigger).toHaveAttribute("id", "video-category");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription("Category not found");
  });

  it("can be disabled", () => {
    render(
      <CategorySelect categories={CATEGORIES} value={null} onValueChange={() => {}} disabled />,
    );
    expect(screen.getByRole("combobox", { name: "Category" })).toBeDisabled();
  });
});
