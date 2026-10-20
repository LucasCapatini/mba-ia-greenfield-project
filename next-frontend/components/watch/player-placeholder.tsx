"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { Video } from "@/lib/api/contracts"
import { describeProcessingError } from "@/lib/processing-error"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type NotReadyStatus = Exclude<Video["processing_status"], "ready">

type PlayerPlaceholderProps = Omit<React.ComponentProps<"div">, "children"> & {
  /**
   * `processing`: 409 `VIDEO_NOT_READY` — only the owner reaches it (everyone else gets 404).
   * `error`: 503 `STORAGE_UNAVAILABLE` or any other playback failure.
   */
  mode: "processing" | "error"
  /** Status shown in `processing` mode. */
  processingStatus?: NotReadyStatus
  processingError?: string | null
}

function processingMessage(status: NotReadyStatus, error: string | null): string {
  switch (status) {
    case "uploading":
      return "Upload in progress. The video will be available after processing."
    case "processing":
      return "Processing… The video will be available when it is ready."
    case "failed":
      return `Processing failed: ${describeProcessingError(error)}`
  }
}

/**
 * Stands in for the player on the watch page (UI Contract → Error Catalog → UX mapping): the
 * processing status when the owner opens a video that is not `ready`, or an error with
 * "Try again", which re-runs the RSC reads (`router.refresh()`). Title, channel and description
 * still render around it.
 */
function PlayerPlaceholder({
  mode,
  processingStatus = "processing",
  processingError = null,
  className,
  ...props
}: PlayerPlaceholderProps) {
  const router = useRouter()
  const message =
    mode === "processing"
      ? processingMessage(processingStatus, processingError)
      : "This video can't be played right now."

  return (
    <div
      data-slot="player-placeholder"
      data-mode={mode}
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-[var(--radius-4)] bg-almost-black-1000 px-6 text-center text-neutral-100",
        className
      )}
      {...props}
    >
      <p role={mode === "error" ? "alert" : "status"} className="text-body-lg">
        {message}
      </p>
      {mode === "error" ? (
        <Button variant="secondary" onClick={() => router.refresh()}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export { PlayerPlaceholder }
export type { PlayerPlaceholderProps }
