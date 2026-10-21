import * as React from "react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

type SideNavMode = "expanded" | "mini" | "drawer"

type SideNavProps = Omit<React.ComponentProps<"nav">, "children"> & {
  /**
   * `expanded` (lg+ column) and `drawer` render every section; `mini` renders only `mainItems`
   * (icon + short label), without the "You"/"Subscriptions" sections (home-search-production/TD-05).
   */
  mode?: SideNavMode
  /** Top group — Home and Subscriptions (`SideNavItem`s); in `mini`, also the "You" shortcut. */
  mainItems: React.ReactNode
  /** "You" section — Your videos (`SideNavItem`s). Omitted for anonymous visitors. */
  youItems?: React.ReactNode
  /** "Subscriptions" section — the followed channels list (`SideNavSubscriptions`). */
  subscriptions?: React.ReactNode
  /** Anonymous visitors: the invitation to sign in that replaces "You" and "Subscriptions". */
  invite?: React.ReactNode
}

/**
 * Figma Left Menu (150:959, Channel Show 155:1927): navigation group, divider, "You" section,
 * divider and the "Subscriptions" section. Rendered expanded or mini in the lg+ column and in full
 * inside the navigation drawer (home-search-production/TD-05).
 */
function SideNav({
  mode = "expanded",
  mainItems,
  youItems,
  subscriptions,
  invite,
  className,
  ...props
}: SideNavProps) {
  const youHeadingId = React.useId()

  if (mode === "mini") {
    return (
      <nav
        aria-label="Main"
        data-slot="side-nav"
        data-mode="mini"
        className={cn("flex flex-col px-1 py-2", className)}
        {...props}
      >
        <ul data-slot="side-nav-main" className="flex flex-col gap-1">
          {mainItems}
        </ul>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Main"
      data-slot="side-nav"
      data-mode={mode}
      className={cn("flex flex-col gap-3 px-3 py-4", className)}
      {...props}
    >
      <ul data-slot="side-nav-main" className="flex flex-col gap-1">
        {mainItems}
      </ul>
      {youItems ? (
        <>
          <Separator className="bg-sidebar-border" />
          <section aria-labelledby={youHeadingId} className="flex flex-col gap-1">
            <h2 id={youHeadingId} className="px-3 py-1.5 text-label-lg text-sidebar-foreground">
              You
            </h2>
            <ul className="flex flex-col gap-1">{youItems}</ul>
          </section>
        </>
      ) : null}
      {subscriptions ? (
        <>
          <Separator className="bg-sidebar-border" />
          {subscriptions}
        </>
      ) : null}
      {invite ? (
        <>
          <Separator className="bg-sidebar-border" />
          {invite}
        </>
      ) : null}
    </nav>
  )
}

export { SideNav }
export type { SideNavProps, SideNavMode }
