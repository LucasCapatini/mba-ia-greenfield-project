"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon"

type CommentActionsMenuProps = {
  /** `viewer_is_author` of the comment (social-interactions/TD-06, Revisions 2026-10-20). */
  viewerIsAuthor: boolean
  /** Replies that go away with this comment when it is a root (TD-07). */
  replyCount?: number
  onEdit: () => void
  /** Injected by the comment list (BFF `DELETE`); the menu never calls the API. */
  onDelete: () => void | Promise<void>
}

/**
 * Author-only "⋮" of a comment (not drawn — phase 06 resolution OQ-2): Edit swaps the text for the
 * composer; Delete asks for confirmation first, warning that the replies go too (TD-07). Nothing is
 * rendered for other viewers — the API still answers 403 COMMENT_FORBIDDEN to them.
 */
function CommentActionsMenu({ viewerIsAuthor, replyCount = 0, onEdit, onDelete }: CommentActionsMenuProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  if (!viewerIsAuthor) return null

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete()
      setConfirmOpen(false)
    } catch {
      // The list reports the failure (toast); the dialog only leaves the busy state.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Non-modal menu: opening the dialog from an item would otherwise leave the body with
          pointer-events disabled by the closing menu. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="Comment actions" variant="ghost" size="sm" disabled={deleting}>
            <MoreVerticalIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete comment?</DialogTitle>
            <DialogDescription>
              {replyCount > 0
                ? `This comment and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"} will be permanently deleted.`
                : "This comment will be permanently deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              aria-busy={deleting ? true : undefined}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { CommentActionsMenu }
export type { CommentActionsMenuProps }
