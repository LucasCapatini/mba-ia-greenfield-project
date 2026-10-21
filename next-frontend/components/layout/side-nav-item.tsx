import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type SideNavItemProps = Omit<React.ComponentProps<"li">, "children"> & {
  href: string
  label: string
  icon: React.ReactNode
  /** Decided by the caller from the current route; renders `aria-current="page"`. */
  active?: boolean
  /** `row` (expanded menu and drawer) or `column` — icon over a short label, mini menu (TD-05). */
  layout?: "row" | "column"
}

/** Figma Left Menu item (150:959): 24px icon + label, highlighted when it is the current route. */
function SideNavItem({
  href,
  label,
  icon,
  active = false,
  layout = "row",
  className,
  ...props
}: SideNavItemProps) {
  return (
    <li data-slot="side-nav-item" data-layout={layout} className={className} {...props}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex rounded-[var(--radius-3)] text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          layout === "row"
            ? "items-center gap-6 px-3 py-2 text-body-lg"
            : "flex-col items-center gap-1 px-1 py-4 text-caption",
          active && "bg-sidebar-accent",
          active && layout === "row" && "text-label-lg"
        )}
      >
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
          {icon}
        </span>
        <span className={cn("truncate", layout === "column" && "max-w-full")}>{label}</span>
      </Link>
    </li>
  )
}

export { SideNavItem }
export type { SideNavItemProps }
