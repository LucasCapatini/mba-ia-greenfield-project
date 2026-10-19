// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildTechMasteryCards } from "@/mocks/factories/videos"

import { ChannelLoadMore } from "../channel-load-more"
import { ChannelVideoList } from "../channel-video-list"

const { replaceMock, params, router } = vi.hoisted(() => {
  const replaceMock = vi.fn()
  return { replaceMock, params: { current: new URLSearchParams() }, router: { replace: replaceMock } }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/channel/tech_mastery",
  useSearchParams: () => params.current,
}))

const cards = buildTechMasteryCards()

beforeEach(() => {
  replaceMock.mockClear()
})

describe("ChannelLoadMore", () => {
  it("asks for the next page keeping the order", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("sort=popular")
    render(<ChannelLoadMore nextCursor="offset-20" />)

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(replaceMock).toHaveBeenCalledWith(
      "/channel/tech_mastery?sort=popular&cursor=offset-20",
      { scroll: false }
    )
  })

  it("is hidden when there is no next page", () => {
    render(<ChannelLoadMore nextCursor={null} />)

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})

describe("ChannelVideoList — accumulated pages", () => {
  it("appends the next page while the order stays the same, then starts over on a new order", () => {
    const { rerender } = render(
      <ChannelVideoList items={cards.slice(0, 20)} cursor={null} nextCursor="offset-20" sort="latest" />
    )
    expect(screen.getAllByRole("article")).toHaveLength(20)

    rerender(
      <ChannelVideoList items={cards.slice(20)} cursor="offset-20" nextCursor={null} sort="latest" />
    )
    expect(screen.getAllByRole("article")).toHaveLength(24)
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()

    rerender(
      <ChannelVideoList items={cards.slice(0, 20)} cursor={null} nextCursor="offset-20" sort="popular" />
    )
    expect(screen.getAllByRole("article")).toHaveLength(20)
  })
})
