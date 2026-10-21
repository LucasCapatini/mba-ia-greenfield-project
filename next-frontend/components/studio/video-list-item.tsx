import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { VideoStats } from "@/components/studio/video-stats"
import { VideoThumbnail } from "@/components/video/video-thumbnail"

/**
 * Row data for the owner panel. Mirrors the `VideoListItem` wire shape planned for
 * `GET /channels/me/videos` (snake_case); replace with a `Pick` of the generated alias from
 * `@/lib/api/contracts` once the OpenAPI chain exports it (SI-04.10).
 */
type VideoListItemData = {
  public_id: string
  title: string
  /** Not part of the planned `VideoListItem` shape yet; rendered only when present. */
  description?: string | null
  status: "draft" | "published"
  visibility: "public" | "unlisted"
  processing_status: "uploading" | "processing" | "ready" | "failed"
  processing_error: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  view_count: number
  like_count: number
  comment_count: number
  published_at: string | null
}

type VideoStatusBadge = {
  label: "Public" | "Unlisted" | "Draft" | "Processing" | "Failed"
  variant: "success" | "secondary" | "outline" | "warning" | "destructive"
}

/** Processing problems win over the editorial state; a ready video shows draft/visibility. */
function getVideoStatusBadge(
  video: Pick<VideoListItemData, "status" | "visibility" | "processing_status">
): VideoStatusBadge {
  if (video.processing_status === "failed") return { label: "Failed", variant: "destructive" }
  if (video.processing_status === "uploading" || video.processing_status === "processing") {
    return { label: "Processing", variant: "warning" }
  }
  if (video.status === "draft") return { label: "Draft", variant: "outline" }
  if (video.visibility === "unlisted") return { label: "Unlisted", variant: "secondary" }
  return { label: "Public", variant: "success" }
}

type VideoListItemProps = Omit<React.ComponentProps<"li">, "children"> & {
  video: VideoListItemData
  /** Edit page link for the title. */
  href?: string
  /** Row actions slot (kebab menu). */
  actions?: React.ReactNode
  now?: Date
}

/**
 * Figma "VideoList" row (158:3096): 256×144 thumbnail (full width, stacked, below `md`), title (one line, ellipsis), muted
 * description, metrics row with status, and a trailing actions slot; bottom border, 16px gaps.
 */
function VideoListItem({ video, href, actions, now, className, ...props }: VideoListItemProps) {
  const badge = getVideoStatusBadge(video)
  const failed = badge.label === "Failed" && video.processing_error

  return (
    <li
      data-slot="video-list-item"
      data-status={badge.label.toLowerCase()}
      className={cn(
        // Below `md` the row stacks: full-width thumbnail, then details + actions side by side
        // (home-search-production/TD-05, Revisions 2026-10-20).
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 border-b border-border pb-4 md:flex md:gap-4",
        className
      )}
      {...props}
    >
      <VideoThumbnail
        src={video.thumbnail_url}
        alt=""
        durationSeconds={video.duration_seconds}
        className="col-span-2 w-full md:w-64"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {href ? (
          <Link
            href={href}
            title={video.title}
            className="truncate text-body-lg text-foreground outline-none hover:underline focus-visible:underline"
          >
            {video.title}
          </Link>
        ) : (
          <p title={video.title} className="truncate text-body-lg text-foreground">
            {video.title}
          </p>
        )}
        {video.description ? (
          <p className="truncate text-body-md text-muted-foreground">{video.description}</p>
        ) : null}
        <VideoStats
          viewCount={video.view_count}
          likeCount={video.like_count}
          commentCount={video.comment_count}
          publishedAt={video.published_at}
          now={now}
        >
          <Badge
            data-slot="video-status"
            variant={badge.variant}
            title={failed ? video.processing_error ?? undefined : undefined}
          >
            {badge.label}
            {failed ? <span className="sr-only">: {video.processing_error}</span> : null}
          </Badge>
        </VideoStats>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </li>
  )
}

export { VideoListItem, getVideoStatusBadge }
export type { VideoListItemData, VideoListItemProps, VideoStatusBadge }
