// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { VideoListItem as VideoListItemData } from "@/lib/api/contracts";

import { OwnerVideoRow } from "../owner-video-row";
import { VideoList } from "../video-list";

function makeVideo(overrides: Partial<VideoListItemData> = {}): VideoListItemData {
  return {
    public_id: "ready-draft-01",
    title: "Aula pronta",
    description: "Primeira aula do curso",
    status: "draft",
    visibility: "public",
    processing_status: "ready",
    processing_error: null,
    thumbnail_url: null,
    duration_seconds: 125,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    published_at: null,
    ...overrides,
  } as VideoListItemData;
}

function renderRow(video = makeVideo()) {
  const handlers = { onPublish: vi.fn(), onUnpublish: vi.fn(), onDelete: vi.fn() };
  render(
    <VideoList aria-label="Channel videos">
      <OwnerVideoRow video={video} {...handlers} />
    </VideoList>,
  );
  return handlers;
}

describe("<OwnerVideoRow />", () => {
  it("keeps title, status and actions reachable by name in the stacked (mobile) layout", () => {
    renderRow();

    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-slot", "video-list-item");
    expect(row).toHaveAttribute("data-public-id", "ready-draft-01");
    expect(within(row).getByRole("link", { name: "Aula pronta" })).toHaveAttribute(
      "href",
      "/studio/videos/ready-draft-01/edit",
    );
    expect(row.querySelector("[data-slot='video-status']")).toHaveTextContent("Draft");
    expect(within(row).getByRole("button", { name: "Video actions" })).toBeInTheDocument();
  });

  it("opens the row actions menu with the publish shortcut of a draft", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Video actions" }));

    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: /publish/i })).toBeInTheDocument();
  });
});
