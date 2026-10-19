import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/studio-upload.plan.md (SI-04.15b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW (store reset by the login handler). The only
// browser-level route is the presigned storage origin (http://localhost:9000) — part PUTs go
// straight from the browser to the storage, never through /api/** (which must not be routed).
const STORAGE = "http://localhost:9000/**"
const MIB = 1024 * 1024

// The MSW store is shared by the whole dev server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function login(page: Page, email: string) {
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
}

/** Presigned part PUTs (and their CORS preflights) answered with an exposed ETag. */
async function routeStorage(page: Page): Promise<string[]> {
  const puts: string[] = []
  await page.route(STORAGE, async (route) => {
    const request = route.request()
    const cors = {
      "Access-Control-Allow-Origin": "http://localhost:3001",
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "ETag",
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const partNumber = new URL(request.url()).searchParams.get("partNumber") ?? "0"
    puts.push(request.url())
    await route.fulfill({ status: 200, headers: { ...cors, ETag: `"etag-${partNumber}"` } })
  })
  return puts
}

function isCreateVideo(request: Request): boolean {
  return request.method() === "POST" && new URL(request.url()).pathname === "/api/videos"
}

test.describe("studio-upload", () => {
  // 1. Selecionar arquivo e iniciar o upload

  test.describe("signed in", () => {
    let storagePuts: string[]

    test.beforeEach(async ({ page }) => {
      await page.goto("/login")
      await login(page, "studio-upload@example.com")
      await page.waitForURL("/")
      await waitForHydration(page, "header")
      storagePuts = await routeStorage(page)
    })

    test("1.1 valid-mp4-creates-upload-and-navigates", async ({ page }) => {
      await page.goto("/studio/upload")
      await waitForHydration(page)

      await expect(page.getByRole("heading", { level: 1, name: "Upload video" })).toBeVisible()
      await expect(page.getByText("MP4 or WebM, up to 10 GB")).toBeVisible()
      await expect(page.getByText("Select file")).toBeVisible()

      const createRequest = page.waitForRequest(isCreateVideo)
      await page.getByLabel("Select file").setInputFiles({
        name: "aula.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.alloc(12 * MIB),
      })

      const request = await createRequest
      expect(request.postDataJSON()).toEqual({
        original_filename: "aula.mp4",
        content_type: "video/mp4",
        size_bytes: 12582912,
      })
      await expect(page).toHaveURL(/\/studio\/upload\/new-upload-id$/)
      await expect.poll(() => storagePuts.length, { timeout: 15_000 }).toBeGreaterThan(0)
      expect(storagePuts[0]).toMatch(/^http:\/\/localhost:9000\//)
    })

    test("1.2 unsupported-file-is-rejected-locally", async ({ page }) => {
      await page.goto("/studio/upload")
      await waitForHydration(page)
      const creates: Request[] = []
      page.on("request", (request) => {
        if (isCreateVideo(request)) creates.push(request)
      })

      await page.getByLabel("Select file").setInputFiles({
        name: "clipe.mov",
        mimeType: "video/quicktime",
        buffer: Buffer.alloc(1024),
      })

      await expect(page.getByText("Only MP4 and WebM files are supported")).toBeVisible()
      expect(creates).toHaveLength(0)
      await expect(page).toHaveURL(/\/studio\/upload$/)

      const createRequest = page.waitForRequest(isCreateVideo)
      await page.getByLabel("Select file").setInputFiles({
        name: "aula.webm",
        mimeType: "video/webm",
        buffer: Buffer.alloc(MIB),
      })

      const request = await createRequest
      expect(request.postDataJSON()).toMatchObject({ content_type: "video/webm" })
      await expect(page.getByText("Only MP4 and WebM files are supported")).toHaveCount(0)
    })
  })

  // 2. Acesso sem sessão

  test("2.1 anonymous-is-redirected-to-login", async ({ page }) => {
    await page.goto("/studio/upload")
    await waitForHydration(page)

    await expect(page).toHaveURL(/\/login\?returnTo=(%2F|\/)studio(%2F|\/)upload$/)
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()

    await login(page, "studio-upload@example.com")

    await expect(page).toHaveURL(/\/studio\/upload$/)
    await expect(page.getByRole("heading", { level: 1, name: "Upload video" })).toBeVisible()
  })
})
