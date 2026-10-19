// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildUnprocessedVideo, buildVideo, toVideoListItem } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { OwnerVideoList } from "../owner-video-list"

const { router } = vi.hoisted(() => ({
  // Stable like the App Router instance. `refresh` is a no-op on purpose: the row must reflect the
  // poll result even when the router drops the refreshed RSC payload.
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/studio/videos",
  useSearchParams: () => new URLSearchParams(),
}))

const PUBLIC_ID = "settles-01"

function statusOf(container: HTMLElement): string | null | undefined {
  return container.querySelector(`li[data-public-id="${PUBLIC_ID}"] [data-slot='video-status']`)
    ?.textContent
}

beforeEach(() => {
  vi.useFakeTimers()
  router.refresh.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("<OwnerVideoList />", () => {
  it("patches a processing row from the poll result without a new RSC payload", async () => {
    const statuses = ["processing", "ready"]
    server.use(
      http.get("/api/videos/:publicId", () =>
        HttpResponse.json(
          buildVideo({
            public_id: PUBLIC_ID,
            status: "draft",
            processing_status: (statuses.shift() ?? "ready") as "processing" | "ready",
          })
        )
      )
    )
    const item = toVideoListItem(
      buildUnprocessedVideo("processing", { public_id: PUBLIC_ID, status: "draft" })
    )

    const { container } = render(
      <OwnerVideoList items={[item]} cursor={null} nextCursor={null} resetKey="all" />
    )
    expect(statusOf(container)).toBe("Processing")

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(statusOf(container)).toBe("Processing")
    expect(router.refresh).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(statusOf(container)).toBe("Draft")
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })
})
