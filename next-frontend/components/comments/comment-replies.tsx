"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { ChevronDownIcon } from "@/components/icons/chevron-down-icon"
import { ChevronUpIcon } from "@/components/icons/chevron-up-icon"
import { Button } from "@/components/ui/button"
import type { Comment, CommentsPage } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"

import { CommentComposer } from "./comment-composer"
import { CommentEntry } from "./comment-entry"
import {
  COMMENT_GENERIC_ERROR,
  COMMENT_GONE_MESSAGE,
  composerErrorOf,
  requestComments,
} from "./comment-requests"

type CommentRepliesProps = {
  root: Comment
  isLoggedIn: boolean
  /** Nome do canal da sessão, para o avatar do composer. */
  viewerName?: string
  /** Texto inicial do composer de resposta aberto nesta thread; `null` = fechado. */
  draft: string | null
  /** "Reply" numa resposta: abre o composer da thread com `@nickname ` (um nível — TD-05). */
  onReplyTo: (prefill: string) => void
  onDraftClose: () => void
  /** Respostas criadas (+1) ou removidas (−1): o pai ajusta `reply_count` e o cabeçalho. */
  onReplyCountDelta: (delta: number) => void
  /** A raiz sumiu do servidor (404 ao responder): o pai a remove. */
  onRootGone: () => void
  now?: Date
}

/**
 * Alternância "N replies" / respostas de uma raiz (social-interactions/TD-05, TD-06): busca
 * `GET /api/comments/{id}/replies` na primeira abertura e mantém o carregado ao recolher; "Show more
 * replies" segue o cursor. O composer de resposta anexa o `201` ao fim da thread (TD-09).
 */
function CommentReplies({
  root,
  isLoggedIn,
  viewerName,
  draft,
  onReplyTo,
  onDraftClose,
  onReplyCountDelta,
  onRootGone,
  now,
}: CommentRepliesProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [replies, setReplies] = React.useState<Comment[] | null>(null)
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const threadId = React.useId()

  const repliesUrl = `/api/comments/${encodeURIComponent(root.id)}/replies`

  async function load(after: string | null): Promise<boolean> {
    setLoading(true)
    try {
      const res = await requestComments(
        after ? `${repliesUrl}?cursor=${encodeURIComponent(after)}` : repliesUrl
      )
      if (res.status === 404) {
        toast.error(COMMENT_GONE_MESSAGE)
        onRootGone()
        return false
      }
      if (!res.ok) {
        toast.error(COMMENT_GENERIC_ERROR)
        return false
      }
      const page = (await res.json()) as CommentsPage
      setReplies((current) => {
        const known = new Set((after ? (current ?? []) : []).map((reply) => reply.id))
        return [
          ...(after ? (current ?? []) : []),
          ...page.items.filter((reply) => !known.has(reply.id)),
        ]
      })
      setCursor(page.next_cursor)
      return true
    } finally {
      setLoading(false)
    }
  }

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    if (replies === null && !(await load(null))) {
      return
    }
    setOpen(true)
  }

  async function submitReply(text: string) {
    const res = await requestComments(repliesUrl, "POST", { text })
    if (res.status === 401) {
      router.push(loginHref(pathname))
      return
    }
    if (res.status === 404) {
      toast.error(COMMENT_GONE_MESSAGE)
      onRootGone()
      return
    }
    if (!res.ok) {
      throw new Error(await composerErrorOf(res))
    }
    const created = (await res.json()) as Comment
    if (replies === null) {
      // Ainda não carregada: a primeira leitura já traz a resposta nova.
      await load(null)
    } else {
      setReplies([...replies, created])
    }
    setOpen(true)
    onReplyCountDelta(1)
    onDraftClose()
  }

  const removeReply = (reply: Comment) => {
    setReplies((current) => (current ?? []).filter((item) => item.id !== reply.id))
    onReplyCountDelta(-1)
  }

  const count = root.reply_count
  const showToggle = count > 0 || (replies?.length ?? 0) > 0

  return (
    <div data-slot="comment-replies" className="flex flex-col gap-3">
      {showToggle ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          aria-expanded={open}
          aria-controls={threadId}
          disabled={loading}
          onClick={toggle}
          className="self-start px-0"
        >
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          {count} {count === 1 ? "reply" : "replies"}
        </Button>
      ) : null}

      {open && replies ? (
        <ul id={threadId} aria-label={`Replies to @${root.author.nickname}`} className="flex flex-col gap-4">
          {replies.map((reply) => (
            <li key={reply.id}>
              <CommentEntry
                comment={reply}
                isLoggedIn={isLoggedIn}
                now={now}
                onReply={() => onReplyTo(`@${reply.author.nickname} `)}
                onUpdated={(updated) =>
                  setReplies((current) =>
                    (current ?? []).map((item) => (item.id === updated.id ? updated : item))
                  )
                }
                onDeleted={removeReply}
                onGone={removeReply}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {open && cursor ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void load(cursor)}
          className="self-start"
        >
          Show more replies
        </Button>
      ) : null}

      {draft !== null ? (
        <CommentComposer
          key={draft}
          isLoggedIn={isLoggedIn}
          returnTo={pathname}
          avatarName={viewerName}
          initialValue={draft}
          label="Add a reply"
          placeholder="Add a reply…"
          submitLabel="Reply"
          startExpanded
          onCancel={onDraftClose}
          onSubmit={submitReply}
        />
      ) : null}
    </div>
  )
}

export { CommentReplies }
export type { CommentRepliesProps }
