// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VideoConfigCard } from "../video-config-card";

type Props = ComponentProps<typeof VideoConfigCard>;

function renderCard(overrides: Partial<Props> = {}) {
  return render(
    <VideoConfigCard
      publicId="tech2024abc"
      origin="https://streamtube.com"
      originalFilename="my_awesome_tech_review_final_v2.mp4"
      processingStatus="ready"
      height={1080}
      {...overrides}
    />,
  );
}

function slot(container: HTMLElement, name: string) {
  return container.querySelector(`[data-slot="video-config-${name}"]`);
}

describe("VideoConfigCard", () => {
  it("links to the watch page and shows the link without the protocol", () => {
    renderCard();

    const link = screen.getByRole("link", { name: "streamtube.com/watch/tech2024abc" });
    expect(link).toHaveAttribute("href", "/watch/tech2024abc");
  });

  it("strips a trailing slash from the origin", () => {
    renderCard({ origin: "http://localhost:3001/" });
    expect(screen.getByRole("link")).toHaveTextContent("localhost:3001/watch/tech2024abc");
  });

  it("shows the filename and the quality once the video is ready", () => {
    const { container } = renderCard();

    expect(slot(container, "filename")).toHaveTextContent("my_awesome_tech_review_final_v2.mp4");
    expect(slot(container, "quality")).toHaveTextContent("1080p HD");
    expect(slot(container, "quality")).toHaveClass("text-foreground");
  });

  it("omits the HD suffix below 720p", () => {
    const { container } = renderCard({ height: 480 });
    expect(slot(container, "quality")).toHaveTextContent(/^480p$/);
  });

  it.each(["uploading", "processing"] as const)(
    "shows a quality placeholder while %s",
    (processingStatus) => {
      const { container } = renderCard({ processingStatus, height: null });

      expect(slot(container, "quality")).toHaveTextContent("Available after processing");
      expect(slot(container, "quality")).toHaveClass("text-muted-foreground");
      expect(slot(container, "filename")).toHaveTextContent("my_awesome_tech_review_final_v2.mp4");
    },
  );

  it("ignores a stale height until the video is ready", () => {
    const { container } = renderCard({ processingStatus: "processing", height: 1080 });
    expect(slot(container, "quality")).toHaveTextContent("Available after processing");
  });

  it("marks the quality as unavailable when processing failed", () => {
    const { container } = renderCard({ processingStatus: "failed", height: null });
    expect(slot(container, "quality")).toHaveTextContent("Unavailable");
  });

  it("shows a dash when the filename is unknown", () => {
    const { container } = renderCard({ originalFilename: null });
    expect(slot(container, "filename")).toHaveTextContent("—");
  });

  it("renders the preview and copy-action slots", () => {
    renderCard({
      preview: <div data-testid="preview" />,
      copyAction: <button type="button" aria-label="Copy link" />,
    });

    expect(screen.getByTestId("preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });
});
