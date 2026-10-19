import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatCompactNumber, formatRelativeTime } from "@/lib/format"

/**
 * Card data for public listings. Mirrors the `VideoCardItem` wire shape planned for
 * `GET /channels/{nickname}/videos` (snake_case); replace with the generated alias from
 * `@/lib/api/contracts` once the OpenAPI chain exports it (SI-04.10).
 */
type VideoCardData = {
  public_id: string
  title: string
  thumbnail_url: string | null
  view_count: number
  published_at: string | null
  channel?: { nickname: string; name: string }
}

type VideoCardProps = Omit<React.ComponentProps<"article">, "children"> & {
  video: VideoCardData
  /** Show the channel name line; off on the channel's own page, where it is redundant. */
  showChannel?: boolean
  now?: Date
}

/**
 * Figma "VideoCard" (143:2505, instances 156:3591…): 16:9 thumbnail with radius-4, 16px gap, title
 * clamped to two lines, optional channel line and "N views • time ago" in body-lg muted. The whole
 * card links to the watch page (phase 05); the title names the link, so the image is decorative.
 * The verified badge of the design has no domain concept and is not rendered.
 */
function VideoCard({ video, showChannel = true, now, className, ...props }: VideoCardProps) {
  const views = `${formatCompactNumber(video.view_count)} ${video.view_count === 1 ? "view" : "views"}`

  return (
    <article data-slot="video-card" className={cn("w-full", className)} {...props}>
      <Link
        href={`/watch/${video.public_id}`}
        className="group flex flex-col gap-4 rounded-[var(--radius-4)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-4)] bg-muted">
          {video.thumbnail_url ? (
            // Browser-facing S3 URL (TD-10): the Next optimizer in the container cannot reach it.
            <Image
              src={video.thumbnail_url}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 640px) 266px, 100vw"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3
            title={video.title}
            className="line-clamp-2 text-body-lg text-foreground group-hover:underline"
          >
            {video.title}
          </h3>
          <div className="flex flex-col gap-0.5 text-body-lg text-muted-foreground">
            {showChannel && video.channel ? (
              <span data-slot="video-card-channel" className="truncate">
                {video.channel.name}
              </span>
            ) : null}
            <span data-slot="video-card-meta" className="flex flex-wrap items-center gap-1">
              <span>{views}</span>
              {video.published_at ? (
                <>
                  {" "}
                  <span aria-hidden="true">•</span>{" "}
                  <time dateTime={video.published_at}>
                    {formatRelativeTime(video.published_at, now)}
                  </time>
                </>
              ) : null}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

export { VideoCard }
export type { VideoCardData, VideoCardProps }
