import type { Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/studio-video-edit.plan.md (SI-04.18b — phase-04-video-channel-management).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW (store reset by the login handler). The only
// browser-level route is the public storage origin, answering every thumbnail with a tiny PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)
const MIB = 1024 * 1024
const CATEGORY_NAMES = [
  "Music",
  "Gaming",
  "Education",
  "Entertainment",
  "Sports",
  "News",
  "Technology",
  "Travel",
  "Cooking",
  "Other",
]

// The MSW store is shared by the whole server: run this file's scenarios one at a time.
test.describe.configure({ mode: "serial" })

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-edit@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

function isApi(method: string, path: string) {
  return (request: Request) =>
    request.method() === method && new URL(request.url()).pathname === path
}

const thumbnail = (page: Page) => page.getByRole("img", { name: /^Thumbnail of / })

test.describe("studio-video-edit", () => {
  test.describe("signed in", () => {
    test.beforeEach(async ({ page }) => {
      await page.route("http://localhost:9000/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX })
      )
      await login(page)
    })

    // 1. Carregar e salvar

    test("1.1 form-is-prefilled-with-video-and-categories", async ({ page }) => {
      await page.goto("/studio/videos/ready-draft-01/edit")
      await waitForHydration(page)

      await expect(page.getByRole("heading", { level: 1, name: "Edit video" })).toBeVisible()
      await expect(page.getByLabel("Title")).toHaveValue("Aula pronta")
      const category = page.getByRole("combobox", { name: "Category" })
      await expect(category).toHaveText("Music")
      await expect(page.getByRole("radio", { name: /Public/ })).toBeChecked()

      await category.click()
      const options = (await page.getByRole("option").allInnerTexts()).map((text) => text.trim())
      expect(options.filter((name) => name !== "No category")).toEqual(CATEGORY_NAMES)
      await page.keyboard.press("Escape")

      await expect(page.getByRole("link", { name: "localhost:3001/watch/ready-draft-01" })).toHaveAttribute(
        "href",
        "/watch/ready-draft-01"
      )
      await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled()
    })

    test("1.2 save-ready-video-publishes", async ({ page }) => {
      await page.goto("/studio/videos/ready-draft-01/edit")
      await waitForHydration(page)

      await page.getByLabel("Title").fill("Aula final")
      const patchRequest = page.waitForRequest(isApi("PATCH", "/api/videos/ready-draft-01"))
      await page.getByRole("button", { name: "Save Changes" }).click()
      expect((await patchRequest).postDataJSON()).toMatchObject({
        title: "Aula final",
        publish: true,
      })

      await expect(page.getByText("Video published")).toBeVisible()
      await expect(page.getByLabel("Title")).toHaveValue("Aula final")
      await expect(page.getByText(/^Published on /)).toBeVisible()
    })

    test("1.3 save-processing-video-keeps-draft-and-validates", async ({ page }) => {
      await page.goto("/studio/videos/processing-01/edit")
      await waitForHydration(page)

      await page.getByLabel("Title").fill("")
      await expect(page.getByText("Title is required")).toBeVisible()
      await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled()

      await page.getByLabel("Description").fill("x".repeat(5001))
      await expect(page.getByText("Description must be 5000 characters or fewer")).toBeVisible()

      await page.getByLabel("Title").fill("Em processamento")
      await page.getByLabel("Description").fill("Descrição curta")
      const patchResponse = page.waitForResponse((response) =>
        isApi("PATCH", "/api/videos/processing-01")(response.request())
      )
      await page.getByRole("button", { name: "Save Changes" }).click()
      expect(await (await patchResponse).json()).toMatchObject({ published: false })

      await expect(
        page.getByText("Changes saved — the video stays a draft until processing finishes")
      ).toBeVisible()
      await expect(page.getByText(/^Processing… you can save/)).toBeVisible()
    })

    // 2. Thumbnail customizada

    test("2.1 change-and-remove-custom-thumbnail", async ({ page }) => {
      await page.goto("/studio/videos/ready-draft-01/edit")
      await waitForHydration(page)
      const before = await thumbnail(page).getAttribute("src")
      expect(before).toContain("auto.jpg")
      const puts: Request[] = []
      page.on("request", (request) => {
        if (isApi("PUT", "/api/videos/ready-draft-01/thumbnail")(request)) puts.push(request)
      })

      await page.getByLabel("Change Thumbnail").setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(6 * MIB),
      })
      await expect(page.getByText("Max 5 MB")).toBeVisible()
      expect(puts).toHaveLength(0)

      const putRequest = page.waitForRequest(isApi("PUT", "/api/videos/ready-draft-01/thumbnail"))
      await page.getByLabel("Change Thumbnail").setInputFiles({
        name: "capa.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(200 * 1024),
      })
      const put = await putRequest
      expect(put.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/)
      expect(put.postDataBuffer()?.toString("latin1")).toContain('name="file"; filename="capa.png"')

      await expect(page.getByRole("button", { name: "Remove custom thumbnail" })).toBeVisible()
      await expect(thumbnail(page)).toHaveAttribute("src", /custom\.jpg\?v=\d+/)
      expect(await thumbnail(page).getAttribute("src")).not.toBe(before)

      const deleteRequest = page.waitForRequest(
        isApi("DELETE", "/api/videos/ready-draft-01/thumbnail")
      )
      await page.getByRole("button", { name: "Remove custom thumbnail" }).click()
      await deleteRequest
      await expect(thumbnail(page)).toHaveAttribute("src", /auto\.jpg\?v=\d+/)
      await expect(page.getByRole("button", { name: "Remove custom thumbnail" })).toHaveCount(0)
    })

    // 3. Proteção da rota

    test("3.1a foreign-video-shows-not-found", async ({ page }) => {
      await page.goto("/studio/videos/other-channel-01/edit")
      await waitForHydration(page)

      await expect(page.getByRole("heading", { name: "Video not found" })).toBeVisible()
    })
  })

  test("3.1b anonymous-is-redirected", async ({ page }) => {
    await page.goto("/studio/videos/ready-draft-01/edit")
    await waitForHydration(page)

    await expect(page).toHaveURL(
      /\/login\?returnTo=(%2F|\/)studio(%2F|\/)videos(%2F|\/)ready-draft-01(%2F|\/)edit$/
    )
  })
})
