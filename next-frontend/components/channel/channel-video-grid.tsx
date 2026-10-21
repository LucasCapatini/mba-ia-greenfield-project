import * as React from "react"

import { cn } from "@/lib/utils"

type ChannelVideoGridProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** One `VideoCard` per child; each is wrapped in a list item. */
  children?: React.ReactNode
  /** Rendered below the grid — the "Load more" control (TD-06 cursor). */
  footer?: React.ReactNode
  emptyMessage?: string
  "aria-label"?: string
}

/**
 * Figma "Video grid" (156:3590): wrapping row of cards, 40px row gap / 24px column gap, px-6;
 * each card 266px wide within 240–360px. The empty state is not drawn (OQ-7).
 */
function ChannelVideoGrid({
  children,
  footer,
  emptyMessage = "This channel has no public videos yet",
  "aria-label": ariaLabel = "Channel videos",
  className,
  ...props
}: ChannelVideoGridProps) {
  const cards = React.Children.toArray(children)

  if (cards.length === 0) {
    return (
      <div data-slot="channel-video-grid" data-state="empty" className={cn("px-4 sm:px-6", className)} {...props}>
        <p className="py-10 text-center text-body-md text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      data-slot="channel-video-grid"
      data-state="filled"
      className={cn("flex w-full flex-col gap-10", className)}
      {...props}
    >
      {/* Grid of 1/2 columns below `lg`; the Figma wrapping row of fixed-width cards from `lg` (TD-05). */}
      <ul
        aria-label={ariaLabel}
        className="grid grid-cols-1 gap-x-6 gap-y-10 px-4 sm:grid-cols-2 sm:px-6 lg:flex lg:flex-wrap"
      >
        {cards.map((card, index) => (
          <li
            key={React.isValidElement(card) && card.key != null ? card.key : index}
            className="min-w-0 lg:w-66.5 lg:max-w-90 lg:min-w-60"
          >
            {card}
          </li>
        ))}
      </ul>
      {footer ? (
        <div data-slot="channel-video-grid-footer" className="flex justify-center px-4 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export { ChannelVideoGrid }
export type { ChannelVideoGridProps }
