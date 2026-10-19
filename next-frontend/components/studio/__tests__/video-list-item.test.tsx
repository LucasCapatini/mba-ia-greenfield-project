// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoList } from "../video-list";
import { getVideoStatusBadge, VideoListItem, type VideoListItemData } from "../video-list-item";

const NOW = new Date("2026-10-19T12:00:00Z");

function makeVideo(overrides: Partial<VideoListItemData> = {}): VideoListItemData {
  return {
    public_id: "ready-draft-01",
    title: "My Awesome Tech Review 2024 - Best Gadgets of the Year",
    description: "In this video, we dive deep into the latest tech trends of 2024.",
    status: "published",
    visibility: "public",
    processing_status: "ready",
    processing_error: null,
    thumbnail_url: "http://localhost:9000/streamtube/thumbnails/ready-draft-01/auto.jpg",
    duration_seconds: 630,
    view_count: 124000,
    like_count: 5200,
    comment_count: 432,
    published_at: "2026-10-17T12:00:00Z",
    ...overrides,
  };
}

function renderRow(video: VideoListItemData, extra: Partial<ComponentProps<typeof VideoListItem>> = {}) {
  return render(
    <VideoList aria-label="Channel videos">
      <VideoListItem video={video} now={NOW} {...extra} />
    </VideoList>,
  );
}

function statusBadge() {
  return within(screen.getByRole("listitem")).getByText(
    (_, el) => el?.getAttribute("data-slot") === "video-status",
  );
}

describe("VideoListItem", () => {
  it("renders the row inside the list with title, description, thumbnail and metrics", () => {
    const { container } = renderRow(makeVideo());

    const list = screen.getByRole("list", { name: "Channel videos" });
    const row = within(list).getByRole("listitem");
    expect(row).toHaveTextContent("My Awesome Tech Review 2024 - Best Gadgets of the Year");
    expect(row).toHaveTextContent("In this video, we dive deep into the latest tech trends of 2024.");
    expect(row).toHaveTextContent("124K views");
    expect(row).toHaveTextContent("2 days ago");
    expect(container.querySelector('[data-slot="video-thumbnail"] img')).toHaveAttribute(
      "src",
      "http://localhost:9000/streamtube/thumbnails/ready-draft-01/auto.jpg",
    );
    expect(screen.getByText("10:30")).toBeInTheDocument();
  });

  it.each([
    [{ status: "published", visibility: "public" }, "Public", "success"],
    [{ status: "published", visibility: "unlisted" }, "Unlisted", "secondary"],
    [{ status: "draft", visibility: "public" }, "Draft", "outline"],
    [{ status: "draft", processing_status: "processing" }, "Processing", "warning"],
    [{ status: "draft", processing_status: "uploading" }, "Processing", "warning"],
    [{ status: "draft", processing_status: "failed", processing_error: "Unsupported codec" }, "Failed", "destructive"],
  ] as const)("shows the %o state as a %s badge", (overrides, label, variant) => {
    renderRow(makeVideo(overrides));

    const badge = statusBadge();
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute("data-variant", variant);
    expect(screen.getByRole("listitem")).toHaveAttribute("data-status", label.toLowerCase());
  });

  it("shows Draft instead of a publication time for a never-published video", () => {
    renderRow(makeVideo({ status: "draft", published_at: null }));

    const row = screen.getByRole("listitem");
    expect(row.querySelector("time")).toBeNull();
    expect(row.querySelector('[data-slot="video-stats-published"]')).toHaveTextContent("Draft");
  });

  it("keeps the relative time for a draft that was published before", () => {
    renderRow(makeVideo({ status: "draft", published_at: "2026-10-17T12:00:00Z" }));

    expect(screen.getByRole("listitem").querySelector("time")).toHaveTextContent("2 days ago");
    expect(statusBadge()).toHaveTextContent("Draft");
  });

  it("exposes the processing error of a failed video", () => {
    renderRow(makeVideo({ processing_status: "failed", processing_error: "Unsupported codec" }));

    const badge = statusBadge();
    expect(badge).toHaveAttribute("title", "Unsupported codec");
    expect(badge).toHaveTextContent("Failed: Unsupported codec");
  });

  it("links the title to the edit page when href is given", () => {
    renderRow(makeVideo(), { href: "/studio/videos/ready-draft-01/edit" });

    const link = screen.getByRole("link", { name: /My Awesome Tech Review/ });
    expect(link).toHaveAttribute("href", "/studio/videos/ready-draft-01/edit");
    expect(link).toHaveAttribute("title", "My Awesome Tech Review 2024 - Best Gadgets of the Year");
  });

  it("renders the title as text without href", () => {
    renderRow(makeVideo());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the description when it is missing", () => {
    renderRow(makeVideo({ description: null }));
    expect(screen.getByRole("listitem")).not.toHaveTextContent("In this video");
  });

  it("renders the actions slot", () => {
    renderRow(makeVideo(), { actions: <button type="button" aria-label="Video actions" /> });
    expect(
      within(screen.getByRole("listitem")).getByRole("button", { name: "Video actions" }),
    ).toBeInTheDocument();
  });

  it("renders the list footer slot", () => {
    render(
      <VideoList aria-label="Channel videos" footer={<button type="button">Load more</button>}>
        <VideoListItem video={makeVideo()} now={NOW} />
      </VideoList>,
    );
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });
});

describe("getVideoStatusBadge", () => {
  it("lets processing state win over a published status", () => {
    expect(
      getVideoStatusBadge({ status: "published", visibility: "public", processing_status: "processing" }),
    ).toEqual({ label: "Processing", variant: "warning" });
  });
});
