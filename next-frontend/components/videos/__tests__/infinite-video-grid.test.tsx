// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildTechMasteryCards } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { InfiniteVideoGrid } from "../infinite-video-grid"

const { navigation } = vi.hoisted(() => ({ navigation: { search: "" } }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

const cards = buildTechMasteryCards()

beforeEach(() => {
  navigation.search = ""
  sessionStorage.clear()
})

describe("<InfiniteVideoGrid />", () => {
  it("renders the RSC page as cards with the channel, followed by the sentinel", () => {
    render(
      <InfiniteVideoGrid
        aria-label="Videos"
        initial={{ items: cards.slice(0, 20), next_cursor: "c-20" }}
        endpoint="/api/videos"
      />
    )

    const grid = screen.getByRole("list", { name: "Videos" })
    expect(within(grid).getAllByRole("article")).toHaveLength(20)
    expect(within(grid).getAllByRole("link", { name: "Tech Mastery" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument()
  })

  it("appends the next page from the endpoint with the fixed query", async () => {
    const user = userEvent.setup()
    const urls: string[] = []
    server.use(
      http.get("/api/videos", ({ request }) => {
        urls.push(new URL(request.url).search)
        return HttpResponse.json({ items: cards.slice(20), next_cursor: null })
      })
    )
    render(
      <InfiniteVideoGrid
        aria-label="Videos"
        initial={{ items: cards.slice(0, 20), next_cursor: "c-20" }}
        endpoint="/api/videos"
        query={{ q: "mastery" }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(await screen.findAllByRole("article")).toHaveLength(24)
    expect(urls).toEqual(["?q=mastery&cursor=c-20"])
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("starts over with the new first page when remounted with another key", async () => {
    const user = userEvent.setup()
    server.use(http.get("/api/videos", () => HttpResponse.json({ items: cards.slice(20), next_cursor: null })))
    navigation.search = "category=technology"
    const { rerender } = render(
      <InfiniteVideoGrid
        key="technology"
        aria-label="Videos"
        initial={{ items: cards.slice(0, 20), next_cursor: "c-20" }}
        endpoint="/api/videos"
        query={{ category: "technology" }}
      />
    )
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findAllByRole("article")).toHaveLength(24)

    navigation.search = "category=music"
    rerender(
      <InfiniteVideoGrid
        key="music"
        aria-label="Videos"
        initial={{ items: cards.slice(0, 3), next_cursor: null }}
        endpoint="/api/videos"
        query={{ category: "music" }}
      />
    )

    expect(screen.getAllByRole("article")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})
