// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../badge";

describe("Badge", () => {
  it("renders a span with data-slot=badge and the default variant", () => {
    render(<Badge>Draft</Badge>);
    const badge = screen.getByText("Draft");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "default");
  });

  it.each(["secondary", "destructive", "outline", "success", "warning"] as const)(
    "exposes the %s variant through data-variant",
    (variant) => {
      render(<Badge variant={variant}>Status</Badge>);
      expect(screen.getByText("Status")).toHaveAttribute("data-variant", variant);
    },
  );

  it("renders the child element when asChild is set", () => {
    render(
      <Badge asChild variant="outline">
        <a href="/studio/videos">Public</a>
      </Badge>,
    );
    const link = screen.getByRole("link", { name: "Public" });
    expect(link).toHaveAttribute("href", "/studio/videos");
    expect(link).toHaveAttribute("data-slot", "badge");
    expect(link).toHaveAttribute("data-variant", "outline");
  });

  it("forwards arbitrary attributes such as aria-label", () => {
    render(<Badge aria-label="Status: Public">Public</Badge>);
    expect(screen.getByLabelText("Status: Public")).toHaveTextContent("Public");
  });
});
