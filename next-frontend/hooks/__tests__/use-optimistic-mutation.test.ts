// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import {
  GENERIC_ERROR_MESSAGE,
  TOO_MANY_MESSAGE,
  useOptimisticMutation,
} from "../use-optimistic-mutation"

const { router, toastError } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

type State = { value: string; count: number }

const PROBE_URL = "/api/optimistic-probe"
const INITIAL: State = { value: "initial", count: 1 }

/** Resposta segurada até `release()` — o estado otimista fica observável antes do servidor. */
function gatedRoute(respond: () => Response) {
  let release!: () => void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.put(PROBE_URL, async () => {
      await opened
      return respond()
    })
  )
  return release
}

const send = () => fetch(PROBE_URL, { method: "PUT" })

beforeEach(() => {
  router.push.mockReset()
  toastError.mockReset()
})

describe("useOptimisticMutation", () => {
  it("shows the optimistic state at once and reconciles with the 200 body", async () => {
    const onConfirmed = vi.fn()
    const release = gatedRoute(() => HttpResponse.json({ value: "server", count: 7 }))
    const { result } = renderHook(() => useOptimisticMutation<State>(INITIAL, { onConfirmed }))

    act(() => {
      result.current.run({ value: "optimistic", count: 2 }, send)
    })

    expect(result.current.shown).toEqual({ value: "optimistic", count: 2 })
    expect(result.current.confirmed).toEqual(INITIAL)

    await act(async () => {
      release()
    })
    // A resposta vence o palpite otimista: a contagem é a do servidor.
    await waitFor(() => expect(result.current.shown).toEqual({ value: "server", count: 7 }))
    expect(result.current.confirmed).toEqual({ value: "server", count: 7 })
    expect(onConfirmed).toHaveBeenCalledWith({ value: "server", count: 7 })
    expect(toastError).not.toHaveBeenCalled()
  })

  it.each([
    [500, GENERIC_ERROR_MESSAGE],
    [429, TOO_MANY_MESSAGE],
    [404, "This video is no longer available"],
  ])("goes back to the confirmed state with a toast on %d", async (status, message) => {
    const release = gatedRoute(() => new HttpResponse(null, { status }))
    const { result } = renderHook(() => useOptimisticMutation<State>(INITIAL))

    act(() => {
      result.current.run({ value: "optimistic", count: 2 }, send)
    })
    expect(result.current.shown.value).toBe("optimistic")

    await act(async () => {
      release()
    })
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message))
    await waitFor(() => expect(result.current.shown).toEqual(INITIAL))
    expect(result.current.confirmed).toEqual(INITIAL)
  })

  it("uses the configured 404 message", async () => {
    gatedRoute(() => new HttpResponse(null, { status: 404 }))()
    const { result } = renderHook(() =>
      useOptimisticMutation<State>(INITIAL, { notFoundMessage: "This comment is no longer available" })
    )

    act(() => {
      result.current.run({ value: "optimistic", count: 2 }, send)
    })

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("This comment is no longer available")
    )
  })

  it("sends the viewer to login with returnTo on 401, without a toast", async () => {
    gatedRoute(() => new HttpResponse(null, { status: 401 }))()
    const { result } = renderHook(() => useOptimisticMutation<State>(INITIAL))

    act(() => {
      result.current.run({ value: "optimistic", count: 2 }, send)
    })

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login?returnTo=/watch/tech-01"))
    expect(toastError).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.shown).toEqual(INITIAL))
  })

  it("treats a network failure as an error and reverts", async () => {
    server.use(http.put(PROBE_URL, () => HttpResponse.error()))
    const { result } = renderHook(() => useOptimisticMutation<State>(INITIAL))

    act(() => {
      result.current.run({ value: "optimistic", count: 2 }, send)
    })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE))
    await waitFor(() => expect(result.current.shown).toEqual(INITIAL))
  })
})
