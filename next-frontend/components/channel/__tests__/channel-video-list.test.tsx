// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildTechMasteryCards } from "@/mocks/factories/videos"

import { ChannelVideoList } from "../channel-video-list"

const { params, router } = vi.hoisted(() => ({
  params: { current: new URLSearchParams() },
  router: { push: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/channel/tech_mastery",
  useSearchParams: () => params.current,
}))

const cards = buildTechMasteryCards()
const fetchMock = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChannelVideoList — infinite scroll", () => {
  it("fetches the next page from the channel BFF keeping the order, without touching the URL", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("sort=popular")
    fetchMock.mockResolvedValue(Response.json({ items: cards.slice(20), next_cursor: null }))
    render(
      <ChannelVideoList
        nickname="tech_mastery"
        initial={{ items: cards.slice(0, 20), next_cursor: "offset-20" }}
        sort="popular"
      />
    )
    expect(screen.getAllByRole("article")).toHaveLength(20)

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/channels/tech_mastery/videos?sort=popular&cursor=offset-20"
    )
    expect(await screen.findAllByRole("article")).toHaveLength(24)
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("starts over on the first page of a new order when remounted with its key", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("sort=latest")
    fetchMock.mockResolvedValue(Response.json({ items: cards.slice(20), next_cursor: null }))
    const { rerender } = render(
      <ChannelVideoList
        key="latest"
        nickname="tech_mastery"
        initial={{ items: cards.slice(0, 20), next_cursor: "offset-20" }}
        sort="latest"
      />
    )
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findAllByRole("article")).toHaveLength(24)

    const popular = [...cards].reverse()
    params.current = new URLSearchParams("sort=popular")
    rerender(
      <ChannelVideoList
        key="popular"
        nickname="tech_mastery"
        initial={{ items: popular.slice(0, 20), next_cursor: "offset-20" }}
        sort="popular"
      />
    )

    const articles = screen.getAllByRole("article")
    expect(articles).toHaveLength(20)
    expect(articles[0]).toHaveTextContent(popular[0].title)
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument()
  })

  it("keeps the cards and offers a retry when the next page fails", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    render(
      <ChannelVideoList
        nickname="tech_mastery"
        initial={{ items: cards.slice(0, 20), next_cursor: "offset-20" }}
        sort="latest"
      />
    )

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load more videos.")
    expect(screen.getAllByRole("article")).toHaveLength(20)
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument()
  })
})
