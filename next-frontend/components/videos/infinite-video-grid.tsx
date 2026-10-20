"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useCursorList, type CursorPage } from "@/hooks/use-cursor-list"
import { InfiniteScrollSentinel } from "@/components/videos/infinite-scroll-sentinel"
import { VideoCard, type VideoCardData } from "@/components/videos/video-card"

type InfiniteVideoGridProps = Omit<React.ComponentProps<"ul">, "children"> & {
  /** First page, read by the RSC. */
  initial: CursorPage<VideoCardData>
  /** Same-origin BFF route of the following pages. */
  endpoint: string
  /** Fixed query of the listing (`category`, `q`, `sort`…). */
  query?: Record<string, string | null | undefined>
  now?: Date
}

/**
 * Video grid with infinite scroll (home-search-production/TD-04): up to four columns of
 * `VideoCard`s (base visual: Figma Home 143:948) followed by the sentinel that loads the next
 * keyset page. Mount it with `key={searchParams.toString()}` so a new filter restarts the list.
 */
function InfiniteVideoGrid({
  initial,
  endpoint,
  query,
  now,
  className,
  ...props
}: InfiniteVideoGridProps) {
  const { items, nextCursor, loadMore, status } = useCursorList({ initial, endpoint, query })

  return (
    <div className="flex flex-col gap-6">
      <ul
        data-slot="infinite-video-grid"
        className={cn(
          "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className
        )}
        {...props}
      >
        {items.map((video) => (
          <li key={video.public_id}>
            <VideoCard video={video} showChannel showAvatar now={now} />
          </li>
        ))}
      </ul>
      <InfiniteScrollSentinel nextCursor={nextCursor} status={status} loadMore={loadMore} />
    </div>
  )
}

export { InfiniteVideoGrid }
export type { InfiniteVideoGridProps }
