// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NavDrawer } from "../nav-drawer"
import { NavStateProvider, useNavState, type NavMode } from "../nav-state-provider"

const { navigation } = vi.hoisted(() => ({ navigation: { pathname: "/" } }))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}))

function mockViewport(lgUp: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({ matches: lgUp, media: query }))
  )
}

function Probe() {
  const nav = useNavState()
  return (
    <>
      <button type="button" aria-label="Menu" onClick={nav?.toggle}>
        ≡
      </button>
      <output aria-label="mode">{nav?.mode}</output>
      <output aria-label="drawer">{nav?.drawerOpen ? "open" : "closed"}</output>
      <button type="button" onClick={nav?.closeDrawer}>
        close from outside
      </button>
    </>
  )
}

function renderNav(initialMode: NavMode = "expanded") {
  return render(
    <NavStateProvider initialMode={initialMode}>
      <Probe />
      <NavDrawer>
        <button type="button">Home</button>
      </NavDrawer>
    </NavStateProvider>
  )
}

const mode = () => screen.getByRole("status", { name: "mode", hidden: true })
const drawer = () => screen.getByRole("status", { name: "drawer", hidden: true })

beforeEach(() => {
  navigation.pathname = "/"
  document.cookie = "side_nav=; path=/; max-age=0"
  vi.unstubAllGlobals()
})

describe("NavStateProvider", () => {
  it("starts in the mode read from the cookie by the RSC", () => {
    mockViewport(true)
    renderNav("mini")

    expect(mode()).toHaveTextContent("mini")
    expect(drawer()).toHaveTextContent("closed")
  })

  it("on lg+, toggle switches expanded/mini and writes, then expires, the side_nav cookie", async () => {
    const user = userEvent.setup()
    mockViewport(true)
    renderNav()

    await user.click(screen.getByRole("button", { name: "Menu" }))
    expect(mode()).toHaveTextContent("mini")
    expect(document.cookie).toContain("side_nav=mini")
    expect(drawer()).toHaveTextContent("closed")

    await user.click(screen.getByRole("button", { name: "Menu" }))
    expect(mode()).toHaveTextContent("expanded")
    expect(document.cookie).not.toContain("side_nav")
  })

  it("below lg, toggle opens the drawer and keeps the column mode and cookie", async () => {
    const user = userEvent.setup()
    mockViewport(false)
    renderNav()

    await user.click(screen.getByRole("button", { name: "Menu" }))

    expect(drawer()).toHaveTextContent("open")
    expect(mode()).toHaveTextContent("expanded")
    expect(document.cookie).not.toContain("side_nav")
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument()
  })

  it("on the watch page, toggle always opens the drawer — even on lg+", async () => {
    const user = userEvent.setup()
    mockViewport(true)
    navigation.pathname = "/watch/abc"
    renderNav()

    await user.click(screen.getByRole("button", { name: "Menu" }))

    expect(drawer()).toHaveTextContent("open")
    expect(mode()).toHaveTextContent("expanded")
  })

  it("Esc closes the drawer and returns the focus to ≡", async () => {
    const user = userEvent.setup()
    mockViewport(false)
    renderNav()
    const menu = screen.getByRole("button", { name: "Menu" })
    await user.click(menu)
    await screen.findByRole("dialog", { name: "Navigation" })

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(drawer()).toHaveTextContent("closed")
    expect(menu).toHaveFocus()
  })

  it("closeDrawer closes it from anywhere", async () => {
    mockViewport(false)
    renderNav()
    await userEvent.setup().click(screen.getByRole("button", { name: "Menu" }))
    await screen.findByRole("dialog", { name: "Navigation" })

    // The modal hides the rest of the page from pointer events; call the action through the probe.
    screen.getByRole("button", { name: "close from outside", hidden: true }).click()

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(drawer()).toHaveTextContent("closed")
  })
})
