import Link from "next/link"

import { Button } from "@/components/ui/button"

// Unknown nickname (`CHANNEL_NOT_FOUND`) — including an old nickname after a rename (TD-08).
export default function ChannelNotFound() {
  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">Channel not found</h1>
      <p className="text-body-md text-muted-foreground">
        This channel doesn&rsquo;t exist or changed its handle.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Go to the home page</Link>
      </Button>
    </main>
  )
}
