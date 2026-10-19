import * as React from "react"

import { cn } from "@/lib/utils"
import { formatCompactNumber, formatRelativeTime } from "@/lib/format"
import { CommentIcon } from "@/components/icons/comment-icon"
import { ThumbUpIcon } from "@/components/icons/thumb-up-icon"
import { ViewsIcon } from "@/components/icons/views-icon"

type VideoStatsProps = Omit<React.ComponentProps<"div">, "children"> & {
  viewCount: number
  likeCount: number
  commentCount: number
  /** First publication time (TD-02); null for a video that was never published. */
  publishedAt: string | null
  /** Reference time for the relative label; defaults to the current time. */
  now?: Date
  /** Extra items appended after a bullet (e.g. the status badge). */
  children?: React.ReactNode
}

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm
}

function Bullet() {
  return <span aria-hidden="true">•</span>
}

/**
 * Figma VideoList metrics row (I158:3096;108:336): views / likes / comments with 12px icons,
 * then "•" and the relative publication time, all caption + muted-foreground. Likes and comments
 * have no visible unit in the design, so their unit is screen-reader only.
 */
function VideoStats({
  viewCount,
  likeCount,
  commentCount,
  publishedAt,
  now,
  className,
  children,
  ...props
}: VideoStatsProps) {
  return (
    <div
      data-slot="video-stats"
      className={cn("flex flex-wrap items-center gap-2 text-caption text-muted-foreground", className)}
      {...props}
    >
      <span data-slot="video-stats-views" className="inline-flex items-center gap-1.5">
        <ViewsIcon className="h-3 w-auto" />
        {formatCompactNumber(viewCount)} {plural(viewCount, "view", "views")}
      </span>{" "}
      <span data-slot="video-stats-likes" className="inline-flex items-center gap-1.5">
        <ThumbUpIcon className="size-3" />
        {formatCompactNumber(likeCount)}
        <span className="sr-only"> {plural(likeCount, "like", "likes")}</span>
      </span>{" "}
      <span data-slot="video-stats-comments" className="inline-flex items-center gap-1.5">
        <CommentIcon className="size-3" />
        {formatCompactNumber(commentCount)}
        <span className="sr-only"> {plural(commentCount, "comment", "comments")}</span>
      </span>{" "}
      <Bullet />{" "}
      {publishedAt ? (
        <time data-slot="video-stats-published" dateTime={publishedAt}>
          {formatRelativeTime(publishedAt, now)}
        </time>
      ) : (
        <span data-slot="video-stats-published">Draft</span>
      )}
      {children ? (
        <>
          {" "}
          <Bullet />{" "}
          {children}
        </>
      ) : null}
    </div>
  )
}

export { VideoStats }
export type { VideoStatsProps }
