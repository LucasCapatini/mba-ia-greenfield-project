import type { Page } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/channel-social.plan.md (SI-06.16b — phase-06-social-interactions).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream faked server-side by mocks/ MSW: the store user (`studio_canal`) follows `tech_mastery`
// (1.2K subscribers); login resets the store. Only the public storage origin is browser-routed.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-canal@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" })
const followed = (page: Page) =>
  mainNav(page).getByRole("region", { name: "Subscriptions" })

test.describe("channel-social", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
    )
  })

  // 1. Menu lateral

  test("1.1 side-nav-only-with-session", async ({ page }) => {
    // Anônimo: menu com "Home" e o convite para entrar (home-search-production/TD-05).
    await page.goto("/channel/tech_mastery")
    await expect(page.getByRole("heading", { level: 1, name: "Tech Mastery" })).toBeVisible()
    await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    await expect(mainNav(page).getByText("Sign in to see your subscriptions")).toBeVisible()
    await expect(mainNav(page).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=/channel/tech_mastery"
    )
    await expect(mainNav(page).getByRole("link", { name: "Subscriptions" })).toHaveCount(0)
    await expect(mainNav(page).getByRole("link", { name: "Your videos" })).toHaveCount(0)

    await login(page)
    await page.goto("/channel/tech_mastery")

    await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    await expect(mainNav(page).getByRole("link", { name: "Subscriptions" })).toHaveAttribute(
      "href",
      "/feed/subscriptions"
    )
    await expect(mainNav(page).getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "href",
      "/studio/videos"
    )
    await expect(mainNav(page).getByRole("link", { name: "Liked videos" })).toHaveCount(0)
    await expect(followed(page).getByRole("link", { name: "Tech Mastery" })).toHaveAttribute(
      "href",
      "/channel/tech_mastery"
    )
  })

  test("1.2 side-nav-scope-across-routes", async ({ page }) => {
    await login(page)

    await page.goto("/studio/videos")
    await expect(mainNav(page).getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await page.goto("/")
    await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await page.goto("/watch/published-01")
    await expect(page.getByRole("heading", { level: 1, name: "Aula publicada" })).toBeVisible()
    await expect(page).toHaveURL(/\/watch\/published-01$/)
    await expect(mainNav(page)).toHaveCount(0)
  })

  // 2. Inscrição

  test("2.1 subscriber-count-and-button-state", async ({ page }) => {
    await page.goto("/channel/tech_mastery")
    const metaRow = page.locator("[data-slot='channel-info-subscribers']").locator("..")
    await expect(metaRow).toHaveText(/@tech_mastery\s*•\s*1\.2K subscribers\s*•\s*24 videos/)
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    await login(page)
    await page.goto("/channel/tech_mastery")
    await expect(page.getByRole("button", { name: "Subscribed" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    await page.goto("/channel/studio_canal")
    await expect(page.getByRole("heading", { level: 1, name: "Studio Canal" })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Subscribe/ })).toHaveCount(0)
    await expect(page.getByText(/\d+ subscribers?/)).toBeVisible()
  })

  test("2.2 unsubscribe-and-resubscribe-update-count-and-nav", async ({ page }) => {
    await login(page)
    await page.goto("/channel/tech_mastery")
    await waitForHydration(page)
    const navChannel = followed(page).getByRole("link", { name: "Tech Mastery" })
    await expect(navChannel).toBeVisible()

    const unsubscribe = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().endsWith("/api/channels/tech_mastery/subscription")
    )
    await page.getByRole("button", { name: "Subscribed" }).click()
    const body = (await (await unsubscribe).json()) as { subscriber_count: number }
    expect(body.subscriber_count).toBe(1199)
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await expect(page.getByText("1.2K subscribers")).toBeVisible()
    await expect(navChannel).toHaveCount(0)

    await page.getByRole("button", { name: "Subscribe" }).click()
    await expect(page.getByRole("button", { name: "Subscribed" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(navChannel).toBeVisible()

    await page.reload()
    await expect(page.getByRole("button", { name: "Subscribed" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  test("2.3 anonymous-subscribe-goes-to-login", async ({ page }) => {
    await page.goto("/channel/tech_mastery")
    await waitForHydration(page)

    await page.getByRole("button", { name: "Subscribe" }).click()

    await expect(page).toHaveURL(/\/login\?returnTo=\/channel\/tech_mastery$/)
  })
})
