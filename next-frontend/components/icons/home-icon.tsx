import * as React from "react"
import { cn } from "@/lib/utils"

// Figma Left Menu "Home" item (150:959); Material Symbols "home" (phase 06 resolution OQ-4).
function HomeIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  )
}

export { HomeIcon }
