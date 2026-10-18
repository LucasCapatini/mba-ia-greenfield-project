import { expect, test } from "./fixtures"

// Upstream faked server-side by mocks/ MSW via instrumentation.ts.
// POST /auth/reset-password triggers: token "expired-token" → 401 TOKEN_EXPIRED,
// "invalid-token" → 401 INVALID_TOKEN, "badrequest-token" → 400, else 204.
test.describe("reset-password", () => {
  test("1.1 valid token → form, successful reset shows success with a Sign in link", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=ok-token")

    await expect(
      page.getByRole("heading", { level: 1, name: "Choose a new password" })
    ).toBeVisible()
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Confirm new password")).toBeVisible()

    await page.getByLabel("New password", { exact: true }).fill("newpassword123")
    await page.getByLabel("Confirm new password").fill("newpassword123")

    const req = page.waitForRequest(
      (r) =>
        r.url().includes("/api/auth/reset-password") && r.method() === "POST"
    )
    await page.getByRole("button", { name: "Reset password" }).click()
    const request = await req
    expect(request.postDataJSON()).toEqual({
      token: "ok-token",
      new_password: "newpassword123",
    })

    await expect(page.getByRole("status")).toContainText("Senha redefinida")
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute(
      "href",
      "/login"
    )
    await expect(
      page.getByRole("button", { name: "Reset password" })
    ).toHaveCount(0)

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name.includes("session"))).toBe(false)
  })

  test("1.2 client-side validation blocks a short password and mismatched confirmation", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=ok-token")

    await page.getByLabel("New password", { exact: true }).fill("short")
    await page.getByLabel("Confirm new password").fill("short")
    await page.getByRole("button", { name: "Reset password" }).click()
    await expect(page.getByText("Mínimo 8 caracteres")).toBeVisible()

    await page.getByLabel("New password", { exact: true }).fill("newpassword123")
    await page.getByLabel("Confirm new password").fill("different123")
    await page.getByRole("button", { name: "Reset password" }).click()
    await expect(page.getByText("As senhas não coincidem")).toBeVisible()

    // Still on the form, no success state.
    await expect(
      page.getByRole("button", { name: "Reset password" })
    ).toBeVisible()
  })

  test("1.3 expired token → submit shows the invalid-link message with a link to /forgot-password", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=expired-token")

    await page.getByLabel("New password", { exact: true }).fill("newpassword123")
    await page.getByLabel("Confirm new password").fill("newpassword123")
    await page.getByRole("button", { name: "Reset password" }).click()

    // Scope to the form's own alert — Next's route announcer is also role="alert".
    const alert = page.locator("[data-slot='form-error']")
    await expect(alert).toContainText("inválido ou expirou")
    await expect(
      alert.getByRole("link", { name: "Request a new link" })
    ).toHaveAttribute("href", "/forgot-password")
    await expect(
      page.getByRole("button", { name: "Reset password" })
    ).toBeVisible()
  })

  test("1.4 missing token → no form, link to /forgot-password", async ({ page }) => {
    await page.goto("/reset-password")

    await expect(
      page.getByRole("heading", { level: 1, name: "Invalid reset link" })
    ).toBeVisible()
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Request a new link" })
    ).toHaveAttribute("href", "/forgot-password")
  })
})
