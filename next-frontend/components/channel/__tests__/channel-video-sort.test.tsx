// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelVideoSort, parseChannelVideoSort } from "../channel-video-sort";

const { replaceMock, navigation } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  navigation: { search: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/channel/tech_mastery",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

beforeEach(() => {
  replaceMock.mockClear();
  navigation.search = "";
});

function chip(name: string) {
  return screen.getByRole("radio", { name });
}

describe("ChannelVideoSort", () => {
  it("renders a radiogroup with Latest active by default", () => {
    render(<ChannelVideoSort />);

    expect(screen.getByRole("radiogroup", { name: "Sort videos" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Latest",
      "Popular",
      "Oldest",
    ]);
    expect(chip("Latest")).toHaveAttribute("aria-checked", "true");
    expect(chip("Popular")).toHaveAttribute("aria-checked", "false");
  });

  it("reflects ?sort= in the active chip", () => {
    navigation.search = "sort=popular";
    render(<ChannelVideoSort />);

    expect(chip("Popular")).toHaveAttribute("aria-checked", "true");
    expect(chip("Popular")).toHaveAttribute("data-state", "active");
    expect(chip("Latest")).toHaveAttribute("aria-checked", "false");
  });

  it("falls back to Latest for an unknown sort", () => {
    navigation.search = "sort=views";
    render(<ChannelVideoSort />);
    expect(chip("Latest")).toHaveAttribute("aria-checked", "true");
  });

  it("keeps only the active chip in the tab order", () => {
    navigation.search = "sort=oldest";
    render(<ChannelVideoSort />);

    expect(chip("Oldest")).toHaveAttribute("tabindex", "0");
    expect(chip("Latest")).toHaveAttribute("tabindex", "-1");
    expect(chip("Popular")).toHaveAttribute("tabindex", "-1");
  });

  it("replaces the URL with the new sort, without cursor and without scrolling", async () => {
    const user = userEvent.setup();
    navigation.search = "sort=latest&cursor=abc123&tab=videos";
    render(<ChannelVideoSort />);

    await user.click(chip("Oldest"));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const [href, options] = replaceMock.mock.calls[0];
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/channel/tech_mastery");
    expect(url.searchParams.get("sort")).toBe("oldest");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.get("tab")).toBe("videos");
    expect(options).toEqual({ scroll: false });
  });

  it("does nothing when the active chip is clicked again", async () => {
    const user = userEvent.setup();
    render(<ChannelVideoSort />);

    await user.click(chip("Latest"));

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("moves focus and selection with the arrow keys, wrapping around", async () => {
    const user = userEvent.setup();
    render(<ChannelVideoSort />);
    chip("Latest").focus();

    await user.keyboard("{ArrowRight}");
    expect(chip("Popular")).toHaveFocus();
    expect(new URL(replaceMock.mock.calls[0][0], "http://localhost").searchParams.get("sort")).toBe(
      "popular",
    );

    chip("Latest").focus();
    await user.keyboard("{ArrowLeft}");
    expect(chip("Oldest")).toHaveFocus();
    expect(new URL(replaceMock.mock.calls[1][0], "http://localhost").searchParams.get("sort")).toBe(
      "oldest",
    );
  });
});

describe("parseChannelVideoSort", () => {
  it.each([
    ["latest", "latest"],
    ["popular", "popular"],
    ["oldest", "oldest"],
    ["views", "latest"],
    [null, "latest"],
    [undefined, "latest"],
  ])("parses %s as %s", (value, expected) => {
    expect(parseChannelVideoSort(value)).toBe(expected);
  });
});
