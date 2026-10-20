// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SideNavItem } from "../side-nav-item";

describe("SideNavItem", () => {
  it("links to its destination with the label as accessible name", () => {
    render(
      <ul>
        <SideNavItem href="/feed/subscriptions" label="Subscriptions" icon={<svg />} />
      </ul>,
    );

    const link = screen.getByRole("link", { name: "Subscriptions" });
    expect(link).toHaveAttribute("href", "/feed/subscriptions");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks the current route with aria-current=page", () => {
    render(
      <ul>
        <SideNavItem href="/" label="Home" icon={<svg />} active />
      </ul>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("renders as a list item so it can sit inside the nav lists", () => {
    render(
      <ul>
        <SideNavItem href="/" label="Home" icon={<svg />} />
      </ul>,
    );

    expect(screen.getByRole("listitem")).toContainElement(screen.getByRole("link", { name: "Home" }));
  });

  it.each(["row", "column"] as const)("marks the current route in the %s layout (expanded and mini)", (layout) => {
    render(
      <ul>
        <SideNavItem href="/" label="Home" icon={<svg />} active layout={layout} />
        <SideNavItem href="/feed/subscriptions" label="Subscriptions" icon={<svg />} layout={layout} />
      </ul>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Subscriptions" })).not.toHaveAttribute("aria-current");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveAttribute("data-layout", layout);
    }
  });
});
