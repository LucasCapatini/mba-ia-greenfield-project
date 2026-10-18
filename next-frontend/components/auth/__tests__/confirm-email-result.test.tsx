// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ConfirmEmailResult } from "../confirm-email-result"

describe("<ConfirmEmailResult />", () => {
  it("success: heading, confirmation copy and a Sign in CTA pointing to /login", () => {
    render(<ConfirmEmailResult state="success" />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Email confirmed" })
    ).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sua conta foi confirmada"
    )
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup"
    )
  })

  it("invalid: heading, copy and the slot content (resend form placeholder)", () => {
    render(
      <ConfirmEmailResult state="invalid">
        <form aria-label="resend-slot" />
      </ConfirmEmailResult>
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Invalid confirmation link" })
    ).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("inválido")
    expect(screen.getByRole("form", { name: "resend-slot" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(
      screen.queryByRole("link", { name: "Sign up" })
    ).not.toBeInTheDocument()
  })

  it("expired: heading, copy and the slot content", () => {
    render(
      <ConfirmEmailResult state="expired">
        <form aria-label="resend-slot" />
      </ConfirmEmailResult>
    )

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Confirmation link expired",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("expirou")
    expect(screen.getByRole("form", { name: "resend-slot" })).toBeInTheDocument()
  })

  it("exposes the state as a data attribute on the root for styling/testing hooks", () => {
    const { container } = render(<ConfirmEmailResult state="expired" />)

    expect(
      container.querySelector("[data-slot='confirm-email-result']")
    ).toHaveAttribute("data-state", "expired")
  })
})
