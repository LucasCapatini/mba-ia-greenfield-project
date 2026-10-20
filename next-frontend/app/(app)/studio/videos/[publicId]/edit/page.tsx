import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { getSession } from "@/lib/auth/session"
import { Card } from "@/components/ui/card"
import { VideoEditForm } from "@/components/studio/video-edit-form"

export const metadata: Metadata = {
  title: "Edit video",
}

type EditVideoPageProps = {
  params: Promise<{ publicId: string }>
}

/** Public origin of the app, for the `/watch/{publicId}` link (OQ-5). */
async function requestOrigin(): Promise<string> {
  const list = await headers()
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3001"
  const protocol = list.get("x-forwarded-proto") ?? "http"
  return `${protocol}://${host}`
}

// /studio/videos/{publicId}/edit — edição e publicação (Figma 156:2790). RSC: vídeo (como dono),
// categorias e, quando `ready`, a URL de playback para o preview (video-channel-management/TD-12).
export default async function EditVideoPage({ params }: EditVideoPageProps) {
  const { publicId } = await params
  const session = await getSession()
  const auth = { Authorization: `Bearer ${session.accessToken}` }

  const [videoResult, categoriesResult, origin] = await Promise.all([
    upstream.GET("/videos/{publicId}", { params: { path: { publicId } }, headers: auth }),
    upstream.GET("/categories"),
    requestOrigin(),
  ])
  if (videoResult.response.status === 401) {
    redirect(`/login?returnTo=/studio/videos/${encodeURIComponent(publicId)}/edit`)
  }
  // 404 and 403 alike: never reveal that the video exists in another channel.
  const video = videoResult.data
  if (!video) {
    notFound()
  }

  let streamUrl: string | null = null
  let streamExpiresAt: string | null = null
  if (video.processing_status === "ready") {
    const playback = await upstream.GET("/videos/{publicId}/playback", {
      params: { path: { publicId } },
      headers: auth,
    })
    streamUrl = playback.data?.stream_url ?? null
    streamExpiresAt = playback.data?.expires_at ?? null
  }

  return (
    <main className="flex w-full flex-col gap-6 px-6 pt-8 pb-6">
      <h1 className="text-h1 text-foreground">Edit video</h1>
      <Card data-slot="edit-video-card" className="w-full gap-6 p-8">
        <VideoEditForm
          key={video.public_id}
          video={video}
          categories={categoriesResult.data ?? []}
          origin={origin}
          streamUrl={streamUrl}
          streamExpiresAt={streamExpiresAt}
        />
      </Card>
    </main>
  )
}
