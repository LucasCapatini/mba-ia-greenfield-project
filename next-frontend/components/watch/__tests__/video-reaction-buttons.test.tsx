// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ReactionState } from "@/lib/api/contracts"
import { server } from "@/mocks/server"

import { VideoReactionButtons } from "../video-reaction-buttons"

const { router, toastError } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/watch/tech-01",
}))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

const URL_PATTERN = "/api/videos/:publicId/reaction"

type Sent = { method: string; body: unknown }

/** Registra verbo + corpo de cada mutação e responde com `respond`. */
function recordMutations(respond: (sent: Sent) => Response): Sent[] {
  const sent: Sent[] = []
  const handler = async ({ request }: { request: Request }) => {
    const entry = {
      method: request.method,
      body: request.method === "PUT" ? await request.json() : null,
    }
    sent.push(entry)
    return respond(entry)
  }
  server.use(http.put(URL_PATTERN, handler), http.delete(URL_PATTERN, handler))
  return sent
}

const NEUTRAL: ReactionState = { viewer_reaction: null, like_count: 1200, dislike_count: 14 }

function renderButtons(initial: ReactionState = NEUTRAL, isLoggedIn = true) {
  return render(
    <VideoReactionButtons publicId="tech-01" initial={initial} isLoggedIn={isLoggedIn} />
  )
}

beforeEach(() => {
  router.push.mockReset()
  toastError.mockReset()
})

describe("<VideoReactionButtons />", () => {
  it("likes with PUT, presses Like and shows the confirmed count", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() =>
      HttpResponse.json({ viewer_reaction: "like", like_count: 1250, dislike_count: 14 })
    )
    renderButtons()
    expect(screen.getByRole("button", { name: "Dislike" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    await user.click(screen.getByRole("button", { name: "Like, 1.2K" }))

    const like = await screen.findByRole("button", { name: "Like, 1.3K" })
    expect(like).toHaveAttribute("aria-pressed", "true")
    expect(sent).toEqual([{ method: "PUT", body: { value: "like" } }])
  })

  it("switches from dislike to like with PUT { value: like }", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() =>
      HttpResponse.json({ viewer_reaction: "like", like_count: 1201, dislike_count: 13 })
    )
    render(
      <VideoReactionButtons
        publicId="tech-01"
        initial={{ viewer_reaction: "dislike", like_count: 1200, dislike_count: 14 }}
        isLoggedIn
      />
    )

    await user.click(screen.getByRole("button", { name: /^Like/ }))

    await waitFor(() => expect(sent).toEqual([{ method: "PUT", body: { value: "like" } }]))
    expect(screen.getByRole("button", { name: "Dislike" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("removes the active reaction with DELETE", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() =>
      HttpResponse.json({ viewer_reaction: null, like_count: 1199, dislike_count: 14 })
    )
    render(
      <VideoReactionButtons
        publicId="tech-01"
        initial={{ viewer_reaction: "like", like_count: 1200, dislike_count: 14 }}
        isLoggedIn
      />
    )

    await user.click(screen.getByRole("button", { name: /^Like/ }))

    await waitFor(() => expect(sent).toEqual([{ method: "DELETE", body: null }]))
    expect(await screen.findByRole("button", { name: /^Like/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("reverts and toasts on 429", async () => {
    const user = userEvent.setup()
    recordMutations(
      () => new HttpResponse(null, { status: 429 })
    )
    renderButtons()

    await user.click(screen.getByRole("button", { name: "Like, 1.2K" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Too many actions, try again in a moment")
    )
    expect(await screen.findByRole("button", { name: "Like, 1.2K" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("sends an anonymous visitor to login without calling the API", async () => {
    const user = userEvent.setup()
    const sent = recordMutations(() => HttpResponse.json({}))
    renderButtons(undefined, false)

    await user.click(screen.getByRole("button", { name: "Dislike" }))

    expect(router.push).toHaveBeenCalledWith("/login?returnTo=/watch/tech-01")
    expect(sent).toEqual([])
  })
})
