import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/studio-upload-processing.plan.md (SI-04.16b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW (store reset by the login handler). The only
// browser-level route is the presigned storage origin (http://localhost:9000) for the part PUTs.
const STORAGE = "http://localhost:9000/**"
const MIB = 1024 * 1024
const EDUCATION_ID = "00000000-0000-4000-8000-000000000003"

// The MSW store is shared by the whole dev server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-proc@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

/** Presigned part PUTs (+ CORS preflight) answered with an exposed ETag after `delayMs`. */
async function routeStorage(page: Page, delayMs: number) {
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
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    // The browser may have aborted the PUT meanwhile (cancel scenario).
    await route
      .fulfill({ status: 200, headers: { ...cors, ETag: `"etag-${partNumber}"` } })
      .catch(() => undefined)
  })
}

async function startUpload(page: Page) {
  await page.goto("/studio/upload")
  await waitForHydration(page)
  await page.getByLabel("Select file").setInputFiles({
    name: "aula.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(12 * MIB),
  })
  await expect(page).toHaveURL(/\/studio\/upload\/new-upload-id$/)
}

function isApi(method: string, path: string) {
  return (request: Request) =>
    request.method() === method && new URL(request.url()).pathname === path
}

test.describe("studio-upload-processing", () => {
  test.describe("signed in", () => {
    // 1. Progresso e processamento

    test("1.1 upload-progress-then-processing-then-ready", async ({ page }) => {
      await login(page)
      // The 3 parts go out in parallel; a 4 s storage answer keeps the "uploading" phase longer
      // than a cold `next dev` compile of the processing page.
      await routeStorage(page, 4_000)

      const completeRequest = page.waitForRequest(
        isApi("POST", "/api/videos/new-upload-id/upload/complete")
      )
      await startUpload(page)

      await expect(page.getByRole("heading", { level: 1, name: "Upload video" })).toBeVisible()
      const progressbar = page.getByRole("progressbar", { name: "Upload progress" })
      await expect(progressbar).toBeVisible()
      await expect(page.getByText(/^Uploading… \d+%$/)).toBeVisible()
      await expect
        .poll(async () => Number(await progressbar.getAttribute("aria-valuenow")))
        .toBeGreaterThan(0)

      const complete = await completeRequest
      expect((complete.postDataJSON() as { parts: unknown[] }).parts).toHaveLength(3)
      await expect(page.getByText("Processing…", { exact: true })).toBeVisible()

      await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/^Checks complete/)).toBeVisible()
    })

    // 2. Salvar metadados durante e depois do processamento

    test("2.1 save-while-processing-keeps-draft", async ({ page }) => {
      await login(page)
      await page.goto("/studio/upload/processing-01")
      await waitForHydration(page)
      const patches: Request[] = []
      page.on("request", (request) => {
        if (isApi("PATCH", "/api/videos/processing-01")(request)) patches.push(request)
      })

      // Fields validate as they change and Save stays disabled while the form is invalid
      // (the edit spec, studio-video-edit 1.3, pins this for the shared form).
      await page.getByLabel("Title").fill("")
      await expect(page.getByText("Title is required")).toBeVisible()
      await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled()
      expect(patches).toHaveLength(0)

      await page.getByLabel("Title").fill("Minha aula")
      await page.getByRole("combobox", { name: "Category" }).click()
      await page.getByRole("option", { name: "Education" }).click()
      await page.getByRole("radio", { name: /Unlisted/ }).check()

      const patchRequest = page.waitForRequest(isApi("PATCH", "/api/videos/processing-01"))
      await page.getByRole("button", { name: "Save Changes" }).click()
      const request = await patchRequest
      expect(request.postDataJSON()).toMatchObject({
        title: "Minha aula",
        visibility: "unlisted",
        category_id: EDUCATION_ID,
        publish: true,
      })

      await expect(
        page.getByText("Changes saved — the video stays a draft until processing finishes")
      ).toBeVisible()
      await expect(page.getByLabel("Title")).toHaveValue("Minha aula")
      await expect(page.getByText(/^Processing… you can save/)).toBeVisible()
    })

    test("2.2 save-when-ready-publishes", async ({ page }) => {
      await login(page)
      await page.goto("/studio/upload/ready-draft-01")
      await waitForHydration(page)

      await page.getByLabel("Description").fill("Aula com descrição nova")
      const patchResponse = page.waitForResponse(
        (response) => isApi("PATCH", "/api/videos/ready-draft-01")(response.request())
      )
      await page.getByRole("button", { name: "Save Changes" }).click()
      const response = await patchResponse
      expect(await response.json()).toMatchObject({ published: true })

      await expect(page.getByText("Video published")).toBeVisible()
      await expect(page.getByText(/^Published/)).toBeVisible()
    })

    // 3. Cancelar o upload

    test("3.1 cancel-during-upload-aborts-and-returns", async ({ page }) => {
      await login(page)
      await routeStorage(page, 5_000)
      await startUpload(page)
      const deletes: Request[] = []
      page.on("request", (request) => {
        if (request.method() === "DELETE") deletes.push(request)
      })

      await page.getByRole("button", { name: "Cancel", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: "Cancel upload?" })
      await expect(dialog).toContainText("The file and this draft will be discarded.")

      await dialog.getByRole("button", { name: "Keep uploading" }).click()
      await expect(dialog).toBeHidden()
      expect(deletes).toHaveLength(0)
      await expect(page.getByText(/^Uploading… \d+%$/)).toBeVisible()

      await page.getByRole("button", { name: "Cancel", exact: true }).click()
      const deleteRequest = page.waitForRequest(
        isApi("DELETE", "/api/videos/new-upload-id/upload")
      )
      await page.getByRole("dialog", { name: "Cancel upload?" })
        .getByRole("button", { name: "Cancel upload" })
        .click()
      await deleteRequest

      await expect(page).toHaveURL(/\/studio\/videos$/)
      await expect(page.locator('a[href*="new-upload-id"]')).toHaveCount(0)
    })
  })

  // 4. Proteção da rota

  test("4.1 anonymous-redirects-and-foreign-video-404", async ({ page }) => {
    await page.goto("/studio/upload/ready-draft-01")
    await waitForHydration(page)
    await expect(page).toHaveURL(
      /\/login\?returnTo=(%2F|\/)studio(%2F|\/)upload(%2F|\/)ready-draft-01$/
    )

    await login(page)
    const response = await page.goto("/studio/upload/other-channel-01")
    expect(response?.status()).toBe(404)
    await expect(page.getByText("This page could not be found.")).toBeVisible()
  })
})
