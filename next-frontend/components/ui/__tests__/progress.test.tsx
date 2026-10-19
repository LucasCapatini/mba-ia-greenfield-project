// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "../progress";

describe("Progress", () => {
  it("renders a progressbar with data-slot and the current value", () => {
    render(<Progress value={84} aria-label="Upload progress" />);

    const bar = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(bar).toHaveAttribute("data-slot", "progress");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "84");
    expect(bar).toHaveAttribute("data-state", "loading");
  });

  it("reports the complete state at 100", () => {
    render(<Progress value={100} aria-label="Upload progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-state", "complete");
  });

  it("is indeterminate without a value (no aria-valuenow)", () => {
    render(<Progress value={null} aria-label="Processing" />);

    const bar = screen.getByRole("progressbar", { name: "Processing" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-state", "indeterminate");
  });

  it("animates a partial indicator while indeterminate", () => {
    render(<Progress value={null} aria-label="Processing" />);
    const indicator = screen
      .getByRole("progressbar")
      .querySelector('[data-slot="progress-indicator"]');

    expect(indicator).toHaveClass("animate-progress-indeterminate", "w-1/3");
    expect(indicator).not.toHaveAttribute("style");
  });

  it("translates the indicator by the remaining percentage when determinate", () => {
    render(<Progress value={84} aria-label="Upload progress" />);
    const indicator = screen
      .getByRole("progressbar")
      .querySelector('[data-slot="progress-indicator"]');

    expect(indicator).toHaveStyle({ transform: "translateX(-16%)" });
    expect(indicator).not.toHaveClass("animate-progress-indeterminate");
  });

  it("renders the indicator inside the bar", () => {
    render(<Progress value={40} aria-label="Upload progress" />);
    const indicator = screen
      .getByRole("progressbar")
      .querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toBeInTheDocument();
  });
});
