// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Slider } from "../slider";

// jsdom has no ResizeObserver; Radix Slider measures the thumb with it.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("Slider", () => {
  it("renders the root, track, range and one thumb with data-slot anchors", () => {
    const { container } = render(<Slider defaultValue={[30]} />);

    expect(container.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="slider-track"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="slider-range"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(1);
  });

  it("exposes the thumb as a slider with its value and bounds", () => {
    render(<Slider defaultValue={[30]} min={0} max={200} />);

    const thumb = screen.getByRole("slider");
    expect(thumb).toHaveAttribute("aria-valuenow", "30");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "200");
  });

  it("changes the value with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Slider defaultValue={[50]} min={0} max={100} step={1} onValueChange={onValueChange} />);

    const thumb = screen.getByRole("slider");
    thumb.focus();

    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith([51]);

    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith([0]);

    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith([100]);
    expect(thumb).toHaveAttribute("aria-valuenow", "100");
  });

  it("reflects a controlled value", () => {
    const { rerender } = render(<Slider value={[10]} max={60} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "10");

    rerender(<Slider value={[42]} max={60} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "42");
  });

  it("names each thumb and announces a custom value text", () => {
    render(<Slider defaultValue={[20]} max={296} thumbLabel="Seek" thumbValueText="0:20 of 4:56" />);

    const thumb = screen.getByRole("slider", { name: "Seek" });
    expect(thumb).toHaveAttribute("aria-valuetext", "0:20 of 4:56");
  });

  it("marks the root as disabled", () => {
    const { container } = render(<Slider defaultValue={[10]} disabled />);
    expect(container.querySelector('[data-slot="slider"]')).toHaveAttribute("data-disabled");
  });
});
