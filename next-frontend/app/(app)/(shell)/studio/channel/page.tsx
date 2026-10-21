import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { clientHeaders } from "@/lib/api/client-headers"
import { getSession } from "@/lib/auth/session"
import { ChannelHeaderCard } from "@/components/channel/channel-header-card"
import { ChannelSettingsForm } from "@/components/channel/channel-settings-form"

export const metadata: Metadata = {
  title: "Channel Settings",
}

// /studio/channel — configurações do canal (Figma 154:1367). RSC: `GET /channels/me` via
// `upstream` com o token da sessão (video-channel-management/TD-12).
export default async function ChannelSettingsPage() {
  const session = await getSession()
  const { data: channel, response } = await upstream.GET("/channels/me", {
    headers: { ...(await clientHeaders()), Authorization: `Bearer ${session.accessToken}` },
  })
  if (response.status === 401) {
    redirect("/login?returnTo=/studio/channel")
  }
  if (!channel) {
    throw new Error(`Could not load your channel (status ${response.status})`)
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 pt-8 pb-6 sm:px-6">
      <h1 className="text-h1 text-foreground">Channel Settings</h1>
      <ChannelHeaderCard
        name={channel.name}
        nickname={channel.nickname}
        videoCount={channel.video_count}
      />
      <ChannelSettingsForm key={channel.updated_at} channel={channel} />
    </main>
  )
}
