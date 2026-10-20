// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PlayerControls, type PlayerControlsProps } from "../player-controls";

// jsdom has no ResizeObserver; Radix Slider measures the thumb with it.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function renderControls(overrides: Partial<PlayerControlsProps> = {}) {
  const props: PlayerControlsProps = {
    paused: true,
    muted: false,
    volume: 0.8,
    currentTime: 20,
    duration: 296,
    buffered: 148,
    fullscreen: false,
    onTogglePlay: vi.fn(),
    onToggleMute: vi.fn(),
    onVolumeChange: vi.fn(),
    onSeek: vi.fn(),
    onToggleFullscreen: vi.fn(),
    ...overrides,
  };
  render(<PlayerControls {...props} />);
  return props;
}

describe("PlayerControls", () => {
  it("renders only the capability controls and the formatted time", () => {
    renderControls();

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter full screen" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("0:20 / 4:56")).toBeInTheDocument();
  });

  it("announces the seek position and the volume level", () => {
    renderControls();

    const seek = screen.getByRole("slider", { name: "Seek" });
    expect(seek).toHaveAttribute("aria-valuenow", "20");
    expect(seek).toHaveAttribute("aria-valuemax", "296");
    expect(seek).toHaveAttribute("aria-valuetext", "0:20 of 4:56");
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuetext", "80%");
  });

  it("switches the button labels with the media state", () => {
    renderControls({ paused: false, muted: true, fullscreen: true });

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("calls the toggle callbacks on click", async () => {
    const user = userEvent.setup();
    const props = renderControls();

    await user.click(screen.getByRole("button", { name: "Play" }));
    await user.click(screen.getByRole("button", { name: "Mute" }));
    await user.click(screen.getByRole("button", { name: "Enter full screen" }));

    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(props.onToggleMute).toHaveBeenCalledTimes(1);
    expect(props.onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("seeks and changes the volume from the keyboard", async () => {
    const user = userEvent.setup();
    const props = renderControls();

    screen.getByRole("slider", { name: "Seek" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(props.onSeek).toHaveBeenLastCalledWith(21);
    await user.keyboard("{End}");
    expect(props.onSeek).toHaveBeenLastCalledWith(296);

    screen.getByRole("slider", { name: "Volume" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(props.onVolumeChange).toHaveBeenLastCalledWith(0.75);
  });

  it("disables seeking until the duration is known", () => {
    renderControls({ duration: 0, currentTime: 0 });

    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("data-disabled");
    expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument();
  });
});
