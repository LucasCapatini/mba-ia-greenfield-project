// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoFilters } from "../video-filters";

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

afterEach(() => {
  vi.useRealTimers();
});

function lastUrl() {
  const call = replaceMock.mock.calls.at(-1);
  if (!call) throw new Error("router.replace was not called");
  return { url: new URL(call[0], "http://localhost"), options: call[1] };
}

describe("VideoFilters — baseline", () => {
  it("renders the Filter, Visibility and Date buttons and the search field", () => {
    render(<VideoFilters />);

    expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "Visibility" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date" })).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search your videos" });
    expect(search).toHaveAttribute("maxlength", "100");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("initializes labels and the search text from searchParams", () => {
    navigation.search = "status=draft&visibility=unlisted&q=react&from=2026-10-01&to=2026-10-19";
    render(<VideoFilters />);

    expect(screen.getByRole("button", { name: "Status: Draft" })).toHaveAttribute("data-variant", "default");
    expect(screen.getByRole("button", { name: "Unlisted" })).toHaveAttribute("data-variant", "default");
    expect(screen.getByRole("button", { name: "Oct 1, 2026 – Oct 19, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("react");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("ignores unknown enum values and malformed dates", () => {
    navigation.search = "status=archived&visibility=private&from=yesterday";
    render(<VideoFilters />);

    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visibility" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date" })).toBeInTheDocument();
  });
});

describe("VideoFilters — status and visibility", () => {
  it("sets status from the Filter menu and drops the cursor", async () => {
    const user = userEvent.setup();
    navigation.search = "cursor=abc&sort=views";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Draft" }));

    const { url, options } = lastUrl();
    expect(url.pathname).toBe("/studio/videos");
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.get("sort")).toBe("views");
    expect(options).toEqual({ scroll: false });
  });

  it("removes the status when All statuses is chosen", async () => {
    const user = userEvent.setup();
    navigation.search = "status=published";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Status: Published" }));
    await user.click(screen.getByRole("menuitemradio", { name: "All statuses" }));

    expect(lastUrl().url.searchParams.has("status")).toBe(false);
  });

  it("sets visibility from its menu", async () => {
    const user = userEvent.setup();
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Visibility" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Public" }));

    expect(lastUrl().url.searchParams.get("visibility")).toBe("public");
  });
});

describe("VideoFilters — date range", () => {
  it("applies from/to and closes the dialog", async () => {
    const user = userEvent.setup();
    navigation.search = "cursor=abc";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-19" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const { url } = lastUrl();
    expect(url.searchParams.get("from")).toBe("2026-10-01");
    expect(url.searchParams.get("to")).toBe("2026-10-19");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects a start date after the end date", async () => {
    const user = userEvent.setup();
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The start date must be on or before the end date.",
    );
    expect(screen.getByLabelText("From")).toHaveAttribute("aria-invalid", "true");
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("accepts an open-ended range", async () => {
    const user = userEvent.setup();
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const { url } = lastUrl();
    expect(url.searchParams.get("from")).toBe("2026-10-01");
    expect(url.searchParams.has("to")).toBe(false);
  });

  it("clears an applied range", async () => {
    const user = userEvent.setup();
    navigation.search = "from=2026-10-01&to=2026-10-19";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Oct 1, 2026 – Oct 19, 2026" }));
    await user.click(screen.getByRole("button", { name: "Clear dates" }));

    const { url } = lastUrl();
    expect(url.searchParams.has("from")).toBe(false);
    expect(url.searchParams.has("to")).toBe(false);
  });
});

describe("VideoFilters — search", () => {
  it("debounces the query by 300 ms and sends it trimmed without cursor", () => {
    vi.useFakeTimers();
    navigation.search = "cursor=abc";
    render(<VideoFilters />);
    const search = screen.getByRole("searchbox");

    fireEvent.change(search, { target: { value: "re" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(search, { target: { value: " react " } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const { url } = lastUrl();
    expect(url.searchParams.get("q")).toBe("react");
    expect(url.searchParams.has("cursor")).toBe(false);
  });

  it("removes q when the field is emptied", () => {
    vi.useFakeTimers();
    navigation.search = "q=react";
    render(<VideoFilters />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "   " } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(lastUrl().url.searchParams.has("q")).toBe(false);
  });

  it("clears the query immediately through the clear button", () => {
    vi.useFakeTimers();
    navigation.search = "q=react";
    render(<VideoFilters />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(lastUrl().url.searchParams.has("q")).toBe(false);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});

describe("VideoFilters — clear filters", () => {
  it("removes every filter, keeps unrelated params and empties the search", async () => {
    const user = userEvent.setup();
    navigation.search =
      "status=draft&visibility=public&q=react&from=2026-10-01&to=2026-10-19&sort=views&cursor=abc";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    const { url } = lastUrl();
    for (const key of ["status", "visibility", "q", "from", "to", "cursor"]) {
      expect(url.searchParams.has(key)).toBe(false);
    }
    expect(url.searchParams.get("sort")).toBe("views");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("navigates to the bare pathname when nothing remains", async () => {
    const user = userEvent.setup();
    navigation.search = "status=draft";
    render(<VideoFilters />);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(replaceMock.mock.calls.at(-1)?.[0]).toBe("/studio/videos");
  });
});
