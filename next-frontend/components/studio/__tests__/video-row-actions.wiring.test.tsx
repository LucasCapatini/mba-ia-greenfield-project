// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildVideo, toVideoListItem } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { OwnerVideoList } from "../owner-video-list"

const { pushMock, refreshMock, toastSuccess, toastError, router } = vi.hoisted(() => {
  const pushMock = vi.fn()
  const refreshMock = vi.fn()
  return {
    pushMock,
    refreshMock,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    router: { push: pushMock, refresh: refreshMock, replace: vi.fn() },
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/studio/videos",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))

const readyDraft = buildVideo({ public_id: "vid-ready", title: "Aula pronta" })
const published = buildVideo({
  public_id: "vid-pub",
  title: "Aula publicada",
  status: "published",
  published_at: "2026-09-30T12:00:00.000Z",
})

function renderList(videos = [readyDraft, published]) {
  return render(
    <OwnerVideoList
      items={videos.map(toVideoListItem)}
      cursor={null}
      nextCursor={null}
      resetKey="{}"
    />
  )
}

function row(publicId: string): HTMLElement {
  return document.querySelector(`[data-public-id="${publicId}"]`) as HTMLElement
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, publicId: string) {
  await user.click(within(row(publicId)).getByRole("button", { name: "Video actions" }))
  return screen.getByRole("menu")
}

beforeEach(() => {
  pushMock.mockClear()
  refreshMock.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe("OwnerVideoList — row actions wiring", () => {
  it("publishes through the BFF, updates the badge and refreshes the page", async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    server.use(
      http.post("/api/videos/:publicId/publish", ({ request }) => {
        calls.push(new URL(request.url).pathname)
        return HttpResponse.json({ ...readyDraft, status: "published", published_at: "2026-10-01T12:00:00.000Z" })
      })
    )
    renderList()

    const menu = await openMenu(user, "vid-ready")
    await user.click(within(menu).getByRole("menuitem", { name: "Publish" }))

    await waitFor(() => expect(within(row("vid-ready")).getByText("Public")).toBeInTheDocument())
    expect(calls).toEqual(["/api/videos/vid-ready/publish"])
    expect(toastSuccess).toHaveBeenCalledWith("Video published")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("unpublishes through the BFF", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/videos/:publicId/unpublish", () =>
        HttpResponse.json({ ...published, status: "draft" })
      )
    )
    renderList()

    const menu = await openMenu(user, "vid-pub")
    await user.click(within(menu).getByRole("menuitem", { name: "Unpublish" }))

    await waitFor(() => expect(within(row("vid-pub")).queryByText("Public")).not.toBeInTheDocument())
    expect(within(row("vid-pub")).getAllByText("Draft").length).toBeGreaterThan(0)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("deletes after confirmation, removes the row and refreshes", async () => {
    const user = userEvent.setup()
    const deletes: string[] = []
    server.use(
      http.delete("/api/videos/:publicId", ({ request }) => {
        deletes.push(new URL(request.url).pathname)
        return new HttpResponse(null, { status: 204 })
      })
    )
    renderList()

    const menu = await openMenu(user, "vid-pub")
    await user.click(within(menu).getByRole("menuitem", { name: "Delete" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(row("vid-pub")).toBeNull())
    expect(deletes).toEqual(["/api/videos/vid-pub"])
    expect(toastSuccess).toHaveBeenCalledWith("Video deleted")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("maps VIDEO_NOT_PUBLISHABLE to a toast that links to the edit page", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/videos/:publicId/publish", () =>
        HttpResponse.json(
          { statusCode: 409, error: "VIDEO_NOT_PUBLISHABLE", message: "title is empty" },
          { status: 409 }
        )
      )
    )
    renderList()

    const menu = await openMenu(user, "vid-ready")
    await user.click(within(menu).getByRole("menuitem", { name: "Publish" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const [message, options] = toastError.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ]
    expect(message).toBe("Video is still processing or has no title — edit it before publishing")
    options.action.onClick()
    expect(pushMock).toHaveBeenCalledWith("/studio/videos/vid-ready/edit")
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("drops a row the upstream no longer has and refreshes", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/videos/:publicId/unpublish", () =>
        HttpResponse.json(
          { statusCode: 404, error: "VIDEO_NOT_FOUND", message: "Video not found" },
          { status: 404 }
        )
      )
    )
    renderList()

    const menu = await openMenu(user, "vid-pub")
    await user.click(within(menu).getByRole("menuitem", { name: "Unpublish" }))

    await waitFor(() => expect(row("vid-pub")).toBeNull())
    expect(toastError).toHaveBeenCalledWith("This video no longer exists.")
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("sends the user to login when the session expired", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/videos/:publicId/publish", () =>
        HttpResponse.json({ statusCode: 401, error: "UNAUTHORIZED", message: "x" }, { status: 401 })
      )
    )
    renderList()

    const menu = await openMenu(user, "vid-ready")
    await user.click(within(menu).getByRole("menuitem", { name: "Publish" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?returnTo=/studio/videos"))
  })

  it("appends the next page while the filters stay the same", () => {
    const first = [readyDraft].map(toVideoListItem)
    const second = [published].map(toVideoListItem)
    const { rerender } = render(
      <OwnerVideoList items={first} cursor={null} nextCursor="offset-1" resetKey="{}" />
    )

    rerender(<OwnerVideoList items={second} cursor="offset-1" nextCursor={null} resetKey="{}" />)
    expect(row("vid-ready")).not.toBeNull()
    expect(row("vid-pub")).not.toBeNull()

    rerender(
      <OwnerVideoList items={second} cursor={null} nextCursor={null} resetKey='{"status":"published"}' />
    )
    expect(row("vid-ready")).toBeNull()
    expect(row("vid-pub")).not.toBeNull()
  })
})
