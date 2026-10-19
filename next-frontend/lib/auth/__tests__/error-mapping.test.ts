import { describe, expect, it, vi } from "vitest"

import {
  RESET_LINK_INVALID_MESSAGE,
  mapResetPasswordErrorToForm,
} from "@/lib/auth/error-mapping"

type Envelope = Parameters<typeof mapResetPasswordErrorToForm>[0]

function envelope(statusCode: number, error: string, message: Envelope["message"]): Envelope {
  return { statusCode, error, message, code: null }
}

describe("mapResetPasswordErrorToForm", () => {
  it("maps 401 INVALID_TOKEN to a root error flagged as reset-link-invalid", () => {
    const setError = vi.fn()

    mapResetPasswordErrorToForm(
      envelope(401, "INVALID_TOKEN", "Token is invalid"),
      setError
    )

    expect(setError).toHaveBeenCalledWith("root.serverError", {
      type: "reset-link-invalid",
      message: RESET_LINK_INVALID_MESSAGE,
    })
  })

  it("maps 401 TOKEN_EXPIRED the same way (both mean: ask for a new link)", () => {
    const setError = vi.fn()

    mapResetPasswordErrorToForm(
      envelope(401, "TOKEN_EXPIRED", "Token has expired"),
      setError
    )

    expect(setError).toHaveBeenCalledWith("root.serverError", {
      type: "reset-link-invalid",
      message: RESET_LINK_INVALID_MESSAGE,
    })
  })

  it("maps 400 to a root error carrying the upstream message (array flattened)", () => {
    const setError = vi.fn()

    mapResetPasswordErrorToForm(
      envelope(400, "VALIDATION_ERROR", [
        "new_password must be longer than or equal to 8 characters",
        "token should not be empty",
      ]),
      setError
    )

    expect(setError).toHaveBeenCalledWith("root.serverError", {
      type: "server",
      message:
        "new_password must be longer than or equal to 8 characters token should not be empty",
    })
  })
})
