// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseOwnerVideoSort, VideoSortMenu } from "../video-sort-menu";

const { replaceMock, navigation } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  navigation: { search: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/studio/videos",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

beforeEach(() => {
  replaceMock.mockClear();
  navigation.search = "";
});

describe("VideoSortMenu", () => {
  it("renders the Sort by trigger with the default Latest label", () => {
    render(<VideoSortMenu />);

    const trigger = screen.getByRole("button", { name: "Sort by: Latest" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("data-slot", "video-sort-menu");
  });

  it.each([
    ["sort=oldest", "Sort by: Oldest"],
    ["sort=views", "Sort by: Most viewed"],
    ["sort=popular", "Sort by: Latest"],
  ])("labels %s as %s", (search, name) => {
    navigation.search = search;
    render(<VideoSortMenu />);
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("lists the three API sorts with the current one checked", async () => {
    const user = userEvent.setup();
    navigation.search = "sort=views";
    render(<VideoSortMenu />);

    await user.click(screen.getByRole("button", { name: "Sort by: Most viewed" }));

    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Latest", "Oldest", "Most viewed"]);
    expect(screen.getByRole("menuitemradio", { name: "Most viewed" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("replaces the URL with the new sort, without cursor and keeping the filters", async () => {
    const user = userEvent.setup();
    navigation.search = "status=draft&q=react&cursor=abc";
    render(<VideoSortMenu />);

    await user.click(screen.getByRole("button", { name: "Sort by: Latest" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Oldest" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const [href, options] = replaceMock.mock.calls[0];
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/studio/videos");
    expect(url.searchParams.get("sort")).toBe("oldest");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.get("q")).toBe("react");
    expect(options).toEqual({ scroll: false });
  });

  it("does not navigate when the current sort is chosen again", async () => {
    const user = userEvent.setup();
    render(<VideoSortMenu />);

    await user.click(screen.getByRole("button", { name: "Sort by: Latest" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Latest" }));

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("parseOwnerVideoSort", () => {
  it.each([
    ["latest", "latest"],
    ["oldest", "oldest"],
    ["views", "views"],
    ["popular", "latest"],
    [null, "latest"],
  ])("parses %s as %s", (value, expected) => {
    expect(parseOwnerVideoSort(value)).toBe(expected);
  });
});
