import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Figma "banner" (154:1487 / 156:3511): 320px static gradient. Banner upload has no capability
 * in this phase (OQ-6), so it is a decorative placeholder hidden from assistive technology.
 */
function ChannelBanner({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      aria-hidden="true"
      data-slot="channel-banner"
      className={cn(
        "h-80 w-full shrink-0 bg-linear-to-r from-banner-from via-banner-via to-banner-to",
        className
      )}
      {...props}
    />
  )
}

export { ChannelBanner }
