// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "../global-search";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

function field() {
  return screen.getByRole("searchbox", { name: "Search" });
}

describe("GlobalSearch", () => {
  it("navigates to /results with the trimmed term on Enter", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(field(), "  aula  {Enter}");

    expect(pushMock).toHaveBeenCalledWith("/results?q=aula");
  });

  it("navigates when the submit button is clicked and encodes the term", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(field(), "música & cia");
    await user.click(screen.getByRole("button", { name: "Submit search" }));

    expect(pushMock).toHaveBeenCalledWith(`/results?q=${encodeURIComponent("música & cia")}`);
  });

  it("does not navigate when the field is empty or only spaces", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Submit search" }));
    await user.type(field(), "   {Enter}");

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("limits the field to 100 characters", () => {
    render(<GlobalSearch />);

    expect(field()).toHaveAttribute("maxLength", "100");
  });

  it("starts with the current term", () => {
    render(<GlobalSearch initialQuery="musica" />);

    expect(field()).toHaveValue("musica");
  });

  it("is exposed as a search landmark", () => {
    render(<GlobalSearch />);

    expect(screen.getByRole("search", { name: "Search videos" })).toBeInTheDocument();
  });

  it("expands the field from the mobile search icon and collapses it back", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    const form = screen.getByRole("search", { name: "Search videos" });
    expect(form).toHaveAttribute("data-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(form).toHaveAttribute("data-expanded", "true");
    expect(field()).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(form).toHaveAttribute("data-expanded", "false");
  });
});
