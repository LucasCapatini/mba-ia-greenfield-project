"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { Comment, CommentSort, CommentsPage } from "@/lib/api/contracts"

import { CommentEntry } from "./comment-entry"
import { CommentReplies } from "./comment-replies"
import { COMMENT_GENERIC_ERROR, requestComments } from "./comment-requests"

type CommentListProps = {
  publicId: string
  sort: CommentSort
  comments: Comment[]
  nextCursor: string | null
  isLoggedIn: boolean
  viewerName?: string
  /** Atualiza a lista de raízes (estado da seção). */
  onCommentsChange: (update: (comments: Comment[]) => Comment[]) => void
  onNextCursorChange: (cursor: string | null) => void
  /** Ajusta o cabeçalho "N Comments" (raízes + respostas — TD-05). */
  onCountDelta: (delta: number) => void
  now?: Date
}

/**
 * Raízes do vídeo (social-interactions/TD-05..TD-07, TD-09): cada item com reações, "Reply", menu do
 * autor e a thread de respostas; "Show more comments" segue o `next_cursor` da ordenação atual.
 * Editar aplica a resposta do `PATCH`; excluir uma raiz tira `1 + reply_count` do cabeçalho.
 */
function CommentList({
  publicId,
  sort,
  comments,
  nextCursor,
  isLoggedIn,
  viewerName,
  onCommentsChange,
  onNextCursorChange,
  onCountDelta,
  now,
}: CommentListProps) {
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [draft, setDraft] = React.useState<{ rootId: string; text: string } | null>(null)

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const res = await requestComments(
        `/api/videos/${encodeURIComponent(publicId)}/comments?sort=${sort}&cursor=${encodeURIComponent(nextCursor)}`
      )
      if (!res.ok) {
        toast.error(COMMENT_GENERIC_ERROR)
        return
      }
      const page = (await res.json()) as CommentsPage
      onCommentsChange((current) => {
        const known = new Set(current.map((comment) => comment.id))
        return [...current, ...page.items.filter((comment) => !known.has(comment.id))]
      })
      onNextCursorChange(page.next_cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  const replace = (updated: Comment) =>
    onCommentsChange((current) =>
      current.map((comment) => (comment.id === updated.id ? updated : comment))
    )

  const removeRoot = (root: Comment) => {
    onCommentsChange((current) => current.filter((comment) => comment.id !== root.id))
    onCountDelta(-(1 + root.reply_count))
  }

  const changeReplyCount = (rootId: string, delta: number) => {
    onCommentsChange((current) =>
      current.map((comment) =>
        comment.id === rootId ? { ...comment, reply_count: comment.reply_count + delta } : comment
      )
    )
    onCountDelta(delta)
  }

  if (comments.length === 0 && !nextCursor) {
    return <p className="text-body-md text-muted-foreground">No comments yet.</p>
  }

  return (
    <div data-slot="comment-list" className="flex flex-col gap-6">
      <ul aria-label="Comments" className="flex flex-col gap-6">
        {comments.map((comment) => (
          <li key={comment.id}>
            <CommentEntry
              comment={comment}
              isLoggedIn={isLoggedIn}
              now={now}
              onReply={() => setDraft({ rootId: comment.id, text: "" })}
              onUpdated={replace}
              onDeleted={removeRoot}
              onGone={removeRoot}
              replies={
                <CommentReplies
                  root={comment}
                  isLoggedIn={isLoggedIn}
                  viewerName={viewerName}
                  now={now}
                  draft={draft?.rootId === comment.id ? draft.text : null}
                  onReplyTo={(text) => setDraft({ rootId: comment.id, text })}
                  onDraftClose={() => setDraft(null)}
                  onReplyCountDelta={(delta) => changeReplyCount(comment.id, delta)}
                  onRootGone={() => removeRoot(comment)}
                />
              }
            />
          </li>
        ))}
      </ul>
      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="self-center rounded-[var(--radius-full)]"
        >
          Show more comments
        </Button>
      ) : null}
    </div>
  )
}

export { CommentList }
export type { CommentListProps }
