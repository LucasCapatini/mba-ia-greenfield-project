"use client"

import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useSubscriptions } from "@/components/layout/subscriptions-provider"
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation"
import type { SubscriptionState } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"
import { cn } from "@/lib/utils"

type SubscribeButtonProps = {
  channel: { nickname: string; name: string }
  initialSubscribed: boolean
  initialSubscriberCount: number
  isLoggedIn: boolean
  /** Espectador é o dono do canal: o botão não é renderizado (decisão do inventário; TD-03). */
  isOwner: boolean
  /** Contagem confirmada pelo servidor, para a linha "N subscribers" do chamador. */
  onSubscriberCountChange?: (count: number) => void
  className?: string
}

/**
 * Pill "Subscribe" ↔ "Subscribed" (Video show 152:2219; Channel Show 156:3536), compartilhada
 * pela watch page e pela página do canal. Otimista e reconciliada pela resposta de
 * `PUT|DELETE /api/channels/{nickname}/subscription` (social-interactions/TD-03, TD-09); o menu
 * lateral só muda depois da confirmação (TD-08). Anônimo vai ao login (TD-10).
 */
function SubscribeButton({
  channel,
  initialSubscribed,
  initialSubscriberCount,
  isLoggedIn,
  isOwner,
  onSubscriberCountChange,
  className,
}: SubscribeButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const subscriptions = useSubscriptions()
  const { shown, run } = useOptimisticMutation<SubscriptionState>(
    { subscribed: initialSubscribed, subscriber_count: initialSubscriberCount },
    {
      notFoundMessage: "This channel is no longer available",
      onConfirmed: (confirmed) => {
        subscriptions?.onChange(channel, confirmed.subscribed)
        onSubscriberCountChange?.(confirmed.subscriber_count)
      },
    }
  )

  if (isOwner) {
    return null
  }

  const toggle = () => {
    if (!isLoggedIn) {
      router.push(loginHref(pathname))
      return
    }
    const subscribed = !shown.subscribed
    run(
      {
        subscribed,
        subscriber_count: shown.subscriber_count + (subscribed ? 1 : -1),
      },
      () =>
        fetch(`/api/channels/${encodeURIComponent(channel.nickname)}/subscription`, {
          method: subscribed ? "PUT" : "DELETE",
        })
    )
  }

  return (
    <Button
      type="button"
      variant={shown.subscribed ? "secondary" : "default"}
      aria-pressed={shown.subscribed}
      onClick={toggle}
      className={cn("rounded-[var(--radius-full)]", className)}
    >
      {shown.subscribed ? "Subscribed" : "Subscribe"}
    </Button>
  )
}

export { SubscribeButton }
export type { SubscribeButtonProps }
