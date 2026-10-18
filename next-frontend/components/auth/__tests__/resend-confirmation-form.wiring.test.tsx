// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { server } from "@/mocks/server"
import { ResendConfirmationForm } from "../resend-confirmation-form"

function envelope(statusCode: number, error: string, message: string) {
  return { statusCode, error, message, code: null }
}

describe("<ResendConfirmationForm /> wiring", () => {
  it("posts { email } to /api/auth/resend-confirmation and swaps the form for the inline confirmation on 204", async () => {
    const user = userEvent.setup()
    const received: Record<string, unknown>[] = []
    server.use(
      http.post("/api/auth/resend-confirmation", async ({ request }) => {
        received.push((await request.json()) as Record<string, unknown>)
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(<ResendConfirmationForm />)
    await user.type(screen.getByLabelText("Email address"), "alice@example.com")
    await user.click(
      screen.getByRole("button", { name: "Resend confirmation link" })
    )

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Verifique seu e-mail")
    )
    expect(received).toEqual([{ email: "alice@example.com" }])
    expect(
      screen.queryByRole("button", { name: "Resend confirmation link" })
    ).not.toBeInTheDocument()
  })

  it("maps a 400 to an inline error on the e-mail field and keeps the form", async () => {
    const user = userEvent.setup()
    server.use(
      http.post("/api/auth/resend-confirmation", () =>
        HttpResponse.json(
          envelope(400, "VALIDATION_ERROR", "email must be an email"),
          { status: 400 }
        )
      )
    )

    render(<ResendConfirmationForm />)
    await user.type(screen.getByLabelText("Email address"), "alice@example.com")
    await user.click(
      screen.getByRole("button", { name: "Resend confirmation link" })
    )

    await waitFor(() =>
      expect(screen.getByText("email must be an email")).toBeInTheDocument()
    )
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(
      screen.getByRole("button", { name: "Resend confirmation link" })
    ).toBeInTheDocument()
  })

  it("blocks submit with client-side validation and fires no request until the e-mail is valid", async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.post("/api/auth/resend-confirmation", () => {
        calls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(<ResendConfirmationForm />)
    await user.type(screen.getByLabelText("Email address"), "not-an-email")
    await user.click(
      screen.getByRole("button", { name: "Resend confirmation link" })
    )

    await waitFor(() =>
      expect(screen.getByText("Endereço de e-mail inválido")).toBeInTheDocument()
    )
    expect(calls).toBe(0)
  })
})
