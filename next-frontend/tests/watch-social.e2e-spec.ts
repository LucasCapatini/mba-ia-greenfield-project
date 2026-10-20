import { readFileSync } from "node:fs"
import path from "node:path"

import type { Locator, Page, Request } from "@playwright/test"

import { expect, test, waitForHydration } from "./fixtures"

// Generated from specs/watch-social.plan.md (SI-06.17b — phase-06-social-interactions).
// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream faked server-side by mocks/ MSW (store reset by the login handler): `tech-01` is a
// published `tech_mastery` video with 1.2K likes and 23 roots (25 comments) — the store user's own
// root, `bia`'s thread with 2 replies and the most likes, another `bia` root and 20 fillers;
// `comments-down-id` answers 500 to the comments read. Only the storage origin is browser-routed.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
)
const WEBM = readFileSync(path.join(__dirname, "fixtures", "watch-sample.webm"))
const WATCH = "/watch/tech-01"
const LOGIN_FROM_WATCH = /\/login\?returnTo=\/watch\/tech-01$/

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

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email address").fill("studio-canal@example.com")
  await page.getByLabel("Password", { exact: true }).fill("secret123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
  await waitForHydration(page, "header")
}

async function openWatch(page: Page, target = WATCH) {
  await page.goto(target)
  await waitForHydration(page)
}

const roots = (page: Page) =>
  page.getByRole("list", { name: "Comments" }).locator(":scope > li")
/** Raiz cujo texto contém `text` (o `article` externo — as respostas ficam aninhadas nele). */
const rootArticle = (page: Page, text: string): Locator =>
  page.getByRole("list", { name: "Comments" }).locator(":scope > li > article").filter({ hasText: text })
const videoReactions = (page: Page) => page.getByRole("group", { name: "Video reactions" })
const videoLike = (page: Page) => videoReactions(page).getByRole("button", { name: /^Like, / })
const videoDislike = (page: Page) => videoReactions(page).getByRole("button", { name: "Dislike" })
const header = (page: Page) => page.getByRole("heading", { level: 2, name: /Comments?$/ })

