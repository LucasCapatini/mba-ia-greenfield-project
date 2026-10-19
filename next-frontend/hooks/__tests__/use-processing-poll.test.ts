// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Video } from "@/lib/api/contracts"
import { server } from "@/mocks/server"

import { useProcessingPoll } from "../use-processing-poll"

const { refreshMock, router } = vi.hoisted(() => {
  const refreshMock = vi.fn()
  // Stable like the App Router instance: a new object per render would restart the effect.
  return { refreshMock, router: { refresh: refreshMock } }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

/** Answers `GET /api/videos/:id` with the next status queued for that id (default `ready`). */
function mockStatuses(queues: Record<string, string[]>) {
  const reads: string[] = []
  server.use(
    http.get("/api/videos/:publicId", ({ params }) => {
      const id = String(params.publicId)
      reads.push(id)
      return HttpResponse.json({ public_id: id, processing_status: queues[id]?.shift() ?? "ready" })
    })
  )
  return reads
}

beforeEach(() => {
  // Pure fake timers: with `shouldAdvanceTime` real time also moves the clock and the 3 s
  // boundary assertions get flaky under a loaded test run.
  vi.useFakeTimers()
  refreshMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useProcessingPoll", () => {
  it("schedules nothing when no id is in flight", async () => {
    const reads = mockStatuses({})
    renderHook(() => useProcessingPoll([]))

    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(reads).toHaveLength(0)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("polls every 3 s and refreshes exactly once when an id settles", async () => {
    const reads = mockStatuses({ a: ["processing", "processing", "ready"] })
    renderHook(() => useProcessingPoll(["a"]))

    await act(() => vi.advanceTimersByTimeAsync(2_999))
    expect(reads).toHaveLength(0)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(reads).toEqual(["a"])

    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(reads).toEqual(["a", "a", "a"])
    expect(refreshMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(reads).toHaveLength(3)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("refreshes once per id that settles (failed counts as terminal)", async () => {
    const reads = mockStatuses({ a: ["failed"], b: ["processing", "ready"] })
    renderHook(() => useProcessingPoll(["a", "b"]))

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(refreshMock).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(refreshMock).toHaveBeenCalledTimes(2)
    expect(reads).toEqual(["a", "b", "b"])
  })

  it("does not restart the timer for a new array with the same ids", async () => {
    const reads = mockStatuses({ a: ["processing", "processing", "processing"] })
    const { rerender } = renderHook(({ ids }) => useProcessingPoll(ids), {
      initialProps: { ids: ["a"] },
    })

    await act(() => vi.advanceTimersByTimeAsync(2_000))
    rerender({ ids: ["a"] })
    await act(() => vi.advanceTimersByTimeAsync(1_000))

    expect(reads).toEqual(["a"])
  })

  it("clears the timer on unmount", async () => {
    const reads = mockStatuses({ a: ["processing", "processing"] })
    const { unmount } = renderHook(() => useProcessingPoll(["a"]))

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(9_000))

    expect(reads).toEqual(["a"])
  })

  it("hands the settled video to onSettled once, before the refresh", async () => {
    mockStatuses({ a: ["processing", "ready"] })
    const order: string[] = []
    refreshMock.mockImplementationOnce(() => order.push("refresh"))
    const onSettled = vi.fn((video: Video) => {
      order.push(`settled:${video.public_id}:${video.processing_status}`)
    })
    renderHook(() => useProcessingPoll(["a"], onSettled))

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(onSettled).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(order).toEqual(["settled:a:ready", "refresh"])

    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it("hands a failed video to onSettled too", async () => {
    mockStatuses({ a: ["failed"] })
    const onSettled = vi.fn((video: Video) => video.processing_status)
    renderHook(() => useProcessingPoll(["a"], onSettled))

    await act(() => vi.advanceTimersByTimeAsync(3_000))

    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled.mock.results[0]?.value).toBe("failed")
  })

  it("does not restart the timer when onSettled changes identity, and calls the latest one", async () => {
    const reads = mockStatuses({ a: ["processing", "ready"] })
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onSettled }) => useProcessingPoll(["a"], onSettled), {
      initialProps: { onSettled: first },
    })

    await act(() => vi.advanceTimersByTimeAsync(2_000))
    rerender({ onSettled: second })
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    expect(reads).toEqual(["a"])

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})
