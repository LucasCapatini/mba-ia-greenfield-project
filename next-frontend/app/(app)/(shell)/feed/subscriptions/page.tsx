import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { clientHeaders } from "@/lib/api/client-headers"
import { loginHref } from "@/lib/auth/return-to"
import { getSession } from "@/lib/auth/session"
import { InfiniteVideoGrid } from "@/components/videos/infinite-video-grid"

const FEED_PATH = "/feed/subscriptions"

export const metadata: Metadata = {
  title: "Subscriptions — StreamTube",
}

// /feed/subscriptions — vídeos dos canais seguidos (base visual: Figma Home 143:948;
// social-interactions/TD-08). O RSC lê só a primeira página com o `Bearer` da sessão; as seguintes
// chegam pelo scroll infinito via `GET /api/me/subscriptions/videos` (home-search-production/TD-04).
// O `proxy.ts` já mandou o anônimo ao login, e a página revalida a sessão como defesa em
// profundidade. Erros (UI Contract → UX mapping): 401 → login com `returnTo`; demais → `error.tsx`.
export default async function SubscriptionsFeedPage() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    redirect(loginHref(FEED_PATH))
  }

  const result = await upstream.GET("/me/subscriptions/videos", {
    headers: { ...(await clientHeaders()), Authorization: `Bearer ${session.accessToken}` },
  })
  if (result.response.status === 401) {
    redirect(loginHref(FEED_PATH))
  }
  if (!result.data) {
    throw new Error(`Could not load the subscriptions feed (status ${result.response.status})`)
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-h1 text-foreground">Subscriptions</h1>
      {result.data.items.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body-lg text-muted-foreground">
            Videos from the channels you subscribe to will show up here.
          </p>
          <Link href="/" className="text-body-md text-link hover:underline">
            Find channels to follow
          </Link>
        </div>
      ) : (
        <InfiniteVideoGrid
          aria-label="Subscription videos"
          initial={result.data}
          endpoint="/api/me/subscriptions/videos"
        />
      )}
    </main>
  )
}
