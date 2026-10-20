import { redirect } from "next/navigation"

import { UploadProvider } from "@/components/upload/upload-provider"
import { getSession } from "@/lib/auth/session"

// Estúdio (`/studio/**`) exige sessão. O redirect com `returnTo` acontece no `proxy.ts`, que
// conhece o pathname; layouts não recebem pathname e não re-renderizam na navegação, então este
// guard é a defesa em profundidade para um cookie que passou pelo proxy mas não vale mais.
export default async function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    redirect("/login")
  }

  return <UploadProvider>{children}</UploadProvider>
}
