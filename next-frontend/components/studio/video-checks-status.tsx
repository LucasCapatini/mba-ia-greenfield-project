import * as React from "react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { describeProcessingError } from "@/lib/processing-error"
import { CheckCircleIcon } from "@/components/icons/check-circle-icon"
import { ErrorOutlineIcon } from "@/components/icons/error-outline-icon"
import { ScheduleIcon } from "@/components/icons/schedule-icon"

type ProcessingStatus = "uploading" | "processing" | "ready" | "failed"

type ChecksState = "pending" | "processing" | "ready" | "published" | "failed"

type VideoChecksStatusProps = Omit<React.ComponentProps<"div">, "children"> & {
  processingStatus: ProcessingStatus
  status: "draft" | "published"
  processingError: string | null
  publishedAt: string | null
}

function resolveChecksState(
  processingStatus: ProcessingStatus,
  status: "draft" | "published"
): ChecksState {
  if (processingStatus === "failed") return "failed"
  if (processingStatus === "uploading") return "pending"
  if (processingStatus === "processing") return "processing"
  return status === "published" ? "published" : "ready"
}

/**
 * Figma "Status" (2771:2088): 12px icon + caption text, muted. Only the success state is drawn;
 * the others follow the UI Contract copy. Announced politely because polling changes it.
 */
function VideoChecksStatus({
  processingStatus,
  status,
  processingError,
  publishedAt,
  className,
  ...props
}: VideoChecksStatusProps) {
  const state = resolveChecksState(processingStatus, status)

  let icon: React.ReactNode
  let message: string
  switch (state) {
    case "failed":
      icon = <ErrorOutlineIcon className="size-3 text-destructive" />
      message = `Processing failed: ${describeProcessingError(processingError)}`
      break
    case "pending":
    case "processing":
      icon = <ScheduleIcon className="size-3 text-muted-foreground" />
      message = "Processing… you can save, publishing happens when ready"
      break
    case "published":
      icon = <CheckCircleIcon className="size-3 text-success" />
      message = publishedAt ? `Published on ${formatDate(publishedAt)}` : "Published"
      break
    default:
      icon = <CheckCircleIcon className="size-3 text-success" />
      message = "Checks complete. Saving will publish this video."
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="video-checks-status"
      data-state={state}
      className={cn(
        "flex items-center gap-1 text-caption text-muted-foreground",
        state === "failed" && "text-destructive",
        className
      )}
      {...props}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}

export { VideoChecksStatus, resolveChecksState }
export type { ChecksState, VideoChecksStatusProps }
