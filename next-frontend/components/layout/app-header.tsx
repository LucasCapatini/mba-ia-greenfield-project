"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { loginHref } from "@/lib/auth/return-to"
import { BrandLogo } from "@/components/auth/brand-logo"
import { SessionContext } from "@/components/auth/session-provider"
import { AddIcon } from "@/components/icons/add-icon"
import { MenuIcon } from "@/components/icons/menu-icon"
import { AccountMenu } from "@/components/layout/account-menu"
import { GlobalSearch } from "@/components/layout/global-search"
import { useNavState } from "@/components/layout/nav-state-provider"
import { Button } from "@/components/ui/button"
import { IconButton, iconButtonVariants } from "@/components/ui/icon-button"

/**
 * Figma TopNav (152:1827) shared by every app route (home-search-production/TD-05): "≡" (side menu
 * expanded/mini on `lg+`, drawer below it and on the watch page), logo, global search (filled with
 * the current `q` on `/results`) and — with a session — "+" (upload) and the avatar that opens the
 * account menu; anonymous visitors get "Sign in" back to the current page. No microphone.
 */
function AppHeader({ className, ...props }: React.ComponentProps<"header">) {
  const session = React.useContext(SessionContext)
  const nav = useNavState()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const currentQuery = pathname === "/results" ? (searchParams.get("q") ?? "") : ""
  const expanded = nav ? (nav.drawerOpen || nav.mode === "expanded") : false

  return (
    <header
      data-slot="app-header"
      data-session={session.isLoggedIn ? "authenticated" : "anonymous"}
      className={cn(
        "relative flex h-15 w-full items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6",
        className
      )}
      {...props}
    >
      <div className="flex shrink-0 items-center gap-4">
        <IconButton aria-label="Menu" aria-expanded={expanded} onClick={nav?.toggle}>
          <MenuIcon />
        </IconButton>
        <Link href="/" aria-label="StreamTube home" className="flex items-center">
          <BrandLogo size="md" />
        </Link>
      </div>

      <GlobalSearch
        key={currentQuery}
        initialQuery={currentQuery}
        className="justify-end md:max-w-2xl md:flex-1 md:justify-center"
      />

      <div className="flex shrink-0 items-center gap-3">
        {session.isLoggedIn ? (
          <>
            <Link
              href="/studio/upload"
              aria-label="Upload video"
              className={cn(iconButtonVariants({ variant: "secondary" }))}
            >
              <AddIcon />
            </Link>
            <AccountMenu channelName={session.channelName} channelSlug={session.channelSlug} />
          </>
        ) : (
          <Button asChild size="sm">
            <Link href={loginHref(search ? `${pathname}?${search}` : pathname)}>Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  )
}

export { AppHeader }
