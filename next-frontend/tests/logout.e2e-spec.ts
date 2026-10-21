import { expect, test } from "./fixtures"

// Upstream faked server-side by mocks/ MSW. POST /auth/login returns the token
// pair for any non-trigger e-mail; the BFF seals the iron-session cookie.
// POST /auth/logout → 204; the BFF destroys the cookie unconditionally.
test.describe("logout", () => {
  test("1.1 anonymous home shows Sign in and no account menu", async ({
    page,
  }) => {
    await page.goto("/")

    const header = page.locator("[data-slot='app-header']")
    await expect(header).toHaveAttribute("data-session", "anonymous")
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=/"
    )
    await expect(header.getByRole("button", { name: "Account" })).toHaveCount(0)

    // Boilerplate is gone.
    await expect(page.getByText("To get started, edit the page.tsx file.")).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Templates|Learning/ })).toHaveCount(0)
  })

  test("1.2 login → header shows the avatar; Sign Out in the account menu returns to the anonymous home and drops the session cookie", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("Email address").fill("user@example.com")
    await page.getByLabel("Password", { exact: true }).fill("secret123")
    await page.getByRole("button", { name: "Sign in" }).click()

    // Login lands on the home with the authenticated header.
    await expect(page).toHaveURL(/\/$/)
    const header = page.locator("[data-slot='app-header']")
    await expect(header).toHaveAttribute("data-session", "authenticated")
    await expect(header.getByRole("link", { name: "Upload video" })).toBeVisible()
    const avatar = header.getByRole("button", { name: "Account" })
    await expect(avatar).toBeVisible()
    expect(
      (await page.context().cookies()).some((c) => c.name.includes("session"))
    ).toBe(true)

    await avatar.click()
    const menu = page.getByRole("dialog", { name: "Account" })
    await expect(menu.getByRole("link", { name: "Edit Channel" })).toHaveAttribute(
      "href",
      "/studio/channel"
    )

    const req = page.waitForRequest(
      (r) => r.url().includes("/api/auth/logout") && r.method() === "POST"
    )
    await menu.getByRole("button", { name: "Sign Out" }).click()
    await req

    await expect(header).toHaveAttribute("data-session", "anonymous")
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect
      .poll(async () =>
        (await page.context().cookies()).some((c) => c.name.includes("session"))
      )
      .toBe(false)
  })

  test("1.3 auth screens do not render the header", async ({ page }) => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      await page.goto(path)
      await expect(page.locator("[data-slot='card']")).toBeVisible()
      await expect(page.locator("[data-slot='app-header']")).toHaveCount(0)
    }
  })
})
