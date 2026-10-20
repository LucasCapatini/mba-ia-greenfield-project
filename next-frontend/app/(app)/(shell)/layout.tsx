import { AppShell } from "@/components/layout/app-shell"
import { SideNavActive } from "@/components/layout/side-nav-active"
import { SideNavSubscriptions } from "@/components/layout/side-nav-subscriptions"
import { SubscriptionsProvider } from "@/components/layout/subscriptions-provider"
import type { SubscribedChannelsPage } from "@/lib/api/contracts"
import { upstream } from "@/lib/api/upstream"
import { getSession } from "@/lib/auth/session"

/** O menu lateral mostra os 7 primeiros canais seguidos; "Show more" pagina o resto (TD-08). */
const SIDE_NAV_SUBSCRIPTIONS = 7

/** Primeira página dos canais seguidos; qualquer falha deixa o menu sem a seção de canais. */
async function firstSubscriptionsPage(accessToken: string): Promise<SubscribedChannelsPage | null> {
  try {
    const { data } = await upstream.GET("/me/subscriptions", {
      params: { query: { limit: SIDE_NAV_SUBSCRIPTIONS } },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return data ?? null
  } catch {
    return null
  }
}

// Rotas com menu lateral (home, canal, estúdio e feed — social-interactions/TD-08, TD-09): com
// sessão, `AppShell` + `SideNav` + `SubscriptionsProvider` semeado pelo RSC; sem sessão, só o
// conteúdo. A watch page fica fora deste grupo (frame 152:2219 sem menu). URLs inalteradas.
export default async function ShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return <AppShell>{children}</AppShell>
  }

  const firstPage = await firstSubscriptionsPage(session.accessToken)
  return (
    <SubscriptionsProvider initial={firstPage /* GET /me/subscriptions?limit=7 */}>
      <AppShell nav={<SideNavActive subscriptions={firstPage ? <SideNavSubscriptions /> : undefined} />}>
        {children}
      </AppShell>
    </SubscriptionsProvider>
  )
}
