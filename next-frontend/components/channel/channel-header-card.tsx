import * as React from "react"

import { cn } from "@/lib/utils"
import { ChannelAvatar } from "@/components/channel/channel-avatar"
import { ChannelBanner } from "@/components/channel/channel-banner"
import { formatVideoCount } from "@/components/channel/channel-info"
import { VideocamIcon } from "@/components/icons/videocam-icon"

type ChannelHeaderCardProps = Omit<React.ComponentProps<"section">, "children"> & {
  name: string
  nickname: string
  videoCount: number
}

/**
 * Figma "Channel card" (154:1486) on /studio/channel: card (bg-card, border-border, radius-3)
 * with the banner on top and a p-8 row holding the 128px avatar, the name (h2 styled as H1),
 * "@nickname" and the videos meta. The subscribers meta is phase 06 and is not rendered.
 */
function ChannelHeaderCard({
  name,
  nickname,
  videoCount,
  className,
  ...props
}: ChannelHeaderCardProps) {
  return (
    <section
      data-slot="channel-header-card"
      aria-label="Channel overview"
      className={cn(
        "w-full overflow-hidden rounded-[var(--radius-3)] border border-border bg-card",
        className
      )}
      {...props}
    >
      <ChannelBanner />
      <div className="flex items-start gap-6 p-8">
        <ChannelAvatar name={name} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-h1 text-foreground">{name}</h2>
          <p className="text-body-md text-muted-foreground">@{nickname}</p>
          <div className="flex items-center gap-4">
            <span
              data-slot="channel-header-card-videos"
              className="inline-flex items-center gap-1 text-caption text-muted-foreground"
            >
              <VideocamIcon className="size-4" />
              {formatVideoCount(videoCount)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export { ChannelHeaderCard }
export type { ChannelHeaderCardProps }
