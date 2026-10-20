import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Spec: specs/home.plan.md (SI-07.14b). Upstream faked server-side by mocks/ MSW: `GET /videos`
// lists 41 public cards (pages of 20) newest first; `category=unknown-category` → 404
// CATEGORY_NOT_FOUND; `category=upstream-error` → 500. Thumbnails from localhost:9000 get a PNG.
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

const cards = (page: Page) => page.locator("article[data-slot='video-card']")
const chips = (page: Page) => page.getByRole("navigation", { name: "Categories" })
const sentinel = (page: Page) => page.locator("[data-slot='infinite-scroll-sentinel']")

async function cardTitles(page: Page): Promise<string[]> {
  return cards(page)
    .locator("h3")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""))
}

/** RSC navigations to the home itself — link prefetches (cards, category chips) do not load a page. */
function isHomeRscRequest(request: Request): boolean {
  const url = new URL(request.url())
  const headers = request.headers()
  if (headers["next-router-prefetch"]) return false
  return url.pathname === "/" && (url.searchParams.has("_rsc") || headers["rsc"] === "1")
}

test.describe("home", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
    )
  })

  // 1. Grid e categorias

  test("1.1 anonymous-sees-chips-and-recent-grid", async ({ page }) => {
    await page.goto("/")

    const chipLinks = chips(page).getByRole("link")
    await expect(chipLinks.nth(0)).toHaveText("All")
    await expect(chipLinks.nth(0)).toHaveAttribute("aria-current", "page")
    await expect(chipLinks.nth(1)).toHaveText("Music")
    await expect(chipLinks.nth(2)).toHaveText("Gaming")
    await expect(chipLinks.nth(3)).toHaveText("Education")

    await expect(cards(page)).toHaveCount(20)
    const times = await cards(page)
      .locator("time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""))
    expect(times).toEqual([...times].sort().reverse())
    const firstCard = cards(page).first()
    await expect(firstCard.locator("img").first()).toBeVisible()
    await expect(firstCard.locator("[data-slot='channel-avatar']")).toBeVisible()
    await expect(firstCard).toContainText(/views •/)

    const header = page.locator("[data-slot='app-header']")
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible()
    const nav = page.getByRole("navigation", { name: "Main" })
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")
    await expect(nav.getByText("Sign in to see your subscriptions")).toBeVisible()

    const title = firstCard.locator("h3")
    const href = await firstCard.locator("a[href^='/watch/']").first().getAttribute("href")
    await title.click()
    await expect(page).toHaveURL(href ?? /\/watch\//)
  })

  test("1.2 chip-filters-by-category", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page)

    await chips(page).getByRole("link", { name: "Music" }).click()

    await expect(page).toHaveURL(/\/\?category=music$/)
    await expect(chips(page).getByRole("link", { name: "Music" })).toHaveAttribute("aria-current", "page")
    await expect(cards(page)).toHaveCount(5)
    expect((await cardTitles(page)).sort()).toEqual(
      ["Aula publicada", "Música ao vivo", "Video 01", "Video 02", "Video 03"].sort()
    )

    await chips(page).getByRole("link", { name: "All" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(cards(page)).toHaveCount(20)
  })

  test("1.3 unknown-category-falls-back-to-all", async ({ page }) => {
    const response = await page.goto("/?category=unknown-category")

    expect(response?.status()).toBe(200)
    await expect(page.getByRole("status").filter({ hasText: "Category not found" })).toBeVisible()
    await expect(chips(page).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page")
    await expect(cards(page)).toHaveCount(20)
  })

  // 2. Scroll infinito

  test("2.1 scrolling-loads-next-page-without-rsc", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page)
    await expect(cards(page)).toHaveCount(20)
    const apiCalls: string[] = []
    const rscCalls: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/videos") apiCalls.push(request.url())
      if (isHomeRscRequest(request)) rscCalls.push(request.url())
    })

    await sentinel(page).scrollIntoViewIfNeeded()
    await expect(cards(page)).toHaveCount(40)
    expect(apiCalls[0]).toMatch(/\/api\/videos\?cursor=/)
    const titles = await cardTitles(page)
    expect(new Set(titles).size).toBe(titles.length)

    await sentinel(page).scrollIntoViewIfNeeded()
    await expect(cards(page)).toHaveCount(41)
    await expect(sentinel(page)).toHaveCount(0)
    expect(page.url()).toMatch(/\/$/)
    expect(rscCalls).toEqual([])
  })

  test("2.2 load-more-works-from-keyboard", async ({ page }) => {
    // Without IntersectionObserver the sentinel never loads by itself: only the keyboard fallback.
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "IntersectionObserver")
    })
    await page.goto("/")
    await waitForHydration(page)
    await expect(cards(page)).toHaveCount(20)

    await cards(page).last().locator("a").last().focus()
    const loadMore = page.getByRole("button", { name: "Load more" })
    for (let tab = 0; tab < 10 && !(await loadMore.evaluate((el) => el === document.activeElement)); tab++) {
      await page.keyboard.press("Tab")
    }
    await expect(loadMore).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(cards(page)).toHaveCount(40)
  })

  test("2.3 back-from-watch-restores-cards-and-scroll", async ({ page }) => {
    await page.goto("/")
    await waitForHydration(page)
    await sentinel(page).scrollIntoViewIfNeeded()
    await expect(cards(page)).not.toHaveCount(20)
    const loaded = await cards(page).count()

    const card = cards(page).nth(25)
    const title = (await card.locator("h3").textContent())?.trim() ?? ""
    await card.locator("h3").click()
    await expect(page).toHaveURL(/\/watch\//)
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible()

    const apiCalls: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/videos") apiCalls.push(request.url())
    })
    await page.goBack()

    await expect(page).toHaveURL(/\/$/)
    await expect(cards(page)).toHaveCount(loaded)
    await expect(cards(page).filter({ hasText: title }).first()).toBeInViewport()
    expect(apiCalls).toEqual([])
  })

  // 3. Erros

  test("3.1 first-page-failure-shows-try-again", async ({ page }) => {
    await page.goto("/?category=upstream-error")
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await waitForHydration(page, "header")

    await page.getByRole("link", { name: "StreamTube home" }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(cards(page)).toHaveCount(20)
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0)
  })
})
