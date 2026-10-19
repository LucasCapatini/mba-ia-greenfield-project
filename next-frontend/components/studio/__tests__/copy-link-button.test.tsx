// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyLinkButton } from "../copy-link-button";

const URL_TO_COPY = "https://streamtube.com/watch/tech2024abc";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  });
}

describe("CopyLinkButton", () => {
  it("renders an icon-only button labelled Copy link with an empty live region", () => {
    render(<CopyLinkButton url={URL_TO_COPY} />);

    expect(screen.getByRole("button", { name: "Copy link" })).toHaveAttribute("type", "button");
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });

  it("writes the URL to the clipboard and announces Copied", async () => {
    render(<CopyLinkButton url={URL_TO_COPY} />);

    await clickCopy();

    expect(writeText).toHaveBeenCalledWith(URL_TO_COPY);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(
      screen.getByRole("button", { name: "Copy link" }).closest('[data-slot="copy-link-button"]'),
    ).toHaveAttribute(
      "data-state",
      "copied",
    );
  });

  it("clears the feedback after 2 seconds", async () => {
    render(<CopyLinkButton url={URL_TO_COPY} />);
    await clickCopy();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("restarts the 2-second window on a second click", async () => {
    render(<CopyLinkButton url={URL_TO_COPY} />);
    await clickCopy();
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    await clickCopy();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("reports a failure when the clipboard rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<CopyLinkButton url={URL_TO_COPY} />);

    await clickCopy();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Couldn't copy");
    expect(status).toHaveClass("text-destructive");
  });

  it("reports a failure when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<CopyLinkButton url={URL_TO_COPY} />);

    await clickCopy();

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy");
  });

  it("clears the pending timer on unmount", async () => {
    const { unmount } = render(<CopyLinkButton url={URL_TO_COPY} />);
    await clickCopy();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
