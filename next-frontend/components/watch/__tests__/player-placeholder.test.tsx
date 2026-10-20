// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlayerPlaceholder } from "../player-placeholder"

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  refreshMock.mockClear()
})

describe("PlayerPlaceholder", () => {
  it("shows the processing status in processing mode, with no retry action", () => {
    render(<PlayerPlaceholder mode="processing" processingStatus="processing" />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Processing… The video will be available when it is ready."
    )
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("shows the upload state and the processing failure reason", () => {
    const { rerender } = render(
      <PlayerPlaceholder mode="processing" processingStatus="uploading" />
    )
    expect(screen.getByRole("status")).toHaveTextContent("Upload in progress.")

    rerender(
      <PlayerPlaceholder
        mode="processing"
        processingStatus="failed"
        processingError="UNSUPPORTED_FORMAT"
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent(/^Processing failed: /)
  })

  it("offers Try again in error mode and refreshes the route when clicked", async () => {
    const user = userEvent.setup()
    render(<PlayerPlaceholder mode="error" />)

    expect(screen.getByRole("alert")).toHaveTextContent("This video can't be played right now.")
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
