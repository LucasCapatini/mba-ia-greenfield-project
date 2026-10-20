// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SessionProvider } from "@/components/auth/session-provider"
import type { SessionState } from "@/components/auth/session-provider"
import { NavStateProvider } from "@/components/layout/nav-state-provider"

import { AppHeader } from "../app-header"

const { navigation, router } = vi.hoisted(() => ({
  navigation: { pathname: "/", search: "" },
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
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

function mockViewport(lgUp: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: lgUp,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

function renderHeader(session: SessionState, initialMode: "expanded" | "mini" = "expanded") {
  return render(
    <SessionProvider initialSession={session}>
      <NavStateProvider initialMode={initialMode}>
        <AppHeader />
      </NavStateProvider>
    </SessionProvider>
  )
}

beforeEach(() => {
  navigation.pathname = "/"
  navigation.search = ""
  document.cookie = "side_nav=; path=/; max-age=0"
  vi.unstubAllGlobals()
  mockViewport(true)
})

describe("<AppHeader />", () => {
  it("anonymous: shows menu, logo, search and Sign in back to the current page", () => {
    navigation.pathname = "/watch/abc"
    renderHeader(anonymous)

    const header = screen.getByRole("banner")
    expect(header).toHaveAttribute("data-session", "anonymous")
    expect(within(header).getByRole("button", { name: "Menu" })).toBeInTheDocument()
    expect(within(header).getByRole("link", { name: "StreamTube home" })).toHaveAttribute("href", "/")
    expect(within(header).getByRole("search", { name: "Search videos" })).toBeInTheDocument()
    expect(within(header).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=/watch/abc"
    )
    expect(within(header).queryByRole("button", { name: "Account" })).not.toBeInTheDocument()
    expect(within(header).queryByRole("link", { name: "Upload video" })).not.toBeInTheDocument()
  })

  it("anonymous: Sign in keeps the query string of the current page", () => {
    navigation.pathname = "/results"
    navigation.search = "q=lofi"
    renderHeader(anonymous)

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=/results%3Fq%3Dlofi"
    )
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("lofi")
  })

  it("authenticated: shows the upload shortcut and the avatar with the channel initials, no Portuguese labels", () => {
    renderHeader(authenticated)

    const header = screen.getByRole("banner")
    expect(header).toHaveAttribute("data-session", "authenticated")
    expect(within(header).getByRole("link", { name: "Upload video" })).toHaveAttribute(
      "href",
      "/studio/upload"
    )
    expect(within(header).getByRole("button", { name: "Account" })).toHaveTextContent("AC")
    expect(within(header).queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument()
    for (const text of ["Sair", "Entrar", "Meus vídeos", "Meu canal", "alice@example.com"]) {
      expect(header).not.toHaveTextContent(text)
    }
  })

  it("on lg+, ≡ toggles mini/expanded, reflects it in aria-expanded and persists the cookie", async () => {
    const user = userEvent.setup()
    renderHeader(authenticated)
    const menu = screen.getByRole("button", { name: "Menu" })
    expect(menu).toHaveAttribute("aria-expanded", "true")

    await user.click(menu)
    expect(menu).toHaveAttribute("aria-expanded", "false")
    expect(document.cookie).toContain("side_nav=mini")

    await user.click(menu)
    expect(menu).toHaveAttribute("aria-expanded", "true")
    expect(document.cookie).not.toContain("side_nav=mini")
  })

  it("below lg, ≡ opens the drawer instead of changing the column mode", async () => {
    const user = userEvent.setup()
    mockViewport(false)
    renderHeader(authenticated, "mini")
    const menu = screen.getByRole("button", { name: "Menu" })
    expect(menu).toHaveAttribute("aria-expanded", "false")

    await user.click(menu)

    expect(menu).toHaveAttribute("aria-expanded", "true")
    expect(document.cookie).not.toContain("side_nav=mini")
  })
})
