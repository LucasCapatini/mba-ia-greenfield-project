import type { Page } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Spec: specs/search-results.plan.md (SI-07.15b). Upstream faked server-side by mocks/ MSW:
// `GET /videos?q=` matches title or channel name/nickname without accents or case ("musica" →
// "Música ao vivo"; "mastery" → the 24 videos of tech_mastery, pages of 20 + 4); `q` outside 2–100
// → 400. Thumbnails from localhost:9000 get a PNG.
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

const cards = (page: Page) => page.locator("article[data-slot='video-card']")
const searchField = (page: Page) =>
  page.locator("[data-slot='app-header']").getByRole("searchbox", { name: "Search" })

test.describe("search-results", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
    )
  })

  // 1. Busca pelo header

  test("1.1 header-search-shows-matches-by-title", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page, "header")

    await searchField(page).fill("musica")
    await searchField(page).press("Enter")

    await expect(page).toHaveURL(/\/results\?q=musica$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “musica”")
    await expect(cards(page).filter({ hasText: "Música ao vivo" })).toHaveCount(1)
    await expect(page.getByRole("navigation", { name: "Categories" })).toHaveCount(0)
    await expect(searchField(page)).toHaveValue("musica")
  })

  test("1.2 search-by-channel-name-with-infinite-scroll", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page, "header")

    await searchField(page).fill("mastery")
    await page.getByRole("button", { name: "Submit search" }).click()

    await expect(page).toHaveURL(/\/results\?q=mastery$/)
    await expect(cards(page)).toHaveCount(20)
    const channels = await cards(page)
      .getByRole("link", { name: "Tech Mastery" })
      .count()
    expect(channels).toBe(20)

    const nextPage = page.waitForRequest(
      (request) => /\/api\/videos\?.*q=mastery.*cursor=|\/api\/videos\?.*cursor=.*q=mastery/.test(request.url())
    )
    await page.locator("[data-slot='infinite-scroll-sentinel']").scrollIntoViewIfNeeded()
    await nextPage
    await expect(cards(page)).toHaveCount(24)
    await expect(page.locator("[data-slot='infinite-scroll-sentinel']")).toHaveCount(0)
  })

  // 2. Termos inválidos e sem resultado

  test("2.1 empty-query-redirects-home", async ({ page }) => {
    await page.goto("/results")
    await expect(page).toHaveURL(/\/$/)

    await page.goto("/results?q=%20%20%20")
    await expect(page).toHaveURL(/\/$/)

    await waitForHydration(page, "header")
    await searchField(page).press("Enter")
    await expect(page).toHaveURL(/\/$/)
  })

  test("2.2 one-character-query-shows-rule-without-api-call", async ({ page }) => {
    const apiCalls: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/videos") apiCalls.push(request.url())
    })

    await page.goto("/results?q=a")

    await expect(page.getByText("Enter at least 2 characters")).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    expect(apiCalls).toEqual([])
  })

  test("2.3 no-results-shows-empty-state", async ({ page }) => {
    await page.goto("/results?q=termo-sem-resultado")

    await expect(page.getByText("No results for “termo-sem-resultado”")).toBeVisible()
    await waitForHydration(page)
    await page.getByRole("link", { name: "Go to the home page" }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
