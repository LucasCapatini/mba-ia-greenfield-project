import * as React from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = Omit<React.ComponentProps<"div">, "title" | "id"> & {
  title: React.ReactNode
  description?: React.ReactNode
  /**
   * Id of the heading, so the section's control can point at it with `aria-labelledby`.
   * The description, when present, gets `${id}-description` for `aria-describedby`.
   */
  id?: string
  /** Heading level; sections inside a page default to h2. */
  as?: "h2" | "h3"
}

/**
 * Figma "SectionHeader" (2389:2464): H2 title (`text-h2`, foreground) over a muted
 * description (`text-body-md`, muted-foreground), 4px apart.
 */
function SectionHeader({
  title,
  description,
  id,
  as: Heading = "h2",
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div data-slot="section-header" className={cn("flex flex-col gap-1", className)} {...props}>
      <Heading id={id} data-slot="section-header-title" className="text-h2 text-foreground">
        {title}
      </Heading>
      {description ? (
        <p
          id={id ? `${id}-description` : undefined}
          data-slot="section-header-description"
          className="text-body-md text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}

export { SectionHeader }
export type { SectionHeaderProps }
