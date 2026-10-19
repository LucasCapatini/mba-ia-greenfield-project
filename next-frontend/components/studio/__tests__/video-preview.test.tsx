// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThumbnailPreview } from "../thumbnail-preview";
import { VideoPreview } from "../video-preview";

const THUMB = "http://localhost:9000/streamtube/thumbnails/abc/auto.jpg?v=1";

describe("VideoPreview", () => {
  it("renders a native video player when the stream URL is available", () => {
    const { container } = render(
      <VideoPreview title="Tech Review" streamUrl="https://cdn/abc.mp4" posterUrl={THUMB} />,
    );

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "https://cdn/abc.mp4");
    expect(video).toHaveAttribute("poster", THUMB);
    expect(video).toHaveAttribute("aria-label", "Preview of Tech Review");
    expect(container.firstElementChild).toHaveAttribute("data-state", "playable");
  });

  it("shows the poster, play glyph and duration until the stream exists", () => {
    const { container } = render(
      <VideoPreview title="Tech Review" posterUrl={THUMB} durationSeconds={941} />,
    );

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", THUMB);
    expect(screen.getByText("15:41")).toBeInTheDocument();
    expect(screen.getByText("Preview available after processing finishes")).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveAttribute("data-state", "unavailable");
  });

  it("falls back to 0:00 without a duration", () => {
    render(<VideoPreview title="Tech Review" />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });
});

describe("ThumbnailPreview", () => {
  it("renders the current thumbnail with its alt text and duration", () => {
    render(<ThumbnailPreview src={THUMB} alt="Thumbnail of Tech Review" durationSeconds={941} />);

    expect(screen.getByRole("img", { name: "Thumbnail of Tech Review" })).toHaveAttribute(
      "src",
      THUMB,
    );
    expect(screen.getByText("15:41").parentElement).toHaveTextContent("Duration 15:41");
  });

  it("shows the No thumbnail yet placeholder before processing", () => {
    render(<ThumbnailPreview src={null} alt="Thumbnail of Tech Review" />);

    expect(screen.getByText("No thumbnail yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
