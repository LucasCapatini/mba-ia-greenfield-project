import * as React from "react"
import Link from "next/link"

import type { VideoCardItem } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/components/channel/channel-avatar"

type VideoChannelLinkProps = Omit<React.ComponentProps<typeof Link>, "href" | "children"> & {
  /** `VideoResponse.channel` — public channel data of the video owner (resolution OQ-1). */
  channel: VideoCardItem["channel"]
}

/**
 * Channel row under the watch page title: initials avatar (no avatar upload exists — Phase 04
 * OQ-6) + channel name, linking to the public channel page `/channel/{nickname}`.
 */
function VideoChannelLink({ channel, className, ...props }: VideoChannelLinkProps) {
  return (
    <Link
      href={`/channel/${channel.nickname}`}
      data-slot="video-channel-link"
      className={cn(
        "flex w-fit items-center gap-3 rounded-[var(--radius-2)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <Avatar size="lg" aria-hidden="true">
        <AvatarFallback>{getInitials(channel.name)}</AvatarFallback>
      </Avatar>
      <span className="text-label-lg text-foreground">{channel.name}</span>
    </Link>
  )
}

export { VideoChannelLink }
export type { VideoChannelLinkProps }
