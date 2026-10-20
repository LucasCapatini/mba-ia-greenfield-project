import * as React from "react"
import { cn } from "@/lib/utils"

// Watch page player — pause glyph (pair of `play-icon.tsx`), two solid bars on a 24×24 grid.
function PauseIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export { PauseIcon }
