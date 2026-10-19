import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Figma FilterChip (158:2651): 36px tall, px 12 / py 8, gap 8, radius-2, Inter Body/LG.
// The Figma file fills "active" with --background and "default" with --card, which are both
// white in light mode (the active chip disappears on the channel page). "active" uses the
// secondary fill instead so the selected chip stays visible in both themes.
const filterChipVariants = cva(
  [
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 px-3 py-2",
    "rounded-[var(--radius-2)] border border-transparent",
    "text-body-lg whitespace-nowrap text-foreground",
    "transition-colors outline-none",
    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      state: {
        active: "bg-secondary text-secondary-foreground",
        default: "bg-transparent hover:bg-accent/50",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
)

type FilterChipProps = Omit<React.ComponentProps<"button">, "aria-pressed" | "aria-checked"> &
  Omit<VariantProps<typeof filterChipVariants>, "state"> & {
    /** Whether the chip is the selected filter. */
    active?: boolean
  }

/**
 * Toggle chip for horizontal filter rows (Latest / Popular / Oldest).
 *
 * Standalone it is a toggle button (`aria-pressed`). Inside a `role="radiogroup"`, pass
 * `role="radio"` and the selection is announced through `aria-checked` instead.
 */
function FilterChip({ className, active = false, role, ...props }: FilterChipProps) {
  const state = active ? "active" : "default"
  const selectionAria =
    role === "radio" ? { "aria-checked": active } : { "aria-pressed": active }

  return (
    <button
      type="button"
      role={role}
      data-slot="filter-chip"
      data-state={state}
      className={cn(filterChipVariants({ state, className }))}
      {...selectionAria}
      {...props}
    />
  )
}

export { FilterChip, filterChipVariants }
