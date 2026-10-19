"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BrandLogo } from "@/components/auth/brand-logo"
import { SessionContext } from "@/components/auth/session-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Minimal session-aware header for the application routes (per
 * saneamento-fase-02-e-infra/TD-05). Reads the session the RSC root layout
 * hydrated into the SessionProvider (phase-02-auth-frontend/TD-06) — no
 * round-trip. The full navbar of Phase 07 grows from here. Authenticated users
 * get the studio entry points (Phase 04, OQ-3 — per video-channel-management/TD-12).
 */
function AppHeader({ className, ...props }: React.ComponentProps<"header">) {
  const session = React.useContext(SessionContext)
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleLogout() {
    setPending(true)
    try {
      // BFF destroys the iron-session cookie unconditionally (204); then the
      // RSC tree must re-render without a session (TD-06 → router.refresh()).
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/")
      router.refresh()
      setPending(false)
    }
  }

  return (
    <header
      data-slot="app-header"
      data-session={session.isLoggedIn ? "authenticated" : "anonymous"}
      className={cn(
        "flex w-full items-center justify-between gap-4 border-b border-border bg-background px-6 py-3",
        className
      )}
      {...props}
    >
      <Link href="/" aria-label="StreamTube home" className="flex items-center">
        <BrandLogo size="md" />
      </Link>

      <nav aria-label="Account" className="flex items-center gap-3">
        {session.isLoggedIn ? (
          <>
            <span
              data-slot="app-header-user"
              className="text-label-md text-muted-foreground"
            >
              {session.email}
            </span>
            <Button asChild size="sm" variant="ghost">
              <Link href="/studio/videos">Meus vídeos</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/studio/channel">Meu canal</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleLogout}
              disabled={pending}
            >
              {pending ? "Saindo…" : "Sair"}
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Criar conta</Link>
            </Button>
          </>
        )}
      </nav>
    </header>
  )
}

export { AppHeader }
