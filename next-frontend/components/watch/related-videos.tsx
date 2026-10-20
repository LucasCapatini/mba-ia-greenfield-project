import * as React from "react"

import type { VideoCardItem } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { VideoCard } from "@/components/videos/video-card"

type RelatedVideosProps = Omit<React.ComponentProps<"section">, "children"> & {
  /** Closed list from `GET /videos/{publicId}/related` (per watch-page/TD-04) — never unlisted. */
  items: VideoCardItem[]
  now?: Date
}

/**
 * Watch page sidebar: vertical list of suggestions of the same category, filled with recent public
 * videos. Renders nothing when the list is empty (the sidebar block is omitted).
 */
function RelatedVideos({ items, now, className, ...props }: RelatedVideosProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <section
      aria-label="Related videos"
      data-slot="related-videos"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.public_id}>
            <VideoCard variant="horizontal" video={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export { RelatedVideos }
export type { RelatedVideosProps }
