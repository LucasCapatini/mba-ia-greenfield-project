"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ApiErrorEnvelope, Video, VideoListItem } from "@/lib/api/contracts"
import { useProcessingPoll } from "@/hooks/use-processing-poll"
import { LoadMore } from "@/components/studio/load-more"
import { OwnerVideoRow } from "@/components/studio/owner-video-row"
import { VideoList } from "@/components/studio/video-list"

type Mutation = "publish" | "unpublish" | "delete"

type OwnerVideoListProps = {
  /** Page delivered by the RSC (`GET /channels/me/videos`). */
  items: VideoListItem[]
  /** Cursor of this page (`null` on the first page). */
  cursor: string | null
  nextCursor: string | null
  /** Identity of the current filters + sort; a new value drops the accumulated pages. */
  resetKey: string
}

const NOT_PUBLISHABLE = "Video is still processing or has no title — edit it before publishing"
const SUCCESS: Record<Mutation, string> = {
  publish: "Video published",
  unpublish: "Video unpublished",
  delete: "Video deleted",
}

/** Previous rows refreshed by the new page (by id) + the rows the page adds. */
function merge(previous: VideoListItem[], page: VideoListItem[]): VideoListItem[] {
  const byId = new Map(page.map((item) => [item.public_id, item]))
  const merged = previous.map((item) => byId.get(item.public_id) ?? item)
  const known = new Set(previous.map((item) => item.public_id))
  return [...merged, ...page.filter((item) => !known.has(item.public_id))]
}

function patchFrom(row: VideoListItem, video: Video): VideoListItem {
  return {
    ...row,
    title: video.title,
    status: video.status,
    visibility: video.visibility,
    processing_status: video.processing_status,
    processing_error: video.processing_error,
    thumbnail_url: video.thumbnail_url,
    published_at: video.published_at,
  }
}

function messageOf(envelope: ApiErrorEnvelope | null, fallback: string): string {
  if (!envelope) return fallback
  return Array.isArray(envelope.message) ? envelope.message.join("; ") : envelope.message
}

/**
 * The owner's video rows (video-channel-management/TD-06, TD-12). "Load more" replaces the URL
 * with `cursor=next_cursor`; the RSC delivers that page and this list appends it to the rows it
 * already shows (a new filter/sort starts over). Kebab mutations go through the BFF, patch the
 * row in place and `router.refresh()`; rows still `uploading|processing` are polled.
 */
function OwnerVideoList({ items, cursor, nextCursor, resetKey }: OwnerVideoListProps) {
  const router = useRouter()
  const [rows, setRows] = React.useState(items)
  const [seenItems, setSeenItems] = React.useState(items)
  const [seenKey, setSeenKey] = React.useState(resetKey)

  // New RSC payload (navigation, Load more or refresh): adjust the rows during render.
  if (items !== seenItems || resetKey !== seenKey) {
    setSeenItems(items)
    if (resetKey !== seenKey || cursor === null) {
      setSeenKey(resetKey)
      setRows(items)
    } else {
      setRows((current) => merge(current, items))
    }
  }

  const inFlight = rows
    .filter((row) => row.processing_status === "uploading" || row.processing_status === "processing")
    .map((row) => row.public_id)
  // The poll's video patches the row at once: the refresh below it may be dropped by the router.
  useProcessingPoll(inFlight, (video) => {
    setRows((current) =>
      current.map((row) => (row.public_id === video.public_id ? patchFrom(row, video) : row))
    )
  })

  const mutate = React.useCallback(
    async function mutate(publicId: string, kind: Mutation): Promise<void> {
      const url = kind === "delete" ? `/api/videos/${publicId}` : `/api/videos/${publicId}/${kind}`
      let response: Response
      try {
        response = await fetch(url, { method: kind === "delete" ? "DELETE" : "POST" })
      } catch {
        toast.error("Could not reach the server. Try again.")
        throw new Error("network")
      }

      if (response.status === 401) {
        router.push("/login?returnTo=/studio/videos")
        throw new Error("unauthorized")
      }
      if (!response.ok) {
        const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
        switch (envelope?.error) {
          case "VIDEO_NOT_PUBLISHABLE":
            toast.error(NOT_PUBLISHABLE, {
              action: {
                label: "Edit video",
                onClick: () => router.push(`/studio/videos/${publicId}/edit`),
              },
            })
            break
          case "VIDEO_NOT_FOUND":
            setRows((current) => current.filter((row) => row.public_id !== publicId))
            toast.error("This video no longer exists.")
            router.refresh()
            break
          case "VIDEO_FORBIDDEN":
            toast.error(messageOf(envelope, "You can no longer change this video."))
            router.refresh()
            break
          case "STORAGE_UNAVAILABLE":
            toast.error("Storage is temporarily unavailable.", {
              action: { label: "Retry", onClick: () => void mutate(publicId, kind).catch(() => {}) },
            })
            break
          default:
            toast.error(messageOf(envelope, "Something went wrong. Try again."))
        }
        throw new Error(envelope?.error ?? `status ${response.status}`)
      }

      if (kind === "delete") {
        setRows((current) => current.filter((row) => row.public_id !== publicId))
      } else {
        const video = (await response.json()) as Video
        setRows((current) =>
          current.map((row) => (row.public_id === publicId ? patchFrom(row, video) : row))
        )
      }
      toast.success(SUCCESS[kind])
      router.refresh()
    },
    [router]
  )

  return (
    <VideoList
      aria-label="Your videos"
      footer={nextCursor ? <LoadMore nextCursor={nextCursor} /> : null}
    >
      {rows.map((video) => (
        <OwnerVideoRow
          key={video.public_id}
          video={video}
          onPublish={() => mutate(video.public_id, "publish")}
          onUnpublish={() => mutate(video.public_id, "unpublish")}
          onDelete={() => mutate(video.public_id, "delete")}
        />
      ))}
    </VideoList>
  )
}

export { OwnerVideoList }
