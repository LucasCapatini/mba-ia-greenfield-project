import { expect, test } from "./fixtures"

// Upstream faked server-side by mocks/ MSW. POST /auth/login returns the token
// pair for any non-trigger e-mail; the BFF seals the iron-session cookie.
// POST /auth/logout → 204; the BFF destroys the cookie unconditionally.
test.describe("logout", () => {
  test("1.1 anonymous home shows Entrar / Criar conta and no Sair", async ({
    page,
  }) => {
    await page.goto("/")

    const header = page.locator("[data-slot='app-header']")
    await expect(header).toHaveAttribute("data-session", "anonymous")
    await expect(header.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login"
    )
    await expect(
      header.getByRole("link", { name: "Criar conta" })
    ).toHaveAttribute("href", "/signup")
    await expect(header.getByRole("button", { name: "Sair" })).toHaveCount(0)

    // Boilerplate is gone.
    await expect(page.getByText("To get started, edit the page.tsx file.")).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Templates|Learning/ })).toHaveCount(0)
  })

  test("1.2 login → header shows the e-mail and Sair; Sair returns to the anonymous home and drops the session cookie", async ({
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
    await expect(header.getByText("user@example.com")).toBeVisible()
    const logout = header.getByRole("button", { name: "Sair" })
    await expect(logout).toBeVisible()
    expect(
      (await page.context().cookies()).some((c) => c.name.includes("session"))
    ).toBe(true)

    const req = page.waitForRequest(
      (r) => r.url().includes("/api/auth/logout") && r.method() === "POST"
    )
    await logout.click()
    await req

    await expect(header).toHaveAttribute("data-session", "anonymous")
    await expect(header.getByRole("link", { name: "Entrar" })).toBeVisible()
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
