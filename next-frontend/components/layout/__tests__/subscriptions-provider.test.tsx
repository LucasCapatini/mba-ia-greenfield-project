// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SubscribedChannel, SubscribedChannelsPage } from "@/lib/api/contracts"
import { server } from "@/mocks/server"

import { SubscriptionsProvider, useSubscriptions } from "../subscriptions-provider"

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

const channel = (name: string): SubscribedChannel => ({ nickname: name.toLowerCase(), name })

/** Expõe o contexto: lista, `hasMore` e botões que chamam `onChange`/`loadMore`. */
function Probe({ follow, unfollow }: { follow?: SubscribedChannel; unfollow?: SubscribedChannel }) {
  const subscriptions = useSubscriptions()
  if (!subscriptions) return <p>no provider</p>
  return (
    <>
      <ol aria-label="Followed">
        {subscriptions.channels.map((item) => (
          <li key={item.nickname}>{item.name}</li>
        ))}
      </ol>
      <p data-testid="has-more">{String(subscriptions.hasMore)}</p>
      {follow ? (
        <button type="button" onClick={() => subscriptions.onChange(follow, true)}>
          follow
        </button>
      ) : null}
      {unfollow ? (
        <button type="button" onClick={() => subscriptions.onChange(unfollow, false)}>
          unfollow
        </button>
      ) : null}
      <button type="button" onClick={() => void subscriptions.loadMore()}>
        more
      </button>
    </>
  )
}

function renderProvider(
  initial: SubscribedChannelsPage | null,
  probe: Parameters<typeof Probe>[0] = {}
) {
  return render(
    <SubscriptionsProvider initial={initial}>
      <Probe {...probe} />
    </SubscriptionsProvider>
  )
}

const names = () =>
  Array.from(screen.getByRole("list", { name: "Followed" }).querySelectorAll("li")).map(
    (item) => item.textContent
  )

beforeEach(() => {
  toastError.mockReset()
})

describe("SubscriptionsProvider", () => {
  it("inserts a followed channel in alphabetical order and does not duplicate it", async () => {
    const user = userEvent.setup()
    renderProvider(
      { items: [channel("Ana"), channel("Davi")], next_cursor: null },
      { follow: channel("Caio") }
    )

    await user.click(screen.getByRole("button", { name: "follow" }))
    await user.click(screen.getByRole("button", { name: "follow" }))

    expect(names()).toEqual(["Ana", "Caio", "Davi"])
  })

  it("removes an unfollowed channel", async () => {
    const user = userEvent.setup()
    renderProvider(
      { items: [channel("Ana"), channel("Bia"), channel("Davi")], next_cursor: null },
      { unfollow: channel("Bia") }
    )

    await user.click(screen.getByRole("button", { name: "unfollow" }))

    expect(names()).toEqual(["Ana", "Davi"])
  })

  it("does not insert a channel past the loaded page while more pages are pending", async () => {
    const user = userEvent.setup()
    renderProvider(
      { items: [channel("Ana"), channel("Bia")], next_cursor: "offset-2" },
      { follow: channel("Zeca") }
    )

    await user.click(screen.getByRole("button", { name: "follow" }))

    expect(names()).toEqual(["Ana", "Bia"])
  })

  it("appends the next page on loadMore and stops without a cursor", async () => {
    const user = userEvent.setup()
    const cursors: (string | null)[] = []
    server.use(
      http.get("/api/me/subscriptions", ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get("cursor"))
        return HttpResponse.json({ items: [channel("Bia"), channel("Caio")], next_cursor: null })
      })
    )
    renderProvider({ items: [channel("Ana"), channel("Bia")], next_cursor: "offset-2" })

    await user.click(screen.getByRole("button", { name: "more" }))

    await waitFor(() => expect(names()).toEqual(["Ana", "Bia", "Caio"]))
    expect(screen.getByTestId("has-more")).toHaveTextContent("false")
    await user.click(screen.getByRole("button", { name: "more" }))
    expect(cursors).toEqual(["offset-2"])
  })

  it("keeps the list and shows a toast when loadMore fails", async () => {
    const user = userEvent.setup()
    server.use(http.get("/api/me/subscriptions", () => new HttpResponse(null, { status: 500 })))
    renderProvider({ items: [channel("Ana")], next_cursor: "offset-1" })

    await user.click(screen.getByRole("button", { name: "more" }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(names()).toEqual(["Ana"])
    expect(screen.getByTestId("has-more")).toHaveTextContent("true")
  })

  it("starts empty, without more pages, when the layout read failed", () => {
    renderProvider(null)
    expect(names()).toEqual([])
    expect(screen.getByTestId("has-more")).toHaveTextContent("false")
  })
})
