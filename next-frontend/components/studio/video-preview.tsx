import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import { ImageIcon } from "@/components/icons/image-icon"
import { PlayIcon } from "@/components/icons/play-icon"

type VideoPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Video title, used as the accessible name of the player. */
  title: string
  /** Signed playback URL from `GET /videos/{publicId}/playback`; only when `ready`. */
  streamUrl?: string | null
  posterUrl?: string | null
  durationSeconds?: number | null
}

/**
 * Figma CardVideoConfig › Video (I156:3122;156:3089): black 166px-tall box with top radius-2,
 * centered play glyph, image glyph top-left and the time bottom-right (white caption). With a
 * stream URL it becomes a native `<video>`; the full player is phase 05.
 */
function VideoPreview({
  title,
  streamUrl,
  posterUrl,
  durationSeconds,
  className,
  ...props
}: VideoPreviewProps) {
  const duration = (durationSeconds == null ? null : formatDuration(durationSeconds)) ?? "0:00"

  return (
    <div
      data-slot="video-preview"
      data-state={streamUrl ? "playable" : "unavailable"}
      className={cn(
        "relative h-41.5 w-full shrink-0 overflow-hidden rounded-t-[var(--radius-2)] bg-neutral-1000",
        className
      )}
      {...props}
    >
      {streamUrl ? (
        <video
          src={streamUrl}
          poster={posterUrl ?? undefined}
          controls
          preload="metadata"
          aria-label={`Preview of ${title}`}
          className="size-full object-contain"
        />
      ) : (
        <>
          {posterUrl ? (
            <Image src={posterUrl} alt="" fill unoptimized sizes="296px" className="object-cover" />
          ) : null}
          <ImageIcon className="absolute top-3 left-3 size-4 text-neutral-100 opacity-50" />
          <PlayIcon className="absolute top-1/2 left-1/2 h-9 w-auto -translate-x-1/2 -translate-y-1/2 text-neutral-100 opacity-50" />
          <span className="absolute right-3 bottom-3 text-caption text-neutral-100">{duration}</span>
          <span className="sr-only">Preview available after processing finishes</span>
        </>
      )}
    </div>
  )
}

export { VideoPreview }
export type { VideoPreviewProps }
