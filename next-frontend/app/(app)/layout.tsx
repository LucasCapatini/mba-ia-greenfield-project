import { cookies } from "next/headers"

import type { SubscribedChannelsPage } from "@/lib/api/contracts"
import { upstream } from "@/lib/api/upstream"
import { clientHeaders } from "@/lib/api/client-headers"
import { getSession } from "@/lib/auth/session"
import { AppHeader } from "@/components/layout/app-header"
import { NavDrawer } from "@/components/layout/nav-drawer"
import { NavStateProvider } from "@/components/layout/nav-state-provider"
import { SideNavActive } from "@/components/layout/side-nav-active"
import { SideNavSubscriptions } from "@/components/layout/side-nav-subscriptions"
import { SubscriptionsProvider } from "@/components/layout/subscriptions-provider"

/** O menu lateral mostra os 7 primeiros canais seguidos; "Show more" pagina o resto (TD-08). */
const SIDE_NAV_SUBSCRIPTIONS = 7

/** Primeira página dos canais seguidos; qualquer falha deixa o menu sem a seção de canais. */
async function firstSubscriptionsPage(accessToken: string): Promise<SubscribedChannelsPage | null> {
  try {
    const { data } = await upstream.GET("/me/subscriptions", {
      params: { query: { limit: SIDE_NAV_SUBSCRIPTIONS } },
      headers: { ...(await clientHeaders()), Authorization: `Bearer ${accessToken}` },
    })
    return data ?? null
  } catch {
    return null
  }
}

// Rotas de app (tudo fora do grupo `(auth)`): header global e drawer de navegação
// (home-search-production/TD-05). O modo do menu vem do cookie `side_nav` lido aqui, então o HTML
// já sai expandido ou mini, sem salto na hidratação. Com sessão, a primeira página de canais
// seguidos semeia o `SubscriptionsProvider` uma vez para o menu lateral do `(shell)` e para o
// drawer da watch page. As telas de auth mantêm o layout próprio de card.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const navMode = (await cookies()).get("side_nav")?.value === "mini" ? "mini" : "expanded"
  const session = await getSession()
  const sideNav = <SideNavActive mode="drawer" subscriptions={<SideNavSubscriptions />} />

  const shell = (
    <NavStateProvider initialMode={navMode}>
      <AppHeader />
      <NavDrawer>{sideNav}</NavDrawer>
      {children}
    </NavStateProvider>
  )

  if (!session.isLoggedIn) {
    return shell
  }
  const firstPage = await firstSubscriptionsPage(session.accessToken)
  return <SubscriptionsProvider initial={firstPage /* GET /me/subscriptions?limit=7 */}>{shell}</SubscriptionsProvider>
}
