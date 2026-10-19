// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Separator } from "../separator";

describe("Separator", () => {
  it("is decorative and horizontal by default (hidden from the a11y tree)", () => {
    const { container } = render(<Separator />);

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toHaveAttribute("role", "none");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("exposes role=separator when it is not decorative", () => {
    render(<Separator decorative={false} />);

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("data-slot", "separator");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
  });

  it("supports the vertical orientation with aria-orientation", () => {
    render(<Separator decorative={false} orientation="vertical" />);

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });

  it("merges a custom className", () => {
    render(<Separator decorative={false} className="my-4" />);
    expect(screen.getByRole("separator")).toHaveClass("my-4", "bg-border");
  });
});
