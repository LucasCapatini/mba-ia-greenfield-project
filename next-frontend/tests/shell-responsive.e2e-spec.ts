import type { Page } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Responsive app shell (home-search-production/TD-05, Verification — SI-07.17). Runs in two
// Playwright projects: `mobile` (Pixel 7) and `chromium` (desktop); each describe skips the other.
// Upstream faked server-side by mocks/ MSW; thumbnails from localhost:9000 get a PNG.

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

const column = (page: Page) => page.locator("[data-slot='app-shell-nav']")
const menuButton = (page: Page) =>
  page.locator("[data-slot='app-header']").getByRole("button", { name: "Menu" })
const drawer = (page: Page) => page.getByRole("dialog", { name: "Navigation" })

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("shell@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
}

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:9000/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
  )
})

test.describe("shell-responsive — mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "phone profile only")

  test("no menu column; ≡ opens the drawer and following a link closes it", async ({ page }) => {
    await login(page)

    await expect(column(page)).toBeHidden()
    expect(await hasHorizontalScroll(page)).toBe(false)

    await menuButton(page).click()
    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page).getByRole("link", { name: "Your videos" })).toBeVisible()
    await expect(drawer(page).getByRole("link", { name: "Tech Mastery" })).toBeVisible()

    await drawer(page).getByRole("link", { name: "Subscriptions", exact: true }).click()
    await expect(page).toHaveURL(/\/feed\/subscriptions$/)
    await expect(drawer(page)).toHaveCount(0)
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test("Esc closes the drawer and gives the focus back to ≡", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page, "header")

    await menuButton(page).click()
    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page).getByText("Sign in to see your subscriptions")).toBeVisible()
    await page.keyboard.press("Escape")

    await expect(drawer(page)).toHaveCount(0)
    await expect(menuButton(page)).toBeFocused()
  })

  test("search starts as an icon that expands over the header", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page, "header")
    const header = page.locator("[data-slot='app-header']")

    await expect(header.getByRole("searchbox", { name: "Search" })).toBeHidden()
    await header.getByRole("button", { name: "Search", exact: true }).click()
    const field = header.getByRole("searchbox", { name: "Search" })
    await expect(field).toBeVisible()
    await expect(field).toBeFocused()

    await field.fill("mastery")
    await field.press("Enter")
    await expect(page).toHaveURL(/\/results\?q=mastery$/)
    expect(await hasHorizontalScroll(page)).toBe(false)
  })

  test("the watch page opens the menu in the drawer", async ({ page }) => {
    await page.goto("/watch/published-01")
    await expect(page.getByRole("heading", { level: 1, name: "Aula publicada" })).toBeVisible()
    await waitForHydration(page, "header")
    expect(await hasHorizontalScroll(page)).toBe(false)

    await menuButton(page).click()

    await expect(drawer(page).getByRole("link", { name: "Home" })).toBeVisible()
  })
})

test.describe("shell-responsive — desktop", () => {
  test.skip(({ isMobile }) => !!isMobile, "desktop profile only")
  test.use({ viewport: { width: 1280, height: 800 } })

  test("≡ collapses the column to mini and the choice survives a reload without a layout shift", async ({
    page,
  }) => {
    await login(page)
    await expect(column(page)).toHaveAttribute("data-mode", "expanded")
    const expandedWidth = (await column(page).boundingBox())?.width ?? 0
    await expect(column(page).getByRole("link", { name: "Your videos" })).toBeVisible()

    await menuButton(page).click()

    await expect(column(page)).toHaveAttribute("data-mode", "mini")
    const miniWidth = (await column(page).boundingBox())?.width ?? 0
    expect(miniWidth).toBeLessThan(expandedWidth)
    await expect(column(page).getByRole("link")).toHaveText(["Home", "Subscriptions", "You"])
    expect((await page.context().cookies()).find((cookie) => cookie.name === "side_nav")?.value).toBe("mini")

    // The server HTML already carries the mini column — no flash on hydration.
    const html = await (await page.request.get("/")).text()
    expect(html).toMatch(/data-slot="app-shell-nav" data-mode="mini"/)
    await page.reload()
    await expect(column(page)).toHaveAttribute("data-mode", "mini")

    await menuButton(page).click()
    await expect(column(page)).toHaveAttribute("data-mode", "expanded")
    expect((await page.context().cookies()).some((cookie) => cookie.name === "side_nav")).toBe(false)
  })

  test("the watch page has no column; ≡ opens the drawer", async ({ page }) => {
    await page.goto("/watch/published-01")
    await expect(page.getByRole("heading", { level: 1, name: "Aula publicada" })).toBeVisible()
    await waitForHydration(page, "header")
    await expect(column(page)).toHaveCount(0)

    await menuButton(page).click()

    await expect(drawer(page).getByRole("link", { name: "Home" })).toBeVisible()
  })
})
