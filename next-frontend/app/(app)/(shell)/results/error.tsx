"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

// Upstream failure on the first page of the search (home-search-production/TD-02): "Try again"
// re-fetches the segment. A new search keeps the pathname (`/results`), which does not reset the
// boundary by itself — it is cleared here once the query string changes.
export default function ResultsError({
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry: () => void
}) {
  const search = useSearchParams().toString()
  const failedSearch = React.useRef(search)

  React.useEffect(() => {
    if (search !== failedSearch.current) reset()
  }, [search, reset])

  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">We couldn&rsquo;t search the videos</h1>
      <p className="text-body-md text-muted-foreground">Something went wrong. Try again in a moment.</p>
      <Button type="button" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </main>
  )
}
