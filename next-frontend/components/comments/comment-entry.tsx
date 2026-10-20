"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { Comment } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"

import { CommentActionsMenu } from "./comment-actions-menu"
import { CommentComposer } from "./comment-composer"
import { CommentItem } from "./comment-item"
import { CommentReactionButtons } from "./comment-reaction-buttons"
import {
  COMMENT_GENERIC_ERROR,
  COMMENT_GONE_MESSAGE,
  composerErrorOf,
  requestComments,
} from "./comment-requests"

type CommentEntryProps = {
  comment: Comment
  isLoggedIn: boolean
  /** "Reply" do item (abre o composer de resposta na thread da raiz). */
  onReply: () => void
  /** Corpo do `PATCH` 200 (texto novo + `edited_at`). */
  onUpdated: (comment: Comment) => void
  /** `DELETE` 204 — o chamador remove o item e ajusta as contagens. */
  onDeleted: (comment: Comment) => void
  /** O servidor não conhece mais o comentário (404 `COMMENT_NOT_FOUND`): remover sem confirmação. */
  onGone: (comment: Comment) => void
  replies?: React.ReactNode
  now?: Date
}

/**
 * Um comentário (raiz ou resposta) com reações, "Reply" e o menu do autor (social-interactions/
 * TD-05..TD-07). Edição e exclusão vão ao BFF e o resultado volta por callback — o estado da lista
 * é do chamador, sem `router.refresh()` (TD-09). Anônimo no "Reply" vai ao login (TD-10).
 */
function CommentEntry({
  comment,
  isLoggedIn,
  onReply,
  onUpdated,
  onDeleted,
  onGone,
  replies,
  now,
}: CommentEntryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [editing, setEditing] = React.useState(false)

  const gone = () => {
    toast.error(COMMENT_GONE_MESSAGE)
    onGone(comment)
  }

  async function save(text: string) {
    const res = await requestComments(
      `/api/comments/${encodeURIComponent(comment.id)}`,
      "PATCH",
      { text }
    )
    if (res.status === 401) {
      router.push(loginHref(pathname))
      return
    }
    if (res.status === 404) {
      gone()
      return
    }
    if (!res.ok) {
      throw new Error(await composerErrorOf(res))
    }
    onUpdated((await res.json()) as Comment)
    setEditing(false)
  }

  async function remove() {
    const res = await requestComments(
      `/api/comments/${encodeURIComponent(comment.id)}`,
      "DELETE"
    )
    if (res.status === 401) {
      router.push(loginHref(pathname))
      return
    }
    if (res.status === 404) {
      gone()
      return
    }
    if (!res.ok) {
      toast.error(COMMENT_GENERIC_ERROR)
      // Mantém o diálogo aberto para uma nova tentativa.
      throw new Error(COMMENT_GENERIC_ERROR)
    }
    onDeleted(comment)
  }

  const reply = () => {
    if (!isLoggedIn) {
      router.push(loginHref(pathname))
      return
    }
    onReply()
  }

  return (
    <CommentItem
      comment={comment}
      now={now}
      reactions={
        <CommentReactionButtons
          commentId={comment.id}
          initial={{
            viewer_reaction: comment.viewer_reaction,
            like_count: comment.like_count,
            dislike_count: comment.dislike_count,
          }}
          isLoggedIn={isLoggedIn}
        />
      }
      replyAction={
        <Button type="button" variant="ghost" size="sm" className="min-w-0" onClick={reply}>
          Reply
        </Button>
      }
      actionsMenu={
        <CommentActionsMenu
          viewerIsAuthor={comment.viewer_is_author}
          replyCount={comment.reply_count}
          onEdit={() => setEditing(true)}
          onDelete={remove}
        />
      }
      editor={
        editing ? (
          <CommentComposer
            isLoggedIn
            returnTo={pathname}
            initialValue={comment.text}
            label="Edit comment"
            submitLabel="Save"
            startExpanded
            onCancel={() => setEditing(false)}
            onSubmit={save}
          />
        ) : undefined
      }
      replies={replies}
    />
  )
}

export { CommentEntry }
export type { CommentEntryProps }
