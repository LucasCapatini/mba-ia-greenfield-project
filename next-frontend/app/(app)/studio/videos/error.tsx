"use client"

import { Button } from "@/components/ui/button"

// Reading the panel failed (anything but the 401 the page already redirects): retry in place.
export default function StudioVideosError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">We couldn&rsquo;t load your videos</h1>
      <p className="text-body-md text-muted-foreground">
        Something went wrong while loading the list. Try again in a moment.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  )
}
