"use client"

import * as React from "react"

import { ChannelHeader } from "@/components/channel/channel-header"
import { SubscribeButton } from "@/components/channel/subscribe-button"
import type { ChannelPublic } from "@/lib/api/contracts"

type ChannelSocialHeaderProps = {
  channel: ChannelPublic
  isLoggedIn: boolean
  /** Espectador é o dono: sem Subscribe, a contagem continua visível (TD-03). */
  isOwner: boolean
}

/**
 * Cabeçalho da página do canal com a inscrição (social-interactions/TD-03, TD-04, TD-09): a meta
 * row "N subscribers" acompanha a contagem confirmada pela resposta do Subscribe, sem recarregar o
 * RSC. O estado inicial vem de `GET /channels/{nickname}` (`subscriber_count`, `viewer_subscribed`).
 */
function ChannelSocialHeader({ channel, isLoggedIn, isOwner }: ChannelSocialHeaderProps) {
  const [subscriberCount, setSubscriberCount] = React.useState(channel.subscriber_count)

  return (
    <ChannelHeader
      name={channel.name}
      nickname={channel.nickname}
      videoCount={channel.video_count}
      subscriberCount={subscriberCount}
      description={channel.description}
      actions={
        isOwner ? undefined : (
          <SubscribeButton
            channel={{ nickname: channel.nickname, name: channel.name }}
            initialSubscribed={channel.viewer_subscribed}
            initialSubscriberCount={channel.subscriber_count}
            isLoggedIn={isLoggedIn}
            isOwner={isOwner}
            onSubscriberCountChange={setSubscriberCount}
          />
        )
      }
    />
  )
}

export { ChannelSocialHeader }
export type { ChannelSocialHeaderProps }
