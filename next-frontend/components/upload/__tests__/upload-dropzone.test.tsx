// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { VideoCreated } from "@/lib/api/contracts"
import { server } from "@/mocks/server"

import { MAX_VIDEO_BYTES, UploadDropzone } from "../upload-dropzone"

const { pushMock, startMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  startMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

vi.mock("@/components/upload/upload-provider", () => ({
  useUploads: () => ({ uploads: new Map(), start: startMock, resume: vi.fn(), cancel: vi.fn() }),
}))

const created: VideoCreated = {
  public_id: "new-upload-id",
  status: "draft",
  processing_status: "uploading",
  upload: {
    upload_id: "up-1",
    part_size: 5_242_880,
    part_count: 3,
    expires_at: "2026-10-20T00:00:00.000Z",
  },
}

function video(name: string, type: string, bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

function errorEnvelope(statusCode: number, error: string) {
  return HttpResponse.json({ statusCode, error, message: error }, { status: statusCode })
}

/** Corpos recebidos por `POST /api/videos` (o handler responde `respond`). */
function mockCreate(respond: () => Response = () => HttpResponse.json(created, { status: 201 })) {
  const bodies: unknown[] = []
  server.use(
    http.post("/api/videos", async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    })
  )
  return bodies
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

beforeEach(() => {
  pushMock.mockClear()
  startMock.mockClear()
})

describe("<UploadDropzone />", () => {
  it("renders the instructions and a real, labelled file input for MP4/WebM", () => {
    render(<UploadDropzone />)

    expect(screen.getByText("MP4 or WebM, up to 10 GB")).toBeInTheDocument()
    expect(fileInput()).toHaveAttribute("accept", "video/mp4,video/webm")
    expect(screen.getByLabelText("Select file")).toBe(fileInput())
  })

  it("creates the upload, hands the file to the provider and opens the processing screen", async () => {
    const user = userEvent.setup()
    const bodies = mockCreate()
    const file = video("aula.mp4", "video/mp4", 2048)
    render(<UploadDropzone />)

    await user.upload(fileInput(), file)

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/upload/new-upload-id"))
    expect(bodies).toEqual([
      { original_filename: "aula.mp4", content_type: "video/mp4", size_bytes: 2048 },
    ])
    expect(startMock).toHaveBeenCalledWith(file, created)
  })

  it("rejects an unsupported type inline without calling the BFF", async () => {
    const bodies = mockCreate()
    render(<UploadDropzone />)

    fireEvent.change(fileInput(), { target: { files: [video("clipe.mov", "video/quicktime")] } })

    expect(await screen.findByText("Only MP4 and WebM files are supported")).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
    expect(fileInput()).toHaveAttribute("aria-invalid", "true")
  })

  it("rejects a file over 10 GiB locally", async () => {
    const bodies = mockCreate()
    const huge = video("grande.mp4", "video/mp4")
    Object.defineProperty(huge, "size", { value: MAX_VIDEO_BYTES + 1 })
    render(<UploadDropzone />)

    fireEvent.change(fileInput(), { target: { files: [huge] } })

    expect(await screen.findByText("Files must be 10 GB or smaller")).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it.each([
    ["VIDEO_TOO_LARGE", 413, "Files must be 10 GB or smaller"],
    ["VIDEO_UNSUPPORTED_MEDIA_TYPE", 400, "Only MP4 and WebM files are supported"],
  ])("maps the upstream %s to the inline message", async (code, status, message) => {
    const user = userEvent.setup()
    mockCreate(() => errorEnvelope(status, code))
    render(<UploadDropzone />)

    await user.upload(fileInput(), video("aula.mp4", "video/mp4"))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(startMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("offers a retry when the storage is unavailable", async () => {
    const user = userEvent.setup()
    let calls = 0
    mockCreate(() => {
      calls += 1
      return calls === 1
        ? errorEnvelope(503, "STORAGE_UNAVAILABLE")
        : HttpResponse.json(created, { status: 201 })
    })
    render(<UploadDropzone />)

    await user.upload(fileInput(), video("aula.mp4", "video/mp4"))
    await user.click(await screen.findByRole("button", { name: "Try again" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/upload/new-upload-id"))
    expect(calls).toBe(2)
  })

  it("sends the user to login (returning here) when the session expired", async () => {
    const user = userEvent.setup()
    mockCreate(() => errorEnvelope(401, "UNAUTHORIZED"))
    render(<UploadDropzone />)

    await user.upload(fileInput(), video("aula.webm", "video/webm"))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?returnTo=/studio/upload"))
    expect(startMock).not.toHaveBeenCalled()
  })

  it("highlights while dragging and accepts a dropped file", async () => {
    const bodies = mockCreate()
    const { container } = render(<UploadDropzone />)
    const zone = container.querySelector('[data-slot="upload-dropzone"]') as HTMLElement
    const file = video("aula.webm", "video/webm")

    fireEvent.dragOver(zone, { dataTransfer: { files: [] } })
    expect(zone).toHaveAttribute("data-state", "dragging")

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/upload/new-upload-id"))
    expect(bodies).toEqual([
      { original_filename: "aula.webm", content_type: "video/webm", size_bytes: 1024 },
    ])
  })
})
