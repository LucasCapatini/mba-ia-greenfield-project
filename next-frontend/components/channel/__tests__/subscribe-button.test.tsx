// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  SubscriptionsProvider,
  useSubscriptions,
} from "@/components/layout/subscriptions-provider"
import { server } from "@/mocks/server"

import { SubscribeButton } from "../subscribe-button"

const { router, toastError } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/channel/tech_mastery",
}))

vi.mock("sonner", () => ({ toast: { error: toastError } }))

const CHANNEL = { nickname: "tech_mastery", name: "Tech Mastery" }
const URL_PATTERN = "/api/channels/:nickname/subscription"

/** Resposta segurada até `release()` — permite olhar o estado otimista antes do servidor. */
function gate() {
  let release!: () => void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { opened, release }
}

/** Lista de canais do contexto, para provar quando o menu lateral é atualizado. */
function ChannelsProbe() {
  const subscriptions = useSubscriptions()
  return (
    <ul aria-label="Followed">
      {subscriptions?.channels.map((channel) => (
        <li key={channel.nickname}>{channel.name}</li>
      ))}
    </ul>
  )
}

function renderButton(props: Partial<ComponentProps<typeof SubscribeButton>> = {}) {
  return render(
    <SubscribeButton
      channel={CHANNEL}
      initialSubscribed={false}
      initialSubscriberCount={1199}
      isLoggedIn
      isOwner={false}
      {...props}
    />
  )
}

beforeEach(() => {
  router.push.mockReset()
  toastError.mockReset()
})

describe("<SubscribeButton />", () => {
  it("shows Subscribed before the response and reports the confirmed count after 200", async () => {
    const user = userEvent.setup()
    const pending = gate()
    const methods: string[] = []
    server.use(
      http.put(URL_PATTERN, async ({ request }) => {
        methods.push(request.method)
        await pending.opened
        return HttpResponse.json({ subscribed: true, subscriber_count: 1250 })
      })
    )
    const onCount = vi.fn()
    renderButton({ onSubscriberCountChange: onCount })

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    const pressed = await screen.findByRole("button", { name: "Subscribed" })
    expect(pressed).toHaveAttribute("aria-pressed", "true")
    expect(onCount).not.toHaveBeenCalled()

    pending.release()
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(1250))
    expect(methods).toEqual(["PUT"])
    expect(screen.getByRole("button", { name: "Subscribed" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("goes back to Subscribe with an error toast when the route answers 500", async () => {
    const user = userEvent.setup()
    server.use(
      http.put(URL_PATTERN, () =>
        HttpResponse.json(
          { statusCode: 500, error: "INTERNAL", message: "boom" },
          { status: 500 }
        )
      )
    )
    renderButton()

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(await screen.findByRole("button", { name: "Subscribe" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("unsubscribes with DELETE", async () => {
    const user = userEvent.setup()
    const methods: string[] = []
    server.use(
      http.delete(URL_PATTERN, ({ request }) => {
        methods.push(request.method)
        return HttpResponse.json({ subscribed: false, subscriber_count: 1199 })
      })
    )
    renderButton({ initialSubscribed: true, initialSubscriberCount: 1200 })

    await user.click(screen.getByRole("button", { name: "Subscribed" }))

    await screen.findByRole("button", { name: "Subscribe" })
    await waitFor(() => expect(methods).toEqual(["DELETE"]))
  })

  it("sends an anonymous visitor to login with returnTo and calls no API", async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    server.events.on("request:start", ({ request }) => calls.push(request.url))
    renderButton({ isLoggedIn: false })

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    expect(router.push).toHaveBeenCalledWith("/login?returnTo=/channel/tech_mastery")
    expect(calls).toEqual([])
    server.events.removeAllListeners()
  })

  it("renders nothing for the channel owner", () => {
    renderButton({ isOwner: true })

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("updates the side nav context only after the server confirms", async () => {
    const user = userEvent.setup()
    const pending = gate()
    server.use(
      http.put(URL_PATTERN, async () => {
        await pending.opened
        return HttpResponse.json({ subscribed: true, subscriber_count: 1200 })
      })
    )
    render(
      <SubscriptionsProvider initial={{ items: [], next_cursor: null }}>
        <SubscribeButton
          channel={CHANNEL}
          initialSubscribed={false}
          initialSubscriberCount={1199}
          isLoggedIn
          isOwner={false}
        />
        <ChannelsProbe />
      </SubscriptionsProvider>
    )

    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    await screen.findByRole("button", { name: "Subscribed" })
    expect(screen.queryByText("Tech Mastery")).not.toBeInTheDocument()

    pending.release()
    expect(await screen.findByText("Tech Mastery")).toBeInTheDocument()
  })
})
