import * as React from "react"

import { cn } from "@/lib/utils"
import { VideoCard, type VideoCardData } from "@/components/videos/video-card"

type SubscriptionVideoGridProps = Omit<React.ComponentProps<"ul">, "children"> & {
  videos: VideoCardData[]
  now?: Date
}

/**
 * Grid of the subscriptions feed (base visual: Figma Home 143:948): up to four columns of
 * `VideoCard`s in the order received — newest first (social-interactions/TD-08). The empty state
 * belongs to the page.
 */
function SubscriptionVideoGrid({ videos, now, className, ...props }: SubscriptionVideoGridProps) {
  return (
    <ul
      aria-label="Subscription videos"
      data-slot="subscription-video-grid"
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      {...props}
    >
      {videos.map((video) => (
        <li key={video.public_id}>
          <VideoCard video={video} showChannel showAvatar now={now} />
        </li>
      ))}
    </ul>
  )
}

export { SubscriptionVideoGrid }
export type { SubscriptionVideoGridProps }
