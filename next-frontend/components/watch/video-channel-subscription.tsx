"use client"

import * as React from "react"

import { SubscribeButton } from "@/components/channel/subscribe-button"
import { VideoChannelLink } from "@/components/watch/video-channel-link"
import type { Video } from "@/lib/api/contracts"

type VideoChannelSubscriptionProps = {
  /** `VideoResponse.channel` com `subscriber_count` e `viewer_subscribed` (social-interactions/TD-04). */
  channel: Video["channel"]
  isLoggedIn: boolean
  /** Espectador é o dono do canal: sem Subscribe, a contagem continua (TD-03). */
  isOwner: boolean
}

/**
 * Canal do vídeo + inscrição na watch page (Video show 152:2219): avatar, nome e "N subscribers" —
 * a contagem acompanha a resposta do Subscribe, sem recarregar o RSC (TD-09) — e o botão ao lado.
 */
function VideoChannelSubscription({ channel, isLoggedIn, isOwner }: VideoChannelSubscriptionProps) {
  const [subscriberCount, setSubscriberCount] = React.useState(channel.subscriber_count)

  return (
    <div data-slot="video-channel-subscription" className="flex items-center gap-6">
      <VideoChannelLink channel={channel} subscriberCount={subscriberCount} />
      <SubscribeButton
        channel={{ nickname: channel.nickname, name: channel.name }}
        initialSubscribed={channel.viewer_subscribed}
        initialSubscriberCount={channel.subscriber_count}
        isLoggedIn={isLoggedIn}
        isOwner={isOwner}
        onSubscriberCountChange={setSubscriberCount}
      />
    </div>
  )
}

export { VideoChannelSubscription }
export type { VideoChannelSubscriptionProps }
