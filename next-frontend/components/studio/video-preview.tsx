import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import { ImageIcon } from "@/components/icons/image-icon"
import { PlayIcon } from "@/components/icons/play-icon"
import { VideoPlayer } from "@/components/watch/video-player"

type VideoPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Video title, used as the accessible name of the player. */
  title: string
  /** The player renews the signed URL through `/api/videos/{publicId}/playback` when it expires. */
  publicId: string
  /** Signed playback URL from `GET /videos/{publicId}/playback`; only when `ready`. */
  streamUrl?: string | null
  /** ISO expiry of `streamUrl`. */
  expiresAt?: string | null
  posterUrl?: string | null
  durationSeconds?: number | null
}

/**
 * Figma CardVideoConfig › Video (I156:3122;156:3089): black 166px-tall box with top radius-2,
 * centered play glyph, image glyph top-left and the time bottom-right (white caption). With a
 * stream URL it becomes the watch page `VideoPlayer` (phase 05, own controls) without view
 * registration: the owner never generates views (watch-page/TD-01).
 */
function VideoPreview({
  title,
  publicId,
  streamUrl,
  expiresAt,
  posterUrl,
  durationSeconds,
  className,
  ...props
}: VideoPreviewProps) {
  const duration = (durationSeconds == null ? null : formatDuration(durationSeconds)) ?? "0:00"
  const playback = streamUrl && expiresAt ? { streamUrl, expiresAt } : null

  return (
    <div
      data-slot="video-preview"
      data-state={playback ? "playable" : "unavailable"}
      className={cn(
        "relative h-41.5 w-full shrink-0 overflow-hidden rounded-t-[var(--radius-2)] bg-neutral-1000",
        className
      )}
      {...props}
    >
      {playback ? (
        <VideoPlayer
          key={publicId}
          role="region"
          aria-label={`Preview of ${title}`}
          publicId={publicId}
          streamUrl={playback.streamUrl}
          expiresAt={playback.expiresAt}
          posterUrl={posterUrl ?? null}
          trackViews={false}
          className="size-full rounded-none"
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
