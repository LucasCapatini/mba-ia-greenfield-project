// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildChannel } from "@/mocks/factories/videos"
import { server } from "@/mocks/server"

import { ChannelSettingsForm } from "../channel-settings-form"

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

vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))

const channel = buildChannel()

function renderForm() {
  return render(<ChannelSettingsForm channel={channel} />)
}

function mockPatch(respond: (body: Record<string, unknown>) => Response) {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.patch("/api/channel", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      bodies.push(body)
      return respond(body)
    })
  )
  return bodies
}

const handle = () => screen.getByLabelText("Channel handle")
const displayName = () => screen.getByLabelText("Display name")
const save = () => screen.getByRole("button", { name: "Save Changes" })

beforeEach(() => {
  pushMock.mockClear()
  refreshMock.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe("<ChannelSettingsForm />", () => {
  it("is prefilled, keeps `@` outside the value and starts with Save disabled", () => {
    renderForm()

    expect(handle()).toHaveValue("studio_canal")
    expect(displayName()).toHaveValue("Studio Canal")
    expect(screen.getByLabelText("Description")).toHaveValue("Canal de testes")
    expect(screen.getByText("@")).toHaveAttribute("aria-hidden", "true")
    expect(save()).toBeDisabled()
  })

  it("sends only the changed fields, toasts and refreshes", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch((body) => HttpResponse.json({ ...channel, ...body }))
    renderForm()

    await user.clear(handle())
    await user.type(handle(), "novo_canal")
    await user.click(save())

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Channel updated"))
    expect(bodies).toEqual([{ nickname: "novo_canal" }])
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("sends a cleared description as null", async () => {
    const user = userEvent.setup()
    const bodies = mockPatch((body) => HttpResponse.json({ ...channel, ...body }))
    renderForm()

    await user.clear(screen.getByLabelText("Description"))
    await user.click(save())

    await waitFor(() => expect(bodies).toEqual([{ description: null }]))
  })

  it("maps NICKNAME_TAKEN to the handle", async () => {
    const user = userEvent.setup()
    mockPatch(() =>
      HttpResponse.json(
        { statusCode: 409, error: "NICKNAME_TAKEN", message: 'Nickname "taken_nick" is already taken' },
        { status: 409 }
      )
    )
    renderForm()

    await user.clear(handle())
    await user.type(handle(), "taken_nick")
    await user.click(save())

    expect(await screen.findByText("This handle is already taken")).toBeInTheDocument()
    expect(handle()).toHaveAttribute("aria-invalid", "true")
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("maps a VALIDATION_ERROR to the field it names", async () => {
    const user = userEvent.setup()
    mockPatch(() =>
      HttpResponse.json(
        { statusCode: 400, error: "VALIDATION_ERROR", message: ["name must be shorter than or equal to 50 characters"] },
        { status: 400 }
      )
    )
    renderForm()

    await user.type(displayName(), " TV")
    await user.click(save())

    expect(
      await screen.findByText("name must be shorter than or equal to 50 characters")
    ).toBeInTheDocument()
  })

  it.each([
    ["admin", "This handle is reserved"],
    ["Ab", "Use 3–50 lowercase letters, numbers or underscores"],
    ["@canal", "Use 3–50 lowercase letters, numbers or underscores"],
  ])("blocks the handle %j before sending", async (value, message) => {
    const user = userEvent.setup()
    const bodies = mockPatch(() => HttpResponse.json(channel))
    renderForm()

    await user.clear(handle())
    await user.type(handle(), value)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(save()).toBeDisabled()
    expect(bodies).toHaveLength(0)
  })

  it("requires a display name and caps the description at 1000", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(displayName())
    expect(await screen.findByText("Display name is required")).toBeInTheDocument()

    await user.type(displayName(), "Studio")
    await user.click(screen.getByLabelText("Description"))
    await user.paste("x".repeat(990))
    expect(screen.getByText("1005/1000")).toBeInTheDocument()
    expect(
      await screen.findByText("Description must be 1000 characters or fewer")
    ).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it("Cancel goes back to the panel", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(pushMock).toHaveBeenCalledWith("/studio/videos")
  })

  it("sends the user to login when the session expired", async () => {
    const user = userEvent.setup()
    mockPatch(() =>
      HttpResponse.json({ statusCode: 401, error: "UNAUTHORIZED", message: "x" }, { status: 401 })
    )
    renderForm()

    await user.type(displayName(), "!")
    await user.click(save())

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?returnTo=/studio/channel"))
  })
})
