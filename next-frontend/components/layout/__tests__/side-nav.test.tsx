// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { SideNav } from "../side-nav";
import { SideNavItem } from "../side-nav-item";

const icon = <svg data-testid="icon" />;

function renderNav(subscriptions?: ReactNode) {
  return render(
    <SideNav
      mainItems={
        <>
          <SideNavItem href="/" label="Home" icon={icon} />
          <SideNavItem href="/feed/subscriptions" label="Subscriptions" icon={icon} />
        </>
      }
      youItems={<SideNavItem href="/studio/videos" label="Your videos" icon={icon} />}
      subscriptions={subscriptions}
    />,
  );
}

describe("SideNav", () => {
  it("is the Main navigation landmark with the main group and the You section", () => {
    renderNav();

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Subscriptions" })).toHaveAttribute(
      "href",
      "/feed/subscriptions",
    );

    const you = within(nav).getByRole("region", { name: "You" });
    expect(within(you).getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "href",
      "/studio/videos",
    );
  });

  it("does not offer Liked videos (no capability in phase 06)", () => {
    renderNav();
    expect(screen.queryByRole("link", { name: /liked videos/i })).not.toBeInTheDocument();
  });

  it("renders the subscriptions slot after a divider when provided", () => {
    const { container } = renderNav(<section aria-label="Subscriptions list">channels</section>);

    expect(screen.getByRole("region", { name: "Subscriptions list" })).toHaveTextContent("channels");
    expect(container.querySelectorAll("[data-slot='separator']")).toHaveLength(2);
  });

  it("omits the subscriptions section and its divider when there is nothing to show", () => {
    const { container } = renderNav();

    expect(screen.queryByRole("region", { name: "Subscriptions list" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-slot='separator']")).toHaveLength(1);
  });
});
