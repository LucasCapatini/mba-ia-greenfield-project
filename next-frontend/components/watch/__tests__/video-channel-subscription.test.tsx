// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import { VideoChannelSubscription } from "../video-channel-subscription"

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const CHANNEL = {
  nickname: "tech_mastery",
  name: "Tech Mastery",
  subscriber_count: 9_880,
  viewer_subscribed: false,
}

function renderRow(props: { isLoggedIn?: boolean; isOwner?: boolean } = {}) {
  return render(
    <VideoChannelSubscription
      channel={CHANNEL}
      isLoggedIn={props.isLoggedIn ?? true}
      isOwner={props.isOwner ?? false}
    />
  )
}

beforeEach(() => {
  router.push.mockReset()
})

describe("<VideoChannelSubscription />", () => {
  it("shows the channel with the subscriber count from the RSC", () => {
    renderRow()

    expect(screen.getByRole("link", { name: /Tech Mastery/ })).toHaveAttribute(
      "href",
      "/channel/tech_mastery"
    )
    expect(screen.getByText("9.9K subscribers")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Subscribe" })).toHaveAttribute("aria-pressed", "false")
  })

  it("shows the subscriber_count returned after subscribing", async () => {
    const user = userEvent.setup()
    server.use(
      http.put("/api/channels/:nickname/subscription", () =>
        HttpResponse.json({ subscribed: true, subscriber_count: 12_500 })
      )
    )
    renderRow()

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    expect(await screen.findByText("12.5K subscribers")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Subscribed" })).toHaveAttribute("aria-pressed", "true")
  })

  it("hides the button for the channel owner but keeps the count", () => {
    renderRow({ isOwner: true })

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText("9.9K subscribers")).toBeInTheDocument()
  })

  it("sends an anonymous visitor to login with returnTo", async () => {
    const user = userEvent.setup()
    renderRow({ isLoggedIn: false })

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    expect(router.push).toHaveBeenCalledWith("/login?returnTo=/watch/tech-01")
  })
})
