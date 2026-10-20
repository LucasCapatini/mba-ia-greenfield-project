"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useNavState } from "@/components/layout/nav-state-provider"

function noop() {}

type NavDrawerProps = {
  /** Controlled state; without it the drawer follows `NavStateProvider` (the app layout). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The side menu rendered inside the drawer (`SideNav` in drawer mode). */
  children: React.ReactNode
  className?: string
}

/**
 * Navigation drawer (no Figma frame — derived from Left Menu 150:959, home-search-production/TD-05):
 * the side menu inside a `Dialog` anchored to the left, opened by "≡" below `lg` and on the watch
 * page. Closes when the route changes, so following a menu link never leaves it open.
 */
function NavDrawer({ open: openProp, onOpenChange: onOpenChangeProp, children, className }: NavDrawerProps) {
  const nav = useNavState()
  const open = openProp ?? nav?.drawerOpen ?? false
  const onOpenChange = onOpenChangeProp ?? nav?.setDrawerOpen ?? noop
  const pathname = usePathname()
  const previousPathname = React.useRef(pathname)

  // A navigation while open closes the drawer (the parent owns `open`, so it is told after commit).
  React.useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    if (open) onOpenChange(false)
  }, [pathname, open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="nav-drawer"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          // No DialogTrigger: give the focus back to "≡" instead of the document body.
          if (!nav) return
          event.preventDefault()
          nav.restoreFocus()
        }}
        className={cn(
          "top-0 left-0 h-full max-h-dvh w-72 max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-0 sm:max-w-72",
          className
        )}
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export { NavDrawer }
export type { NavDrawerProps }
