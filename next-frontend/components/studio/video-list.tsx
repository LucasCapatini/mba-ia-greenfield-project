import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VideoFileIcon } from "@/components/icons/video-file-icon"

type VideoListProps = React.ComponentProps<"ul"> & {
  /** Rendered below the rows — the "Load more" control for cursor pagination (TD-06). */
  footer?: React.ReactNode
}

/** Figma "Lista de vídeos" (158:3198): rows of `VideoListItem` stacked 24px apart. */
function VideoList({ footer, className, children, ...props }: VideoListProps) {
  return (
    <div data-slot="video-list" className={cn("flex w-full flex-col gap-6", className)}>
      <ul className="flex flex-col gap-6" {...props}>
        {children}
      </ul>
      {footer ? <div data-slot="video-list-footer">{footer}</div> : null}
    </div>
  )
}

type VideoListEmptyProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Filters or search are active (the channel itself may have videos). */
  filtered: boolean
}

/**
 * Empty states of the panel (not drawn, derived from the UI Contract): a channel without videos
 * invites the first upload; an empty filtered result offers to clear the filters.
 */
function VideoListEmpty({ filtered, className, ...props }: VideoListEmptyProps) {
  return (
    <div
      data-slot="video-list-empty"
      className={cn(
        "flex w-full flex-col items-center gap-4 rounded-[var(--radius-2)] border border-dashed border-border px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <VideoFileIcon className="size-12 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-h3 text-foreground">
          {filtered ? "No videos match your filters" : "No videos yet"}
        </p>
        <p className="text-body-md text-muted-foreground">
          {filtered
            ? "Try other filters or clear them to see every video."
            : "Upload your first video to start your channel."}
        </p>
      </div>
      {filtered ? (
        <Button asChild variant="outline">
          <Link href="/studio/videos">Clear filters</Link>
        </Button>
      ) : (
        <Button asChild className="rounded-[var(--radius-full)]">
          <Link href="/studio/upload">Upload video</Link>
        </Button>
      )}
    </div>
  )
}

export { VideoList, VideoListEmpty }
