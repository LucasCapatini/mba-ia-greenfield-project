import * as React from "react"

import { cn } from "@/lib/utils"

type AppShellProps = React.ComponentProps<"div"> & {
  /** The side navigation (Figma Left Menu 150:959). Omitted without a session (social-interactions/TD-08). */
  nav?: React.ReactNode
}

/**
 * Body of the routes that carry the side menu (Figma Channel Show "Body" 2737:2153): fixed SideNav
 * on the left + the page content. Pages render their own `<main>`, so the content column is a plain
 * container. Without `nav` only the content is rendered (anonymous visitors).
 */
function AppShell({ nav, children, className, ...props }: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      data-nav={nav ? "visible" : "hidden"}
      className={cn("flex w-full flex-1", className)}
      {...props}
    >
      {nav ? (
        <div
          data-slot="app-shell-nav"
          className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
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
