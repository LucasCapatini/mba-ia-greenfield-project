import * as React from "react"
import { cn } from "@/lib/utils"

// Figma Left Menu "Your videos" item (150:959): play triangle inside a screen outline; Material
// Symbols "smart_display" (phase 06 resolution OQ-4).
function YourVideosIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M9.5 7.5v9l7-4.5-7-4.5zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14.01H4V5.99h16v12.02z" />
    </svg>
  )
}

export { YourVideosIcon }
