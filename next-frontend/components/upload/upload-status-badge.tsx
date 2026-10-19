import * as React from "react"

import { cn } from "@/lib/utils"

type UploadStatus = "uploading" | "processing" | "ready" | "failed"

const STATUS_LABEL: Record<UploadStatus, string> = {
  uploading: "Uploading",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
}

const STATUS_COLOR: Record<UploadStatus, string> = {
  uploading: "text-link",
  processing: "text-warning-text",
  ready: "text-success-text",
  failed: "text-destructive",
}

type UploadStatusBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  status: UploadStatus
}

/**
 * Figma "Status label" (157:1938): caption text on the right of the upload row. Only
 * "Uploading" (link color) is drawn; each other state has its own word and color, so the state
 * never relies on color alone.
 */
function UploadStatusBadge({ status, className, ...props }: UploadStatusBadgeProps) {
  return (
    <span
      data-slot="upload-status-badge"
      data-status={status}
      className={cn("shrink-0 text-caption whitespace-nowrap", STATUS_COLOR[status], className)}
      {...props}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export { UploadStatusBadge }
export type { UploadStatus, UploadStatusBadgeProps }
