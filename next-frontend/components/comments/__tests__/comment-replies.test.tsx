// @vitest-environment jsdom
import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Comment } from "@/lib/api/contracts"
import { buildCommentResponse } from "@/mocks/factories/social"
import { server } from "@/mocks/server"

import { CommentReplies } from "../comment-replies"

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const NOW = new Date("2026-10-01T12:00:00.000Z")
const REPLIES = "/api/comments/:commentId/replies"

const ROOT = buildCommentResponse({ text: "Raiz da bia", reply_count: 2 })
const FIRST = buildCommentResponse({
  parent_id: ROOT.id,
  text: "Primeira resposta",
  author: { nickname: "ana", name: "Ana" },
})
const SECOND = buildCommentResponse({ parent_id: ROOT.id, text: "Segunda resposta" })

/** O pai da thread (lista) — guarda o rascunho do composer e o `reply_count` da raiz. */
function Harness() {
  const [root, setRoot] = React.useState<Comment>(ROOT)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [total, setTotal] = React.useState(10)
  return (
    <>
      <p data-testid="total">{total}</p>
      <button type="button" onClick={() => setDraft("")}>
        Reply to root
      </button>
      <CommentReplies
        root={root}
        isLoggedIn
        viewerName="Studio Canal"
        now={NOW}
        draft={draft}
        onReplyTo={setDraft}
        onDraftClose={() => setDraft(null)}
        onReplyCountDelta={(delta) => {
          setRoot((current) => ({ ...current, reply_count: current.reply_count + delta }))
          setTotal((current) => current + delta)
        }}
        onRootGone={vi.fn()}
      />
    </>
  )
}

/** Conta as leituras de respostas e devolve `items` (+ o que for anexado em `extra`). */
function serveReplies(extra: Comment[] = []) {
  const reads: string[] = []
  server.use(
    http.get(REPLIES, ({ request }) => {
      reads.push(new URL(request.url).pathname)
      return HttpResponse.json({ items: [FIRST, SECOND, ...extra], next_cursor: null })
    })
  )
  return reads
}

const thread = () => screen.getByRole("list", { name: "Replies to @bia" })

beforeEach(() => {
  router.push.mockReset()
})

describe("<CommentReplies />", () => {
  it("loads the replies on the first opening only, oldest first", async () => {
    const user = userEvent.setup()
    const reads = serveReplies()
    render(<Harness />)

    const toggle = screen.getByRole("button", { name: "2 replies" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await user.click(toggle)

    expect(await screen.findByText("Primeira resposta")).toBeInTheDocument()
    expect(within(thread()).getAllByRole("article").map((a) => a.textContent)).toEqual([
      expect.stringContaining("Primeira resposta"),
      expect.stringContaining("Segunda resposta"),
    ])
    expect(screen.getByRole("button", { name: "2 replies" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    await user.click(screen.getByRole("button", { name: "2 replies" }))
    expect(screen.queryByText("Primeira resposta")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "2 replies" }))
    expect(await screen.findByText("Primeira resposta")).toBeInTheDocument()
    expect(reads).toHaveLength(1)
  })

  it("appends a reply to the end of the open thread and adds to the counts", async () => {
    const user = userEvent.setup()
    serveReplies()
    server.use(
      http.post(REPLIES, async ({ request }) => {
        const { text } = (await request.json()) as { text: string }
        return HttpResponse.json(
          buildCommentResponse({ parent_id: ROOT.id, text, viewer_is_author: true }),
          { status: 201 }
        )
      })
    )
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: "2 replies" }))
    await screen.findByText("Segunda resposta")

    await user.click(screen.getByRole("button", { name: "Reply to root" }))
    const field = screen.getByLabelText("Add a reply")
    await user.type(field, "Concordo")
    await user.click(within(field.closest("form")!).getByRole("button", { name: "Reply" }))

    await screen.findByRole("button", { name: "3 replies" })
    const texts = within(thread()).getAllByRole("article").map((a) => a.textContent)
    expect(texts[texts.length - 1]).toContain("Concordo")
    expect(screen.getByTestId("total")).toHaveTextContent("11")
    expect(screen.queryByLabelText("Add a reply")).not.toBeInTheDocument()
  })

  it("pre-fills @nickname when replying to a reply", async () => {
    const user = userEvent.setup()
    serveReplies()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: "2 replies" }))
    const first = (await screen.findByText("Primeira resposta")).closest("article")!

    await user.click(within(first).getByRole("button", { name: "Reply" }))

    await waitFor(() => expect(screen.getByLabelText("Add a reply")).toHaveValue("@ana "))
  })
})
