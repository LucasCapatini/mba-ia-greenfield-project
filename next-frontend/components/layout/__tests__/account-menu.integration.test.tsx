// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import { AccountMenu } from "../account-menu"

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

beforeEach(() => {
  router.push.mockClear()
  router.refresh.mockClear()
})

async function openMenu() {
  const user = userEvent.setup()
  render(<AccountMenu channelName="Studio Canal" channelSlug="studio_canal" />)
  await user.click(screen.getByRole("button", { name: "Account" }))
  return { user, panel: await screen.findByRole("dialog", { name: "Account" }) }
}

describe("<AccountMenu />", () => {
  it("shows the session channel with its public page and the Edit Channel shortcut", async () => {
    const { panel } = await openMenu()

    expect(within(panel).getByText("Studio Canal")).toBeInTheDocument()
    expect(within(panel).getByRole("link", { name: "@studio_canal" })).toHaveAttribute(
      "href",
      "/channel/studio_canal"
    )
    expect(within(panel).getByRole("link", { name: "Edit Channel" })).toHaveAttribute(
      "href",
      "/studio/channel"
    )
  })

  it("Sign Out calls the BFF logout, then goes home and refreshes the RSC tree", async () => {
    const calls: string[] = []
    server.use(
      http.post("/api/auth/logout", ({ request }) => {
        calls.push(request.method)
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { user, panel } = await openMenu()

    await user.click(within(panel).getByRole("button", { name: "Sign Out" }))

    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(calls).toEqual(["POST"])
    expect(router.push).toHaveBeenCalledWith("/")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("Esc closes the panel and returns focus to the avatar", async () => {
    const { user } = await openMenu()

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus()
  })

  it("falls back to the nickname when the session has no channel name", async () => {
    const user = userEvent.setup()
    render(<AccountMenu channelName="" channelSlug="studio_canal" />)
    await user.click(screen.getByRole("button", { name: "Account" }))

    const panel = await screen.findByRole("dialog", { name: "Account" })
    expect(within(panel).getByText("studio_canal")).toBeInTheDocument()
  })
})
