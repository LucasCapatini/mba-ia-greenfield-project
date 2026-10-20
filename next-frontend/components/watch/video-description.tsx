"use client"

import * as React from "react"

import { formatCompactNumber, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type VideoDescriptionProps = Omit<React.ComponentProps<"section">, "children"> & {
  viewCount: number
  /** ISO timestamp of the publication; `null` for a never-published draft (owner preview). */
  publishedAt: string | null
  description: string | null
  now?: Date
}

/**
 * Watch page description box: "N views • time ago" followed by the description as plain text with
 * its line breaks preserved (timestamps and URLs are not linkified — resolution OQ-4). Collapsed to
 * 3 lines with `line-clamp` over the full text (watch-page/TD-09); the "…more" / "Show less"
 * control only appears when the text overflows those 3 lines (resolution OQ-3).
 */
function VideoDescription({
  viewCount,
  publishedAt,
  description,
  now,
  className,
  ...props
}: VideoDescriptionProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [overflowing, setOverflowing] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)
  const textId = React.useId()

  React.useEffect(() => {
    const element = textRef.current
    if (!element || expanded) return
    // Measured outside the effect body (rAF / resize callbacks) while the text is clamped.
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1)
    const frame = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", measure)
    }
  }, [description, expanded])

  const views = `${formatCompactNumber(viewCount)} ${viewCount === 1 ? "view" : "views"}`

  return (
    <section
      data-slot="video-description"
      aria-label="Description"
      className={cn("flex flex-col gap-2 rounded-[var(--radius-4)] border border-border bg-background p-3", className)}
      {...props}
    >
      <p data-slot="video-description-meta" className="text-body-lg text-foreground">
        <span>{views}</span>
        {publishedAt ? (
          <>
            {" "}
            <span aria-hidden="true">•</span>{" "}
            <time dateTime={publishedAt}>{formatRelativeTime(publishedAt, now)}</time>
          </>
        ) : null}
      </p>

      {description ? (
        <>
          <p
            ref={textRef}
            id={textId}
            data-slot="video-description-text"
            className={cn("text-body-lg whitespace-pre-line text-foreground", !expanded && "line-clamp-3")}
          >
            {description}
          </p>
          {overflowing ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={textId}
              onClick={() => setExpanded((value) => !value)}
              className="w-fit rounded-[var(--radius-2)] text-label-md text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {expanded ? "Show less" : "…more"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export { VideoDescription }
export type { VideoDescriptionProps }
