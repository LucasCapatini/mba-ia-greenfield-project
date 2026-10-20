import * as React from "react"
import { cn } from "@/lib/utils"

// Watch page player — muted glyph: the `volume-icon.tsx` speaker crossed by an X (24×24).
function VolumeOffIcon({ className, ...props }: React.ComponentProps<"svg">) {
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
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="m16 9 6 6M22 9l-6 6" />
    </svg>
  )
}

export { VolumeOffIcon }
