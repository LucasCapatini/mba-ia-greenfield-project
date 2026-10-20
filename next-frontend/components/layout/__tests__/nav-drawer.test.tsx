// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavDrawer } from "../nav-drawer";

const { navigation } = vi.hoisted(() => ({ navigation: { pathname: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

beforeEach(() => {
  navigation.pathname = "/";
});

function renderDrawer(open: boolean, onOpenChange = vi.fn()) {
  const view = render(
    <NavDrawer open={open} onOpenChange={onOpenChange}>
      <nav aria-label="Main">menu</nav>
    </NavDrawer>
  );
  return { ...view, onOpenChange };
}

describe("NavDrawer", () => {
  it("renders the menu inside a dialog when open", () => {
    renderDrawer(true);

    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderDrawer(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks to close on Escape", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDrawer(true);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks to close when the route changes while open", () => {
    const { rerender, onOpenChange } = renderDrawer(true);

    navigation.pathname = "/feed/subscriptions";
    rerender(
      <NavDrawer open onOpenChange={onOpenChange}>
        <nav aria-label="Main">menu</nav>
      </NavDrawer>
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not ask to close when the route stays the same", () => {
    const { rerender, onOpenChange } = renderDrawer(true);

    rerender(
      <NavDrawer open onOpenChange={onOpenChange}>
        <nav aria-label="Main">menu</nav>
      </NavDrawer>
    );

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
