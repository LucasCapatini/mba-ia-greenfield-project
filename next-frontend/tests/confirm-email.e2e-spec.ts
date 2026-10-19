import { expect, test } from "./fixtures"

// Upstream faked server-side by mocks/ MSW via instrumentation.ts.
// GET /auth/confirm-email triggers: "expired-token" → 401 TOKEN_EXPIRED,
// "invalid-token" / "" → 401 INVALID_TOKEN, anything else → 204.
// POST /auth/resend-confirmation → 204 (400 only for badrequest@example.com).
test.describe("confirm-email", () => {
  test("1.1 valid token → confirmed on first paint with a Sign in link", async ({
    page,
  }) => {
    await page.goto("/confirm-email?token=ok-token")

    await expect(
      page.getByRole("heading", { level: 1, name: "Email confirmed" })
    ).toBeVisible()
    await expect(page.getByRole("status")).toContainText(
      "Sua conta foi confirmada"
    )
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    await expect(
      page.getByRole("button", { name: "Resend confirmation link" })
    ).toHaveCount(0)

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name.includes("session"))).toBe(false)
  })

  test("1.2 expired token → expired state with resend form; resend shows inline confirmation", async ({
    page,
  }) => {
    await page.goto("/confirm-email?token=expired-token")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Confirmation link expired",
      })
    ).toBeVisible()
    const submit = page.getByRole("button", {
      name: "Resend confirmation link",
    })
    await expect(submit).toBeVisible()

    await page.getByLabel("Email address").fill("alice@example.com")
    const req = page.waitForRequest(
      (r) =>
        r.url().includes("/api/auth/resend-confirmation") &&
        r.method() === "POST"
    )
    await submit.click()
    await req

    await expect(
      page.locator("[data-slot='resend-confirmation-success']")
    ).toContainText("Verifique seu e-mail")
    await expect(submit).toHaveCount(0)
    await expect(page).toHaveURL(/\/confirm-email\?token=expired-token$/)
  })

  test("1.3 invalid token → invalid state with resend form", async ({ page }) => {
    await page.goto("/confirm-email?token=invalid-token")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Invalid confirmation link",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Resend confirmation link" })
    ).toBeVisible()
  })

  test("1.4 missing token → invalid state", async ({ page }) => {
    await page.goto("/confirm-email")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Invalid confirmation link",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Resend confirmation link" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
  })

  test("1.5 opening the link twice (prefetch simulation) stays confirmed", async ({
    page,
  }) => {
    await page.goto("/confirm-email?token=ok-token")
    await expect(
      page.getByRole("heading", { level: 1, name: "Email confirmed" })
    ).toBeVisible()

    await page.goto("/confirm-email?token=ok-token")
    await expect(
      page.getByRole("heading", { level: 1, name: "Email confirmed" })
    ).toBeVisible()
  })
})
