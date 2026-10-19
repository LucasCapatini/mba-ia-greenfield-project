import Link from "next/link"

import { Button } from "@/components/ui/button"

// The video does not exist or belongs to another channel (the page never tells them apart).
export default function EditVideoNotFound() {
  return (
    <main className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 text-foreground">Video not found</h1>
      <p className="text-body-md text-muted-foreground">
        This video doesn&rsquo;t exist or isn&rsquo;t in your channel.
      </p>
      <Button asChild variant="outline">
        <Link href="/studio/videos">Back to your videos</Link>
      </Button>
    </main>
  )
}
