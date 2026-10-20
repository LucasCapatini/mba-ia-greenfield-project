"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { HomeIcon } from "@/components/icons/home-icon"
import { SubscriptionsIcon } from "@/components/icons/subscriptions-icon"
import { YourVideosIcon } from "@/components/icons/your-videos-icon"
import { SideNav } from "@/components/layout/side-nav"
import { SideNavItem } from "@/components/layout/side-nav-item"

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

/**
 * Menu lateral das rotas do grupo `(shell)` (social-interactions/TD-08): Home, Subscriptions e
 * Your videos com o item da rota atual marcado (`aria-current="page"`), e a seção de canais
 * seguidos recebida do layout. "Liked videos" não existe (sem capability nesta fase).
 */
function SideNavActive({ subscriptions }: { subscriptions?: React.ReactNode }) {
  const active = activeSideNavItem(usePathname())
  return (
    <SideNav
      mainItems={
        <>
          <SideNavItem href="/" label="Home" icon={<HomeIcon />} active={active === "home"} />
          <SideNavItem
            href="/feed/subscriptions"
            label="Subscriptions"
            icon={<SubscriptionsIcon />}
            active={active === "subscriptions"}
          />
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
      subscriptions={subscriptions}
    />
  )
}

export { SideNavActive, activeSideNavItem }
export type { SideNavEntry }
