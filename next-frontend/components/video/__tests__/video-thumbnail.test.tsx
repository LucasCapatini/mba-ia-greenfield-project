// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoThumbnail } from "../video-thumbnail";

const SRC = "http://localhost:9000/streamtube/thumbnails/abc/custom.jpg";

describe("VideoThumbnail", () => {
  it("renders the image with its alt text from the stable URL", () => {
    render(<VideoThumbnail src={SRC} alt="My Awesome Tech Review" durationSeconds={630} />);

    const img = screen.getByRole("img", { name: "My Awesome Tech Review" });
    expect(img).toHaveAttribute("src", SRC);
    expect(img.closest('[data-slot="video-thumbnail"]')).toBeInTheDocument();
  });

  it("formats the duration as m:ss with a screen-reader prefix", () => {
    const { container } = render(<VideoThumbnail src={SRC} alt="" durationSeconds={630} />);

    const duration = container.querySelector('[data-slot="video-thumbnail-duration"]');
    expect(duration).toHaveTextContent("Duration 10:30");
    expect(duration).toHaveClass("bg-overlay");
  });

  it("formats durations over an hour as h:mm:ss", () => {
    render(<VideoThumbnail src={SRC} alt="" durationSeconds={3725} />);
    expect(screen.getByText("1:02:05")).toBeInTheDocument();
  });

  it.each([null, undefined])("omits the duration badge when duration is %s", (durationSeconds) => {
    const { container } = render(
      <VideoThumbnail src={SRC} alt="" durationSeconds={durationSeconds} />,
    );
    expect(container.querySelector('[data-slot="video-thumbnail-duration"]')).toBeNull();
  });

  it("keeps an empty alt for decorative thumbnails", () => {
    const { container } = render(<VideoThumbnail src={SRC} alt="" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("exposes the placeholder as an image when there is no thumbnail yet", () => {
    render(<VideoThumbnail src={null} alt="Processing video" />);

    const placeholder = screen.getByRole("img", { name: "Processing video" });
    expect(placeholder).toHaveAttribute("data-slot", "video-thumbnail");
    expect(placeholder.querySelector("img")).toBeNull();
  });

  it("hides a decorative placeholder from assistive technology", () => {
    const { container } = render(<VideoThumbnail src={null} alt="" />);
    expect(container.querySelector('[data-slot="video-thumbnail"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
