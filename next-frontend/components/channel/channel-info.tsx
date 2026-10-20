import * as React from "react"

import { cn } from "@/lib/utils"
import { formatCompactNumber } from "@/lib/format"

type ChannelInfoProps = Omit<React.ComponentProps<"div">, "children"> & {
  name: string
  nickname: string
  /** Public videos (`video_count`: published + public). */
  videoCount: number
  /** Inscritos (`subscriber_count`, social-interactions/TD-04); omitido não renderiza o trecho. */
  subscriberCount?: number
  description?: string | null
}

function formatVideoCount(count: number): string {
  return `${formatCompactNumber(count)} ${count === 1 ? "video" : "videos"}`
}

function formatSubscriberCount(count: number): string {
  return `${formatCompactNumber(count)} ${count === 1 ? "subscriber" : "subscribers"}`
}

/**
 * Figma "channel info" (156:3515): name as the page `<h1>` (text-h1), meta row
 * "@nickname • N subscribers • N videos" (body-lg, muted) and the description (body-md, muted).
 * The subscriber count arrived in phase 06 (social-interactions/TD-04).
 */
function ChannelInfo({
  name,
  nickname,
  videoCount,
  subscriberCount,
  description,
  className,
  ...props
}: ChannelInfoProps) {
  return (
    <div data-slot="channel-info" className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
      <h1 className="text-h1 text-foreground">{name}</h1>
      <p className="flex flex-wrap items-center gap-2 py-0.5 text-body-lg text-muted-foreground">
        <span data-slot="channel-info-nickname">@{nickname}</span>{" "}
        <span aria-hidden="true">•</span>{" "}
        {subscriberCount === undefined ? null : (
          <>
            <span data-slot="channel-info-subscribers">{formatSubscriberCount(subscriberCount)}</span>{" "}
            <span aria-hidden="true">•</span>{" "}
          </>
        )}
        <span data-slot="channel-info-videos">{formatVideoCount(videoCount)}</span>
      </p>
      {description ? (
        <p data-slot="channel-info-description" className="text-body-md text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export { ChannelInfo, formatSubscriberCount, formatVideoCount }
export type { ChannelInfoProps }
