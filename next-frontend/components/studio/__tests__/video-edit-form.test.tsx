// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Video } from "@/lib/api/contracts"
import { buildUnprocessedVideo, buildVideo, CATEGORIES, findCategory } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { VideoEditForm } from "../video-edit-form"

const { pushMock, refreshMock, toastSuccess, toastError, router } = vi.hoisted(() => {
  const pushMock = vi.fn()
  const refreshMock = vi.fn()
  return {
    pushMock,
    refreshMock,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    router: { push: pushMock, refresh: refreshMock },
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/studio/videos/vid-1/edit",
}))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))

const ready = buildVideo({
  public_id: "vid-1",
  title: "Aula pronta",
  description: "Primeira aula",
  category: findCategory("music"),
})

function renderForm(video: Video = ready) {
  return render(
    <VideoEditForm video={video} categories={[...CATEGORIES]} origin="http://localhost:3001" />
  )
}

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

describe("<VideoEditForm />", () => {
  it("is prefilled from the video and links the public watch page", () => {
    renderForm()

    expect(screen.getByLabelText("Title")).toHaveValue("Aula pronta")
    expect(screen.getByLabelText("Description")).toHaveValue("Primeira aula")
    expect(screen.getByRole("radio", { name: /Public/ })).toBeChecked()
    expect(screen.getByText("http://localhost:3001/watch/vid-1".replace("http://", ""))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()
  })

  it("saves with publish: true and announces the publication", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch((body) =>
      HttpResponse.json({ video: { ...ready, ...body, status: "published" }, published: true })
    )
    renderForm()

    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Aula final")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Video published"))
    expect(bodies[0]).toEqual({
      title: "Aula final",
      description: "Primeira aula",
      category_id: findCategory("music").id,
      visibility: "public",
      publish: true,
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("keeps a processing video as a draft and says so", async () => {
    const user = userEvent.setup()
    const processing = buildUnprocessedVideo("processing", { public_id: "vid-1", title: "Em proc." })
    mockPatch((body) => HttpResponse.json({ video: { ...processing, ...body }, published: false }))
    renderForm(processing)

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Changes saved — the video stays a draft until processing finishes"
      )
    )
  })

  it("validates as the user types and keeps Save disabled while invalid", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch(() => HttpResponse.json({}))
    renderForm()

    await user.clear(screen.getByLabelText("Title"))
    expect(await screen.findByText("Title is required")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()

    await user.type(screen.getByLabelText("Title"), "Ok")
    await user.click(screen.getByLabelText("Description"))
    await user.paste("x".repeat(5000))
    expect(
      await screen.findByText("Description must be 5000 characters or fewer")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled()
    expect(bodies).toHaveLength(0)
  })

  it.each([
    ["CATEGORY_NOT_FOUND", "Category x does not exist", "This category no longer exists"],
    ["VALIDATION_ERROR", "description must be shorter than or equal to 5000 characters", "description must be shorter than or equal to 5000 characters"],
  ])("maps %s inline", async (code, message, shown) => {
    const user = userEvent.setup()
    mockPatch(() => envelope(400, code, message))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(shown)).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("sends an expired session to login and back to the edit page, slashes readable", async () => {
    const user = userEvent.setup()
    mockPatch(() => new HttpResponse(null, { status: 401 }))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/login?returnTo=/studio/videos/vid-1/edit")
    )
  })

  it("returns to the panel with a toast when the video is gone", async () => {
    const user = userEvent.setup()
    mockPatch(() => envelope(404, "VIDEO_NOT_FOUND", "Video not found"))
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/studio/videos"))
    expect(toastError).toHaveBeenCalledWith("This video is no longer available.")
  })

  it("offers a retry when the storage is unavailable", async () => {
    const user = userEvent.setup()
    let calls = 0
    mockPatch((body) => {
      calls += 1
      return calls === 1
        ? envelope(503, "STORAGE_UNAVAILABLE", "Storage unavailable")
        : HttpResponse.json({ video: { ...ready, ...body }, published: false })
    })
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const [, options] = toastError.mock.calls[0] as [string, { action: { onClick: () => void } }]
    options.action.onClick()

    await waitFor(() => expect(calls).toBe(2))
  })

  it("cancels straight to the panel when nothing changed", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(pushMock).toHaveBeenCalledWith("/studio/videos")
  })

  it("asks before discarding unsaved changes", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText("Title"), "!")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Discard" }))
    expect(pushMock).toHaveBeenCalledWith("/studio/videos")
  })
})
