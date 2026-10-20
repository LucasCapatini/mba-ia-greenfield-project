// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { InfiniteScrollSentinel } from "../infinite-scroll-sentinel"

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void

const observers: Array<{ callback: ObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = []

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn()
      constructor(callback: ObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect })
      }
      observe() {}
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("<InfiniteScrollSentinel />", () => {
  it("asks for the next page when it scrolls into view, not before", () => {
    const loadMore = vi.fn()
    render(<InfiniteScrollSentinel nextCursor="c-20" status="idle" loadMore={loadMore} />)

    act(() => observers[0].callback([{ isIntersecting: false }]))
    expect(loadMore).not.toHaveBeenCalled()

    act(() => observers[0].callback([{ isIntersecting: true }]))
    expect(loadMore).toHaveBeenCalledOnce()
  })

  it("offers Load more as a keyboard-reachable fallback", async () => {
    const user = userEvent.setup()
    const loadMore = vi.fn()
    render(<InfiniteScrollSentinel nextCursor="c-20" status="idle" loadMore={loadMore} />)

    await user.tab()
    expect(screen.getByRole("button", { name: "Load more" })).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(loadMore).toHaveBeenCalledOnce()
  })

  it("shows the spinner while loading, without the button", () => {
    render(<InfiniteScrollSentinel nextCursor="c-20" status="loading" loadMore={vi.fn()} />)

    expect(screen.getByRole("status", { name: "Loading more videos" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows an inline error with Load more as the retry and stops observing", () => {
    render(<InfiniteScrollSentinel nextCursor="c-20" status="error" loadMore={vi.fn()} />)

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load more videos.")
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument()
    expect(observers).toHaveLength(0)
  })

  it("renders nothing and disconnects once the listing is over", () => {
    const { container, rerender } = render(
      <InfiniteScrollSentinel nextCursor="c-20" status="idle" loadMore={vi.fn()} />
    )

    rerender(<InfiniteScrollSentinel nextCursor={null} status="idle" loadMore={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })
})
