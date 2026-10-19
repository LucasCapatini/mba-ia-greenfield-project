import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"

type VideoThumbnailProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Stable public thumbnail URL (TD-10); null while the worker has not produced one. */
  src: string | null
  /** Describes the image; pass "" when the video title is already announced next to it. */
  alt: string
  durationSeconds?: number | null
}

/**
 * Figma VideoList thumb (I158:3096;108:323): 256×144, radius-2, black backdrop, duration in the
 * bottom-right corner. The duration sits on the overlay token so white text keeps contrast on
 * bright frames.
 */
function VideoThumbnail({
  src,
  alt,
  durationSeconds,
  className,
  ...props
}: VideoThumbnailProps) {
  const duration = durationSeconds == null ? null : formatDuration(durationSeconds)
  // Without an image the box still stands for the video, unless the caller marked it decorative.
  const placeholderA11y = src
    ? {}
    : alt
      ? { role: "img", "aria-label": alt }
      : { "aria-hidden": true }

  return (
    <div
      data-slot="video-thumbnail"
      className={cn(
        "relative aspect-video w-64 shrink-0 overflow-hidden rounded-[var(--radius-2)] bg-neutral-1000",
        className
      )}
      {...placeholderA11y}
      {...props}
    >
      {src ? (
        // The S3 public endpoint is browser-facing only, so the Next optimizer cannot fetch it.
        <Image src={src} alt={alt} fill unoptimized sizes="256px" className="object-cover" />
      ) : null}
      {duration ? (
        <span
          data-slot="video-thumbnail-duration"
          className="absolute right-2 bottom-2 rounded-[var(--radius-1)] bg-overlay px-1 text-caption text-neutral-100"
        >
          <span className="sr-only">Duration </span>
          {duration}
        </span>
      ) : null}
    </div>
  )
}

export { VideoThumbnail }
export type { VideoThumbnailProps }
