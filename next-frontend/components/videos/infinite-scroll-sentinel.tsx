"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { CursorListStatus } from "@/hooks/use-cursor-list"

type InfiniteScrollSentinelProps = Omit<React.ComponentProps<"div">, "children"> & {
  nextCursor: string | null
  status: CursorListStatus
  loadMore: () => void
}

/**
 * Sentinel below an infinite grid (home-search-production/TD-04): asks for the next page when it
 * scrolls into view, shows the frame spinner while loading and keeps a keyboard-reachable
 * "Load more" button as the fallback (and as the retry after an error). Renders nothing once the
 * listing is over (`nextCursor` null).
 */
function InfiniteScrollSentinel({
  nextCursor,
  status,
  loadMore,
  className,
  ...props
}: InfiniteScrollSentinelProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const hasMore = nextCursor !== null
  const errored = status === "error"

  React.useEffect(() => {
    const node = ref.current
    if (!node || !hasMore || errored || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore()) // sentinela abaixo do grid
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, errored, loadMore])

  if (!hasMore) return null

  return (
    <div
      ref={ref}
      data-slot="infinite-scroll-sentinel"
      className={cn("flex flex-col items-center gap-3 py-6", className)}
      {...props}
    >
      {status === "loading" ? (
        <span role="status" aria-label="Loading more videos">
          <span className="block size-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
        </span>
      ) : (
        <>
          {errored && (
            <p role="alert" className="text-body-md text-muted-foreground">
              Couldn&apos;t load more videos.
            </p>
          )}
          <Button type="button" variant="secondary" size="md" onClick={loadMore}>
            Load more
          </Button>
        </>
      )}
    </div>
  )
}

export { InfiniteScrollSentinel }
export type { InfiniteScrollSentinelProps }
