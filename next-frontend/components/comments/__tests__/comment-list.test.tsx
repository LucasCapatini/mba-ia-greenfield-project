// @vitest-environment jsdom
import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Comment, CommentsPage } from "@/lib/api/contracts"
import { buildCommentResponse } from "@/mocks/factories/social"
import { server } from "@/mocks/server"

import { CommentList } from "../comment-list"

const { router, toastError } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

const NOW = new Date("2026-10-01T12:00:00.000Z")

/** Estado da seção (lista + cursor + cabeçalho) em volta da lista controlada. */
function Harness({ page, count = 25 }: { page: CommentsPage; count?: number }) {
  const [comments, setComments] = React.useState<Comment[]>(page.items)
  const [cursor, setCursor] = React.useState(page.next_cursor)
  const [total, setTotal] = React.useState(count)
  return (
    <>
      <p data-testid="total">{total}</p>
      <CommentList
        publicId="tech-01"
        sort="latest"
        comments={comments}
        nextCursor={cursor}
        isLoggedIn
        viewerName="Studio Canal"
        now={NOW}
        onCommentsChange={setComments}
        onNextCursorChange={setCursor}
        onCountDelta={(delta) => setTotal((current) => current + delta)}
      />
    </>
  )
}

beforeEach(() => {
  router.push.mockReset()
  toastError.mockReset()
})

describe("<CommentList />", () => {
  it("appends the next page and hides Show more when there is no cursor", async () => {
    const user = userEvent.setup()
    const cursors: (string | null)[] = []
    server.use(
      http.get("/api/videos/:publicId/comments", ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get("cursor"))
        return HttpResponse.json({
          items: [buildCommentResponse({ text: "Da página 2" })],
          next_cursor: null,
        })
      })
    )
    render(
      <Harness
        page={{ items: [buildCommentResponse({ text: "Da página 1" })], next_cursor: "c-2" }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Show more comments" }))

    expect(await screen.findByText("Da página 2")).toBeInTheDocument()
    expect(screen.getByText("Da página 1")).toBeInTheDocument()
    expect(cursors).toEqual(["c-2"])
    expect(screen.queryByRole("button", { name: "Show more comments" })).not.toBeInTheDocument()
  })

  it("shows the actions menu only on the viewer's own comments", () => {
    render(
      <Harness
        page={{
          items: [
            buildCommentResponse({ text: "Meu", viewer_is_author: true }),
            buildCommentResponse({ text: "Alheio" }),
          ],
          next_cursor: null,
        }}
      />
    )

    expect(screen.getAllByRole("button", { name: "Comment actions" })).toHaveLength(1)
    const mine = screen.getByText("Meu").closest("article")!
    expect(within(mine).getByRole("button", { name: "Comment actions" })).toBeInTheDocument()
  })

  it("applies the PATCH response, showing (edited)", async () => {
    const user = userEvent.setup()
    const own = buildCommentResponse({ text: "Antes", viewer_is_author: true })
    server.use(
      http.patch("/api/comments/:commentId", async ({ request }) => {
        const { text } = (await request.json()) as { text: string }
        return HttpResponse.json({ ...own, text, edited_at: "2026-10-01T12:05:00.000Z" })
      })
    )
    render(<Harness page={{ items: [own], next_cursor: null }} />)

    await user.click(screen.getByRole("button", { name: "Comment actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Edit" }))
    const field = screen.getByLabelText("Edit comment")
    await user.clear(field)
    await user.type(field, "Depois")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Depois")).toBeInTheDocument()
    expect(screen.getByText("(edited)")).toBeInTheDocument()
  })

  it("removes a deleted root and takes 1 + reply_count from the header", async () => {
    const user = userEvent.setup()
    server.use(
      http.delete("/api/comments/:commentId", () => new HttpResponse(null, { status: 204 }))
    )
    render(
      <Harness
        count={25}
        page={{
          items: [buildCommentResponse({ text: "Com respostas", viewer_is_author: true, reply_count: 2 })],
          next_cursor: null,
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Comment actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("22"))
    expect(screen.queryByText("Com respostas")).not.toBeInTheDocument()
  })

  it("removes a comment the server no longer knows and shows a toast", async () => {
    const user = userEvent.setup()
    server.use(
      http.patch("/api/comments/:commentId", () =>
        HttpResponse.json(
          { statusCode: 404, error: "COMMENT_NOT_FOUND", message: "Comment not found" },
          { status: 404 }
        )
      )
    )
    render(
      <Harness
        page={{
          items: [buildCommentResponse({ text: "Sumiu", viewer_is_author: true })],
          next_cursor: null,
        }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Comment actions" }))
    await user.click(screen.getByRole("menuitem", { name: "Edit" }))
    await user.type(screen.getByLabelText("Edit comment"), "!")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("This comment is no longer available")
    )
    expect(screen.queryByText("Sumiu")).not.toBeInTheDocument()
    expect(screen.getByTestId("total")).toHaveTextContent("24")
  })

  it("renders the empty state", () => {
    render(<Harness page={{ items: [], next_cursor: null }} />)

    expect(screen.getByText("No comments yet.")).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Comments" })).not.toBeInTheDocument()
  })
})
