import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { publicRead } from "@/lib/api/public-read"
import { upstream } from "@/lib/api/upstream"
import { getSession } from "@/lib/auth/session"
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
import { CommentSection } from "@/components/comments/comment-section"
import { VideoChannelSubscription } from "@/components/watch/video-channel-subscription"
import { VideoDescription } from "@/components/watch/video-description"
import { VideoPlayer } from "@/components/watch/video-player"
import { VideoReactionButtons } from "@/components/watch/video-reaction-buttons"

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
// Fase 06 (social-interactions/TD-03, TD-04, TD-09): o vídeo já traz o estado do espectador; só um
// vídeo `published` ganha o par like/dislike e a seção de comentários, cuja primeira página é lida
// aqui em paralelo (falha → bloco com "Try again" na seção). As interações não recarregam o RSC.
export default async function WatchPage({ params }: WatchPageProps) {
  const { publicId } = await params
  const video = await getWatchVideo(publicId)
  if (!video) {
    notFound()
  }

  const session = await getSession()
  const published = video.status === "published"
  const path = { params: { path: { publicId } } }
  const [playback, related, origin, comments] = await Promise.all([
    video.processing_status === "ready"
      ? publicRead((headers) => upstream.GET("/videos/{publicId}/playback", { ...path, headers }))
      : null,
    publicRead((headers) => upstream.GET("/videos/{publicId}/related", { ...path, headers })),
    requestOrigin(),
    published
      ? publicRead((headers) =>
          upstream.GET("/videos/{publicId}/comments", {
            params: { path: { publicId }, query: { sort: "latest" } },
            headers,
          })
        )
      : null,
  ])
  const isOwner = session.isLoggedIn && session.channelSlug === video.channel.nickname
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
    <main className="flex w-full flex-col gap-6 px-4 pt-6 pb-10 sm:px-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {player}

        <h1 className="text-h1 text-foreground">{video.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <VideoChannelSubscription
            key={publicId}
            channel={video.channel}
            isLoggedIn={session.isLoggedIn}
            isOwner={isOwner}
          />
          <div className="flex items-center gap-3">
            {published ? (
              <VideoReactionButtons
                key={publicId}
                publicId={publicId}
                initial={{
                  viewer_reaction: video.viewer_reaction,
                  like_count: video.like_count,
                  dislike_count: video.dislike_count,
                }}
                isLoggedIn={session.isLoggedIn}
              />
            ) : null}
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

        {published ? (
          <CommentSection
            key={publicId}
            publicId={publicId}
            commentCount={video.comment_count}
            initialPage={comments?.data ?? null}
            isLoggedIn={session.isLoggedIn}
            // Iniciais do avatar a partir do nome do canal; sessões anteriores ao campo usam o nickname.
            viewerName={
              session.isLoggedIn ? session.channelName || session.channelSlug || undefined : undefined
            }
          />
        ) : null}
      </div>

      <RelatedVideos items={related.data?.items ?? []} className="w-full lg:w-100 lg:shrink-0" />
    </main>
  )
}
