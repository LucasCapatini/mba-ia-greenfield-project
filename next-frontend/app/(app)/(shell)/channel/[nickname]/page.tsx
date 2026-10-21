import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { publicRead } from "@/lib/api/public-read"
import { getPublicChannel } from "@/lib/channel/get-channel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChannelSocialHeader } from "@/components/channel/channel-social-header"
import { getSession } from "@/lib/auth/session"
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

// Só a primeira página: as seguintes vêm do BFF pelo scroll infinito (home-search-production/TD-04).
async function firstPage(nickname: string, sort: ChannelSort) {
  return publicRead((headers) =>
    upstream.GET("/channels/{nickname}/videos", {
      params: { path: { nickname }, query: { sort } },
      headers,
    })
  )
}

// /channel/{nickname} — página pública do canal (Figma 155:1926). RSC com sessão opcional
// (video-channel-management/TD-07, TD-12): a leitura do canal traz `subscriber_count` e
// `viewer_subscribed` (social-interactions/TD-04); o dono não vê o Subscribe. O 404 de nickname
// inexistente é resolvido no layout do segmento, antes do streaming.
export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const { nickname } = await params
  const query = await searchParams
  const channel = await getPublicChannel(nickname)
  if (!channel) {
    notFound()
  }
  const session = await getSession()

  const requested = first(query.sort)
  const sort: ChannelSort = SORTS.find((value) => value === requested) ?? "latest"
  const result = await firstPage(nickname, sort)
  if (!result.data) {
    throw new Error(`Could not load the channel videos (status ${result.response.status})`)
  }

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <ChannelSocialHeader
        channel={channel}
        isLoggedIn={session.isLoggedIn}
        isOwner={session.isLoggedIn && session.channelSlug === channel.nickname}
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
        key={sort}
        aria-label={`Videos from ${channel.name}`}
        nickname={channel.nickname}
        initial={result.data}
        sort={sort}
      />
    </main>
  )
}
