// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UploadStatusBadge } from "../upload-status-badge";
import { UploadStatusRow } from "../upload-status-row";

const FILE = "my_awesome_video_final_v2.mp4";

function message(container: HTMLElement) {
  return container.querySelector('[data-slot="upload-status-message"]');
}

describe("UploadStatusRow", () => {
  it("shows the file name, the percentage and a determinate progressbar while uploading", () => {
    const { container } = render(<UploadStatusRow fileName={FILE} status="uploading" progress={84} />);

    expect(screen.getByText(FILE)).toHaveAttribute("title", FILE);
    expect(message(container)).toHaveTextContent("Uploading… 84%");
    expect(message(container)).toHaveAttribute("aria-live", "polite");
    const bar = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "84");
    expect(bar).toHaveAttribute("data-state", "loading");
  });

  it.each([
    [-5, "0"],
    [33.6, "34"],
    [140, "100"],
    [undefined, "0"],
  ])("clamps and rounds progress %s to %s%%", (progress, expected) => {
    const { container } = render(
      <UploadStatusRow fileName={FILE} status="uploading" progress={progress} />,
    );
    expect(message(container)).toHaveTextContent(`Uploading… ${expected}%`);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", expected);
  });

  it("switches to an indeterminate bar while processing", () => {
    const { container } = render(<UploadStatusRow fileName={FILE} status="processing" progress={100} />);

    expect(message(container)).toHaveTextContent("Processing…");
    const bar = screen.getByRole("progressbar", { name: "Processing progress" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-state", "indeterminate");
  });

  it("shows a complete bar when ready", () => {
    const { container } = render(<UploadStatusRow fileName={FILE} status="ready" />);

    expect(message(container)).toHaveTextContent("Upload complete. Your video is ready.");
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-state", "complete");
  });

  it("explains the failure and hides the bar", () => {
    const { container } = render(
      <UploadStatusRow fileName={FILE} status="failed" processingError="UNSUPPORTED_FORMAT" />,
    );

    expect(message(container)).toHaveTextContent("Failed: the file is not a supported video format");
    expect(message(container)).toHaveClass("text-destructive");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("lets a custom message replace the status line", () => {
    const { container } = render(
      <UploadStatusRow
        fileName={FILE}
        status="uploading"
        progress={40}
        message="Upload interrupted — select the file again to resume"
      />,
    );
    expect(message(container)).toHaveTextContent(
      "Upload interrupted — select the file again to resume",
    );
  });

  it("exposes the status on the row and the badge", () => {
    const { container } = render(<UploadStatusRow fileName={FILE} status="processing" />);

    expect(container.firstElementChild).toHaveAttribute("data-status", "processing");
    expect(container.querySelector('[data-slot="upload-status-badge"]')).toHaveTextContent(
      "Processing",
    );
  });
});

describe("UploadStatusBadge", () => {
  it.each([
    ["uploading", "Uploading", "text-link"],
    ["processing", "Processing", "text-warning-text"],
    ["ready", "Ready", "text-success-text"],
    ["failed", "Failed", "text-destructive"],
  ] as const)("labels %s as %s with its color", (status, label, color) => {
    render(<UploadStatusBadge status={status} />);

    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute("data-status", status);
    expect(badge).toHaveClass(color);
  });
});
