"use client"

import { Button } from "@/components/ui/button"

// Upstream failure while reading the subscriptions feed: retry in place.
export default function SubscriptionsFeedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">We couldn&rsquo;t load your subscriptions</h1>
      <p className="text-body-md text-muted-foreground">Something went wrong. Try again in a moment.</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  )
}
