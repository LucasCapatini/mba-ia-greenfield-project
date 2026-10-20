"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { loginHref } from "@/lib/auth/return-to"
import { SessionContext } from "@/components/auth/session-provider"
import { HomeIcon } from "@/components/icons/home-icon"
import { SubscriptionsIcon } from "@/components/icons/subscriptions-icon"
import { YourVideosIcon } from "@/components/icons/your-videos-icon"
import { useNavState } from "@/components/layout/nav-state-provider"
import { SideNav, type SideNavMode } from "@/components/layout/side-nav"
import { SideNavItem } from "@/components/layout/side-nav-item"
import { useSubscriptions } from "@/components/layout/subscriptions-provider"
import { Button } from "@/components/ui/button"

type SideNavEntry = "home" | "subscriptions" | "your-videos"

/** Item do menu lateral que corresponde à rota atual (`null` fora delas — ex.: página de canal). */
function activeSideNavItem(pathname: string): SideNavEntry | null {
  if (pathname === "/") return "home"
  if (pathname === "/feed/subscriptions" || pathname.startsWith("/feed/subscriptions/")) {
    return "subscriptions"
  }
  if (pathname === "/studio" || pathname.startsWith("/studio/")) return "your-videos"
  return null
}

type SideNavActiveProps = {
  /** Seção de canais seguidos (`SideNavSubscriptions`); só aparece com sessão e leitura ok. */
  subscriptions?: React.ReactNode
  /** `drawer` dentro do `NavDrawer`; sem ele, o modo da coluna vem do `NavStateProvider`. */
  mode?: Extract<SideNavMode, "drawer">
}

/**
 * Menu lateral do app (social-interactions/TD-08; home-search-production/TD-05): com sessão,
 * Home, Subscriptions, "You" → Your videos e os canais seguidos; sem sessão, Home e o convite para
 * entrar com `returnTo` da página atual. Na coluna segue o modo expandido/mini do contexto; no
 * drawer mostra o menu completo e fecha ao seguir um link. "Liked videos" não existe.
 */
function SideNavActive({ subscriptions, mode: modeProp }: SideNavActiveProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = React.useContext(SessionContext)
  const nav = useNavState()
  // Sem sessão não há provider; com a leitura do layout falhando, a seção de canais some.
  const showSubscriptions = useSubscriptions()?.available ?? false
  const mode: SideNavMode = modeProp ?? nav?.mode ?? "expanded"
  const active = activeSideNavItem(pathname)
  const layout = mode === "mini" ? "column" : "row"

  // No drawer, seguir qualquer link fecha o menu — inclusive o da rota atual (sem mudar o pathname).
  function handleClick(event: React.MouseEvent<HTMLElement>) {
    if (mode === "drawer" && (event.target as HTMLElement).closest("a")) nav?.closeDrawer()
  }

  const home = (
    <SideNavItem href="/" label="Home" icon={<HomeIcon />} active={active === "home"} layout={layout} />
  )

  if (!session.isLoggedIn) {
    const search = searchParams.toString()
    return (
      <SideNav
        mode={mode}
        onClick={handleClick}
        mainItems={home}
        invite={
          <section aria-label="Sign in" className="flex flex-col items-start gap-3 px-3 py-2">
            <p className="text-body-md text-sidebar-foreground">Sign in to see your subscriptions</p>
            <Button asChild size="sm" variant="secondary">
              <Link href={loginHref(search ? `${pathname}?${search}` : pathname)}>Sign in</Link>
            </Button>
          </section>
        }
      />
    )
  }

  const subscriptionsItem = (
    <SideNavItem
      href="/feed/subscriptions"
      label="Subscriptions"
      icon={<SubscriptionsIcon />}
      active={active === "subscriptions"}
      layout={layout}
    />
  )

  if (mode === "mini") {
    return (
      <SideNav
        mode="mini"
        mainItems={
          <>
            {home}
            {subscriptionsItem}
            <SideNavItem
              href="/studio/videos"
              label="You"
              icon={<YourVideosIcon />}
              active={active === "your-videos"}
              layout="column"
            />
          </>
        }
      />
    )
  }

  return (
    <SideNav
      mode={mode}
      onClick={handleClick}
      mainItems={
        <>
          {home}
          {subscriptionsItem}
        </>
      }
      youItems={
        <SideNavItem
          href="/studio/videos"
          label="Your videos"
          icon={<YourVideosIcon />}
          active={active === "your-videos"}
        />
      }
      subscriptions={showSubscriptions ? subscriptions : undefined}
    />
  )
}

export { SideNavActive, activeSideNavItem }
export type { SideNavEntry, SideNavActiveProps }
