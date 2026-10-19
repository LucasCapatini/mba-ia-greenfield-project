// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoadMore } from "../load-more"

const { replaceMock, params } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  params: { current: new URLSearchParams() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/studio/videos",
  useSearchParams: () => params.current,
}))

beforeEach(() => {
  replaceMock.mockClear()
})

describe("<LoadMore />", () => {
  it("asks for the next page keeping every filter", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("status=draft&q=aula&sort=oldest")
    render(<LoadMore nextCursor="offset-20" />)

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(replaceMock).toHaveBeenCalledWith(
      "/studio/videos?status=draft&q=aula&sort=oldest&cursor=offset-20",
      { scroll: false }
    )
  })

  it("replaces a previous cursor instead of stacking it", async () => {
    const user = userEvent.setup()
    params.current = new URLSearchParams("cursor=offset-20")
    render(<LoadMore nextCursor="offset-40" />)

    await user.click(screen.getByRole("button", { name: "Load more" }))

    expect(replaceMock).toHaveBeenCalledWith("/studio/videos?cursor=offset-40", { scroll: false })
  })
})
