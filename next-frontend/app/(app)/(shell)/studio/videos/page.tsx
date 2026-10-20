import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import type { OwnerVideosQuery } from "@/lib/api/contracts"
import { upstream } from "@/lib/api/upstream"
import { getSession } from "@/lib/auth/session"
import { Button } from "@/components/ui/button"
import { FiltersNotice, INVALID_FILTERS_NOTICE } from "@/components/studio/filters-notice"
import { OwnerVideoList } from "@/components/studio/owner-video-list"
import { StudioPageHeader } from "@/components/studio/studio-page-header"
import { VideoFilters } from "@/components/studio/video-filters"
import { VideoListEmpty } from "@/components/studio/video-list"
import { VideoSortMenu } from "@/components/studio/video-sort-menu"

export const metadata: Metadata = {
  title: "Channel content",
}

type SearchParams = Record<string, string | string[] | undefined>

// Filter state lives in the URL (video-channel-management/TD-12): these keys go to the upstream
// as-is; anything else is ignored.
const QUERY_KEYS = [
  "status",
  "visibility",
  "processing_status",
  "q",
  "sort",
  "from",
  "to",
  "cursor",
] as const
const FILTER_KEYS = ["status", "visibility", "processing_status", "q", "from", "to"] as const

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === "" ? undefined : raw
}

function toQuery(searchParams: SearchParams): OwnerVideosQuery {
  const query: Record<string, string> = {}
  for (const key of QUERY_KEYS) {
    const value = first(searchParams[key])
    if (value !== undefined) query[key] = value
  }
  return query as OwnerVideosQuery
}

// /studio/videos — painel do dono (Figma 152:1824). RSC: a lista vem de `GET /channels/me/videos`
// via `upstream` com o token da sessão.
export default async function StudioVideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await getSession()
  const { data, response } = await upstream.GET("/channels/me/videos", {
    params: { query: toQuery(params) },
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (response.status === 401) {
    redirect("/login?returnTo=/studio/videos")
  }
  // `VALIDATION_ERROR` (filters or cursor): drop them and say so discreetly (UI Contract).
  if (response.status === 400) {
    redirect(`/studio/videos?notice=${INVALID_FILTERS_NOTICE}`)
  }
  if (!data) {
    throw new Error(`Could not load your videos (status ${response.status})`)
  }

  const query = toQuery(params)
  const filtered = FILTER_KEYS.some((key) => first(params[key]) !== undefined)
  // Same filters + sort keep accumulating "Load more" pages; anything else starts over.
  const resetKey = JSON.stringify({ ...query, cursor: undefined })

  return (
    <main className="flex w-full flex-col">
      <FiltersNotice />
      <StudioPageHeader
        title="Channel content"
        description="Manage your videos and content"
        action={
          // Pill radius at the call site (Drift Report: CONFLICT on `button.tsx`, SI-04.17.0).
          <Button asChild className="rounded-[var(--radius-full)]">
            <Link href="/studio/upload">Upload video</Link>
          </Button>
        }
      />
      <VideoFilters />
      <div className="flex w-full flex-col gap-4 px-6 pt-3 pb-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-body-md text-muted-foreground" aria-live="polite">
            {data.total} {data.total === 1 ? "video" : "videos"}
          </p>
          <VideoSortMenu />
        </div>
        {data.items.length === 0 ? (
          <VideoListEmpty filtered={filtered} />
        ) : (
          <OwnerVideoList
            items={data.items}
            cursor={query.cursor ?? null}
            nextCursor={data.next_cursor}
            resetKey={resetKey}
          />
        )}
      </div>
    </main>
  )
}
