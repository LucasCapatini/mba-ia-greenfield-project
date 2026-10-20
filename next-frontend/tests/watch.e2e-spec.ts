import { readFileSync } from "node:fs"
import path from "node:path"

import type { Page, Response } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/watch.plan.md (SI-05.11b — phase-05-watch-page).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW (store reset by the login handler). The only
// browser-level route is the public storage origin: `videos/**/source` answers with the 2 s WebM
// fixture (whole body, 200 — no Range, accepted by watch-page/TD-07) and thumbnails with a PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)
const WEBM = readFileSync(path.join(__dirname, "fixtures", "watch-sample.webm"))

// The MSW store is shared by the whole server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function routeStorage(page: Page) {
  await page.route("http://localhost:9000/**", (route) => {
    const url = route.request().url()
    if (url.includes("/videos/") && url.includes("/source")) {
      return route.fulfill({ status: 200, contentType: "video/webm", body: WEBM })
    }
    return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
  })
}

async function loginAsOwner(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-watch@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

async function openWatch(page: Page, publicId: string): Promise<Response | null> {
  const response = await page.goto(`/watch/${publicId}`)
  await waitForHydration(page)
  return response
}

const isViewsCall = (publicId: string) => (response: Response) =>
  response.request().method() === "POST" &&
  new URL(response.url()).pathname === `/api/videos/${publicId}/views`

test.describe("watch", () => {
  test.beforeEach(async ({ page }) => {
    await routeStorage(page)
  })

  // 1. Acesso anônimo e conteúdo da página

  test("1.1 anonymous-sees-full-watch-page", async ({ page }) => {
    await openWatch(page, "published-01")

    await expect(page).toHaveTitle(/Aula publicada/)
    await expect(page.getByRole("heading", { level: 1, name: "Aula publicada" })).toBeVisible()
    const channel = page.getByRole("link", { name: "Studio Canal", exact: true })
    await expect(channel).toHaveAttribute("href", "/channel/studio_canal")
    await expect(channel).toContainText("SC")

    const video = page.locator("video")
    await expect(video).toHaveAttribute("poster", /\/thumbnails\/published-01\//)
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mute" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Enter full screen" })).toBeVisible()
    await expect(page.getByRole("slider", { name: "Seek" })).toBeAttached()
    await expect(
      page.getByRole("button", {
        name: /subscribe|like|subtitles|captions|settings|miniplayer|theater/i,
      })
    ).toHaveCount(0)
    await expect(page.getByRole("textbox")).toHaveCount(0)

    const description = page.getByRole("region", { name: "Description" })
    await expect(description).toContainText(/views • /)
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible()

    const related = page.getByRole("region", { name: "Related videos" }).getByRole("link")
    expect(await related.count()).toBeGreaterThan(0)
    for (const href of await related.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    )) {
      expect(href).toMatch(/^\/watch\//)
      expect(href).not.toBe("/watch/published-01")
    }
  })

  test("1.2 playback-and-single-view-registration", async ({ page }) => {
    const views: Response[] = []
    page.on("response", (response) => {
      if (isViewsCall("published-01")(response)) views.push(response)
    })
    await openWatch(page, "published-01")
    const play = page.getByRole("button", { name: "Play" })
    await expect(play).toBeEnabled()

    const registered = page.waitForResponse(isViewsCall("published-01"))
    await play.click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
    // The 2 s fixture is shorter than 10 s: the view registers when it ends.
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 10_000 })
    expect((await registered).status()).toBe(204)
    expect(views).toHaveLength(1)

    await page.getByRole("button", { name: "Play" }).click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 10_000 })
    expect(views).toHaveLength(1)
  })

  test("1.3 description-expands-and-collapses", async ({ page }) => {
    await openWatch(page, "published-01")
    const description = page.getByRole("region", { name: "Description" })
    const more = description.getByRole("button", { name: "…more" })
    await expect(more).toHaveAttribute("aria-expanded", "false")

    await more.click()

    const less = description.getByRole("button", { name: "Show less" })
    await expect(less).toHaveAttribute("aria-expanded", "true")
    await expect(description).toContainText("Material complementar na descrição do canal.")
    await expect(description.getByRole("link")).toHaveCount(0)

    await less.click()

    await expect(description.getByRole("button", { name: "…more" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  // 2. Download e unlisted

  test("2.1 download-item-points-to-download-url", async ({ page }) => {
    await openWatch(page, "published-01")

    await page.getByRole("button", { name: "More actions" }).click()

    const download = page.getByRole("menuitem", { name: "Download" })
    await expect(download).toBeVisible()
    const href = await download.getAttribute("href")
    expect(href).toMatch(/^http:\/\/localhost:9000\//)
    expect(href).toContain("X-Amz-Signature=download")
  })

  test("2.2 unlisted-opens-by-link-and-is-never-suggested", async ({ page }) => {
    await openWatch(page, "unlisted-01")
    await expect(page.getByRole("heading", { level: 1, name: "Aula não listada" })).toBeVisible()
    await expect(page.locator("video")).toHaveCount(1)

    await openWatch(page, "published-01")

    await expect(
      page.getByRole("region", { name: "Related videos" }).locator('a[href="/watch/unlisted-01"]')
    ).toHaveCount(0)
  })

  // 3. Estados de erro

  test("3.1 missing-video-renders-not-found", async ({ page }) => {
    const missing = await openWatch(page, "notfound-id")
    expect(missing?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Video not found" })).toBeVisible()
    await expect(page.locator("video")).toHaveCount(0)

    const draft = await openWatch(page, "processing-01")
    expect(draft?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Video not found" })).toBeVisible()
  })

  test("3.2 owner-processing-and-storage-error-placeholders", async ({ page }) => {
    await loginAsOwner(page)
    await openWatch(page, "processing-01")
    await expect(
      page.getByRole("heading", { level: 1, name: "Vídeo em processamento" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Studio Canal", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Description" })).toBeVisible()
    await expect(page.getByRole("status").filter({ hasText: "Processing…" })).toBeVisible()
    await expect(page.locator("video")).toHaveCount(0)

    await page.context().clearCookies()
    await openWatch(page, "storage-down-id")
    const alert = page.getByRole("main").getByRole("alert")
    await expect(alert).toHaveText("This video can't be played right now.")
    await expect(page.getByRole("heading", { level: 1, name: "Storage fora do ar" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Studio Canal", exact: true })).toBeVisible()

    const reread = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/watch/storage-down-id" &&
        request.headers()["rsc"] === "1"
    )
    await page.getByRole("button", { name: "Try again" }).click()
    await reread
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("This video can't be played right now.")
  })
})
