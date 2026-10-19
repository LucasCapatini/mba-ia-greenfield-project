import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import { ImageIcon } from "@/components/icons/image-icon"

type ThumbnailPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Current thumbnail (custom or automatic, TD-10 stable URL); null until the worker makes one. */
  src: string | null
  alt: string
  durationSeconds?: number | null
}

/**
 * Figma "ThumbUpload" (156:2612): ~266×151 image with radius-4 and an optional duration badge
 * (overlay fill, white label-md). Shows a "No thumbnail yet" placeholder before processing.
 */
function ThumbnailPreview({
  src,
  alt,
  durationSeconds,
  className,
  ...props
}: ThumbnailPreviewProps) {
  const duration = durationSeconds == null ? null : formatDuration(durationSeconds)

  return (
    <div
      data-slot="thumbnail-preview"
      className={cn(
        "relative aspect-video w-66.5 shrink-0 overflow-hidden rounded-[var(--radius-4)] bg-muted",
        className
      )}
      {...props}
    >
      {src ? (
        // Browser-facing S3 URL: the Next optimizer in the container cannot reach it.
        <Image src={src} alt={alt} fill unoptimized sizes="266px" className="object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="size-6" />
          <span className="text-caption">No thumbnail yet</span>
        </div>
      )}
      {duration ? (
        <span
          data-slot="thumbnail-preview-duration"
          className="absolute right-2 bottom-2 rounded-[var(--radius-1)] bg-overlay p-1 text-label-md text-neutral-100"
        >
          <span className="sr-only">Duration </span>
          {duration}
        </span>
      ) : null}
    </div>
  )
}

export { ThumbnailPreview }
export type { ThumbnailPreviewProps }
