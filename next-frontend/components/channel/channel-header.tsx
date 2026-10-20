import * as React from "react"

import { cn } from "@/lib/utils"
import { ChannelAvatar } from "@/components/channel/channel-avatar"
import { ChannelBanner } from "@/components/channel/channel-banner"
import { ChannelInfo } from "@/components/channel/channel-info"

type ChannelHeaderProps = Omit<React.ComponentProps<"section">, "children"> & {
  name: string
  nickname: string
  videoCount: number
  /** "N subscribers" na meta row (Fase 06). */
  subscriberCount?: number
  description?: string | null
  /** Header actions — the Subscribe button (phase 06); the bell 158:2691 is not rendered. */
  actions?: React.ReactNode
}

/**
 * Figma public channel header (156:3349): 320px banner, 128px avatar overlapping its bottom edge
 * (left 32, top 280) and the info row offset past the avatar (pl 184, pr 32, pt 24).
 */
function ChannelHeader({
  name,
  nickname,
  videoCount,
  subscriberCount,
  description,
  actions,
  className,
  ...props
}: ChannelHeaderProps) {
  return (
    <section
      data-slot="channel-header"
      aria-label={`${name} channel`}
      className={cn("relative w-full", className)}
      {...props}
    >
      {/* Below `md`: shorter banner, smaller avatar and info stacked under it (TD-05, Revisions 2026-10-20). */}
      <ChannelBanner className="h-32 md:h-80" />
      <ChannelAvatar name={name} className="absolute top-20 left-4 size-24 md:top-70 md:left-8 md:size-32" />
      <div className="flex flex-col items-start gap-4 px-4 pt-16 md:flex-row md:items-center md:pt-6 md:pr-8 md:pl-46">
        <ChannelInfo
          className="w-full md:w-auto md:flex-1"
          name={name}
          nickname={nickname}
          videoCount={videoCount}
          subscriberCount={subscriberCount}
          description={description}
        />
        {actions ? <div className="flex shrink-0 items-center gap-4">{actions}</div> : null}
      </div>
    </section>
  )
}

export { ChannelHeader }
export type { ChannelHeaderProps }
