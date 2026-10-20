// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildCommentResponse } from "@/mocks/factories/social"
import { server } from "@/mocks/server"

import { CommentSection } from "../comment-section"

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const COMMENTS = "/api/videos/:publicId/comments"
const NOW = new Date("2026-10-01T12:00:00.000Z")

function renderSection() {
  const latest = [
    buildCommentResponse({ text: "Mais recente" }),
    buildCommentResponse({ text: "Mais antigo" }),
  ]
  render(
    <CommentSection
      publicId="tech-01"
      commentCount={1234}
      initialPage={{ items: latest, next_cursor: null }}
      isLoggedIn
      viewerName="Studio Canal"
      now={NOW}
    />
  )
}

const firstArticle = () =>
  within(screen.getByRole("list", { name: "Comments" })).getAllByRole("article")[0]

beforeEach(() => {
  router.push.mockReset()
})

describe("<CommentSection />", () => {
  it("shows the header count with a thousands separator", () => {
    renderSection()

    expect(screen.getByRole("heading", { name: "1,234 Comments" })).toBeInTheDocument()
  })

  it("reloads the first page when the sort changes, dropping the previous items", async () => {
    const user = userEvent.setup()
    const sorts: (string | null)[] = []
    server.use(
      http.get(COMMENTS, ({ request }) => {
        sorts.push(new URL(request.url).searchParams.get("sort"))
        return HttpResponse.json({
          items: [buildCommentResponse({ text: "Mais curtido", like_count: 340 })],
          next_cursor: null,
        })
      })
    )
    renderSection()

    await user.click(screen.getByRole("button", { name: "Sort by: Latest" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Top" }))

    await screen.findByRole("button", { name: "Sort by: Top" })
    expect(sorts).toEqual(["top"])
    expect(screen.getByText("Mais curtido")).toBeInTheDocument()
    expect(screen.queryByText("Mais recente")).not.toBeInTheDocument()
  })

  it("puts a created comment on top and adds 1 to the header", async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    server.use(
      http.post(COMMENTS, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(
          buildCommentResponse({
            text: "Ótimo conteúdo",
            author: { nickname: "studio_canal", name: "Studio Canal" },
            viewer_is_author: true,
          }),
          { status: 201 }
        )
      })
    )
    renderSection()

    await user.type(screen.getByLabelText("Add a comment"), "Ótimo conteúdo")
    await user.click(screen.getByRole("button", { name: "Comment" }))

    await screen.findByRole("heading", { name: "1,235 Comments" })
    expect(bodies).toEqual([{ text: "Ótimo conteúdo" }])
    expect(firstArticle()).toHaveTextContent("Ótimo conteúdo")
    expect(firstArticle()).toHaveTextContent("@studio_canal")
  })

  it("keeps the typed text and shows the error when creating fails", async () => {
    const user = userEvent.setup()
    server.use(
      http.post(COMMENTS, () =>
        HttpResponse.json(
          { statusCode: 400, error: "VALIDATION_ERROR", message: "text is too long" },
          { status: 400 }
        )
      )
    )
    renderSection()

    await user.type(screen.getByLabelText("Add a comment"), "Rascunho")
    await user.click(screen.getByRole("button", { name: "Comment" }))

    expect(await screen.findByText("text is too long")).toBeInTheDocument()
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Rascunho")
    expect(screen.getByRole("heading", { name: "1,234 Comments" })).toBeInTheDocument()
  })

  it("shows the error block when the first page failed and recovers on Try again", async () => {
    const user = userEvent.setup()
    server.use(
      http.get(COMMENTS, () =>
        HttpResponse.json({
          items: [buildCommentResponse({ text: "Voltou" })],
          next_cursor: null,
        })
      )
    )
    render(
      <CommentSection
        publicId="tech-01"
        commentCount={1}
        initialPage={null}
        isLoggedIn={false}
        now={NOW}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Comments could not be loaded.")
    expect(screen.queryByRole("list", { name: "Comments" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Voltou")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
