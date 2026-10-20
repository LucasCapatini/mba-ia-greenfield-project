"use client"

import * as React from "react"

import { SubscriptionVideoGrid } from "@/components/feed/subscription-video-grid"
import { LoadMore } from "@/components/studio/load-more"
import type { VideoCardItem } from "@/lib/api/contracts"

type SubscriptionFeedListProps = {
  /** Page delivered by the RSC (`GET /me/subscriptions/videos`). */
  items: VideoCardItem[]
  /** Cursor of this page (`null` on the first page). */
  cursor: string | null
  nextCursor: string | null
}

/** Previous cards + the cards the new page adds (by id, refreshed in place). */
function merge(previous: VideoCardItem[], page: VideoCardItem[]): VideoCardItem[] {
  const byId = new Map(page.map((item) => [item.public_id, item]))
  const merged = previous.map((item) => byId.get(item.public_id) ?? item)
  const known = new Set(previous.map((item) => item.public_id))
  return [...merged, ...page.filter((item) => !known.has(item.public_id))]
}

/**
 * Subscriptions feed grid (social-interactions/TD-08). "Load more" replaces the URL with
 * `cursor=next_cursor`; the RSC delivers that page and this list appends it to the cards already
 * shown — the same keyset pagination by `searchParams` of the channel page (TD-12, TD-06).
 */
function SubscriptionFeedList({ items, cursor, nextCursor }: SubscriptionFeedListProps) {
  const [cards, setCards] = React.useState(items)
  const [seenItems, setSeenItems] = React.useState(items)

  // New RSC payload (Load more or navigation): adjust the cards during render.
  if (items !== seenItems) {
    setSeenItems(items)
    setCards((current) => (cursor === null ? items : merge(current, items)))
  }

  return (
    <div className="flex flex-col gap-10">
      <SubscriptionVideoGrid videos={cards} />
      {nextCursor ? <LoadMore nextCursor={nextCursor} /> : null}
    </div>
  )
}

export { SubscriptionFeedList }
export type { SubscriptionFeedListProps }
