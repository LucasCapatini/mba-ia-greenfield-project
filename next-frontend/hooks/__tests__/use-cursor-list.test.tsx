// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

import { MAX_STORED_ITEMS, useCursorList, type CursorPage } from "../use-cursor-list";

const { navigation, router } = vi.hoisted(() => ({
  navigation: { pathname: "/", search: "" },
  router: { push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

type Item = { public_id: string; title: string };

function items(from: number, to: number): Item[] {
  return Array.from({ length: to - from + 1 }, (_, index) => ({
    public_id: `v-${from + index}`,
    title: `Video ${from + index}`,
  }));
}

const firstPage: CursorPage<Item> = { items: items(1, 20), next_cursor: "c-20" };

/** Answers `/api/videos` with `pages[cursor]` and records every requested URL. */
function serve(pages: Record<string, CursorPage<Item> | number>) {
  const urls: string[] = [];
  server.use(
    http.get("/api/videos", ({ request }) => {
      urls.push(request.url.replace(/^https?:\/\/[^/]+/, ""));
      const cursor = new URL(request.url).searchParams.get("cursor") ?? "";
      const page = pages[cursor];
      if (page === undefined) return HttpResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      if (typeof page === "number") return HttpResponse.json({ error: "X" }, { status: page });
      return HttpResponse.json(page);
    }),
  );
  return urls;
}

function renderList(initial = firstPage, query: Record<string, string | null> = { category: "music" }) {
  return renderHook(() => useCursorList<Item>({ initial, endpoint: "/api/videos", query }));
}

beforeEach(() => {
  navigation.pathname = "/";
  navigation.search = "category=music";
  router.push.mockClear();
  sessionStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCursorList", () => {
  it("appends the next page with the fixed query and the cursor, then stops at next_cursor null", async () => {
    const urls = serve({ "c-20": { items: items(21, 24), next_cursor: null } });
    const { result } = renderList();

    await act(() => result.current.loadMore());

    expect(urls).toEqual(["/api/videos?category=music&cursor=c-20"]);
    expect(result.current.items.map((item) => item.public_id)).toEqual(items(1, 24).map((item) => item.public_id));
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.status).toBe("idle");

    await act(() => result.current.loadMore());
    expect(urls).toHaveLength(1);
  });

  it("ignores a loadMore while a page is in flight", async () => {
    const urls = serve({ "c-20": { items: items(21, 40), next_cursor: "c-40" } });
    const { result } = renderList();

    await act(async () => {
      void result.current.loadMore();
      void result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(40));
    expect(urls).toHaveLength(1);
  });

  it("drops items already shown (dedup by public_id)", async () => {
    serve({ "c-20": { items: [...items(19, 20), ...items(21, 22)], next_cursor: null } });
    const { result } = renderList();

    await act(() => result.current.loadMore());

    expect(result.current.items.map((item) => item.public_id)).toEqual(items(1, 22).map((item) => item.public_id));
  });

  it("reports an error, keeps the items and retries on the next loadMore", async () => {
    let fail = true;
    server.use(
      http.get("/api/videos", () =>
        fail
          ? HttpResponse.json({ error: "INTERNAL" }, { status: 500 })
          : HttpResponse.json({ items: items(21, 24), next_cursor: null }),
      ),
    );
    const { result } = renderList();

    await act(() => result.current.loadMore());
    expect(result.current.status).toBe("error");
    expect(result.current.items).toHaveLength(20);
    expect(result.current.nextCursor).toBe("c-20");

    fail = false;
    await act(() => result.current.loadMore());
    expect(result.current.status).toBe("idle");
    expect(result.current.items).toHaveLength(24);
  });

  it("starts over from the RSC page on a 400 (stale or forged cursor)", async () => {
    serve({ "c-20": { items: items(21, 40), next_cursor: "c-40" }, "c-40": 400 });
    const { result } = renderList();
    await act(() => result.current.loadMore());
    expect(result.current.items).toHaveLength(40);

    await act(() => result.current.loadMore());

    expect(result.current.items).toEqual(firstPage.items);
    expect(result.current.nextCursor).toBe("c-20");
    expect(result.current.status).toBe("idle");
  });

  it("sends the visitor to the login on a 401, back to the current URL", async () => {
    navigation.pathname = "/feed/subscriptions";
    navigation.search = "";
    serve({ "c-20": 401 });
    const { result } = renderList(firstPage, {});

    await act(() => result.current.loadMore());

    expect(router.push).toHaveBeenCalledWith("/login?returnTo=/feed/subscriptions");
  });

  it("saves items, cursor and scroll per URL on unmount and restores them on the next mount", async () => {
    serve({ "c-20": { items: items(21, 40), next_cursor: "c-40" } });
    const first = renderList();
    await act(() => first.result.current.loadMore());
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1234 });
    window.dispatchEvent(new Event("scroll"));

    first.unmount();

    const stored = JSON.parse(sessionStorage.getItem("cursor-list:/?category=music") ?? "null");
    expect(stored).toMatchObject({ nextCursor: "c-40", scrollY: 1234 });
    expect(stored.items).toHaveLength(40);

    const second = renderList();
    await waitFor(() => expect(second.result.current.items).toHaveLength(40));
    expect(second.result.current.nextCursor).toBe("c-40");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1234);
  });

  it("keeps one entry per URL — another filter starts from its own RSC page", () => {
    sessionStorage.setItem(
      "cursor-list:/?category=music",
      JSON.stringify({ items: items(1, 40), nextCursor: "c-40", scrollY: 10 }),
    );
    navigation.search = "category=gaming";

    const { result } = renderList(firstPage, { category: "gaming" });

    expect(result.current.items).toHaveLength(20);
  });

  it(`does not save a list longer than ${MAX_STORED_ITEMS} items`, () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const long: CursorPage<Item> = { items: items(1, MAX_STORED_ITEMS + 1), next_cursor: "c-x" };
    const { unmount } = renderList(long);

    unmount();

    expect(setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("cursor-list:/?category=music")).toBeNull();
    setItem.mockRestore();
  });

  it(`ignores a stored list longer than ${MAX_STORED_ITEMS} items`, () => {
    sessionStorage.setItem(
      "cursor-list:/?category=music",
      JSON.stringify({ items: items(1, MAX_STORED_ITEMS + 1), nextCursor: "c-x", scrollY: 0 }),
    );

    const { result } = renderList();

    expect(result.current.items).toHaveLength(20);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
