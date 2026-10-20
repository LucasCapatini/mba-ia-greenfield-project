import * as React from "react"
import { cn } from "@/lib/utils"

// Watch page player — enter full screen: four outward corner brackets (24×24).
function FullscreenIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  )
}

// Watch page player — exit full screen: the same corners pointing inward.
function ExitFullscreenIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" />
    </svg>
  )
}

export { ExitFullscreenIcon, FullscreenIcon }
