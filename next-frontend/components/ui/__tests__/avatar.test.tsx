// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Avatar, AvatarFallback, AvatarImage } from "../avatar";

// jsdom never loads images, so Radix keeps AvatarImage unmounted. FakeImage
// reports a successful load so the image branch can be asserted.
class FakeImage {
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = "";
  crossOrigin: string | null = null;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(type: string, cb: () => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  removeEventListener(type: string, cb: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== cb);
  }

  set src(_value: string) {
    setTimeout(() => {
      this.complete = true;
      this.naturalWidth = 1;
      this.onload?.();
      (this.listeners.load ?? []).forEach((cb) => cb());
    }, 0);
  }
}

describe("Avatar", () => {
  it("renders the fallback initials with data-slot while the image is not loaded", () => {
    render(
      <Avatar>
        <AvatarImage src="/missing.png" alt="Tech Mastery" />
        <AvatarFallback>TM</AvatarFallback>
      </Avatar>,
    );

    const fallback = screen.getByText("TM");
    expect(fallback).toHaveAttribute("data-slot", "avatar-fallback");
    expect(fallback.closest('[data-slot="avatar"]')).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("exposes the size through data-size (default and explicit)", () => {
    const { container, rerender } = render(
      <Avatar>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveAttribute("data-size", "default");

    rerender(
      <Avatar size="lg">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveAttribute("data-size", "lg");
  });

  describe("when the image loads", () => {
    beforeEach(() => {
      vi.stubGlobal("Image", FakeImage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("renders the image with its alt text instead of the fallback", async () => {
      render(
        <Avatar>
          <AvatarImage src="/avatar.png" alt="Tech Mastery" />
          <AvatarFallback>TM</AvatarFallback>
        </Avatar>,
      );

      const img = await screen.findByRole("img", { name: "Tech Mastery" });
      expect(img).toHaveAttribute("data-slot", "avatar-image");
      expect(img).toHaveAttribute("src", "/avatar.png");
      expect(screen.queryByText("TM")).not.toBeInTheDocument();
    });
  });
});
