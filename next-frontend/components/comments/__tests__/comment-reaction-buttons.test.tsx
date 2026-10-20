// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/server"

import { CommentReactionButtons } from "../comment-reaction-buttons"

const { router, toastError } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

const COMMENT_ID = "00000000-0000-4000-8000-000000000002"
const URL_PATTERN = "/api/comments/:commentId/reaction"

function recordMutations(respond: () => Response): { method: string; url: string; body: unknown }[] {
  const sent: { method: string; url: string; body: unknown }[] = []
  const handler = async ({ request }: { request: Request }) => {
    sent.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: request.method === "PUT" ? await request.json() : null,
    })
    return respond()
  }
  server.use(http.put(URL_PATTERN, handler), http.delete(URL_PATTERN, handler))
  return sent
}

function renderButtons(
  viewerReaction: "like" | "dislike" | null = null,
  isLoggedIn = true
) {
  return render(
    <CommentReactionButtons
      commentId={COMMENT_ID}
      initial={{ viewer_reaction: viewerReaction, like_count: 245, dislike_count: 3 }}
      isLoggedIn={isLoggedIn}
    />
  )
}

beforeEach(() => {
  router.push.mockReset()
  toastError.mockReset()
})

describe("<CommentReactionButtons />", () => {
  it("likes the comment through its own route and reconciles the count", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() =>
      HttpResponse.json({ viewer_reaction: "like", like_count: 250, dislike_count: 3 })
    )
    renderButtons()

    await user.click(screen.getByRole("button", { name: "Like, 245" }))

    const like = await screen.findByRole("button", { name: "Like, 250" })
    expect(like).toHaveAttribute("aria-pressed", "true")
    expect(sent).toEqual([
      { method: "PUT", url: `/api/comments/${COMMENT_ID}/reaction`, body: { value: "like" } },
    ])
  })

  it("dislikes, then removes the dislike with DELETE", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() =>
      HttpResponse.json({ viewer_reaction: null, like_count: 245, dislike_count: 3 })
    )
    renderButtons("dislike")

    await user.click(screen.getByRole("button", { name: "Dislike" }))

    await waitFor(() => expect(sent.map((item) => item.method)).toEqual(["DELETE"]))
    expect(await screen.findByRole("button", { name: "Dislike" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("reverts with a toast when the comment no longer exists", async () => {
    const user = userEvent.setup()
    recordMutations(() =>
      HttpResponse.json(
        { statusCode: 404, error: "COMMENT_NOT_FOUND", message: "Comment not found" },
        { status: 404 }
      )
    )
    renderButtons()

    await user.click(screen.getByRole("button", { name: "Like, 245" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("This comment is no longer available")
    )
    expect(await screen.findByRole("button", { name: "Like, 245" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("sends an anonymous visitor to login without calling the API", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() => HttpResponse.json({}))
    renderButtons(null, false)

    await user.click(screen.getByRole("button", { name: "Like, 245" }))

    expect(router.push).toHaveBeenCalledWith("/login?returnTo=/watch/tech-01")
    expect(sent).toEqual([])
  })
})
