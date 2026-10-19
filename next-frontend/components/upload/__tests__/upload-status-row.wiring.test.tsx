// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { UploadEntry } from "@/components/upload/upload-provider"
import { buildUnprocessedVideo, buildVideo } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { UploadStatusRowLive } from "../upload-status-row"

const { refreshMock, resumeMock, uploadState } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  resumeMock: vi.fn(),
  uploadState: { current: undefined as UploadEntry | undefined },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}))
vi.mock("@/components/upload/upload-provider", () => ({
  useUpload: () => ({
    upload: uploadState.current,
    start: vi.fn(),
    resume: resumeMock,
    cancel: vi.fn(),
  }),
}))

const file = new File(["x"], "aula.mp4", { type: "video/mp4" })

function entry(patch: Partial<UploadEntry>): UploadEntry {
  return { file, progress: 0, status: "uploading", error: null, errorCode: null, ...patch }
}

beforeEach(() => {
  refreshMock.mockClear()
  resumeMock.mockClear()
  uploadState.current = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe("<UploadStatusRowLive />", () => {
  it("shows the multipart progress while the upload is in flight (no polling)", () => {
    uploadState.current = entry({ progress: 42 })
    let polls = 0
    server.use(http.get("/api/videos/:publicId", () => (polls++, HttpResponse.json({}))))

    render(<UploadStatusRowLive video={buildUnprocessedVideo("uploading", { public_id: "vid-1" })} />)

    expect(screen.getByText("Uploading… 42%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42")
    expect(polls).toBe(0)
  })

  it("refreshes the page once the upload completes and shows processing meanwhile", () => {
    uploadState.current = entry({ status: "completed", progress: 100 })

    render(<UploadStatusRowLive video={buildUnprocessedVideo("uploading", { public_id: "vid-1" })} />)

    expect(screen.getByText("Processing…")).toBeInTheDocument()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("polls while processing and refreshes (then stops) when the video is ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const answers = ["processing", "ready"]
    const reads: string[] = []
    server.use(
      http.get("/api/videos/:publicId", ({ params }) => {
        reads.push(String(params.publicId))
        return HttpResponse.json({ processing_status: answers.shift() ?? "ready" })
      })
    )

    render(<UploadStatusRowLive video={buildUnprocessedVideo("processing", { public_id: "vid-1" })} />)

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(reads).toEqual(["vid-1"])
    expect(refreshMock).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(reads).toEqual(["vid-1", "vid-1"])
    expect(refreshMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(reads).toHaveLength(2)
  })

  it("does not poll a ready video", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let reads = 0
    server.use(http.get("/api/videos/:publicId", () => (reads++, HttpResponse.json({}))))

    render(<UploadStatusRowLive video={buildVideo({ public_id: "vid-1" })} />)
    await act(() => vi.advanceTimersByTimeAsync(9_000))

    expect(reads).toBe(0)
    expect(screen.getByText("Ready")).toBeInTheDocument()
  })

  it("offers to resume when the page was reloaded with the session still active", async () => {
    server.use(
      http.get("/api/videos/:publicId/upload", () =>
        HttpResponse.json({
          upload_id: "up-1",
          state: "active",
          part_size: 5_242_880,
          part_count: 3,
          expected_bytes: 12_000_000,
          expires_at: "2026-10-20T00:00:00.000Z",
          uploaded_parts: [],
        })
      )
    )

    render(<UploadStatusRowLive video={buildUnprocessedVideo("uploading", { public_id: "vid-1" })} />)

    expect(
      await screen.findByText("Upload interrupted — select the file again to resume")
    ).toBeInTheDocument()
    const input = screen.getByLabelText("Select file to resume") as HTMLInputElement
    await act(async () => {
      Object.defineProperty(input, "files", { value: [file], configurable: true })
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(resumeMock).toHaveBeenCalledWith(file)
  })

  it("links back to the panel when the upload session is no longer active", () => {
    uploadState.current = entry({
      status: "failed",
      error: "Upload session is not active (state: aborted)",
      errorCode: "UPLOAD_NOT_ACTIVE",
    })

    render(<UploadStatusRowLive video={buildUnprocessedVideo("uploading", { public_id: "vid-1" })} />)

    expect(screen.getByRole("alert")).toHaveTextContent("The upload can no longer continue.")
    expect(screen.getByRole("link", { name: "Back to your videos" })).toHaveAttribute(
      "href",
      "/studio/videos"
    )
  })
})
