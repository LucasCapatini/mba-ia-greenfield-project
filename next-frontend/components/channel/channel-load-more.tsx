"use client"

import { LoadMore } from "@/components/studio/load-more"

type ChannelLoadMoreProps = { nextCursor: string | null }

/**
 * "Load more" of the public channel page (TD-06): keeps `?sort=` and asks the RSC for the next
 * keyset page with `cursor=next_cursor`; hidden when the listing has no next page.
 */
function ChannelLoadMore({ nextCursor }: ChannelLoadMoreProps) {
  return nextCursor ? <LoadMore nextCursor={nextCursor} /> : null
}

export { ChannelLoadMore }
