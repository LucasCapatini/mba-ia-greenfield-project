// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "../search-input";

function ControlledSearch({ onValueChange }: { onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState("react");
  return (
    <SearchInput
      aria-label="Search your videos"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

describe("SearchInput", () => {
  it("renders a labelled searchbox inside the data-slot wrapper", () => {
    render(<SearchInput aria-label="Search your videos" placeholder="Search" />);

    const input = screen.getByRole("searchbox", { name: "Search your videos" });
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input.closest('[data-slot="search-input"]')).toBeInTheDocument();
  });

  it("shows the magnifier and no clear button while empty", () => {
    render(<SearchInput aria-label="Search your videos" />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("works uncontrolled: typing reveals the clear button and reports the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(
      <SearchInput
        aria-label="Search your videos"
        onValueChange={onValueChange}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("searchbox");

    await user.type(input, "cats");

    expect(input).toHaveValue("cats");
    expect(onValueChange).toHaveBeenLastCalledWith("cats");
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("clears an uncontrolled field, notifies the parent and refocuses the input", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClear = vi.fn();
    render(
      <SearchInput
        aria-label="Search your videos"
        defaultValue="cats"
        onValueChange={onValueChange}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onValueChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("reflects a controlled value and clears through onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ControlledSearch onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("react");

    await user.type(input, "!");
    expect(input).toHaveValue("react!");

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
  });

  it("keeps a controlled value when the parent ignores the change", async () => {
    const user = userEvent.setup();
    render(<SearchInput aria-label="Search your videos" value="fixed" onValueChange={() => {}} />);
    const input = screen.getByRole("searchbox");

    await user.type(input, "x");

    expect(input).toHaveValue("fixed");
  });

  it("enforces a configurable maxLength", async () => {
    const user = userEvent.setup();
    render(<SearchInput aria-label="Search your videos" maxLength={5} />);
    const input = screen.getByRole("searchbox");

    await user.type(input, "123456789");

    expect(input).toHaveAttribute("maxlength", "5");
    expect(input).toHaveValue("12345");
  });

  it("disables the field and the clear button together", () => {
    render(<SearchInput aria-label="Search your videos" defaultValue="cats" disabled />);

    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeDisabled();
    expect(screen.getByRole("searchbox").closest('[data-slot="search-input"]')).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("forwards the ref to the underlying input", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<SearchInput aria-label="Search your videos" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("searchbox"));
  });
});
