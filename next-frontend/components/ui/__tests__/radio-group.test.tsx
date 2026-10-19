// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "../radio-group";

function VisibilityGroup(props: ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup aria-label="Visibility" {...props}>
      <RadioGroupItem value="public" aria-label="Public" />
      <RadioGroupItem value="unlisted" aria-label="Unlisted" />
      <RadioGroupItem value="private" aria-label="Private" disabled />
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("renders a radiogroup of radios with data-slot anchors", () => {
    render(<VisibilityGroup />);

    const group = screen.getByRole("radiogroup", { name: "Visibility" });
    expect(group).toHaveAttribute("data-slot", "radio-group");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    radios.forEach((radio) => expect(radio).toHaveAttribute("data-slot", "radio-group-item"));
  });

  it("reflects the default value through aria-checked and shows the indicator", () => {
    render(<VisibilityGroup defaultValue="public" />);

    const publicRadio = screen.getByRole("radio", { name: "Public" });
    expect(publicRadio).toHaveAttribute("aria-checked", "true");
    expect(publicRadio).toHaveAttribute("data-state", "checked");
    expect(publicRadio.querySelector('[data-slot="radio-group-indicator"]')).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onValueChange when an option is clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<VisibilityGroup defaultValue="public" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("radio", { name: "Unlisted" }));

    expect(onValueChange).toHaveBeenCalledWith("unlisted");
    expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Public" })).toHaveAttribute("aria-checked", "false");
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<VisibilityGroup defaultValue="public" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Public" }));

    // Radix moves focus in a timeout and only checks the focused radio while the
    // arrow key is still down, so hold it until focus lands.
    await user.keyboard("{ArrowDown>}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveFocus());
    await user.keyboard("{/ArrowDown}");

    expect(onValueChange).toHaveBeenLastCalledWith("unlisted");
    expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveAttribute("aria-checked", "true");
  });

  it("keeps disabled options unselectable", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<VisibilityGroup defaultValue="public" onValueChange={onValueChange} />);

    const privateRadio = screen.getByRole("radio", { name: "Private" });
    expect(privateRadio).toBeDisabled();
    await user.click(privateRadio);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(privateRadio).toHaveAttribute("aria-checked", "false");
  });
});
