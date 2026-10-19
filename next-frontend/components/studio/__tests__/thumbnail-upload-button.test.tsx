// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import { ThumbnailUploadButton } from "../thumbnail-upload-button"

const { refreshMock, toastSuccess, toastError, router } = vi.hoisted(() => {
  const refreshMock = vi.fn()
  return {
    refreshMock,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    router: { push: vi.fn(), refresh: refreshMock },
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/studio/videos/vid-1/edit",
}))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))

function image(name: string, type: string, bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

/** Records thumbnail requests (method + uploaded file name), answered with `respond`. */
function mockThumbnail(respond: () => Response = () => HttpResponse.json({})) {
  const calls: { method: string; file: string | null }[] = []
  const handler = async ({ request }: { request: Request }) => {
    let file: string | null = null
    if (request.method === "PUT") {
      const entry = (await request.formData()).get("file")
      file = entry instanceof File ? entry.name : null
    }
    calls.push({ method: request.method, file })
    return respond()
  }
  server.use(
    http.put("/api/videos/:publicId/thumbnail", handler),
    http.delete("/api/videos/:publicId/thumbnail", handler)
  )
  return calls
}

function renderButton(hasCustomThumbnail = false) {
  return render(<ThumbnailUploadButton publicId="vid-1" hasCustomThumbnail={hasCustomThumbnail} />)
}

beforeEach(() => {
  refreshMock.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe("<ThumbnailUploadButton />", () => {
  it("uploads a valid image as multipart `file` and refreshes the page", async () => {
    const user = userEvent.setup()
    const calls = mockThumbnail()
    // jsdom's FormData is not a body Node's fetch can serialize; check what the button hands over.
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    renderButton()

    await user.upload(screen.getByLabelText("Change Thumbnail"), image("capa.png", "image/png"))

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    expect(calls.map((call) => call.method)).toEqual(["PUT"])
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/videos/vid-1/thumbnail")
    expect(init.body).toBeInstanceOf(FormData)
    expect(((init.body as FormData).get("file") as File).name).toBe("capa.png")
    expect(new Headers(init.headers).has("content-type")).toBe(false)
    fetchSpy.mockRestore()
    expect(toastSuccess).toHaveBeenCalledWith("Thumbnail updated")
  })

  it("rejects an image over 5 MiB before sending", async () => {
    const user = userEvent.setup()
    const calls = mockThumbnail()
    renderButton()
    const huge = image("huge.png", "image/png")
    Object.defineProperty(huge, "size", { value: 6 * 1024 * 1024 })

    await user.upload(screen.getByLabelText("Change Thumbnail"), huge)

    expect(await screen.findByRole("alert")).toHaveTextContent("Max 5 MB")
    expect(calls).toHaveLength(0)
  })

  it("rejects an unsupported type before sending", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const calls = mockThumbnail()
    renderButton()

    await user.upload(screen.getByLabelText("Change Thumbnail"), image("capa.gif", "image/gif"))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use a JPEG, PNG or WebP image of at least 640×360"
    )
    expect(calls).toHaveLength(0)
  })

  it.each([
    ["THUMBNAIL_INVALID", 400, "Use a JPEG, PNG or WebP image of at least 640×360"],
    ["THUMBNAIL_TOO_LARGE", 413, "Max 5 MB"],
  ])("maps the upstream %s inline", async (code, status, message) => {
    const user = userEvent.setup()
    mockThumbnail(() => HttpResponse.json({ statusCode: status, error: code, message: code }, { status }))
    renderButton()

    await user.upload(screen.getByLabelText("Change Thumbnail"), image("capa.png", "image/png"))

    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("removes the custom thumbnail with DELETE", async () => {
    const user = userEvent.setup()
    const calls = mockThumbnail(() => new HttpResponse(null, { status: 204 }))
    renderButton(true)

    await user.click(screen.getByRole("button", { name: "Remove custom thumbnail" }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    expect(calls).toEqual([{ method: "DELETE", file: null }])
  })

  it("only offers removal when the thumbnail is custom", () => {
    renderButton(false)

    expect(screen.queryByRole("button", { name: "Remove custom thumbnail" })).not.toBeInTheDocument()
  })
})
