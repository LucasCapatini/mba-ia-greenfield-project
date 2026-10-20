// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import { VideoPlayer } from "../video-player"

const FIRST_URL = "http://localhost:9000/streamtube-videos/videos/published-01/source?sig=first"
const RENEWED_URL = "http://localhost:9000/streamtube-videos/videos/published-01/source?sig=renewed"
const FAR_FUTURE = "2999-01-01T00:00:00.000Z"

type MediaFields = { paused: boolean; currentTime: number; duration: number }

let fields: MediaFields
const play = vi.fn()
const pause = vi.fn()

/**
 * jsdom implements no media playback (watch-page/TD-07): `play`/`pause` are stubbed on the
 * prototype and the instance fields are plain values the stubs keep in sync, firing the same
 * events a browser would.
 */
function stubMedia(video: HTMLVideoElement) {
  for (const key of ["paused", "currentTime", "duration"] as const) {
    Object.defineProperty(video, key, {
      configurable: true,
      get: () => fields[key],
      set: (value: never) => {
        fields[key] = value
      },
    })
  }
}

beforeEach(() => {
  fields = { paused: true, currentTime: 0, duration: 0 }
  play.mockReset().mockImplementation(function (this: HTMLVideoElement) {
    fields.paused = false
    this.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  pause.mockReset().mockImplementation(function (this: HTMLVideoElement) {
    fields.paused = true
    this.dispatchEvent(new Event("pause"))
  })
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play)
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause)
  // Keep the view registration out of these tests (covered by its own hook test).
  server.use(http.post("/api/videos/:publicId/views", () => new HttpResponse(null, { status: 204 })))
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPlayer(expiresAt = FAR_FUTURE) {
  const view = render(
    <VideoPlayer
      publicId="published-01"
      streamUrl={FIRST_URL}
      expiresAt={expiresAt}
      posterUrl="http://localhost:9000/streamtube-videos/thumbnails/published-01/auto.jpg?v=1"
    />
  )
  const video = view.container.querySelector("video")!
  stubMedia(video)
  // Metadata loaded: the controls become enabled.
  fields.duration = 120
  fireEvent(video, new Event("durationchange"))
  return { ...view, video }
}

describe("VideoPlayer", () => {
  it("renders the native video with the stream URL, the poster and only the capability controls", () => {
    const { video } = renderPlayer()

    expect(video).toHaveAttribute("src", FIRST_URL)
    expect(video).toHaveAttribute("poster", expect.stringContaining("/thumbnails/published-01/"))
    expect(video).toHaveAttribute("preload", "metadata")
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Play",
      "Mute",
      "Enter full screen",
    ])
  })

  it("toggles play and pause from the button, updating its accessible label", async () => {
    const user = userEvent.setup()
    renderPlayer()

    await user.click(screen.getByRole("button", { name: "Play" }))
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Pause" }))
    expect(pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("toggles play and pause when the video itself is clicked", () => {
    const { video } = renderPlayer()

    fireEvent.click(video)
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.click(video)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it("renews the expired URL on a media error and resumes at the saved time", async () => {
    const reads: string[] = []
    server.use(
      http.get("/api/videos/:publicId/playback", ({ params }) => {
        reads.push(String(params.publicId))
        return HttpResponse.json({
          stream_url: RENEWED_URL,
          download_url: `${RENEWED_URL}&download`,
          thumbnail_url: null,
          expires_at: FAR_FUTURE,
        })
      })
    )
    const { video } = renderPlayer()
    fireEvent.click(video)
    fields.currentTime = 42
    fireEvent(video, new Event("timeupdate"))

    fireEvent(video, new Event("error"))

    await waitFor(() => expect(video).toHaveAttribute("src", RENEWED_URL))
    expect(reads).toEqual(["published-01"])

    play.mockClear()
    fields.currentTime = 0
    fireEvent(video, new Event("loadedmetadata"))
    expect(fields.currentTime).toBe(42)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("renews before resuming when the URL already expired", async () => {
    let reads = 0
    server.use(
      http.get("/api/videos/:publicId/playback", () => {
        reads++
        return HttpResponse.json({
          stream_url: RENEWED_URL,
          download_url: RENEWED_URL,
          thumbnail_url: null,
          expires_at: FAR_FUTURE,
        })
      })
    )
    const { video } = renderPlayer("2000-01-01T00:00:00.000Z")

    fireEvent.click(screen.getByRole("button", { name: "Play" }))

    await waitFor(() => expect(video).toHaveAttribute("src", RENEWED_URL))
    expect(reads).toBe(1)
    expect(play).not.toHaveBeenCalled()
    fireEvent(video, new Event("loadedmetadata"))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("plays at once when the renewal returns the same, already expired URL (clock skew)", async () => {
    let reads = 0
    server.use(
      http.get("/api/videos/:publicId/playback", () => {
        reads++
        return HttpResponse.json({
          stream_url: FIRST_URL,
          download_url: FIRST_URL,
          thumbnail_url: null,
          expires_at: "2000-01-01T00:00:00.000Z",
        })
      })
    )
    renderPlayer("2000-01-01T00:00:00.000Z")

    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))

    expect(play).toHaveBeenCalledTimes(2)
    expect(reads).toBe(1)
  })

  it("shows the error state with Try again when the renewal fails", async () => {
    server.use(
      http.get("/api/videos/:publicId/playback", () =>
        HttpResponse.json(
          { statusCode: 503, error: "STORAGE_UNAVAILABLE", message: "Object storage is unavailable" },
          { status: 503 }
        )
      )
    )
    const { video } = renderPlayer()

    fireEvent(video, new Event("error"))

    expect(await screen.findByRole("alert")).toHaveTextContent("This video could not be loaded.")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()
  })

  it("does not renew twice for the same failure: a second error shows the error state", async () => {
    let reads = 0
    server.use(
      http.get("/api/videos/:publicId/playback", () => {
        reads++
        return HttpResponse.json({
          stream_url: RENEWED_URL,
          download_url: RENEWED_URL,
          thumbnail_url: null,
          expires_at: FAR_FUTURE,
        })
      })
    )
    const { video } = renderPlayer()

    fireEvent(video, new Event("error"))
    await waitFor(() => expect(video).toHaveAttribute("src", RENEWED_URL))
    await act(async () => {
      video.dispatchEvent(new Event("error"))
    })

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(reads).toBe(1)
  })
})
