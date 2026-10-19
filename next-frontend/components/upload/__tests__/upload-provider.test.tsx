// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { VideoCreated } from "@/lib/api/contracts"
import type { UploadProgress } from "@/lib/upload/multipart-uploader"

import { UploadProvider, useUpload } from "../upload-provider"

type FakeHandle = {
  onProgress: (progress: UploadProgress) => void
  resolve: () => void
  reject: (error: unknown) => void
  cancel: ReturnType<typeof vi.fn>
}

const { launched, CancelledError, FakeUploadError } = vi.hoisted(() => {
  class CancelledError extends Error {}
  class FakeUploadError extends Error {
    constructor(
      message: string,
      readonly code: string
    ) {
      super(message)
    }
  }
  return { launched: [] as FakeHandle[], CancelledError, FakeUploadError }
})

vi.mock("@/lib/upload/multipart-uploader", () => {
  function fakeHandle(onProgress?: (progress: UploadProgress) => void) {
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const done = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    const cancel = vi.fn(async () => {
      reject(new CancelledError())
    })
    launched.push({ onProgress: onProgress ?? (() => {}), resolve, reject, cancel })
    return { done, cancel, progress: () => ({ uploadedBytes: 0, totalBytes: 0 }) }
  }
  return {
    UploadCancelledError: CancelledError,
    UploadError: FakeUploadError,
    startUpload: vi.fn(({ onProgress }) => fakeHandle(onProgress)),
    resumeUpload: vi.fn(({ onProgress }) => fakeHandle(onProgress)),
  }
})

const PUBLIC_ID = "vid-1"
const created: VideoCreated = {
  public_id: PUBLIC_ID,
  status: "draft",
  processing_status: "uploading",
  upload: { upload_id: "up-1", part_size: 5, part_count: 2, expires_at: "2026-10-20T00:00:00.000Z" },
}
const file = new File(["0123456789"], "aula.mp4", { type: "video/mp4" })

function renderUpload() {
  return renderHook(() => useUpload(PUBLIC_ID), { wrapper: UploadProvider })
}

type ListenerSpy = { mock: { calls: unknown[][] } }

function beforeUnloadListeners(spy: ListenerSpy) {
  return spy.mock.calls.filter((call) => call[0] === "beforeunload").length
}

let addSpy: ListenerSpy
let removeSpy: ListenerSpy

beforeEach(() => {
  launched.length = 0
  addSpy = vi.spyOn(window, "addEventListener")
  removeSpy = vi.spyOn(window, "removeEventListener")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("UploadProvider + useUpload", () => {
  it("has no entry before an upload starts", () => {
    const { result } = renderUpload()

    expect(result.current.upload).toBeUndefined()
  })

  it("start creates an uploading entry with progress 0", () => {
    const { result } = renderUpload()

    act(() => result.current.start(file, created))

    expect(result.current.upload).toMatchObject({
      file,
      progress: 0,
      status: "uploading",
      error: null,
    })
  })

  it("propagates progress as a percentage and completes at 100", async () => {
    const { result } = renderUpload()
    act(() => result.current.start(file, created))

    act(() => launched[0].onProgress({ uploadedBytes: 5, totalBytes: 10 }))
    expect(result.current.upload?.progress).toBe(50)

    await act(async () => launched[0].resolve())
    expect(result.current.upload).toMatchObject({ status: "completed", progress: 100 })
  })

  it("registers beforeunload only while an upload is in flight", async () => {
    const { result } = renderUpload()
    expect(beforeUnloadListeners(addSpy)).toBe(0)

    act(() => result.current.start(file, created))
    expect(beforeUnloadListeners(addSpy)).toBe(1)
    expect(beforeUnloadListeners(removeSpy)).toBe(0)

    await act(async () => launched[0].resolve())
    expect(beforeUnloadListeners(removeSpy)).toBe(1)
  })

  it("cancel aborts the upload and marks it cancelled", async () => {
    const { result } = renderUpload()
    act(() => result.current.start(file, created))

    await act(() => result.current.cancel())

    expect(launched[0].cancel).toHaveBeenCalledTimes(1)
    expect(result.current.upload?.status).toBe("cancelled")
    expect(beforeUnloadListeners(removeSpy)).toBe(1)
  })

  it("marks a failed upload with the error message", async () => {
    const { result } = renderUpload()
    act(() => result.current.start(file, created))

    await act(async () => launched[0].reject(new Error("Storage rejected part 2 (500)")))

    expect(result.current.upload).toMatchObject({
      status: "failed",
      error: "Storage rejected part 2 (500)",
    })
  })

  it("keeps the uploader error code of a failure", async () => {
    const { result } = renderUpload()
    act(() => result.current.start(file, created))

    await act(async () =>
      launched[0].reject(new FakeUploadError("Upload session is not active", "UPLOAD_NOT_ACTIVE"))
    )

    expect(result.current.upload).toMatchObject({ status: "failed", errorCode: "UPLOAD_NOT_ACTIVE" })
  })

  it("resume restarts tracking for the same publicId", () => {
    const { result } = renderUpload()

    act(() => result.current.resume(file))

    expect(launched).toHaveLength(1)
    expect(result.current.upload).toMatchObject({ status: "uploading", progress: 0 })
  })

  it("useUpload outside the provider throws a helpful error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => renderHook(() => useUpload(PUBLIC_ID))).toThrow(/UploadProvider/)
  })
})
