import type { Page } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/subscriptions-feed.plan.md (SI-06.18b — phase-06-social-interactions).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream faked server-side by mocks/ MSW: the store user (`studio_canal`) follows `tech_mastery`,
// whose 24 public videos make the feed (pages of 20); login resets the store. Only the public
// storage origin is browser-routed.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)

async function fillLogin(page: Page) {
  await page.getByLabel("Email address").fill("studio-canal@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
}

async function login(page: Page) {
  await page.goto("/login")
  await fillLogin(page)
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

const cards = (page: Page) =>
  page.getByRole("list", { name: "Subscription videos" }).locator("article[data-slot='video-card']")

test.describe("subscriptions-feed", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
    )
  })

  // 1. Acesso

  test("1.1 anonymous-is-redirected-to-login", async ({ page }) => {
    await page.goto("/feed/subscriptions")
    await expect(page).toHaveURL(/\/login\?returnTo=\/feed\/subscriptions$/)

    await waitForHydration(page, "form")
    await fillLogin(page)
    await expect(page).toHaveURL(/\/feed\/subscriptions$/)
    await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeVisible()
  })

  // 2. Conteúdo

  test("2.1 feed-lists-followed-channel-videos", async ({ page }) => {
    await login(page)
    await page.goto("/feed/subscriptions")

    await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeVisible()
    await expect(cards(page)).toHaveCount(20)
    const times = await cards(page).locator("time").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("datetime") ?? "")
    )
    expect(times).toEqual([...times].sort().reverse())

    const firstCard = cards(page).first()
    await expect(firstCard.locator("[data-slot='channel-avatar']")).toHaveText("TM")
    await expect(firstCard.getByRole("link", { name: "Tech Mastery" })).toHaveAttribute(
      "href",
      "/channel/tech_mastery"
    )
    await expect(firstCard.getByRole("link", { name: /^Tutorial/ })).toHaveAttribute(
      "href",
      /^\/watch\/tech-video-\d+$/
    )
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Subscriptions", exact: true })
    ).toHaveAttribute("aria-current", "page")
  })

  test("2.2 load-more-appends-and-disappears", async ({ page }) => {
    await login(page)
    await page.goto("/feed/subscriptions")
    await waitForHydration(page)
    await expect(cards(page)).toHaveCount(20)

    await page.getByRole("button", { name: "Load more" }).click()

    await expect(cards(page)).toHaveCount(24)
    const ids = await cards(page)
      .getByRole("link", { name: /^Tutorial/ })
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    expect(new Set(ids).size).toBe(24)
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0)
  })

  test("2.3 empty-state-without-subscriptions", async ({ page }) => {
    await login(page)
    await page.goto("/channel/tech_mastery")
    await waitForHydration(page)

    await page.getByRole("button", { name: "Subscribed" }).click()
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveAttribute("aria-pressed", "false")

    await page.goto("/feed/subscriptions")
    await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    await expect(page.getByText("Videos from the channels you subscribe to will show up here.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Find channels to follow" })).toHaveAttribute("href", "/")
  })
})
