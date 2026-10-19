import * as React from "react"
import { cn } from "@/lib/utils"

// Figma "Search" (158:4007) magnifier, re-centered from its 72×44 frame into a 24×24 viewBox.
function SearchIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path d="M21 21 17 17" />
      <path d="M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    </svg>
  )
}

export { SearchIcon }
