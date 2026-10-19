"use client"

import * as React from "react"

import type { VideoCardItem } from "@/lib/api/contracts"
import { ChannelLoadMore } from "@/components/channel/channel-load-more"
import { ChannelVideoGrid } from "@/components/channel/channel-video-grid"
import { VideoCard } from "@/components/videos/video-card"

type ChannelVideoListProps = {
  /** Page delivered by the RSC (`GET /channels/{nickname}/videos`). */
  items: VideoCardItem[]
  /** Cursor of this page (`null` on the first page). */
  cursor: string | null
  nextCursor: string | null
  /** Current order; a new one drops the accumulated pages (it needs a new keyset cursor). */
  sort: string
  "aria-label"?: string
}

/** Previous cards + the cards the new page adds (by id, refreshed in place). */
function merge(previous: VideoCardItem[], page: VideoCardItem[]): VideoCardItem[] {
  const byId = new Map(page.map((item) => [item.public_id, item]))
  const merged = previous.map((item) => byId.get(item.public_id) ?? item)
  const known = new Set(previous.map((item) => item.public_id))
  return [...merged, ...page.filter((item) => !known.has(item.public_id))]
}

/**
 * The channel's public video grid. "Load more" replaces the URL with `cursor=next_cursor`; the RSC
 * delivers that page and this list appends it to the cards already shown, while the order stays
 * the same (video-channel-management/TD-06).
 */
function ChannelVideoList({
  items,
  cursor,
  nextCursor,
  sort,
  "aria-label": ariaLabel,
}: ChannelVideoListProps) {
  const [cards, setCards] = React.useState(items)
  const [seenItems, setSeenItems] = React.useState(items)
  const [seenSort, setSeenSort] = React.useState(sort)

  // New RSC payload (Load more, a new order or navigation): adjust the cards during render.
  if (items !== seenItems || sort !== seenSort) {
    setSeenItems(items)
    if (sort !== seenSort || cursor === null) {
      setSeenSort(sort)
      setCards(items)
    } else {
      setCards((current) => merge(current, items))
    }
  }

  return (
    <ChannelVideoGrid aria-label={ariaLabel} footer={<ChannelLoadMore nextCursor={nextCursor} />}>
      {cards.map((video) => (
        <VideoCard key={video.public_id} video={video} showChannel={false} />
      ))}
    </ChannelVideoGrid>
  )
}

export { ChannelVideoList }
