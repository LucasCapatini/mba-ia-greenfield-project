"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

type NavMode = "expanded" | "mini"

type NavStateContextValue = {
  /** Mode of the side column on `lg+` (cookie `side_nav`, read by the RSC — no layout shift). */
  mode: NavMode
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  /** "≡": on `lg+` routes with a side column, toggles expanded/mini; otherwise opens the drawer. */
  toggle: () => void
  closeDrawer: () => void
  /** Focuses the control that opened the drawer ("≡") — the drawer has no Radix trigger of its own. */
  restoreFocus: () => void
}

/** Tailwind's `lg` breakpoint (64rem) — below it the column gives way to the drawer. */
const LG_QUERY = "(min-width: 64rem)"

const NavStateContext = React.createContext<NavStateContextValue | null>(null)

/** Routes outside the `(shell)` group never show the side column — "≡" always opens the drawer. */
function hasSideColumn(pathname: string): boolean {
  return !pathname.startsWith("/watch/")
}

/** Mini lasts a year; going back to expanded expires the cookie (the default needs none). */
function persistMode(mode: NavMode) {
  if (mode === "mini") {
    document.cookie = "side_nav=mini; path=/; max-age=31536000; samesite=lax"
  } else {
    document.cookie = "side_nav=; path=/; max-age=0; samesite=lax"
  }
}

/**
 * Navigation state of the app shell (home-search-production/TD-05): the side column mode
 * (`expanded` | `mini`, persisted in the `side_nav` cookie so the RSC renders it without a flash)
 * and the drawer used below `lg` and on the watch page.
 */
function NavStateProvider({
  initialMode,
  children,
}: {
  initialMode: NavMode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mode, setMode] = React.useState<NavMode>(initialMode)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const opener = React.useRef<HTMLElement | null>(null)

  const toggle = React.useCallback(() => {
    if (hasSideColumn(pathname) && window.matchMedia(LG_QUERY).matches) {
      const next = mode === "mini" ? "expanded" : "mini"
      persistMode(next)
      setMode(next)
      return
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerOpen(true)
  }, [mode, pathname])

  const closeDrawer = React.useCallback(() => setDrawerOpen(false), [])
  const restoreFocus = React.useCallback(() => opener.current?.focus(), [])

  const value = React.useMemo(
    () => ({ mode, drawerOpen, setDrawerOpen, toggle, closeDrawer, restoreFocus }),
    [mode, drawerOpen, toggle, closeDrawer, restoreFocus]
  )

  return <NavStateContext value={value}>{children}</NavStateContext>
}

/** Navigation state; `null` outside `NavStateProvider` (isolated component tests). */
function useNavState(): NavStateContextValue | null {
  return React.useContext(NavStateContext)
}

export { NavStateProvider, useNavState, LG_QUERY }
export type { NavMode, NavStateContextValue }
