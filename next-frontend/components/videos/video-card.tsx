import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatCompactNumber, formatRelativeTime } from "@/lib/format"
import { VideoThumbnail } from "@/components/video/video-thumbnail"
import { ChannelAvatar } from "@/components/channel/channel-avatar"

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
  /** Shown as a badge on the thumbnail by the `horizontal` variant only. */
  duration_seconds?: number | null
  channel?: { nickname: string; name: string }
}

type VideoCardProps = Omit<React.ComponentProps<"article">, "children"> & {
  video: VideoCardData
  /** `default`: vertical card of the channel grid. `horizontal`: compact row of the watch page sidebar. */
  variant?: "default" | "horizontal"
  /** Show the channel name line; off on the channel's own page, where it is redundant. */
  showChannel?: boolean
  /**
   * `default` variant only: channel initials avatar beside the text column, avatar and name linking
   * to `/channel/{nickname}` (subscriptions feed — Figma Home 143:948, phase 06 resolution OQ-5).
   */
  showAvatar?: boolean
  now?: Date
}

/** 16:9 thumbnail of the `default` variant (decorative — the title names the watch link). */
function DefaultThumbnail({ video }: { video: VideoCardData }) {
  return (
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
  )
}

function VideoCardMeta({ video, now }: { video: VideoCardData; now?: Date }) {
  const views = `${formatCompactNumber(video.view_count)} ${video.view_count === 1 ? "view" : "views"}`
  return (
    <span data-slot="video-card-meta" className="flex flex-wrap items-center gap-1">
      <span>{views}</span>
      {video.published_at ? (
        <>
          {" "}
          <span aria-hidden="true">•</span>{" "}
          <time dateTime={video.published_at}>{formatRelativeTime(video.published_at, now)}</time>
        </>
      ) : null}
    </span>
  )
}

/**
 * Figma "VideoCard" (143:2505, instances 156:3591…): 16:9 thumbnail with radius-4, 16px gap, title
 * clamped to two lines, optional channel line and "N views • time ago" in body-lg muted. The whole
 * card links to the watch page (phase 05); the title names the link, so the image is decorative.
 * The `horizontal` variant (Video show sidebar, 152:2219) puts a 168px thumbnail with the duration
 * badge beside a compact text column. The verified badge of the design has no domain concept and
 * is not rendered.
 */
function VideoCard({
  video,
  variant = "default",
  showChannel = true,
  showAvatar = false,
  now,
  className,
  ...props
}: VideoCardProps) {
  const channel =
    showChannel && video.channel ? (
      <span data-slot="video-card-channel" className="truncate">
        {video.channel.name}
      </span>
    ) : null

  if (variant === "horizontal") {
    return (
      <article
        data-slot="video-card"
        data-variant="horizontal"
        className={cn("w-full", className)}
        {...props}
      >
        <Link
          href={`/watch/${video.public_id}`}
          className="group flex gap-3 rounded-[var(--radius-2)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <VideoThumbnail
            src={video.thumbnail_url}
            alt=""
            durationSeconds={video.duration_seconds}
            className="w-42"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h3
              title={video.title}
              className="line-clamp-2 text-body-md text-foreground group-hover:underline"
            >
              {video.title}
            </h3>
            <div className="flex flex-col gap-0.5 text-caption text-muted-foreground">
              {channel}
              <VideoCardMeta video={video} now={now} />
            </div>
          </div>
        </Link>
      </article>
    )
  }

  if (showAvatar && video.channel) {
    const channelHref = `/channel/${video.channel.nickname}`
    const watchHref = `/watch/${video.public_id}`
    // Separate links (watch / channel): a link cannot contain another. The thumbnail and the avatar
    // duplicate the title and name links, so they stay out of the tab order and the a11y tree.
    return (
      <article
        data-slot="video-card"
        data-variant="default"
        data-avatar="true"
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
      >
        <Link href={watchHref} tabIndex={-1} aria-hidden="true" className="block">
          <DefaultThumbnail video={video} />
        </Link>
        <div className="flex gap-3">
          <Link href={channelHref} tabIndex={-1} aria-hidden="true" className="shrink-0">
            <ChannelAvatar
              name={video.channel.name}
              aria-hidden="true"
              className="size-10 [&_[data-slot=avatar-fallback]]:text-label-md"
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              href={watchHref}
              className="group rounded-[var(--radius-2)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <h3 title={video.title} className="line-clamp-2 text-body-lg text-foreground group-hover:underline">
                {video.title}
              </h3>
            </Link>
            <div className="flex flex-col gap-0.5 text-body-lg text-muted-foreground">
              <Link
                href={channelHref}
                data-slot="video-card-channel"
                className="w-fit truncate rounded-[var(--radius-2)] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {video.channel.name}
              </Link>
              <VideoCardMeta video={video} now={now} />
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article data-slot="video-card" data-variant="default" className={cn("w-full", className)} {...props}>
      <Link
        href={`/watch/${video.public_id}`}
        className="group flex flex-col gap-4 rounded-[var(--radius-4)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <DefaultThumbnail video={video} />
        <div className="flex min-w-0 flex-col gap-2">
          <h3
            title={video.title}
            className="line-clamp-2 text-body-lg text-foreground group-hover:underline"
          >
            {video.title}
          </h3>
          <div className="flex flex-col gap-0.5 text-body-lg text-muted-foreground">
            {channel}
            <VideoCardMeta video={video} now={now} />
          </div>
        </div>
      </Link>
    </article>
  )
}

export { VideoCard }
export type { VideoCardData, VideoCardProps }
