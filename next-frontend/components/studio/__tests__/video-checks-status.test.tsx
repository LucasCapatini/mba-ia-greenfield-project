// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { describeProcessingError } from "@/lib/processing-error";

import { VideoChecksStatus } from "../video-checks-status";

type Props = ComponentProps<typeof VideoChecksStatus>;

function renderStatus(overrides: Partial<Props> = {}) {
  return render(
    <VideoChecksStatus
      processingStatus="ready"
      status="draft"
      processingError={null}
      publishedAt={null}
      {...overrides}
    />,
  );
}

describe("VideoChecksStatus", () => {
  it("is a polite live region", () => {
    renderStatus();

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-slot", "video-checks-status");
  });

  it.each([
    ["uploading", "pending"],
    ["processing", "processing"],
  ] as const)("tells the owner they can save while %s", (processingStatus, state) => {
    renderStatus({ processingStatus });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-state", state);
    expect(status).toHaveTextContent("Processing… you can save, publishing happens when ready");
  });

  it("announces that saving a ready draft publishes it", () => {
    renderStatus({ processingStatus: "ready", status: "draft" });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-state", "ready");
    expect(status).toHaveTextContent("Checks complete. Saving will publish this video.");
  });

  it("shows the publication date of a published video", () => {
    renderStatus({ status: "published", publishedAt: "2026-10-17T12:00:00Z" });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-state", "published");
    expect(status).toHaveTextContent("Published on Oct 17, 2026");
  });

  it.each([
    ["UNSUPPORTED_FORMAT", "not a supported video format"],
    ["PROBE_FAILED", "couldn't read this video file"],
    ["THUMBNAIL_FAILED", "couldn't generate a thumbnail"],
    ["OBJECT_MISSING", "uploaded file was not found"],
  ])("maps the %s processing error to a message", (code, fragment) => {
    renderStatus({ processingStatus: "failed", processingError: code });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-state", "failed");
    expect(status).toHaveClass("text-destructive");
    expect(status).toHaveTextContent(`Processing failed: `);
    expect(status).toHaveTextContent(fragment);
  });

  it("falls back for unknown or missing error codes", () => {
    expect(describeProcessingError("NEW_CODE")).toBe("an unexpected error occurred (NEW_CODE).");
    expect(describeProcessingError(null)).toBe("an unknown error occurred.");
  });

  it("lets a processing failure win over a published status", () => {
    renderStatus({ processingStatus: "failed", status: "published", processingError: "PROBE_FAILED" });
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "failed");
  });
});
