// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SideNavActive, activeSideNavItem } from "../side-nav-active"

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}))

describe("activeSideNavItem", () => {
  it.each([
    ["/", "home"],
    ["/feed/subscriptions", "subscriptions"],
    ["/studio/videos", "your-videos"],
    ["/studio/channel", "your-videos"],
    ["/studio/videos/abc/edit", "your-videos"],
    ["/channel/tech_mastery", null],
    ["/feedback", null],
  ])("maps %s to %s", (path, expected) => {
    expect(activeSideNavItem(path)).toBe(expected)
  })
})

describe("<SideNavActive />", () => {
  it.each([
    ["/", "Home"],
    ["/feed/subscriptions", "Subscriptions"],
    ["/studio/videos", "Your videos"],
  ])("marks the item of %s with aria-current=page", (path, label) => {
    pathname.current = path
    render(<SideNavActive />)

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page")
    const others = screen
      .getAllByRole("link")
      .filter((link) => link.textContent !== label)
    for (const link of others) {
      expect(link).not.toHaveAttribute("aria-current")
    }
  })

  it("renders Home, Subscriptions and Your videos without Liked videos", () => {
    pathname.current = "/channel/tech_mastery"
    render(<SideNavActive />)

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Subscriptions" })).toHaveAttribute(
      "href",
      "/feed/subscriptions"
    )
    expect(screen.getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "href",
      "/studio/videos"
    )
    expect(screen.queryByRole("link", { name: "Liked videos" })).not.toBeInTheDocument()
  })
})
