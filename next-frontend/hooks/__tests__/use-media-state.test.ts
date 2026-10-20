// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useMediaState } from "../use-media-state"

type MediaProps = {
  paused: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  ranges: Array<[number, number]>
}

/** A jsdom `<video>` whose media fields are plain values the test sets before each event. */
function stubVideo(initial: Partial<MediaProps> = {}) {
  const video = document.createElement("video")
  const props: MediaProps = {
    paused: true,
    currentTime: 0,
    duration: Number.NaN,
    volume: 1,
    muted: false,
    ranges: [],
    ...initial,
  }
  for (const key of ["paused", "currentTime", "duration", "volume", "muted"] as const) {
    Object.defineProperty(video, key, {
      configurable: true,
      get: () => props[key],
      set: (value: never) => {
        props[key] = value
      },
    })
  }
  Object.defineProperty(video, "buffered", {
    configurable: true,
    get: () => ({
      length: props.ranges.length,
      start: (i: number) => props.ranges[i][0],
      end: (i: number) => props.ranges[i][1],
    }),
  })
  return { video, props }
}

function setup(initial: Partial<MediaProps> = {}) {
  const { video, props } = stubVideo(initial)
  const container = document.createElement("div")
  const videoRef = { current: video }
  const containerRef = { current: container }
  const hook = renderHook(() => useMediaState(videoRef, containerRef))
  const fire = (type: string, target: EventTarget = video) =>
    act(() => {
      target.dispatchEvent(new Event(type))
    })
  return { video, props, container, hook, fire }
}

afterEach(() => {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null })
})

describe("useMediaState", () => {
  it("reads the element on mount, with 0 for a duration that is not finite yet", () => {
    const { hook } = setup({ volume: 0.5, muted: true })

    expect(hook.result.current).toEqual({
      paused: true,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 0.5,
      muted: true,
      waiting: false,
      fullscreen: false,
    })
  })

  it("updates paused on play and pause", () => {
    const { props, hook, fire } = setup()

    props.paused = false
    fire("play")
    expect(hook.result.current.paused).toBe(false)

    props.paused = true
    fire("pause")
    expect(hook.result.current.paused).toBe(true)
  })

  it("updates currentTime on timeupdate and duration on durationchange", () => {
    const { props, hook, fire } = setup()

    props.duration = 296
    fire("durationchange")
    props.currentTime = 20
    fire("timeupdate")

    expect(hook.result.current).toMatchObject({ duration: 296, currentTime: 20 })
  })

  it("reports the end of the buffered range that covers the current time on progress", () => {
    const { props, hook, fire } = setup({ currentTime: 50 })

    props.ranges = [
      [0, 10],
      [40, 148],
    ]
    fire("progress")
    expect(hook.result.current.buffered).toBe(148)

    props.currentTime = 200
    fire("timeupdate")
    expect(hook.result.current.buffered).toBe(0)
  })

  it("updates volume and muted on volumechange", () => {
    const { props, hook, fire } = setup()

    props.volume = 0.3
    props.muted = true
    fire("volumechange")

    expect(hook.result.current).toMatchObject({ volume: 0.3, muted: true })
  })

  it("turns waiting on with waiting and off with playing, and keeps it across timeupdate", () => {
    const { props, hook, fire } = setup({ paused: false })

    fire("waiting")
    expect(hook.result.current.waiting).toBe(true)
    props.currentTime = 1
    fire("timeupdate")
    expect(hook.result.current.waiting).toBe(true)

    fire("playing")
    expect(hook.result.current.waiting).toBe(false)
  })

  it("marks ended playback as paused and not waiting", () => {
    const { props, hook, fire } = setup({ paused: false })
    fire("waiting")

    props.paused = true
    fire("ended")

    expect(hook.result.current).toMatchObject({ paused: true, waiting: false })
  })

  it("follows fullscreenchange for the player container only", () => {
    const { container, hook, fire } = setup()

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: container })
    fire("fullscreenchange", document)
    expect(hook.result.current.fullscreen).toBe(true)

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.createElement("section"),
    })
    fire("fullscreenchange", document)
    expect(hook.result.current.fullscreen).toBe(false)
  })
})
