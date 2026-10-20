import Link from "next/link"

import { Button } from "@/components/ui/button"

// Unknown id, malformed id or someone else's draft (`VIDEO_NOT_FOUND`) — never reveals that a
// draft exists (video-channel-management/TD-07).
export default function VideoNotFound() {
  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">Video not found</h1>
      <p className="text-body-md text-muted-foreground">
        This video doesn&rsquo;t exist or isn&rsquo;t available.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Go to the home page</Link>
      </Button>
    </main>
  )
}
