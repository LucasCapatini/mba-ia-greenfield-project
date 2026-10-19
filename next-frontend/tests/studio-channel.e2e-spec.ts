import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/studio-channel.plan.md (SI-04.19b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW: channel `studio_canal` in the store (reset by the
// login handler); `taken_nick` is the reserved trigger answering 409 NICKNAME_TAKEN.

// The MSW store is shared by the whole server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-canal@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

const isChannelPatch = (request: Request) =>
  request.method() === "PATCH" && new URL(request.url()).pathname === "/api/channel"

const header = (page: Page) => page.locator("[data-slot='channel-header-card']")
const handle = (page: Page) => page.getByLabel("Channel handle")
const save = (page: Page) => page.getByRole("button", { name: "Save Changes" })

test.describe("studio-channel", () => {
  test.describe("signed in", () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
    })

    // 1. Visualizar e editar o canal

    test("1.1 settings-show-current-channel", async ({ page }) => {
      await page.getByRole("link", { name: "Meu canal" }).click()

      await expect(page).toHaveURL(/\/studio\/channel$/)
      await expect(page.getByRole("heading", { level: 1, name: "Channel Settings" })).toBeVisible()
      await expect(header(page)).toContainText("Studio Canal")
      await expect(header(page)).toContainText("@studio_canal")
      await expect(header(page)).toContainText("3 videos")
      await expect(header(page)).not.toContainText(/subscribers/i)

      await expect(handle(page)).toHaveValue("studio_canal")
      await expect(page.locator("[data-slot='handle-prefix']")).toHaveText("@")
      await expect(page.getByLabel("Display name")).toHaveValue("Studio Canal")
      await expect(page.getByLabel("Description")).toHaveValue("Canal de testes")
      await expect(save(page)).toBeDisabled()
    })

    test("1.2 changing-handle-updates-header", async ({ page }) => {
      await page.goto("/studio/channel")
      await waitForHydration(page)

      await handle(page).fill("novo_canal")
      const patchRequest = page.waitForRequest(isChannelPatch)
      await save(page).click()
      expect((await patchRequest).postDataJSON()).toEqual({ nickname: "novo_canal" })

      await expect(page.getByText("Channel updated")).toBeVisible()
      await expect(header(page)).toContainText("@novo_canal")
    })

    // Steps 2–3 of scenario 1.2: the public page follows the new handle; the old one is a 404.
    test("1.2b changing-handle-updates-public-url", async ({ page }) => {
      await page.goto("/studio/channel")
      await waitForHydration(page)
      await handle(page).fill("novo_canal")
      await save(page).click()
      await expect(header(page)).toContainText("@novo_canal")

      await page.goto("/channel/novo_canal")
      await expect(page.getByRole("heading", { name: "Studio Canal" })).toBeVisible()

      const old = await page.goto("/channel/studio_canal")
      expect(old?.status()).toBe(404)
      await expect(page.getByRole("heading", { name: "Channel not found" })).toBeVisible()
    })

    test("1.3 taken-and-invalid-handles-are-blocked", async ({ page }) => {
      await page.goto("/studio/channel")
      await waitForHydration(page)
      const patches: Request[] = []
      page.on("request", (request) => {
        if (isChannelPatch(request)) patches.push(request)
      })

      await handle(page).fill("admin")
      await expect(page.getByText("This handle is reserved")).toBeVisible()
      await expect(save(page)).toBeDisabled()
      expect(patches).toHaveLength(0)

      await handle(page).fill("Ab")
      await expect(
        page.getByText("Use 3–50 lowercase letters, numbers or underscores")
      ).toBeVisible()

      await page.getByLabel("Display name").fill("")
      await expect(page.getByText("Display name is required")).toBeVisible()

      await page.getByLabel("Display name").fill("Studio Canal")
      await handle(page).fill("taken_nick")
      const patchRequest = page.waitForRequest(isChannelPatch)
      await save(page).click()
      await patchRequest

      await expect(page.getByText("This handle is already taken")).toBeVisible()
      await expect(header(page)).toContainText("@studio_canal")
    })
  })

  // 2. Proteção da rota

  test("2.1 anonymous-is-redirected", async ({ page }) => {
    await page.goto("/studio/channel")
    await waitForHydration(page)

    await expect(page).toHaveURL(/\/login\?returnTo=(%2F|\/)studio(%2F|\/)channel$/)
  })
})
