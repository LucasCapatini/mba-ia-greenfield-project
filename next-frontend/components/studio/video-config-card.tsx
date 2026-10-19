import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type VideoConfigCardProps = Omit<React.ComponentProps<"div">, "children"> & {
  publicId: string
  /** App origin (e.g. "https://streamtube.com"); the watch page path is decided in OQ-5. */
  origin: string
  originalFilename: string | null
  processingStatus: "uploading" | "processing" | "ready" | "failed"
  /** Frame height extracted by the worker; null until processing finishes. */
  height: number | null
  /** The `VideoPreview` slot. */
  preview?: React.ReactNode
  /** The copy-link button slot. */
  copyAction?: React.ReactNode
}

function formatQuality(height: number): string {
  return height >= 720 ? `${height}p HD` : `${height}p`
}

function qualityPlaceholder(status: VideoConfigCardProps["processingStatus"]): string {
  return status === "failed" ? "Unavailable" : "Available after processing"
}

/**
 * Figma "CardVideoConfig" (156:3122): 328px card (bg-card, border-border, radius-3, p-4) with the
 * preview on top, then the public link, the original filename and the video quality, separated
 * by top borders; labels are caption + muted-foreground.
 */
function VideoConfigCard({
  publicId,
  origin,
  originalFilename,
  processingStatus,
  height,
  preview,
  copyAction,
  className,
  ...props
}: VideoConfigCardProps) {
  const watchPath = `/watch/${publicId}`
  const displayLink = `${origin.replace(/^https?:\/\//, "").replace(/\/$/, "")}${watchPath}`
  const quality =
    processingStatus === "ready" && height ? formatQuality(height) : qualityPlaceholder(processingStatus)

  return (
    <div
      data-slot="video-config-card"
      className={cn(
        "flex w-82 shrink-0 flex-col overflow-hidden rounded-[var(--radius-3)] border border-border bg-card p-4",
        className
      )}
      {...props}
    >
      {preview}
      <dl className="flex flex-col text-caption">
        <div className="flex flex-col gap-1 pt-5 pb-4">
          <dt className="text-muted-foreground">Video link</dt>
          <dd className="flex items-center gap-2">
            <Link
              href={watchPath}
              data-slot="video-config-link"
              className="truncate text-body-md text-link hover:underline"
            >
              {displayLink}
            </Link>
            {copyAction}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-t border-border py-4 text-muted-foreground">
          <dt>Filename</dt>
          <dd data-slot="video-config-filename" className="break-all">
            {originalFilename ?? "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <dt className="text-muted-foreground">Video Quality</dt>
          <dd
            data-slot="video-config-quality"
            className={cn(
              processingStatus === "ready" && height ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {quality}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export { VideoConfigCard }
export type { VideoConfigCardProps }
