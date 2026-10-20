"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import type { Comment, CommentSort, CommentsPage } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"
import { Button } from "@/components/ui/button"

import { CommentComposer } from "./comment-composer"
import { CommentList } from "./comment-list"
import {
  COMMENT_GENERIC_ERROR,
  VIDEO_GONE_MESSAGE,
  composerErrorOf,
  requestComments,
} from "./comment-requests"
import { CommentSortMenu } from "./comment-sort-menu"

type CommentSectionProps = {
  publicId: string
  commentCount: number
  /**
   * Primeira página (`sort=latest`) lida pelo RSC da watch page (TD-09); `null` quando a leitura
   * falhou — a seção mostra o bloco de erro com "Try again" e o resto da página segue normal.
   */
  initialPage: CommentsPage | null
  isLoggedIn: boolean
  /** Nome do canal da sessão — avatar do composer. */
  viewerName?: string
  now?: Date
}

const NUMBER = new Intl.NumberFormat("en-US")
const COMMENTS_UNAVAILABLE = "Comments could not be loaded."

/**
 * Seção de comentários da watch page (Video show 152:2219; social-interactions/TD-05..TD-07, TD-09):
 * cabeçalho "N Comments" + "Sort by" + composer + lista. A primeira página vem do RSC; trocar a
 * ordem refaz a primeira página pelo BFF e descarta as anteriores; um comentário criado entra no
 * topo e soma 1 ao cabeçalho — tudo em estado local, sem `router.refresh()`.
 */
function CommentSection({
  publicId,
  commentCount,
  initialPage,
  isLoggedIn,
  viewerName,
  now,
}: CommentSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [count, setCount] = React.useState(commentCount)
  const [sort, setSort] = React.useState<CommentSort>("latest")
  const [loaded, setLoaded] = React.useState(initialPage !== null)
  const [comments, setComments] = React.useState<Comment[]>(initialPage?.items ?? [])
  const [nextCursor, setNextCursor] = React.useState(initialPage?.next_cursor ?? null)
  const [sorting, setSorting] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)

  const commentsUrl = `/api/videos/${encodeURIComponent(publicId)}/comments`

  async function changeSort(next: CommentSort) {
    if (next === sort) return
    setSorting(true)
    try {
      const res = await requestComments(`${commentsUrl}?sort=${next}`)
      if (!res.ok) {
        toast.error(COMMENT_GENERIC_ERROR)
        return
      }
      const page = (await res.json()) as CommentsPage
      setSort(next)
      setComments(page.items)
      setNextCursor(page.next_cursor)
    } finally {
      setSorting(false)
    }
  }

  async function retry() {
    setRetrying(true)
    try {
      const res = await requestComments(`${commentsUrl}?sort=${sort}`)
      if (!res.ok) {
        toast.error(COMMENTS_UNAVAILABLE)
        return
      }
      const page = (await res.json()) as CommentsPage
      setComments(page.items)
      setNextCursor(page.next_cursor)
      setLoaded(true)
    } finally {
      setRetrying(false)
    }
  }

  async function create(text: string) {
    const res = await requestComments(commentsUrl, "POST", { text })
    if (res.status === 401) {
      router.push(loginHref(pathname))
      return
    }
    if (res.status === 404) {
      throw new Error(VIDEO_GONE_MESSAGE)
    }
    if (!res.ok) {
      throw new Error(await composerErrorOf(res))
    }
    const created = (await res.json()) as Comment
    setComments((current) => [created, ...current])
    setCount((current) => current + 1)
  }

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <h2 id="comments-heading" className="text-h3 text-foreground">
          {NUMBER.format(count)} {count === 1 ? "Comment" : "Comments"}
        </h2>
        <CommentSortMenu value={sort} onValueChange={changeSort} disabled={sorting || !loaded} />
      </div>
      {loaded ? null : (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-[var(--radius-3)] border border-border p-4"
        >
          <p className="text-body-md text-foreground">{COMMENTS_UNAVAILABLE}</p>
          <Button type="button" variant="outline" disabled={retrying} onClick={() => void retry()}>
            Try again
          </Button>
        </div>
      )}
      <CommentComposer
        isLoggedIn={isLoggedIn}
        returnTo={pathname}
        avatarName={viewerName}
        onSubmit={create}
      />
      {loaded ? (
        <CommentList
          publicId={publicId}
          sort={sort}
          comments={comments}
          nextCursor={nextCursor}
          isLoggedIn={isLoggedIn}
          viewerName={viewerName}
          now={now}
          onCommentsChange={setComments}
          onNextCursorChange={setNextCursor}
          onCountDelta={(delta) => setCount((current) => current + delta)}
        />
      ) : null}
    </section>
  )
}

export { CommentSection }
export type { CommentSectionProps }
