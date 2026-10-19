// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChannelVideoSort } from "../channel-video-sort"

const { replaceMock, params, router } = vi.hoisted(() => {
  const replaceMock = vi.fn()
  return { replaceMock, params: { current: new URLSearchParams() }, router: { replace: replaceMock } }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/channel/tech_mastery",
  useSearchParams: () => params.current,
}))

beforeEach(() => {
  replaceMock.mockClear()
})

describe("ChannelVideoSort — URL wiring", () => {
  it("marks the chip from `?sort=` as active", () => {
    params.current = new URLSearchParams("sort=popular")
    render(<ChannelVideoSort />)

    expect(screen.getByRole("radio", { name: "Popular" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: "Latest" })).toHaveAttribute("aria-checked", "false")
  })

  it("falls back to Latest for an unknown `?sort=`", () => {
    params.current = new URLSearchParams("sort=invalido")
    render(<ChannelVideoSort />)

    expect(screen.getByRole("radio", { name: "Latest" })).toHaveAttribute("aria-checked", "true")
  })

  it("writes the new order and drops the cursor of the previous order", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("sort=latest&cursor=offset-20")
    render(<ChannelVideoSort />)

    await user.click(screen.getByRole("radio", { name: "Popular" }))

    expect(replaceMock).toHaveBeenCalledWith("/channel/tech_mastery?sort=popular", {
      scroll: false,
    })
  })
})
