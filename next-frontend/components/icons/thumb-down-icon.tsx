import * as React from "react"
import { cn } from "@/lib/utils"
import { THUMB_OUTLINE_PATH, THUMB_SOLID_PATH } from "@/components/icons/thumb-up-icon"

type ThumbDownIconProps = React.ComponentProps<"svg"> & {
  /** `true` (default): solid glyph — active reaction. `false`: outlined glyph — inactive reaction. */
  filled?: boolean
}

// Mirror of `thumb-up-icon.tsx` (Figma Video show 152:2219, dislike half of the reaction pill):
// the same glyphs flipped vertically.
function ThumbDownIcon({ filled = true, className, ...props }: ThumbDownIconProps) {
  const size = filled ? 12 : 24
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      fill="currentColor"
      aria-hidden="true"
      data-filled={filled}
      className={cn(className)}
      {...props}
    >
      <g transform={`matrix(1 0 0 -1 0 ${size})`}>
        <path d={filled ? THUMB_SOLID_PATH : THUMB_OUTLINE_PATH} />
      </g>
    </svg>
  )
}

export { ThumbDownIcon }
export type { ThumbDownIconProps }
