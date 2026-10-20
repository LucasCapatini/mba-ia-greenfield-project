// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import type { SubscribedChannel, SubscribedChannelsPage } from "@/lib/api/contracts"
import { server } from "@/mocks/server"

import { SideNavSubscriptions } from "../side-nav-subscriptions"
import { SubscriptionsProvider, useSubscriptions } from "../subscriptions-provider"

vi.mock("next/navigation", () => ({
  usePathname: () => "/channel/caio",
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const channel = (name: string): SubscribedChannel => ({
  nickname: name.toLowerCase(),
  name,
})

const NINE = ["Ana", "Bia", "Caio", "Davi", "Eva", "Fabi", "Gil", "Hugo", "Ivo"].map(channel)

/** Botões que simulam o SubscribeButton chamando o contexto após a confirmação. */
function ContextActions() {
  const subscriptions = useSubscriptions()
  return (
    <>
      <button type="button" onClick={() => subscriptions?.onChange(channel("Cris"), true)}>
        follow Cris
      </button>
      <button type="button" onClick={() => subscriptions?.onChange(channel("Bia"), false)}>
        unfollow Bia
      </button>
    </>
  )
}

function renderNav(initial: SubscribedChannelsPage) {
  return render(
    <SubscriptionsProvider initial={initial}>
      <SideNavSubscriptions />
      <ContextActions />
    </SubscriptionsProvider>
  )
}

const names = () =>
  within(screen.getByRole("region", { name: "Subscriptions" }))
    .getAllByRole("link")
    // O avatar (iniciais) fica fora da árvore acessível; o rótulo é o último filho do link.
    .map((link) => link.lastElementChild?.textContent)

describe("<SideNavSubscriptions />", () => {
  it("lists the first page in order, links each channel and marks the current one", () => {
    renderNav({ items: NINE.slice(0, 7), next_cursor: "offset-7" })

    expect(names()).toEqual(["Ana", "Bia", "Caio", "Davi", "Eva", "Fabi", "Gil"])
    expect(screen.getByRole("link", { name: "Bia" })).toHaveAttribute("href", "/channel/bia")
    expect(screen.getByRole("link", { name: "Caio" })).toHaveAttribute("aria-current", "page")
  })

  it("appends the next page on Show more and hides the button without a cursor", async () => {
    const user = userEvent.setup()
    const cursors: (string | null)[] = []
    server.use(
      http.get("/api/me/subscriptions", ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get("cursor"))
        return HttpResponse.json({ items: NINE.slice(7), next_cursor: null })
      })
    )
    renderNav({ items: NINE.slice(0, 7), next_cursor: "offset-7" })

    await user.click(screen.getByRole("button", { name: "Show more" }))

    expect(await screen.findByRole("link", { name: "Ivo" })).toBeInTheDocument()
    expect(names()).toHaveLength(9)
    expect(cursors).toEqual(["offset-7"])
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
  })

  it("inserts and removes channels in alphabetical order through the context", async () => {
    const user = userEvent.setup()
    renderNav({ items: [channel("Ana"), channel("Bia"), channel("Davi")], next_cursor: null })

    await user.click(screen.getByRole("button", { name: "follow Cris" }))
    expect(names()).toEqual(["Ana", "Bia", "Cris", "Davi"])

    await user.click(screen.getByRole("button", { name: "unfollow Bia" }))
    expect(names()).toEqual(["Ana", "Cris", "Davi"])
  })

  it("shows the empty state without subscriptions", () => {
    renderNav({ items: [], next_cursor: null })

    expect(screen.getByText("Channels you subscribe to will show up here.")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
