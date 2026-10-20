import * as React from "react"
import { cva } from "class-variance-authority"

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

type ChannelAvatarSize = "sm" | "md" | "lg"

const channelAvatarVariants = cva("", {
  variants: {
    size: {
      sm: "size-6",
      md: "size-10",
      lg: "size-32",
    },
  },
  defaultVariants: { size: "lg" },
})

const channelAvatarInitialsVariants = cva("text-muted-foreground", {
  variants: {
    size: {
      sm: "text-helper",
      md: "text-label-md",
      lg: "text-h1",
    },
  },
  defaultVariants: { size: "lg" },
})

type ChannelAvatarProps = Omit<React.ComponentProps<typeof Avatar>, "children" | "size"> & {
  name: string
  size?: ChannelAvatarSize
}

/**
 * Figma channel Avatar: `lg` 128px (channel header 2405:2276 / 2405:2283), `md` 40px (video card,
 * comments) and `sm` 24px (side-nav subscriptions), with the initials scaled to each size. Avatar
 * upload has no capability yet (OQ-6), so it always shows the channel initials, named after the
 * channel. The variant is exposed as `data-avatar-size` — `data-size` belongs to the `Avatar`
 * primitive, which styles its own sizes from it.
 */
function ChannelAvatar({ name, size = "lg", className, ...props }: ChannelAvatarProps) {
  return (
    <Avatar
      role="img"
      aria-label={name}
      data-slot="channel-avatar"
      data-avatar-size={size}
      className={cn(channelAvatarVariants({ size }), className)}
      {...props}
    >
      <AvatarFallback aria-hidden="true" className={channelAvatarInitialsVariants({ size })}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export { ChannelAvatar, getInitials }