test.describe("watch-social", () => {
  test.beforeEach(async ({ page }) => {
    await routeStorage(page)
  })

  // 1. Estado inicial e visitante anônimo

  test("1.1 page-arrives-with-viewer-state", async ({ page }) => {
    await login(page)
    await openWatch(page)

    const like = videoReactions(page).getByRole("button", { name: "Like, 1.2K" })
    const dislike = videoDislike(page)
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(dislike).toHaveAttribute("aria-pressed", "false")
    await expect(dislike).not.toContainText(/\d/)
    await expect(page.getByRole("link", { name: /^Tech Mastery/ })).toContainText("1.2K subscribers")
    await expect(page.getByRole("button", { name: "Subscribed" })).toHaveAttribute("aria-pressed", "true")
    await expect(header(page)).toHaveText("25 Comments")
    await expect(page.getByRole("button", { name: "Sort by: Latest" })).toBeVisible()
    await expect(page.getByLabel("Add a comment")).toBeVisible()
    await expect(roots(page)).toHaveCount(20)
    await expect(page.getByRole("button", { name: "Comment actions" })).toHaveCount(1)
    await expect(
      rootArticle(page, "Alguém mais testou com Docker?").getByRole("button", { name: "Comment actions" })
    ).toBeVisible()

    await page.context().clearCookies()
    await openWatch(page)
    await expect(videoReactions(page).getByRole("button", { name: "Like, 1.2K" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByRole("link", { name: "Sign in to comment" })).toBeVisible()
    await expect(page.getByLabel("Add a comment")).toHaveCount(0)
  })

  test("1.2 anonymous-interaction-goes-to-login", async ({ page }) => {
    await openWatch(page)
    const apiCalls: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url())
    })

    await videoReactions(page).getByRole("button", { name: "Like, 1.2K" }).click()
    await expect(page).toHaveURL(LOGIN_FROM_WATCH)
    expect(apiCalls).toEqual([])

    const gates: ((page: Page) => Locator)[] = [
      (p) => p.getByRole("button", { name: "Subscribe" }),
      (p) => rootArticle(p, "Melhor explicação").getByRole("button", { name: "Reply" }).first(),
      (p) => p.getByRole("link", { name: "Sign in to comment" }),
    ]
    for (const gate of gates) {
      await openWatch(page)
      await gate(page).click()
      await expect(page).toHaveURL(LOGIN_FROM_WATCH)
    }
  })

  test("1.3 owner-draft-hides-social-section", async ({ page }) => {
    await login(page)
    const commentReads: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/comments")) commentReads.push(request.url())
    })
    await openWatch(page, "/watch/ready-draft-01")

    await expect(page.locator("video")).toBeAttached()
    const channel = page.getByRole("link", { name: /^Studio Canal/ })
    await expect(channel).toContainText(/\d+ subscribers?/)
    await expect(page.getByRole("button", { name: /^Subscribe/ })).toHaveCount(0)
    await expect(videoReactions(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: /^Like/ })).toHaveCount(0)
    await expect(header(page)).toHaveCount(0)
    await expect(page.getByLabel("Add a comment")).toHaveCount(0)
    expect(commentReads).toEqual([])
  })

  // 2. Reações e inscrição sem recarregar o RSC

  test("2.1 like-dislike-and-subscribe-without-refresh", async ({ page }) => {
    await login(page)
    await openWatch(page)
    const rscReloads: string[] = []
    page.on("request", (request: Request) => {
      if (request.headers()["rsc"] && new URL(request.url()).pathname === WATCH) {
        rscReloads.push(request.url())
      }
    })
    const reaction = (method: string) =>
      page.waitForResponse(
        (response) =>
          response.request().method() === method &&
          new URL(response.url()).pathname === "/api/videos/tech-01/reaction"
      )

    const liked = reaction("PUT")
    await videoLike(page).click()
    const likeBody = (await (await liked).json()) as { like_count: number }
    expect(likeBody.like_count).toBe(1201)
    await expect(videoLike(page)).toHaveAttribute("aria-pressed", "true")

    const disliked = reaction("PUT")
    await videoDislike(page).click()
    const dislikeBody = (await (await disliked).json()) as { like_count: number; viewer_reaction: string }
    expect(dislikeBody).toMatchObject({ viewer_reaction: "dislike", like_count: 1200 })
    await expect(videoDislike(page)).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(videoLike(page)).toHaveAttribute("aria-pressed", "false")

    const removed = reaction("DELETE")
    await videoDislike(page).click()
    await removed
    await expect(videoDislike(page)).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await expect(videoLike(page)).toHaveAttribute("aria-pressed", "false")

    const unsubscribed = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === "/api/channels/tech_mastery/subscription"
    )
    await page.getByRole("button", { name: "Subscribed" }).click()
    const subscription = (await (await unsubscribed).json()) as { subscriber_count: number }
    expect(subscription.subscriber_count).toBe(1199)
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByRole("link", { name: /^Tech Mastery/ })).toContainText("1.2K subscribers")

    expect(rscReloads).toEqual([])
  })

  // 3. Comentários

  test("3.1 comment-reply-edit-delete-flow", async ({ page }) => {
    await login(page)
    await openWatch(page)

    await page.getByLabel("Add a comment").click()
    await page.getByLabel("Add a comment").fill("  Ótimo conteúdo  ")
    await page.getByRole("button", { name: "Comment", exact: true }).click()
    await expect(header(page)).toHaveText("26 Comments")
    await expect(roots(page).first()).toContainText("Ótimo conteúdo")
    await expect(roots(page).first()).toContainText("@studio_canal")

    const thread = rootArticle(page, "Melhor explicação")
    await thread.getByRole("button", { name: "Reply" }).first().click()
    const replyField = page.getByLabel("Add a reply")
    await replyField.fill("Concordo")
    await replyField.locator("xpath=ancestor::form").getByRole("button", { name: "Reply" }).click()
    await expect(thread.getByRole("button", { name: "3 replies" })).toHaveAttribute("aria-expanded", "true")
    const replies = thread.getByRole("list", { name: "Replies to @bia" }).getByRole("article")
    await expect(replies).toHaveCount(3)
    await expect(replies.last()).toContainText("Concordo")
    await expect(header(page)).toHaveText("27 Comments")

    await replies.filter({ hasText: "Obrigada!" }).getByRole("button", { name: "Reply" }).click()
    await expect(page.getByLabel("Add a reply")).toHaveValue("@bia ")
    await page.getByRole("button", { name: "Cancel" }).last().click()

    const mine = rootArticle(page, "Ótimo conteúdo")
    await mine.getByRole("button", { name: "Comment actions" }).click()
    await page.getByRole("menuitem", { name: "Edit" }).click()
    const editField = page.getByLabel("Edit comment")
    await editField.fill("Ótimo conteúdo, revisado")
    await page.getByRole("button", { name: "Save" }).click()
    const edited = rootArticle(page, "Ótimo conteúdo, revisado")
    await expect(edited).toContainText("(edited)")

    await edited.getByRole("button", { name: "Comment actions" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expect(rootArticle(page, "Ótimo conteúdo, revisado")).toHaveCount(0)
    await expect(header(page)).toHaveText("26 Comments")
  })

  test("3.2 sort-and-pagination", async ({ page }) => {
    // O login reseta o store do MSW (a 3.1 respondeu na thread de `bia`); depois volta a anônimo.
    await login(page)
    await page.context().clearCookies()
    await openWatch(page)

    await page.getByRole("button", { name: "Show more comments" }).click()
    await expect(roots(page)).toHaveCount(23)
    await expect(page.getByRole("button", { name: "Show more comments" })).toHaveCount(0)

    await page.getByRole("button", { name: "Sort by: Latest" }).click()
    await page.getByRole("menuitemradio", { name: "Top" }).click()
    await expect(page.getByRole("button", { name: "Sort by: Top" })).toBeVisible()
    await expect(roots(page).first()).toContainText("Melhor explicação")

    const replyReads: string[] = []
    page.on("request", (request) => {
      if (/\/api\/comments\/[^/]+\/replies/.test(request.url())) replyReads.push(request.url())
    })
    const thread = rootArticle(page, "Melhor explicação")
    await thread.getByRole("button", { name: "2 replies" }).click()
    const replies = thread.getByRole("list", { name: "Replies to @bia" }).getByRole("article")
    await expect(replies).toHaveCount(2)
    await expect(replies.first()).toContainText("Concordo, ficou muito claro.")
    await expect(replies.last()).toContainText("Obrigada!")

    await thread.getByRole("button", { name: "2 replies" }).click()
    await expect(replies).toHaveCount(0)
    await thread.getByRole("button", { name: "2 replies" }).click()
    await expect(replies).toHaveCount(2)
    expect(replyReads).toHaveLength(1)
  })

  test("3.3 comments-error-keeps-page-usable", async ({ page }) => {
    await openWatch(page, "/watch/comments-down-id")

    await expect(page.locator("video")).toBeAttached()
    await expect(page.getByRole("heading", { level: 1, name: "Comentários fora do ar" })).toBeVisible()
    await expect(page.getByRole("link", { name: /^Tech Mastery/ })).toBeVisible()
    const error = page.getByRole("alert").filter({ hasText: "Comments could not be loaded." })
    await expect(error).toBeVisible()
    await expect(error.getByRole("button", { name: "Try again" })).toBeVisible()
  })
})
