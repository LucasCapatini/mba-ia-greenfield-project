import * as React from "react"
import { cn } from "@/lib/utils"

// Figma Left Menu "Subscriptions" item (150:959); Material Symbols "subscriptions" (phase 06 OQ-4).
function SubscriptionsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M20 8H4V6h16v2zm-2-6H6v2h12V2zm4 10v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-6 4l-6-3.27v6.53L16 16z" />
    </svg>
  )
}

export { SubscriptionsIcon }
