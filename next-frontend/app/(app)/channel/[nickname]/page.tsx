import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { getPublicChannel } from "@/lib/channel/get-channel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChannelHeader } from "@/components/channel/channel-header"
import { ChannelVideoList } from "@/components/channel/channel-video-list"
import { ChannelVideoSort } from "@/components/channel/channel-video-sort"

type ChannelPageProps = {
  params: Promise<{ nickname: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Client-side mirror of `sort` (any other value → `latest`).
const SORTS = ["latest", "popular", "oldest"] as const
type ChannelSort = (typeof SORTS)[number]

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === "" ? undefined : raw
}

export async function generateMetadata({ params }: ChannelPageProps): Promise<Metadata> {
  const { nickname } = await params
  const channel = await getPublicChannel(nickname)
  if (!channel) {
    return { title: "Channel not found — StreamTube" }
  }
  return {
    title: `${channel.name} (@${channel.nickname}) — StreamTube`,
    description: channel.description ?? `Videos from @${channel.nickname} on StreamTube`,
  }
}

async function listVideos(nickname: string, sort: ChannelSort, cursor: string | undefined) {
  return upstream.GET("/channels/{nickname}/videos", {
    params: { path: { nickname }, query: { sort, ...(cursor ? { cursor } : {}) } },
  })
}

// /channel/{nickname} — página pública do canal (Figma 155:1926). RSC anônimo
// (video-channel-management/TD-07, TD-12); o 404 de nickname inexistente é resolvido no layout do
// segmento, antes do streaming.
export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const { nickname } = await params
  const query = await searchParams
  const channel = await getPublicChannel(nickname)
  if (!channel) {
    notFound()
  }

  const requested = first(query.sort)
  let sort: ChannelSort = SORTS.find((value) => value === requested) ?? "latest"
  let cursor = first(query.cursor)
  let result = await listVideos(nickname, sort, cursor)
  // `VALIDATION_ERROR` (stale or forged cursor): render with the defaults instead.
  if (result.response.status === 400) {
    sort = "latest"
    cursor = undefined
    result = await listVideos(nickname, sort, cursor)
  }
  if (!result.data) {
    throw new Error(`Could not load the channel videos (status ${result.response.status})`)
  }

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <ChannelHeader
        name={channel.name}
        nickname={channel.nickname}
        videoCount={channel.video_count}
        description={channel.description}
      />
      <Tabs defaultValue="videos">
        <TabsList variant="line" aria-label="Channel sections">
          <TabsTrigger value="videos" className="flex-none">
            Videos
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ChannelVideoSort />
      <ChannelVideoList
        aria-label={`Videos from ${channel.name}`}
        items={result.data.items}
        cursor={cursor ?? null}
        nextCursor={result.data.next_cursor}
        sort={sort}
      />
    </main>
  )
}
