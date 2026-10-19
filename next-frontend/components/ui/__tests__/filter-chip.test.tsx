// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterChip, filterChipVariants } from "../filter-chip";

describe("FilterChip", () => {
  it("renders a type=button toggle in the default (not pressed) state", () => {
    render(<FilterChip>Popular</FilterChip>);

    const chip = screen.getByRole("button", { name: "Popular" });
    expect(chip).toHaveAttribute("type", "button");
    expect(chip).toHaveAttribute("data-slot", "filter-chip");
    expect(chip).toHaveAttribute("data-state", "default");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).not.toHaveAttribute("aria-checked");
  });

  it("exposes the active state through aria-pressed and data-state", () => {
    render(<FilterChip active>Latest</FilterChip>);

    const chip = screen.getByRole("button", { name: "Latest", pressed: true });
    expect(chip).toHaveAttribute("data-state", "active");
    expect(chip).toHaveClass("bg-secondary");
  });

  it("uses aria-checked instead of aria-pressed when rendered as a radio", () => {
    render(
      <div role="radiogroup" aria-label="Sort videos">
        <FilterChip role="radio" active>
          Latest
        </FilterChip>
        <FilterChip role="radio">Oldest</FilterChip>
      </div>,
    );

    const latest = screen.getByRole("radio", { name: "Latest" });
    expect(latest).toHaveAttribute("aria-checked", "true");
    expect(latest).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("radio", { name: "Oldest" })).toHaveAttribute("aria-checked", "false");
  });

  it("reports clicks to the parent without toggling itself", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FilterChip onClick={onClick}>Popular</FilterChip>);
    const chip = screen.getByRole("button", { name: "Popular" });

    await user.click(chip);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FilterChip disabled onClick={onClick}>
        Popular
      </FilterChip>,
    );

    await user.click(screen.getByRole("button", { name: "Popular" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a leading icon next to the label", () => {
    render(
      <FilterChip>
        <svg data-testid="chip-icon" aria-hidden="true" />
        Filter
      </FilterChip>,
    );

    expect(screen.getByRole("button", { name: "Filter" })).toContainElement(
      screen.getByTestId("chip-icon"),
    );
  });

  it("merges a custom className with the variant classes", () => {
    render(<FilterChip className="min-w-20">Oldest</FilterChip>);
    expect(screen.getByRole("button", { name: "Oldest" })).toHaveClass("min-w-20", "h-9");
  });

  it("exports variants that differ per state", () => {
    expect(filterChipVariants({ state: "active" })).toContain("bg-secondary");
    expect(filterChipVariants({ state: "default" })).toContain("bg-transparent");
    expect(filterChipVariants()).toBe(filterChipVariants({ state: "default" }));
  });
});
