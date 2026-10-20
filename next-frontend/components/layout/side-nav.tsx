import * as React from "react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

type SideNavProps = Omit<React.ComponentProps<"nav">, "children"> & {
  /** Top group — Home and Subscriptions (`SideNavItem`s). */
  mainItems: React.ReactNode
  /** "You" section — Your videos (`SideNavItem`s). "Liked videos" has no capability (TD-08). */
  youItems: React.ReactNode
  /** "Subscriptions" section — the followed channels list (`SideNavSubscriptions`). */
  subscriptions?: React.ReactNode
}

/**
 * Figma Left Menu (150:959, Channel Show 155:1927): navigation group, divider, "You" section,
 * divider and the "Subscriptions" section. Fixed width; collapsing via "≡" and the mobile behavior
 * belong to phase 07 (social-interactions/TD-08).
 */
function SideNav({ mainItems, youItems, subscriptions, className, ...props }: SideNavProps) {
  return (
    <nav
      aria-label="Main"
      data-slot="side-nav"
      className={cn("flex flex-col gap-3 px-3 py-4", className)}
      {...props}
    >
      <ul data-slot="side-nav-main" className="flex flex-col gap-1">
        {mainItems}
      </ul>
      <Separator className="bg-sidebar-border" />
      <section aria-labelledby="side-nav-you" className="flex flex-col gap-1">
        <h2 id="side-nav-you" className="px-3 py-1.5 text-label-lg text-sidebar-foreground">
          You
        </h2>
        <ul className="flex flex-col gap-1">{youItems}</ul>
      </section>
      {subscriptions ? (
        <>
          <Separator className="bg-sidebar-border" />
          {subscriptions}
        </>
      ) : null}
    </nav>
  )
}

export { SideNav }
export type { SideNavProps }
