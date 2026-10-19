// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrivacyOption, type Visibility } from "../privacy-option";

function Controlled({
  initial = "public",
  onChange,
}: {
  initial?: Visibility;
  onChange?: (value: Visibility) => void;
}) {
  const [value, setValue] = useState<Visibility>(initial);
  return (
    <PrivacyOption
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("PrivacyOption", () => {
  it("renders a fieldset with a hidden legend and a labelled radiogroup", () => {
    render(<Controlled />);

    const group = screen.getByRole("group", { name: "Visibility" });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByText("Visibility", { selector: "legend" })).toHaveClass("sr-only");
    expect(screen.getByRole("radiogroup", { name: "Visibility" })).toBeInTheDocument();
  });

  it("names each radio by its title and describes it with the option copy", () => {
    render(<Controlled />);

    expect(screen.getByRole("radio", { name: "Public" })).toHaveAccessibleDescription(
      "Everyone can see your video",
    );
    expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveAccessibleDescription(
      "Anyone with the video link can watch your video",
    );
  });

  it.each(["public", "unlisted"] as const)("reflects the %s value through aria-checked", (value) => {
    render(<PrivacyOption value={value} onChange={() => {}} />);

    const other = value === "public" ? "Unlisted" : "Public";
    const own = value === "public" ? "Public" : "Unlisted";
    expect(screen.getByRole("radio", { name: own })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: other })).toHaveAttribute("aria-checked", "false");
  });

  it("highlights the selected card", () => {
    const { container } = render(<PrivacyOption value="unlisted" onChange={() => {}} />);

    const cards = container.querySelectorAll('[data-slot="privacy-option-card"]');
    expect(cards[0]).toHaveAttribute("data-state", "unchecked");
    expect(cards[1]).toHaveAttribute("data-state", "checked");
    expect(cards[1]).toHaveClass("border-primary", "bg-input-background");
  });

  it("selects an option when its card text is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByText("Anyone with the video link can watch your video"));

    expect(onChange).toHaveBeenCalledWith("unlisted");
    expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveAttribute("aria-checked", "true");
  });

  it("selects with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Public" }));

    // Radix moves focus in a timeout and only checks while the key is down.
    await user.keyboard("{ArrowDown>}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Unlisted" })).toHaveFocus());
    await user.keyboard("{/ArrowDown}");

    expect(onChange).toHaveBeenLastCalledWith("unlisted");
  });

  it("does not change while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrivacyOption value="public" onChange={onChange} disabled />);

    await user.click(screen.getByText("Unlisted"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Unlisted" })).toBeDisabled();
  });

  it("forwards aria-describedby to the radiogroup", () => {
    render(
      <>
        <p id="visibility-description">Choose who can see your video.</p>
        <PrivacyOption
          value="public"
          onChange={() => {}}
          aria-describedby="visibility-description"
        />
      </>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAccessibleDescription(
      "Choose who can see your video.",
    );
  });
});
