import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/studio-videos.plan.md (SI-04.17b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW: 22 owner videos, store reset by the login handler.
// No browser-level routes except the storage origin for thumbnails.

// The MSW store is shared by the whole server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-list@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

const rows = (page: Page) => page.locator("li[data-public-id]")
const row = (page: Page, publicId: string) => page.locator(`li[data-public-id="${publicId}"]`)

function isApi(method: string, path: string) {
  return (request: Request) =>
    request.method() === method && new URL(request.url()).pathname === path
}

async function openRowMenu(page: Page, publicId: string) {
  // The menus are non-modal: wait for the previous one to finish closing so only one is open.
  await expect(page.getByRole("menu")).toHaveCount(0)
  await row(page, publicId).getByRole("button", { name: "Video actions" }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toHaveCount(1)
  return menu
}

test.describe("studio-videos", () => {
  test.describe("signed in", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("http://localhost:9000/**", (route) => route.fulfill({ status: 404 }))
      await login(page)
    })

    // 1. Lista, filtros e paginação

    test("1.1 list-renders-with-total-and-states", async ({ page }) => {
      await page.getByRole("link", { name: "Meus vídeos" }).click()

      await expect(page).toHaveURL(/\/studio\/videos$/)
      await expect(page.getByRole("heading", { level: 1, name: "Channel content" })).toBeVisible()
      await expect(page.getByText("22 videos", { exact: true })).toBeVisible()
      await expect(rows(page)).toHaveCount(20)
      await expect(page.getByRole("button", { name: "Load more" })).toBeVisible()
      for (const label of ["Draft", "Public", "Processing", "Failed"]) {
        await expect(page.locator("[data-slot='video-status']", { hasText: label }).first()).toBeVisible()
      }

      await page.getByRole("button", { name: "Load more" }).click()

      await expect(page).toHaveURL(/[?&]cursor=/)
      await expect(rows(page)).toHaveCount(22)
      await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0)
    })

    test("1.2 filters-and-search-are-reflected", async ({ page }) => {
      await page.goto("/studio/videos")
      await waitForHydration(page)

      await page.getByRole("button", { name: "Filter" }).click()
      await page.getByRole("menuitemradio", { name: "Draft" }).click()
      await page.getByRole("searchbox", { name: "Search your videos" }).fill("aula")

      await expect(page).toHaveURL(/status=draft/)
      await expect(page).toHaveURL(/q=aula/)
      expect(page.url()).not.toContain("cursor=")
      await expect(rows(page)).toHaveCount(4)
      const titles = await rows(page).locator("a").allInnerTexts()
      expect(titles.map((title) => title.trim()).sort()).toEqual(
        ["Aula 2", "Aula processando", "Aula pronta", "aula 3"].sort()
      )
      await expect(page.getByText("4 videos", { exact: true })).toBeVisible()

      await page.goto("/studio/videos?status=draft&q=aula")

      await waitForHydration(page)
      await expect(page.getByRole("button", { name: "Status: Draft" })).toBeVisible()
      await expect(page.getByRole("searchbox", { name: "Search your videos" })).toHaveValue("aula")

      await page.getByRole("button", { name: "Date" }).click()
      const dateDialog = page.getByRole("dialog", { name: "Filter by date" })
      await dateDialog.getByLabel("From").fill("2026-10-10")
      await dateDialog.getByLabel("To").fill("2026-10-01")
      await dateDialog.getByRole("button", { name: "Apply" }).click()
      await expect(dateDialog.getByRole("alert")).toContainText(
        "The start date must be on or before the end date."
      )
      expect(page.url()).not.toMatch(/[?&](from|to)=/)
      await page.keyboard.press("Escape")

      await page.getByRole("button", { name: "Clear filters" }).click()
      await expect(page).toHaveURL(/\/studio\/videos$/)
      await expect(page.getByText("22 videos", { exact: true })).toBeVisible()
    })

    // 2. Ações por linha

    test("2.1 publish-and-delete-from-kebab", async ({ page }) => {
      await page.goto("/studio/videos")
      await waitForHydration(page)

      const publishRequest = page.waitForRequest(isApi("POST", "/api/videos/ready-draft-01/publish"))
      const menu = await openRowMenu(page, "ready-draft-01")
      await menu.getByRole("menuitem", { name: "Publish" }).click()
      await publishRequest
      await expect(
        row(page, "ready-draft-01").locator("[data-slot='video-status']", { hasText: "Public" })
      ).toBeVisible()

      const deletes: Request[] = []
      page.on("request", (request) => {
        if (request.method() === "DELETE") deletes.push(request)
      })
      await (await openRowMenu(page, "published-01")).getByRole("menuitem", { name: "Delete" }).click()
      const dialog = page.getByRole("dialog", { name: "Delete video?" })
      await expect(dialog).toBeVisible()
      expect(deletes).toHaveLength(0)

      const deleteRequest = page.waitForRequest(isApi("DELETE", "/api/videos/published-01"))
      await dialog.getByRole("button", { name: "Delete" }).click()
      await deleteRequest
      await expect(row(page, "published-01")).toHaveCount(0)
      await expect(page.getByText("21 videos", { exact: true })).toBeVisible()

      const failedMenu = await openRowMenu(page, "failed-01")
      await expect(failedMenu.getByRole("menuitem", { name: /^Publish/ })).toBeDisabled()
    })

    test("2.2 processing-row-updates-automatically", async ({ page }) => {
      const polls: Request[] = []
      page.on("request", (request) => {
        if (isApi("GET", "/api/videos/becomes-ready-02")(request)) polls.push(request)
      })
      await page.goto("/studio/videos")
      await waitForHydration(page)

      const badge = row(page, "becomes-ready-02").locator("[data-slot='video-status']")
      await expect(badge).toHaveText("Processing")
      await expect.poll(() => polls.length, { timeout: 10_000 }).toBeGreaterThan(0)

      await expect(badge).toHaveText("Draft", { timeout: 15_000 })
      const settled = polls.length
      await page.waitForTimeout(6_500)
      expect(polls.length).toBe(settled)
    })
  })

  // 3. Proteção da rota

  test("3.1 anonymous-is-redirected", async ({ page }) => {
    await page.goto("/studio/videos")
    await waitForHydration(page)

    await expect(page).toHaveURL(/\/login\?returnTo=(%2F|\/)studio(%2F|\/)videos$/)
  })
})
