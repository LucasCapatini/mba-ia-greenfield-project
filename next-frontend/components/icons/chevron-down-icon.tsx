import * as React from "react"
import { cn } from "@/lib/utils"

function ChevronDownIcon({ className, ...props }: React.ComponentProps<"svg">) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export { ChevronDownIcon }
