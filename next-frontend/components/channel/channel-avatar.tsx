import * as React from "react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/** "Tech Mastery Plus" → "TM"; "techmaster" → "T". */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

type ChannelAvatarProps = Omit<React.ComponentProps<typeof Avatar>, "children" | "size"> & {
  name: string
}

/**
 * Figma channel Avatar (2405:2276 / 2405:2283): 128px circle with border. Avatar upload has no
 * capability in this phase (OQ-6), so it always shows the channel initials, named after the channel.
 */
function ChannelAvatar({ name, className, ...props }: ChannelAvatarProps) {
  return (
    <Avatar
      role="img"
      aria-label={name}
      data-slot="channel-avatar"
      className={cn("size-32", className)}
      {...props}
    >
      <AvatarFallback aria-hidden="true" className="text-h1 text-muted-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export { ChannelAvatar, getInitials }
