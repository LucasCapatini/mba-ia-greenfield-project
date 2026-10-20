"use client"

import { usePathname, useRouter } from "next/navigation"

import { ThumbDownIcon } from "@/components/icons/thumb-down-icon"
import { ThumbUpIcon } from "@/components/icons/thumb-up-icon"
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation"
import type { ReactionState, ReactionValue } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"
import { formatCompactNumber } from "@/lib/format"
import { nextReaction, sendReaction } from "@/lib/reactions"
import { cn } from "@/lib/utils"

type VideoReactionButtonsProps = {
  publicId: string
  initial: ReactionState
  isLoggedIn: boolean
  className?: string
}

const segment = [
  "inline-flex items-center gap-2 px-4 py-2 text-label-lg text-secondary-foreground",
  "transition-colors outline-none hover:bg-muted",
  "focus-visible:ring-3 focus-visible:ring-ring/50",
  "[&_svg]:size-6 [&_svg]:shrink-0",
].join(" ")

/**
 * Par like/dislike do vídeo (Video show 152:2219): pill segmentada cinza — like com a contagem
 * compacta, divisória e dislike sem contagem (`dislike_count` fica só no contrato — TD-04). Ícone
 * preenchido no estado ativo. Otimista sobre `PUT|DELETE /api/videos/{publicId}/reaction`
 * (social-interactions/TD-03, TD-09); anônimo vai ao login sem chamar a API (TD-10).
 */
function VideoReactionButtons({
  publicId,
  initial,
  isLoggedIn,
  className,
}: VideoReactionButtonsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { shown, run } = useOptimisticMutation<ReactionState>(initial)

  const react = (clicked: ReactionValue) => {
    if (!isLoggedIn) {
      router.push(loginHref(pathname))
      return
    }
    const { next, method } = nextReaction(shown, clicked)
    run(next, () =>
      sendReaction(
        `/api/videos/${encodeURIComponent(publicId)}/reaction`,
        method,
        next.viewer_reaction
      )
    )
  }

  const liked = shown.viewer_reaction === "like"
  const disliked = shown.viewer_reaction === "dislike"
  const likes = formatCompactNumber(shown.like_count)

  return (
    <div
      role="group"
      aria-label="Video reactions"
      className={cn(
        "inline-flex items-center overflow-hidden rounded-[var(--radius-full)] border border-border bg-secondary",
        className
      )}
    >
      <button
        type="button"
        aria-pressed={liked}
        aria-label={`Like, ${likes}`}
        onClick={() => react("like")}
        className={segment}
      >
        <ThumbUpIcon filled={liked} />
        <span>{likes}</span>
      </button>
      <span aria-hidden="true" className="h-6 w-px bg-border" />
      <button
        type="button"
        aria-pressed={disliked}
        aria-label="Dislike"
        onClick={() => react("dislike")}
        className={segment}
      >
        <ThumbDownIcon filled={disliked} />
      </button>
    </div>
  )
}

export { VideoReactionButtons }
export type { VideoReactionButtonsProps }
