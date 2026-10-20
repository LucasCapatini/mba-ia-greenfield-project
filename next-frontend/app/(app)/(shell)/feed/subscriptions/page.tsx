import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { SubscriptionFeedList } from "@/components/feed/subscription-feed-list"
import { upstream } from "@/lib/api/upstream"
import { loginHref } from "@/lib/auth/return-to"
import { getSession } from "@/lib/auth/session"

const FEED_PATH = "/feed/subscriptions"

export const metadata: Metadata = {
  title: "Subscriptions — StreamTube",
}

type SubscriptionsFeedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === "" ? undefined : raw
}

// /feed/subscriptions — vídeos dos canais seguidos (base visual: Figma Home 143:948;
// social-interactions/TD-08). RSC com o `Bearer` da sessão e `cursor` vindo de `searchParams`, como a
// página do canal (video-channel-management/TD-12); o `proxy.ts` já mandou o anônimo ao login, e a
// página revalida a sessão como defesa em profundidade. Erros (UI Contract → UX mapping): 401 →
// login com `returnTo`; cursor adulterado (400) → primeira página; demais → `error.tsx`.
export default async function SubscriptionsFeedPage({ searchParams }: SubscriptionsFeedPageProps) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    redirect(loginHref(FEED_PATH))
  }

  const cursor = first((await searchParams).cursor)
  const result = await upstream.GET("/me/subscriptions/videos", {
    params: { query: cursor ? { cursor } : {} },
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (result.response.status === 401) {
    redirect(loginHref(FEED_PATH))
  }
  if (result.response.status === 400 && cursor) {
    redirect(FEED_PATH)
  }
  if (!result.data) {
    throw new Error(`Could not load the subscriptions feed (status ${result.response.status})`)
  }

  const { items, next_cursor: nextCursor } = result.data
  return (
    <main className="flex w-full flex-col gap-6 px-6 py-6">
      <h1 className="text-h1 text-foreground">Subscriptions</h1>
      {items.length === 0 && !cursor ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body-lg text-muted-foreground">
            Videos from the channels you subscribe to will show up here.
          </p>
          <Link href="/" className="text-body-md text-link hover:underline">
            Find channels to follow
          </Link>
        </div>
      ) : (
        <SubscriptionFeedList items={items} cursor={cursor ?? null} nextCursor={nextCursor} />
      )}
    </main>
  )
}
