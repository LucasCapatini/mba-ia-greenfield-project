import { AppShell } from "@/components/layout/app-shell"
import { SideNavActive } from "@/components/layout/side-nav-active"
import { SideNavSubscriptions } from "@/components/layout/side-nav-subscriptions"

// Rotas com menu lateral (home, busca, canal, estúdio e feed — social-interactions/TD-08;
// home-search-production/TD-05): `AppShell` com o menu sempre presente — com sessão, Home,
// Subscriptions, Your videos e os canais seguidos (do `SubscriptionsProvider` montado no layout
// `(app)`); sem sessão, Home e o convite para entrar. A watch page fica fora deste grupo (frame
// 152:2219 sem coluna de menu; o "≡" abre o drawer). URLs inalteradas.
export default function ShellLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell nav={<SideNavActive subscriptions={<SideNavSubscriptions />} />}>{children}</AppShell>
}
