// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Textarea } from "../textarea";

function ControlledTextarea({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("Initial");
  return (
    <Textarea
      aria-label="Description"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange?.(event.target.value);
      }}
    />
  );
}

describe("Textarea", () => {
  it("renders a textbox with data-slot=textarea", () => {
    render(<Textarea aria-label="Description" placeholder="Tell viewers about your video" />);

    const textarea = screen.getByRole("textbox", { name: "Description" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("data-slot", "textarea");
    expect(textarea).toHaveAttribute("placeholder", "Tell viewers about your video");
  });

  it("works as a controlled input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledTextarea onChange={onChange} />);
    const textarea = screen.getByRole("textbox", { name: "Description" });
    expect(textarea).toHaveValue("Initial");

    await user.clear(textarea);
    await user.type(textarea, "New text");

    expect(textarea).toHaveValue("New text");
    expect(onChange).toHaveBeenLastCalledWith("New text");
  });

  it("forwards aria-invalid and aria-describedby", () => {
    render(
      <>
        <Textarea aria-label="Description" aria-invalid aria-describedby="description-error" />
        <p id="description-error">Too long</p>
      </>,
    );

    const textarea = screen.getByRole("textbox", { name: "Description" });
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Too long");
  });

  it("enforces maxLength while typing", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Description" maxLength={5} />);
    const textarea = screen.getByRole("textbox", { name: "Description" });

    await user.type(textarea, "123456789");

    expect(textarea).toHaveAttribute("maxlength", "5");
    expect(textarea).toHaveValue("12345");
  });

  it("is not editable when disabled", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Description" disabled />);
    const textarea = screen.getByRole("textbox", { name: "Description" });

    await user.type(textarea, "abc");

    expect(textarea).toBeDisabled();
    expect(textarea).toHaveValue("");
  });
});
