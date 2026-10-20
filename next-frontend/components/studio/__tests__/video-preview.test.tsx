// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { server } from "@/mocks/server";

import { ThumbnailPreview } from "../thumbnail-preview";
import { VideoPreview } from "../video-preview";

const THUMB = "http://localhost:9000/streamtube/thumbnails/abc/auto.jpg?v=1";
const FAR_FUTURE = "2999-01-01T00:00:00.000Z";

afterEach(() => {
  server.events.removeAllListeners();
});

describe("VideoPreview", () => {
  it("renders the watch page player with its own controls when the stream URL is available", () => {
    const { container } = render(
      <VideoPreview
        title="Tech Review"
        publicId="abc"
        streamUrl="https://cdn/abc.mp4"
        expiresAt={FAR_FUTURE}
        posterUrl={THUMB}
      />,
    );

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "https://cdn/abc.mp4");
    expect(video).toHaveAttribute("poster", THUMB);
    expect(video).not.toHaveAttribute("controls");
    expect(screen.getByRole("region", { name: "Preview of Tech Review" })).toContainElement(video);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter full screen" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-state", "playable");
  });

  it("never registers a view, even after more than 10 s of playback", async () => {
    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => {
      requests.push(new URL(request.url).pathname);
    });
    const { container } = render(
      <VideoPreview
        title="Tech Review"
        publicId="abc"
        streamUrl="https://cdn/abc.mp4"
        expiresAt={FAR_FUTURE}
      />,
    );
    const video = container.querySelector("video")!;
    const media = { currentTime: 0, duration: 60 };
    Object.defineProperty(video, "currentTime", { configurable: true, get: () => media.currentTime });
    Object.defineProperty(video, "duration", { configurable: true, get: () => media.duration });

    act(() => {
      while (media.currentTime < 15) {
        media.currentTime += 0.25;
        video.dispatchEvent(new Event("timeupdate"));
      }
      video.dispatchEvent(new Event("ended"));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests.filter((path) => path.endsWith("/views"))).toEqual([]);
  });

  it("shows the poster, play glyph and duration until the stream exists", () => {
    const { container } = render(
      <VideoPreview title="Tech Review" publicId="abc" posterUrl={THUMB} durationSeconds={941} />,
    );

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", THUMB);
    expect(screen.getByText("15:41")).toBeInTheDocument();
    expect(screen.getByText("Preview available after processing finishes")).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveAttribute("data-state", "unavailable");
  });

  it("falls back to 0:00 without a duration", () => {
    render(<VideoPreview title="Tech Review" publicId="abc" />);
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
