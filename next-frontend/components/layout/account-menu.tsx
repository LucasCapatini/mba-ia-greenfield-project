"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { ChannelAvatar } from "@/components/channel/channel-avatar"
import { EditSquareIcon } from "@/components/icons/edit-square-icon"
import { LogoutIcon } from "@/components/icons/logout-icon"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

type AccountMenuProps = {
  /** Channel display name (`channelName` of the session); falls back to the nickname. */
  channelName: string
  /** Channel nickname (`channelSlug` of the session). */
  channelSlug: string
  className?: string
}

const ITEM_CLASS =
  "flex w-full items-center gap-4 border-b border-border px-4 py-4 text-body-lg text-foreground outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50 [&_svg]:size-6 [&_svg]:shrink-0"

/**
 * Figma "Account User Menu" (150:1267): the header avatar opens a right-side panel with the channel
 * (name + `@nickname`, linked to the public page), "Edit Channel" and "Sign Out"
 * (home-search-production/TD-05, Revisions 2026-10-20 — name and nickname come from the session).
 * Sign Out calls the BFF logout, which destroys the session cookie, then re-renders the RSC tree.
 */
function AccountMenu({ channelName, channelSlug, className }: AccountMenuProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const name = channelName || channelSlug

  async function handleSignOut() {
    setPending(true)
    try {
      // The BFF destroys the iron-session cookie unconditionally (204).
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setOpen(false)
      setPending(false)
      router.push("/")
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Account"
        className={cn(
          "rounded-[var(--radius-full)] outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <ChannelAvatar name={name} size="md" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        data-slot="account-menu"
        aria-describedby={undefined}
        className="top-0 right-0 left-auto h-full max-h-dvh w-80 max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 content-start gap-0 overflow-y-auto rounded-none p-0 sm:max-w-80"
      >
        <DialogTitle className="border-b border-border px-4 py-5 text-h3 text-foreground">
          Account
        </DialogTitle>
        <div className="flex items-center gap-4 border-b border-border px-4 py-4">
          <ChannelAvatar name={name} size="md" aria-hidden="true" className="size-16 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-lg text-foreground">{name}</span>
            <Link
              href={`/channel/${channelSlug}`}
              onClick={() => setOpen(false)}
              className="truncate text-body-md text-muted-foreground hover:underline focus-visible:underline"
            >
              @{channelSlug}
            </Link>
          </div>
        </div>
        <nav aria-label="Account actions" className="flex flex-col">
          <Link href="/studio/channel" onClick={() => setOpen(false)} className={ITEM_CLASS}>
            <EditSquareIcon />
            Edit Channel
          </Link>
          <button type="button" onClick={handleSignOut} disabled={pending} className={ITEM_CLASS}>
            <LogoutIcon />
            Sign Out
          </button>
        </nav>
      </DialogContent>
    </Dialog>
  )
}

export { AccountMenu }
export type { AccountMenuProps }
