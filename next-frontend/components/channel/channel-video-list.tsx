"use client"

import type { VideoCardItem } from "@/lib/api/contracts"
import { useCursorList, type CursorPage } from "@/hooks/use-cursor-list"
import { ChannelVideoGrid } from "@/components/channel/channel-video-grid"
import { InfiniteScrollSentinel } from "@/components/videos/infinite-scroll-sentinel"
import { VideoCard } from "@/components/videos/video-card"

type ChannelVideoListProps = {
  nickname: string
  /** First page delivered by the RSC (`GET /channels/{nickname}/videos`). */
  initial: CursorPage<VideoCardItem>
  /** Current order. Mount the list with `key={sort}` so a new order starts over on its first page. */
  sort: string
  "aria-label"?: string
}

/**
 * The channel's public video grid with infinite scroll (home-search-production/TD-04): the RSC
 * delivers the first page and the sentinel below the grid fetches the following ones from
 * `/api/channels/{nickname}/videos`, keeping the order — the URL never changes.
 */
function ChannelVideoList({ nickname, initial, sort, "aria-label": ariaLabel }: ChannelVideoListProps) {
  const { items, nextCursor, loadMore, status } = useCursorList({
    initial,
    endpoint: `/api/channels/${encodeURIComponent(nickname)}/videos`,
    query: { sort },
  })

  return (
    <ChannelVideoGrid
      aria-label={ariaLabel}
      footer={<InfiniteScrollSentinel nextCursor={nextCursor} status={status} loadMore={loadMore} />}
    >
      {items.map((video) => (
        <VideoCard key={video.public_id} video={video} showChannel={false} />
      ))}
    </ChannelVideoGrid>
  )
}

export { ChannelVideoList }
export type { ChannelVideoListProps }
