// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SessionProvider } from "@/components/auth/session-provider"
import type { SessionState } from "@/components/auth/session-provider"
import { server } from "@/mocks/server"
import { AppHeader } from "../app-header"

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const anonymous: SessionState = {
  userId: "",
  email: "",
  channelSlug: "",
  isLoggedIn: false,
}

const authenticated: SessionState = {
  userId: "user-1",
  email: "alice@example.com",
  channelSlug: "alice",
  isLoggedIn: true,
}

function renderHeader(session: SessionState) {
  return render(
    <SessionProvider initialSession={session}>
      <AppHeader />
    </SessionProvider>
  )
}

beforeEach(() => {
  pushMock.mockClear()
  refreshMock.mockClear()
})

describe("<AppHeader />", () => {
  it("anonymous: shows Entrar and Criar conta links and no Sair button", () => {
    renderHeader(anonymous)

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/signup"
    )
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument()
    expect(screen.getByRole("banner")).toHaveAttribute("data-session", "anonymous")
  })

  it("authenticated: shows the user's e-mail and a Sair button, no sign-in links", () => {
    renderHeader(authenticated)

    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument()
    expect(screen.getByRole("banner")).toHaveAttribute(
      "data-session",
      "authenticated"
    )
  })

  it("Sair posts to /api/auth/logout, then pushes to / and refreshes the RSC tree", async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.post("/api/auth/logout", () => {
        calls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    renderHeader(authenticated)

    await user.click(screen.getByRole("button", { name: "Sair" }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    expect(calls).toBe(1)
    expect(pushMock).toHaveBeenCalledWith("/")
  })

  it("home link points to / and carries the brand", () => {
    renderHeader(anonymous)

    expect(screen.getByRole("link", { name: "StreamTube home" })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
