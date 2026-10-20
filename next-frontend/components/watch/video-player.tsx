"use client"

import * as React from "react"

import type { VideoPlayback } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { useMediaState } from "@/hooks/use-media-state"
import { useViewRegistration } from "@/hooks/use-view-registration"
import { Button } from "@/components/ui/button"
import { PlayerControls } from "@/components/watch/player-controls"

type VideoPlayerProps = Omit<React.ComponentProps<"div">, "children"> & {
  publicId: string
  /** Signed stream URL from `GET /videos/{publicId}/playback` (read by the RSC). */
  streamUrl: string
  /** ISO expiry of `streamUrl`. */
  expiresAt: string
  posterUrl: string | null
  /** Registers the view after the threshold (off in the studio preview). */
  trackViews?: boolean
}

type Restore = { time: number; play: boolean }

function playSafely(video: HTMLVideoElement) {
  // `play()` rejects when the browser blocks autoplay or the source changes mid-call.
  video.play().catch(() => {})
}

/**
 * Watch page player (watch-page/TD-05): native `<video>` + the custom `PlayerControls`. The signed
 * URL expires (PLAYBACK_URL_TTL), so a media `error` — or resuming after `expiresAt` — fetches a
 * fresh one through the BFF, swaps `src` and resumes at the saved time; one attempt, then an
 * error state with "Try again". Mount it with `key={publicId}` so a new video starts clean.
 */
function VideoPlayer({
  publicId,
  streamUrl,
  expiresAt,
  posterUrl,
  trackViews = true,
  className,
  ...props
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [source, setSource] = React.useState({ url: streamUrl, expiresAt })
  const [failed, setFailed] = React.useState(false)
  const restoreRef = React.useRef<Restore | null>(null)
  const renewingRef = React.useRef(false)
  /** A renewal already happened for the current failure; reset once playback resumes. */
  const renewedRef = React.useRef(false)
  /** The server handed back an already-expired URL (clock skew): stop trusting `expiresAt`. */
  const ignoreExpiryRef = React.useRef(false)

  const media = useMediaState(videoRef, containerRef)
  useViewRegistration(videoRef, publicId, trackViews)

  const renew = React.useCallback(
    async (play: boolean) => {
      const video = videoRef.current
      if (!video || renewingRef.current) {
        return
      }
      renewingRef.current = true
      const time = video.currentTime
      try {
        const res = await fetch(`/api/videos/${encodeURIComponent(publicId)}/playback`)
        if (!res.ok) {
          throw new Error(`playback ${res.status}`)
        }
        const playback = (await res.json()) as VideoPlayback
        if (Date.parse(playback.expires_at) <= Date.now()) {
          ignoreExpiryRef.current = true
        }
        setFailed(false)
        if (playback.stream_url === video.getAttribute("src")) {
          // Same URL: the element does not reload and no `loadedmetadata` comes — resume now.
          video.currentTime = time
          if (play) {
            playSafely(video)
          }
        } else {
          restoreRef.current = { time, play }
        }
        setSource({ url: playback.stream_url, expiresAt: playback.expires_at })
      } catch {
        setFailed(true)
      } finally {
        renewingRef.current = false
      }
    },
    [publicId]
  )

  const expired = () => !ignoreExpiryRef.current && Date.now() >= Date.parse(source.expiresAt)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (!video.paused) {
      video.pause()
    } else if (expired()) {
      void renew(true)
    } else {
      playSafely(video)
    }
  }

  const handleError = () => {
    const video = videoRef.current
    if (renewedRef.current) {
      setFailed(true)
      return
    }
    renewedRef.current = true
    void renew(video ? !video.paused || restoreRef.current?.play === true : false)
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    const restore = restoreRef.current
    if (!video || !restore) {
      return
    }
    restoreRef.current = null
    video.currentTime = restore.time
    if (restore.play) {
      playSafely(video)
    }
  }

  const retry = () => {
    renewedRef.current = true
    void renew(true)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
    } else {
      void containerRef.current?.requestFullscreen?.()
    }
  }

  const changeVolume = (volume: number) => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.volume = volume
    video.muted = volume === 0
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (video) {
      video.muted = !video.muted
    }
  }

  const seek = (time: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = time
    }
  }

  return (
    <div
      ref={containerRef}
      data-slot="video-player"
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden rounded-[var(--radius-4)] bg-almost-black-1000",
        className
      )}
      {...props}
    >
      <video
        ref={videoRef}
        src={source.url}
        poster={posterUrl ?? undefined}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onError={handleError}
        onLoadedMetadata={handleLoadedMetadata}
        onPlaying={() => {
          renewedRef.current = false
        }}
        className="size-full object-contain"
      />

      {media.waiting && !media.paused && !failed ? (
        <div
          role="status"
          aria-label="Loading"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="size-12 animate-spin rounded-full border-4 border-neutral-100/30 border-t-neutral-100" />
        </div>
      ) : null}

      {failed ? (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-overlay text-neutral-100"
        >
          <p className="text-body-lg">This video could not be loaded.</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        <PlayerControls
          paused={media.paused}
          muted={media.muted}
          volume={media.volume}
          currentTime={media.currentTime}
          duration={media.duration}
          buffered={media.buffered}
          fullscreen={media.fullscreen}
          disabled={media.duration === 0}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onVolumeChange={changeVolume}
          onSeek={seek}
          onToggleFullscreen={toggleFullscreen}
          className="absolute inset-x-0 bottom-0"
        />
      )}
    </div>
  )
}

export { VideoPlayer }
export type { VideoPlayerProps }
