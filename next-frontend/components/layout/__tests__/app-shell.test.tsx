// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "../app-shell";

describe("AppShell", () => {
  it("renders the side navigation next to the content when nav is provided", () => {
    const { container } = render(
      <AppShell nav={<nav aria-label="Main">menu</nav>}>
        <main>Page content</main>
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
    expect(container.firstElementChild).toHaveAttribute("data-nav", "visible");
  });

  it("renders only the content when there is no nav (anonymous visitor)", () => {
    const { container } = render(
      <AppShell>
        <main>Page content</main>
      </AppShell>,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
    expect(container.firstElementChild).toHaveAttribute("data-nav", "hidden");
  });

  it("does not add a second main landmark around the page", () => {
    render(
      <AppShell nav={<nav aria-label="Main">menu</nav>}>
        <main>Page content</main>
      </AppShell>,
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
