import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type SideNavItemProps = Omit<React.ComponentProps<"li">, "children"> & {
  href: string
  label: string
  icon: React.ReactNode
  /** Decided by the caller from the current route; renders `aria-current="page"`. */
  active?: boolean
}

/** Figma Left Menu item (150:959): 24px icon + label, highlighted when it is the current route. */
function SideNavItem({ href, label, icon, active = false, className, ...props }: SideNavItemProps) {
  return (
    <li data-slot="side-nav-item" className={className} {...props}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-6 rounded-[var(--radius-3)] px-3 py-2 text-body-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active && "bg-sidebar-accent text-label-lg"
        )}
      >
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  )
}

export { SideNavItem }
export type { SideNavItemProps }
