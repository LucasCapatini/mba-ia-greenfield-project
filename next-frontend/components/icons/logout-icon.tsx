import * as React from "react"
import { cn } from "@/lib/utils"

// Figma Account User Menu "Sign Out" (150:1267); Material Symbols "logout".
function LogoutIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h7v2zm11-4l-1.375-1.45l2.55-2.55H9v-2h8.175l-2.55-2.55L16 7l5 5z" />
    </svg>
  )
}

export { LogoutIcon }
