// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { UploadEntry } from "@/components/upload/upload-provider"
import { server } from "@/mocks/server"

import { CancelUploadButton } from "../cancel-upload-button"

const { pushMock, cancelMock, uploadState } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  cancelMock: vi.fn(async () => undefined),
  uploadState: { current: undefined as UploadEntry | undefined },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/upload/upload-provider", () => ({
  useUpload: () => ({
    upload: uploadState.current,
    start: vi.fn(),
    resume: vi.fn(),
    cancel: cancelMock,
  }),
}))

const file = new File(["x"], "aula.mp4", { type: "video/mp4" })

/** `DELETE` requests (method + path) the button sent to the BFF. */
function recordDeletes(): string[] {
  const deletes: string[] = []
  server.use(
    http.delete("/api/videos/:publicId/upload", ({ request }) => {
      deletes.push(new URL(request.url).pathname)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete("/api/videos/:publicId", ({ request }) => {
      deletes.push(new URL(request.url).pathname)
      return new HttpResponse(null, { status: 204 })
    })
  )
  return deletes
}

beforeEach(() => {
  pushMock.mockClear()
  cancelMock.mockClear()
  uploadState.current = undefined
})

describe("<CancelUploadButton />", () => {
  it("asks for confirmation and keeps uploading when dismissed", async () => {
    const user = userEvent.setup()
    const deletes = recordDeletes()
    uploadState.current = { file, progress: 30, status: "uploading", error: null, errorCode: null }
    render(<CancelUploadButton video={{ public_id: "vid-1", processing_status: "uploading" }} />)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("dialog", { name: "Cancel upload?" })).toHaveTextContent(
      "The file and this draft will be discarded."
    )
    await user.click(screen.getByRole("button", { name: "Keep uploading" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(cancelMock).not.toHaveBeenCalled()
    expect(deletes).toEqual([])
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("cancels the running upload through the provider and returns to the panel", async () => {
    const user = userEvent.setup()
    const deletes = recordDeletes()
    uploadState.current = { file, progress: 30, status: "uploading", error: null, errorCode: null }
    render(<CancelUploadButton video={{ public_id: "vid-1", processing_status: "uploading" }} />)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Cancel upload" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/videos"))
    expect(cancelMock).toHaveBeenCalledTimes(1)
    // The provider's cancel() aborts the PUTs and itself calls DELETE …/upload.
    expect(deletes).toEqual([])
  })

  it("aborts an open session left by a reloaded page with DELETE …/upload", async () => {
    const user = userEvent.setup()
    const deletes = recordDeletes()
    render(<CancelUploadButton video={{ public_id: "vid-1", processing_status: "uploading" }} />)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Cancel upload" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/videos"))
    expect(deletes).toEqual(["/api/videos/vid-1/upload"])
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it("discards the draft with DELETE /api/videos/{id} once the upload finished", async () => {
    const user = userEvent.setup()
    const deletes = recordDeletes()
    render(<CancelUploadButton video={{ public_id: "vid-1", processing_status: "processing" }} />)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Cancel upload" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/videos"))
    expect(deletes).toEqual(["/api/videos/vid-1"])
  })
})
