import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { publicRead } from "@/lib/api/public-read"
import { upstream } from "@/lib/api/upstream"
import { requestOrigin } from "@/lib/request-origin"
import { getWatchVideo } from "@/lib/watch/get-watch-video"
import { IconButton } from "@/components/ui/icon-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon"
import { CopyLinkButton } from "@/components/studio/copy-link-button"
import { DownloadMenuItem } from "@/components/watch/download-menu-item"
import { PlayerPlaceholder } from "@/components/watch/player-placeholder"
import { RelatedVideos } from "@/components/watch/related-videos"
import { VideoChannelLink } from "@/components/watch/video-channel-link"
import { VideoDescription } from "@/components/watch/video-description"
import { VideoPlayer } from "@/components/watch/video-player"

type WatchPageProps = {
  params: Promise<{ publicId: string }>
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { publicId } = await params
  const video = await getWatchVideo(publicId)
  if (!video) {
    return { title: "Video not found — StreamTube" }
  }
  return {
    title: `${video.title} — StreamTube`,
    description: video.description ?? `${video.title} by ${video.channel.name} on StreamTube`,
  }
}

// /watch/{publicId} — página pública de visualização (Figma Video show 152:2219; watch-page/TD-06).
// RSC: lê o vídeo com a sessão opcional e, com ele legível, o playback (só quando `ready`) e as
// sugestões em paralelo (video-channel-management/TD-12). Duas colunas: conteúdo + sidebar.
// Erros (UI Contract → Error Catalog): 404 → not-found; vídeo não `ready` (só o dono chega aqui;
// a API responderia 409 VIDEO_NOT_READY) → placeholder com o status; falha do playback (503
// STORAGE_UNAVAILABLE, 429…) → placeholder de erro com "Try again". Sugestões que falham → sidebar
// omitida. Título, canal e descrição renderizam em todos os casos não-404.
export default async function WatchPage({ params }: WatchPageProps) {
  const { publicId } = await params
  const video = await getWatchVideo(publicId)
  if (!video) {
    notFound()
  }

  const path = { params: { path: { publicId } } }
  const [playback, related, origin] = await Promise.all([
    video.processing_status === "ready"
      ? publicRead((headers) => upstream.GET("/videos/{publicId}/playback", { ...path, headers }))
      : null,
    publicRead((headers) => upstream.GET("/videos/{publicId}/related", { ...path, headers })),
    requestOrigin(),
  ])
  // Corrida: o vídeo sumiu (ou virou rascunho) entre as duas leituras.
  if (playback?.response.status === 404) {
    notFound()
  }

  let player: React.ReactNode
  if (video.processing_status !== "ready") {
    player = (
      <PlayerPlaceholder
        mode="processing"
        processingStatus={video.processing_status}
        processingError={video.processing_error}
      />
    )
  } else if (playback?.data) {
    player = (
      <VideoPlayer
        key={publicId}
        publicId={publicId}
        streamUrl={playback.data.stream_url}
        expiresAt={playback.data.expires_at}
        posterUrl={video.thumbnail_url}
      />
    )
  } else {
    player = <PlayerPlaceholder mode="error" />
  }

  return (
    <main className="flex w-full flex-col gap-6 px-6 pt-6 pb-10 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {player}

        <h1 className="text-h1 text-foreground">{video.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <VideoChannelLink channel={video.channel} />
          <div className="flex items-center gap-3">
            <CopyLinkButton variant="pill" url={`${origin}/watch/${publicId}`} />
            {playback?.data ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton aria-label="More actions" variant="secondary" size="lg">
                    <MoreVerticalIcon />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DownloadMenuItem downloadUrl={playback.data.download_url} />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <VideoDescription
          viewCount={video.view_count}
          publishedAt={video.published_at}
          description={video.description}
        />
      </div>

      <RelatedVideos items={related.data?.items ?? []} className="w-full lg:w-100 lg:shrink-0" />
    </main>
  )
}
