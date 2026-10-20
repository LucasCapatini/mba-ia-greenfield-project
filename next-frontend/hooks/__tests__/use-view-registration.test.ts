// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import { server } from "@/mocks/server"

import { useViewRegistration } from "../use-view-registration"

/** A jsdom `<video>` with writable `currentTime` / `duration` / `seeking`. */
function stubVideo(duration: number) {
  const video = document.createElement("video")
  const props = { currentTime: 0, duration, seeking: false }
  for (const key of ["currentTime", "duration", "seeking"] as const) {
    Object.defineProperty(video, key, {
      configurable: true,
      get: () => props[key],
    })
  }
  const fire = (type: string) =>
    act(() => {
      video.dispatchEvent(new Event(type))
    })
  /** Plays from the current position to `to` in 0.25 s `timeupdate` ticks. */
  const playTo = (to: number) => {
    while (props.currentTime < to) {
      props.currentTime = Math.min(to, props.currentTime + 0.25)
      fire("timeupdate")
    }
  }
  /** Seek through the bar: `seeking` → `timeupdate` at the new position → `seeked`. */
  const seekTo = (to: number) => {
    props.seeking = true
    fire("seeking")
    props.currentTime = to
    fire("timeupdate")
    props.seeking = false
    fire("seeked")
  }
  return { video, props, fire, playTo, seekTo }
}

let calls: string[] = []

beforeEach(() => {
  calls = []
  server.use(
    http.post("/api/videos/:publicId/views", ({ params }) => {
      calls.push(String(params.publicId))
      return new HttpResponse(null, { status: 204 })
    })
  )
})

/** Lets a fetch that was (wrongly) started reach the handler before asserting there was none. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

function mount(video: HTMLVideoElement, enabled = true, publicId = "published-01") {
  const ref = { current: video }
  return renderHook(() => useViewRegistration(ref, publicId, enabled))
}

describe("useViewRegistration", () => {
  it("registers once after 10 s of accumulated playback", async () => {
    const player = stubVideo(296)
    mount(player.video)

    player.playTo(9.75)
    await settle()
    expect(calls).toEqual([])

    player.playTo(10)
    await waitFor(() => expect(calls).toEqual(["published-01"]))
  })

  it("registers a 4 s video when it ends after being watched", async () => {
    const player = stubVideo(4)
    mount(player.video)

    player.playTo(3.5)
    player.fire("ended")

    await waitFor(() => expect(calls).toEqual(["published-01"]))
  })

  it("does not count seeks: jumping to the end without playing never registers", async () => {
    const player = stubVideo(4)
    mount(player.video)

    player.seekTo(4)
    player.fire("ended")
    await settle()

    expect(calls).toEqual([])
  })

  it("ignores jumps forward while accumulating only played time", async () => {
    const player = stubVideo(296)
    mount(player.video)

    player.playTo(5)
    player.seekTo(200)
    player.playTo(204)
    await settle()
    expect(calls).toEqual([])

    player.playTo(205)
    await waitFor(() => expect(calls).toHaveLength(1))
  })

  it("never registers twice in the same mount", async () => {
    const player = stubVideo(30)
    mount(player.video)

    player.playTo(30)
    player.fire("ended")
    player.seekTo(0)
    player.playTo(30)
    await settle()

    expect(calls).toEqual(["published-01"])
  })

  it("never registers when disabled", async () => {
    const player = stubVideo(30)
    mount(player.video, false)

    player.playTo(30)
    player.fire("ended")
    await settle()

    expect(calls).toEqual([])
  })

  it("stays silent when the registration fails", async () => {
    server.use(http.post("/api/videos/:publicId/views", () => HttpResponse.error()))
    const player = stubVideo(30)
    mount(player.video)

    expect(() => player.playTo(15)).not.toThrow()
    await settle()
  })
})
