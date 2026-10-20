"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useNavState } from "@/components/layout/nav-state-provider"

type AppShellProps = React.ComponentProps<"div"> & {
  /** The side navigation (Figma Left Menu 150:959) — shown in the lg+ column. */
  nav?: React.ReactNode
}

/**
 * Body of the routes that carry the side menu (Figma Channel Show "Body" 2737:2153): side column +
 * page content. On `lg+` the column is expanded or mini, following the `side_nav` mode of
 * `NavStateProvider` (home-search-production/TD-05); below `lg` there is no column — the menu lives
 * only in the navigation drawer. Pages render their own `<main>`, so the content column is a plain
 * container (`min-w-0` keeps narrow screens from overflowing).
 */
function AppShell({ nav, children, className, ...props }: AppShellProps) {
  const mode = useNavState()?.mode ?? "expanded"

  return (
    <div
      data-slot="app-shell"
      data-nav={nav ? "visible" : "hidden"}
      data-mode={mode}
      className={cn("flex w-full flex-1", className)}
      {...props}
    >
      {nav ? (
        <div
          data-slot="app-shell-nav"
          data-mode={mode}
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block",
            mode === "mini" ? "w-20" : "w-64"
          )}
        >
          {nav}
        </div>
      ) : null}
      <div data-slot="app-shell-content" className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

export { AppShell }
export type { AppShellProps }
