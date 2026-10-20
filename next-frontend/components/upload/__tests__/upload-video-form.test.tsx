// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Video } from "@/lib/api/contracts"
import { buildUnprocessedVideo, buildVideo, CATEGORIES } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { UploadVideoForm } from "../upload-video-form"

const { pushMock, refreshMock, toastSuccess, toastError } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => "/studio/upload/vid-1",
}))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))
vi.mock("@/components/upload/upload-provider", () => ({
  useUpload: () => ({ upload: undefined, start: vi.fn(), resume: vi.fn(), cancel: vi.fn() }),
}))
vi.mock("@/hooks/use-processing-poll", () => ({ useProcessingPoll: () => undefined }))

const processing = buildUnprocessedVideo("processing", {
  public_id: "vid-1",
  title: "Aula processando",
})

function renderForm(video: Video = processing) {
  return render(
    <UploadVideoForm video={video} categories={[...CATEGORIES]} origin="http://localhost:3001" />
  )
}

/** Bodies of `PATCH /api/videos/:id`, answered with `respond(body)`. */
function mockPatch(respond: (body: Record<string, unknown>) => Response) {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.patch("/api/videos/:publicId", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      bodies.push(body)
      return respond(body)
    })
  )
  return bodies
}

function envelope(statusCode: number, error: string, message: string) {
  return HttpResponse.json({ statusCode, error, message }, { status: statusCode })
}

beforeEach(() => {
  pushMock.mockClear()
  refreshMock.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe("<UploadVideoForm />", () => {
  it("keeps Save Changes disabled until the form is dirty", async () => {
    const user = userEvent.setup()
    renderForm()
    const save = screen.getByRole("button", { name: "Save Changes" })

    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText("Title"), " 2")
    expect(save).toBeEnabled()
  })

  it("saves with publish: true and tells the user the video stays a draft while processing", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch((body) =>
      HttpResponse.json({ video: { ...processing, ...body }, published: false })
    )
    renderForm()

    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Minha aula")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Changes saved — the video stays a draft until processing finishes"
      )
    )
    expect(bodies).toEqual([
      {
        title: "Minha aula",
        description: null,
        category_id: null,
        visibility: "public",
        publish: true,
      },
    ])
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("announces the publication when the BFF chained the publish", async () => {
    const user = userEvent.setup()
    const ready = buildVideo({ public_id: "vid-1", title: "Aula pronta" })
    mockPatch((body) =>
      HttpResponse.json({ video: { ...ready, ...body, status: "published" }, published: true })
    )
    renderForm(ready)

    await user.type(screen.getByLabelText("Description"), "Nova descrição")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Video published"))
  })

  it("blocks an empty title inline without calling the BFF", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch(() => HttpResponse.json({}))
    renderForm()

    await user.clear(screen.getByLabelText("Title"))
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText("Title is required")).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()
    expect(bodies).toHaveLength(0)
  })

  it("blocks a description over 5000 characters and shows the counter", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch(() => HttpResponse.json({}))
    renderForm()

    const description = screen.getByLabelText("Description")
    await user.click(description)
    await user.paste("x".repeat(5001))
    expect(screen.getByText("5001/5000")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(
      await screen.findByText("Description must be 5000 characters or fewer")
    ).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it.each([
    ["CATEGORY_NOT_FOUND", 400, "Category x does not exist", "This category no longer exists"],
    ["VALIDATION_ERROR", 400, "title must be shorter than or equal to 100 characters", "title must be shorter than or equal to 100 characters"],
  ])("maps %s inline", async (code, status, message, shown) => {
    const user = userEvent.setup()
    mockPatch(() => envelope(status, code, message))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(shown)).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("reports other failures in a toast", async () => {
    const user = userEvent.setup()
    mockPatch(() => envelope(500, "INTERNAL_ERROR", "Something broke"))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Something broke"))
  })

  it("returns to the panel when the video is no longer the user's", async () => {
    const user = userEvent.setup()
    mockPatch(() => envelope(403, "VIDEO_FORBIDDEN", "You do not own this video"))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/videos"))
    expect(toastError).toHaveBeenCalledWith("This video is no longer available.")
  })

  it("sends the user to login when the session expired", async () => {
    const user = userEvent.setup()
    mockPatch(() => envelope(401, "UNAUTHORIZED", "Session expired"))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/login?returnTo=/studio/upload/vid-1")
    )
  })

  it("rejects an oversized thumbnail inline before uploading", async () => {
    const user = userEvent.setup()
    let puts = 0
    server.use(
      http.put("/api/videos/:publicId/thumbnail", () => {
        puts += 1
        return HttpResponse.json({})
      })
    )
    renderForm()
    const big = new File([new Uint8Array(16)], "capa.png", { type: "image/png" })
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 })

    await user.upload(screen.getByLabelText("Change Thumbnail"), big)

    expect(await screen.findByText("Max 5 MB")).toBeInTheDocument()
    expect(puts).toBe(0)
  })
})
