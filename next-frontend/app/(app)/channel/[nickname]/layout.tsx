import { notFound } from "next/navigation"

import { getPublicChannel } from "@/lib/channel/get-channel"

// The 404 check lives in the segment layout, outside the `loading.tsx` Suspense boundary: an
// unknown nickname (`CHANNEL_NOT_FOUND`, or an old nickname after a rename — TD-08) is resolved
// before any byte is streamed, so the response really is HTTP 404 (Next `loading.md` § Status
// Codes). The not-found UI is `app/(app)/channel/not-found.tsx`.
export default async function ChannelLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ nickname: string }>
}) {
  const { nickname } = await params
  if (!(await getPublicChannel(nickname))) {
    notFound()
  }
  return children
}
