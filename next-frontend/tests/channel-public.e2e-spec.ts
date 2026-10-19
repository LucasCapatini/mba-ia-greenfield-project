import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

// Generated from specs/channel-public.plan.md (SI-04.20b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Anonymous context; upstream faked server-side by mocks/ MSW (`tech_mastery`: 24 public videos,
// pages of 20; `nao_existe` → 404). The only browser route is the public storage origin.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)

const cards = (page: Page) => page.locator("article[data-slot='video-card']")

test.describe("channel-public", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
    )
  })

  // 1. Renderização anônima

  test("1.1 anonymous-sees-channel-info-and-videos", async ({ page }) => {
    await page.goto("/channel/tech_mastery")

    await expect(page).toHaveTitle(/Tech Mastery \(@tech_mastery\)/)
    await expect(page.getByRole("heading", { level: 1, name: "Tech Mastery" })).toBeVisible()
    await expect(page.getByText("@tech_mastery")).toBeVisible()
    await expect(page.getByText("24 videos")).toBeVisible()
    await expect(page.getByText("Tutoriais de tecnologia")).toBeVisible()
    await expect(page.getByRole("button", { name: /subscribe/i })).toHaveCount(0)
    await expect(page.getByText(/subscribers/i)).toHaveCount(0)

    await expect(cards(page)).toHaveCount(20)
    await expect(page.getByRole("tab", { name: "Videos" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("radio", { name: "Latest" })).toHaveAttribute("aria-checked", "true")

    const firstCard = cards(page).first()
    const link = firstCard.getByRole("link").first()
    await expect(link).toHaveAttribute("href", /^\/watch\/tech-video-\d+$/)
    // The title already names the link, so the thumbnail is decorative (alt="") — the UI Contract
    // allows it ("ou alt=\"\" quando o título já é o texto do link") and avoids a doubled name.
    await expect(link).toHaveAccessibleName(/Tutorial 01/)
    const image = firstCard.locator("img").first()
    await expect(image).toHaveAttribute("alt", "")
    const src = (await image.getAttribute("src")) ?? ""
    expect(src).toMatch(/^http:\/\/localhost:9000\/streamtube-videos\/thumbnails\/.+\?v=\d+$/)
    expect(src).not.toMatch(/X-Amz-/i)
  })

  // 2. Ordenação e paginação

  test("2.1 sort-popular-and-load-more", async ({ page }) => {
    await page.goto("/channel/tech_mastery")

    await page.getByRole("radio", { name: "Popular" }).click()
    await expect(page).toHaveURL(/[?&]sort=popular/)
    expect(page.url()).not.toContain("cursor=")
    await expect(page.getByRole("radio", { name: "Popular" })).toHaveAttribute("aria-checked", "true")
    // Most viewed fixture: "Tutorial 18" with 23.5K views.
    await expect(cards(page).first()).toContainText("Tutorial 18")
    await expect(cards(page).first()).toContainText("23.5K views")

    await page.getByRole("button", { name: "Load more" }).click()
    await expect(page).toHaveURL(/cursor=/)
    expect(page.url()).toContain("sort=popular")
    await expect(cards(page)).toHaveCount(24)
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0)

    await page.goto("/channel/tech_mastery?sort=invalido")
    await expect(page.getByRole("radio", { name: "Latest" })).toHaveAttribute("aria-checked", "true")
    await expect(cards(page).first()).toContainText("Tutorial 01")
  })

  // 3. Canal inexistente

  test("3.1 unknown-nickname-shows-not-found", async ({ page }) => {
    const response = await page.goto("/channel/nao_existe")

    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Channel not found" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/")
  })
})
