import { expect, test } from "./fixtures"

// Upstream faked server-side by mocks/ MSW. POST /auth/resend-confirmation
// returns 204 for any e-mail (anti-enumeration) and 400 for the reserved trigger
// badrequest@example.com.
test.describe("resend-confirmation", () => {
  test("1.1 resend-sucesso-inline", async ({ page }) => {
    await page.goto("/resend-confirmation")

    await expect(
      page.getByRole("heading", { level: 1, name: "Resend confirmation e-mail" })
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
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    )
    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name.includes("session"))).toBe(false)
  })

  test("1.2 resend-erro-400-mantem-formulario", async ({ page }) => {
    await page.goto("/resend-confirmation")

    await page.getByLabel("Email address").fill("badrequest@example.com")
    await page
      .getByRole("button", { name: "Resend confirmation link" })
      .click()

    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    await expect(
      page.getByRole("button", { name: "Resend confirmation link" })
    ).toBeVisible()
    await expect(
      page.locator("[data-slot='resend-confirmation-success']")
    ).toHaveCount(0)
  })
})
