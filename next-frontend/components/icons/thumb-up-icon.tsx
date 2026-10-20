import * as React from "react"
import { cn } from "@/lib/utils"

type ThumbUpIconProps = React.ComponentProps<"svg"> & {
  /**
   * `true` (default): the solid glyph — studio likes metric (Figma VideoList I158:3096;108:344) and
   * the active reaction state. `false`: the outlined glyph — inactive reaction state (Figma Video
   * show 152:2219; Material Symbols "thumb_up", phase 06 resolution OQ-4).
   */
  filled?: boolean
}

const SOLID_PATH =
  "M7.34531 0.771094C7.95469 0.892969 8.35078 1.48594 8.22891 2.09531L8.175 2.3625C8.05078 2.98828 7.82109 3.58359 7.5 4.125H10.875C11.4961 4.125 12 4.62891 12 5.25C12 5.68359 11.7539 6.06094 11.393 6.24844C11.6484 6.45469 11.8125 6.77109 11.8125 7.125C11.8125 7.67344 11.4187 8.13047 10.9008 8.22891C11.0039 8.4 11.0625 8.59922 11.0625 8.8125C11.0625 9.31172 10.7367 9.73594 10.2867 9.88125C10.3031 9.95859 10.3125 10.0406 10.3125 10.125C10.3125 10.7461 9.80859 11.25 9.1875 11.25H6.90234C6.45703 11.25 6.02344 11.1188 5.65312 10.8727L4.75078 10.2703C4.125 9.85313 3.75 9.15 3.75 8.39766V7.5V6.375V5.79141C3.75 5.10703 4.06172 4.4625 4.59375 4.03359L4.76719 3.89531C5.38828 3.39844 5.8125 2.7 5.96719 1.92188L6.02109 1.65469C6.14297 1.04531 6.73594 0.649219 7.34531 0.771094ZM0.75 4.5H2.25C2.66484 4.5 3 4.83516 3 5.25V10.5C3 10.9148 2.66484 11.25 2.25 11.25H0.75C0.335156 11.25 0 10.9148 0 10.5V5.25C0 4.83516 0.335156 4.5 0.75 4.5Z"

const OUTLINE_PATH =
  "M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1z"

function ThumbUpIcon({ filled = true, className, ...props }: ThumbUpIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={filled ? "0 0 12 12" : "0 0 24 24"}
      fill="currentColor"
      aria-hidden="true"
      data-filled={filled}
      className={cn(className)}
      {...props}
    >
      <path d={filled ? SOLID_PATH : OUTLINE_PATH} />
    </svg>
  )
}

export { ThumbUpIcon, SOLID_PATH as THUMB_SOLID_PATH, OUTLINE_PATH as THUMB_OUTLINE_PATH }
export type { ThumbUpIconProps }
