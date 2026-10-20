"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { ChannelAvatar } from "@/components/channel/channel-avatar"
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon"
import { useSubscriptions } from "@/components/layout/subscriptions-provider"
import { cn } from "@/lib/utils"

/**
 * Seção "Subscriptions" do menu lateral (Figma Left Menu 150:959 / Channel Show I155:1927;62:1672):
 * canais seguidos em ordem alfabética, avatar de iniciais + nome com link para o canal. Lida do
 * `SubscriptionsProvider` — o Subscribe a atualiza sem recarregar (social-interactions/TD-08,
 * TD-09); "Show more" busca a próxima página e some sem cursor (TD-08, Revisions 2026-10-20).
 */
function SideNavSubscriptions() {
  const subscriptions = useSubscriptions()
  const pathname = usePathname()

  if (!subscriptions) {
    return null
  }
  const { channels, hasMore, loadingMore, loadMore } = subscriptions

  return (
    <section aria-labelledby="side-nav-subscriptions" className="flex flex-col gap-1">
      <h2 id="side-nav-subscriptions" className="px-3 py-1.5 text-label-lg text-sidebar-foreground">
        Subscriptions
      </h2>
      {channels.length === 0 ? (
        <p className="px-3 py-2 text-body-md text-muted-foreground">
          Channels you subscribe to will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {channels.map((channel) => {
            const href = `/channel/${channel.nickname}`
            const active = pathname === href
            return (
              <li key={channel.nickname}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-6 rounded-[var(--radius-3)] px-3 py-2 text-body-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active && "bg-sidebar-accent text-label-lg"
                  )}
                >
                  <ChannelAvatar
                    name={channel.name}
                    size="sm"
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span className="truncate">{channel.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {hasMore ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="flex items-center gap-6 rounded-[var(--radius-3)] px-3 py-2 text-body-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50"
        >
          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
            <ChevronDownIcon />
          </span>
          Show more
        </button>
      ) : null}
    </section>
  )
}

export { SideNavSubscriptions }
