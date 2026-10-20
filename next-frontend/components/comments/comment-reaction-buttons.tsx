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

type CommentReactionButtonsProps = {
  commentId: string
  initial: ReactionState
  isLoggedIn: boolean
  className?: string
}

const iconButton = [
  "inline-flex items-center gap-1 rounded-[var(--radius-full)] p-1 text-muted-foreground",
  "transition-colors outline-none hover:text-foreground",
  "focus-visible:ring-3 focus-visible:ring-ring/50",
  "aria-pressed:text-foreground [&_svg]:size-5 [&_svg]:shrink-0",
].join(" ")

/**
 * Like/dislike do comentário (Video show 152:2219): ícones pequenos sem fundo — like com a
 * contagem, dislike sem. Mesma mecânica da reação ao vídeo sobre
 * `PUT|DELETE /api/comments/{commentId}/reaction`, para raízes e respostas
 * (social-interactions/TD-03, TD-09); anônimo vai ao login sem chamar a API (TD-10).
 */
function CommentReactionButtons({
  commentId,
  initial,
  isLoggedIn,
  className,
}: CommentReactionButtonsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { shown, run } = useOptimisticMutation<ReactionState>(initial, {
    notFoundMessage: "This comment is no longer available",
  })

  const react = (clicked: ReactionValue) => {
    if (!isLoggedIn) {
      router.push(loginHref(pathname))
      return
    }
    const { next, method } = nextReaction(shown, clicked)
    run(next, () =>
      sendReaction(
        `/api/comments/${encodeURIComponent(commentId)}/reaction`,
        method,
        next.viewer_reaction
      )
    )
  }

  const liked = shown.viewer_reaction === "like"
  const disliked = shown.viewer_reaction === "dislike"
  const likes = formatCompactNumber(shown.like_count)

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={`Like, ${likes}`}
        onClick={() => react("like")}
        className={iconButton}
      >
        <ThumbUpIcon filled={liked} />
        {shown.like_count > 0 && <span className="text-caption">{likes}</span>}
      </button>
      <button
        type="button"
        aria-pressed={disliked}
        aria-label="Dislike"
        onClick={() => react("dislike")}
        className={iconButton}
      >
        <ThumbDownIcon filled={disliked} />
      </button>
    </div>
  )
}

export { CommentReactionButtons }
export type { CommentReactionButtonsProps }
