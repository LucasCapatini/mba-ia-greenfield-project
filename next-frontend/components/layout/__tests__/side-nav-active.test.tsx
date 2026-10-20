// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SessionProvider, type SessionState } from "@/components/auth/session-provider"
import { NavStateProvider, useNavState, type NavMode } from "@/components/layout/nav-state-provider"
import { SubscriptionsProvider } from "@/components/layout/subscriptions-provider"

import { SideNavActive, activeSideNavItem } from "../side-nav-active"

const { navigation } = vi.hoisted(() => ({ navigation: { pathname: "/", search: "" } }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

const anonymous: SessionState = {
  userId: "",
  email: "",
  channelSlug: "",
  channelName: "",
  isLoggedIn: false,
}

const authenticated: SessionState = {
  userId: "user-1",
  email: "alice@example.com",
  channelSlug: "alice_ch",
  channelName: "Alice Channel",
  isLoggedIn: true,
}

const channelsList = <section aria-label="Followed channels">channels</section>

function renderMenu(
  session: SessionState,
  ui: ReactNode,
  { initialMode = "expanded", subscriptions = true }: { initialMode?: NavMode; subscriptions?: boolean } = {}
) {
  const content = subscriptions ? (
    <SubscriptionsProvider initial={{ items: [], next_cursor: null }}>{ui}</SubscriptionsProvider>
  ) : (
    ui
  )
  return render(
    <SessionProvider initialSession={session}>
      <NavStateProvider initialMode={initialMode}>{content}</NavStateProvider>
    </SessionProvider>
  )
}

beforeEach(() => {
  navigation.pathname = "/"
  navigation.search = ""
})

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

describe("<SideNavActive /> — with a session", () => {
  it.each([
    ["/", "Home"],
    ["/feed/subscriptions", "Subscriptions"],
    ["/studio/videos", "Your videos"],
  ])("marks the item of %s with aria-current=page", (path, label) => {
    navigation.pathname = path
    renderMenu(authenticated, <SideNavActive />)

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page")
    const others = screen.getAllByRole("link").filter((link) => link.textContent !== label)
    for (const link of others) {
      expect(link).not.toHaveAttribute("aria-current")
    }
  })

  it("renders Home, Subscriptions, Your videos and the followed channels, without Liked videos", () => {
    navigation.pathname = "/channel/tech_mastery"
    renderMenu(authenticated, <SideNavActive subscriptions={channelsList} />)

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(within(nav).getByRole("link", { name: "Subscriptions" })).toHaveAttribute(
      "href",
      "/feed/subscriptions"
    )
    expect(within(nav).getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "href",
      "/studio/videos"
    )
    expect(within(nav).getByRole("region", { name: "Followed channels" })).toBeInTheDocument()
    expect(within(nav).queryByRole("link", { name: "Liked videos" })).not.toBeInTheDocument()
    expect(within(nav).queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument()
  })

  it("omits the channels section when the layout read failed", () => {
    render(
      <SessionProvider initialSession={authenticated}>
        <SubscriptionsProvider initial={null}>
          <SideNavActive subscriptions={channelsList} />
        </SubscriptionsProvider>
      </SessionProvider>
    )

    expect(screen.queryByRole("region", { name: "Followed channels" })).not.toBeInTheDocument()
  })

  it("in mini mode shows only Home, Subscriptions and You as icon + short label", () => {
    navigation.pathname = "/studio/videos"
    renderMenu(authenticated, <SideNavActive subscriptions={channelsList} />, { initialMode: "mini" })

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Home",
      "Subscriptions",
      "You",
    ])
    expect(within(nav).getByRole("link", { name: "You" })).toHaveAttribute("aria-current", "page")
    expect(within(nav).queryByRole("region", { name: "Followed channels" })).not.toBeInTheDocument()
  })

  it("in the drawer renders the full menu even when the column is mini", () => {
    renderMenu(authenticated, <SideNavActive mode="drawer" subscriptions={channelsList} />, {
      initialMode: "mini",
    })

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(nav).toHaveAttribute("data-mode", "drawer")
    expect(within(nav).getByRole("link", { name: "Your videos" })).toBeInTheDocument()
    expect(within(nav).getByRole("region", { name: "Followed channels" })).toBeInTheDocument()
  })

  it("closes the drawer when a link is followed, even the current route", async () => {
    const user = userEvent.setup()
    function DrawerProbe() {
      const nav = useNavState()
      return (
        <>
          <button type="button" onClick={() => nav?.setDrawerOpen(true)}>
            open
          </button>
          <output>{nav?.drawerOpen ? "open" : "closed"}</output>
        </>
      )
    }
    renderMenu(
      authenticated,
      <>
        <DrawerProbe />
        <SideNavActive mode="drawer" />
      </>
    )
    await user.click(screen.getByRole("button", { name: "open" }))
    expect(screen.getByRole("status")).toHaveTextContent("open")

    await user.click(screen.getByRole("link", { name: "Home" }))

    expect(screen.getByRole("status")).toHaveTextContent("closed")
  })
})

describe("<SideNavActive /> — anonymous visitor", () => {
  it("shows only Home and the invitation to sign in back to the current page", () => {
    navigation.pathname = "/channel/tech_mastery"
    navigation.search = "sort=popular"
    renderMenu(anonymous, <SideNavActive subscriptions={channelsList} />, { subscriptions: false })

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(within(nav).getByText("Sign in to see your subscriptions")).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=/channel/tech_mastery%3Fsort%3Dpopular"
    )
    expect(within(nav).queryByRole("link", { name: "Subscriptions" })).not.toBeInTheDocument()
    expect(within(nav).queryByRole("link", { name: "Your videos" })).not.toBeInTheDocument()
    expect(within(nav).queryByRole("region", { name: "Followed channels" })).not.toBeInTheDocument()
  })

  it("marks Home as current on /", () => {
    renderMenu(anonymous, <SideNavActive />, { subscriptions: false })

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")
  })

  it("in mini mode shows only Home", () => {
    renderMenu(anonymous, <SideNavActive />, { initialMode: "mini", subscriptions: false })

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home"])
  })
})
