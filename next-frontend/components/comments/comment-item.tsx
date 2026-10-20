import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { ChannelAvatar } from "@/components/channel/channel-avatar"

/** The fields of `CommentResponse` this item renders (social-interactions/TD-06). */
type CommentItemData = {
  id: string
  text: string
  author: { nickname: string; name: string }
  created_at: string
  edited_at: string | null
}

type CommentItemProps = Omit<React.ComponentProps<"article">, "children"> & {
  comment: CommentItemData
  /** Like/dislike of the comment (`CommentReactionButtons`). */
  reactions?: React.ReactNode
  /** The "Reply" control. */
  replyAction?: React.ReactNode
  /** The author-only "⋮" menu (`CommentActionsMenu`). */
  actionsMenu?: React.ReactNode
  /** Replaces the text while the author edits the comment (`CommentComposer`). */
  editor?: React.ReactNode
  /** The thread below a root comment (`CommentReplies`). */
  replies?: React.ReactNode
  now?: Date
}

/**
 * Figma Video show comment (152:2219): 48px channel avatar, "@nickname" + relative time in muted
 * caption, the plain text with line breaks preserved and, below it, the reactions and "Reply". The
 * parts that talk to the BFF enter through slots, so this item stays presentational. "(edited)" is
 * not drawn — rendered in muted caption next to the time (phase 06 resolution OQ-2).
 */
function CommentItem({
  comment,
  reactions,
  replyAction,
  actionsMenu,
  editor,
  replies,
  now,
  className,
  ...props
}: CommentItemProps) {
  const headingId = `comment-${comment.id}-author`
  return (
    <article
      data-slot="comment-item"
      aria-labelledby={headingId}
      className={cn("flex w-full gap-4", className)}
      {...props}
    >
      <ChannelAvatar name={comment.author.name} size="md" className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex flex-wrap items-baseline gap-2">
            <Link
              id={headingId}
              href={`/channel/${comment.author.nickname}`}
              className="text-label-md text-foreground hover:underline"
            >
              @{comment.author.nickname}
            </Link>
            <time dateTime={comment.created_at} className="text-caption text-muted-foreground">
              {formatRelativeTime(comment.created_at, now)}
            </time>
            {comment.edited_at ? (
              <span data-slot="comment-item-edited" className="text-caption text-muted-foreground">
                (edited)
              </span>
            ) : null}
          </p>
          {actionsMenu}
        </div>
        {editor ?? (
          <p data-slot="comment-item-text" className="text-body-md whitespace-pre-line text-foreground">
            {comment.text}
          </p>
        )}
        {reactions || replyAction ? (
          <div data-slot="comment-item-actions" className="flex items-center gap-4">
            {reactions}
            {replyAction}
          </div>
        ) : null}
        {replies}
      </div>
    </article>
  )
}

export { CommentItem }
export type { CommentItemData, CommentItemProps }
