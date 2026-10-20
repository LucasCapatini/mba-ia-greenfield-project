// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { server } from "@/mocks/server"
import { ResetPasswordForm } from "../reset-password-form"

function envelope(statusCode: number, error: string, message: string) {
  return { statusCode, error, message, code: null }
}

async function fillPasswords(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm = password
) {
  await user.type(screen.getByLabelText("New password"), password)
  await user.type(screen.getByLabelText("Confirm new password"), confirm)
}

describe("<ResetPasswordForm /> wiring", () => {
  it("updates the password strength meter on every typed character (useWatch)", async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm token="ok-token" />)
    const meter = document.querySelector("[data-slot='password-strength-meter']")
    const field = screen.getByLabelText("New password")

    expect(meter).toHaveAttribute("data-strength", "empty")
    await user.type(field, "a")
    expect(meter).toHaveAttribute("data-strength", "weak")
    await user.type(field, "bcdefgH")
    expect(meter).toHaveAttribute("data-strength", "fair")
    await user.type(field, "1")
    expect(meter).toHaveAttribute("data-strength", "strong")
    await user.type(field, "!")
    expect(meter).toHaveAttribute("data-strength", "very-strong")
  })

  it("posts { token, new_password } to /api/auth/reset-password and shows success with a Sign in link on 204", async () => {
    const user = userEvent.setup()
    const received: Record<string, unknown>[] = []
    server.use(
      http.post("/api/auth/reset-password", async ({ request }) => {
        received.push((await request.json()) as Record<string, unknown>)
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(<ResetPasswordForm token="ok-token" />)
    await fillPasswords(user, "newpassword123")
    await user.click(screen.getByRole("button", { name: "Reset password" }))

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Senha redefinida")
    )
    expect(received).toEqual([{ token: "ok-token", new_password: "newpassword123" }])
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(
      screen.queryByRole("button", { name: "Reset password" })
    ).not.toBeInTheDocument()
  })

  it("blocks a short password and a mismatched confirmation client-side without calling the BFF", async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.post("/api/auth/reset-password", () => {
        calls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(<ResetPasswordForm token="ok-token" />)

    await fillPasswords(user, "short")
    await user.click(screen.getByRole("button", { name: "Reset password" }))
    await waitFor(() =>
      expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument()
    )

    await user.clear(screen.getByLabelText("New password"))
    await user.clear(screen.getByLabelText("Confirm new password"))
    await fillPasswords(user, "newpassword123", "different123")
    await user.click(screen.getByRole("button", { name: "Reset password" }))
    await waitFor(() =>
      expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument()
    )

    expect(calls).toBe(0)
    expect(screen.getByRole("button", { name: "Reset password" })).toBeInTheDocument()
  })

  it("maps 401 (expired / invalid token) to a root error with a link to /forgot-password and keeps the form", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/auth/reset-password", () =>
        HttpResponse.json(envelope(401, "TOKEN_EXPIRED", "Token has expired"), {
          status: 401,
        })
      )
    )

    render(<ResetPasswordForm token="expired-token" />)
    await fillPasswords(user, "newpassword123")
    await user.click(screen.getByRole("button", { name: "Reset password" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("inválido ou expirou")
    expect(
      screen.getByRole("link", { name: "Request a new link" })
    ).toHaveAttribute("href", "/forgot-password")
    expect(screen.getByRole("button", { name: "Reset password" })).toBeInTheDocument()
  })

  it("maps 400 to a root error carrying the upstream message", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/auth/reset-password", () =>
        HttpResponse.json(
          envelope(400, "VALIDATION_ERROR", "new_password must be longer than or equal to 8 characters"),
          { status: 400 }
        )
      )
    )

    render(<ResetPasswordForm token="badrequest-token" />)
    await fillPasswords(user, "newpassword123")
    await user.click(screen.getByRole("button", { name: "Reset password" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "new_password must be longer than or equal to 8 characters"
    )
    expect(
      screen.queryByRole("link", { name: "Request a new link" })
    ).not.toBeInTheDocument()
  })
})
