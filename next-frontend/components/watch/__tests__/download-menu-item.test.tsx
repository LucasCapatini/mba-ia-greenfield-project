// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { DownloadMenuItem } from "../download-menu-item";

const DOWNLOAD_URL =
  "http://localhost:9000/streamtube-videos/videos/pub-01/source?X-Amz-Signature=download";

function renderOpenMenu() {
  return render(
    <DropdownMenu open>
      <DropdownMenuTrigger>More actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DownloadMenuItem downloadUrl={DOWNLOAD_URL} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DownloadMenuItem", () => {
  it("renders a 'Download' menu item", () => {
    renderOpenMenu();

    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
  });

  it("points the item at the signed download URL from the props", () => {
    renderOpenMenu();

    const item = screen.getByRole("menuitem", { name: "Download" });
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", DOWNLOAD_URL);
    expect(item).toHaveAttribute("download");
  });

  it("decorates the item with the download icon, hidden from assistive tech", () => {
    renderOpenMenu();

    const svg = screen.getByRole("menuitem", { name: "Download" }).querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
