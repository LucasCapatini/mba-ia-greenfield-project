import * as React from "react"

import { cn } from "@/lib/utils"

type StudioPageHeaderProps = Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary action on the right (e.g. the "Upload video" button). */
  action?: React.ReactNode
}

/**
 * Figma "videos table" header (152:2137): H1 title over a muted subtitle (4px apart) and the
 * primary action on the right; px-6 py-4 with a bottom border.
 */
function StudioPageHeader({
  title,
  description,
  action,
  className,
  ...props
}: StudioPageHeaderProps) {
  return (
    <div
      data-slot="studio-page-header"
      className={cn(
        "flex w-full items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description ? <p className="text-body-md text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export { StudioPageHeader }
export type { StudioPageHeaderProps }
