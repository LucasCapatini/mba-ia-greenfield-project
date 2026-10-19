"use client"

import * as React from "react"
import Link from "next/link"

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon"

type VideoRowActionsProps = {
  publicId: string
  title: string
  status: "draft" | "published"
  processingStatus: "uploading" | "processing" | "ready" | "failed"
  /** Mutations are injected by the screen (BFF + `router.refresh()`); the menu never calls the API. */
  onPublish: () => void | Promise<void>
  onUnpublish: () => void | Promise<void>
  onDelete: () => void | Promise<void>
  /** Defaults to the edit page of this video. */
  editHref?: string
}

type PendingAction = "publish" | "unpublish" | "delete" | null

/**
 * Figma VideoList kebab (I158:3096;108:331): icon-only trigger whose menu is not drawn. Per the
 * owner's decision it holds Edit, Publish/Unpublish (by `status`) and Delete behind a confirmation
 * dialog. Publishing requires a ready video (TD-02), so Publish is disabled until then.
 */
function VideoRowActions({
  publicId,
  title,
  status,
  processingStatus,
  onPublish,
  onUnpublish,
  onDelete,
  editHref = `/studio/videos/${publicId}/edit`,
}: VideoRowActionsProps) {
  const [pending, setPending] = React.useState<PendingAction>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const canPublish = processingStatus === "ready"

  async function run(action: Exclude<PendingAction, null>, callback: () => void | Promise<void>) {
    setPending(action)
    try {
      await callback()
      return true
    } catch {
      // The screen reports the failure (toast); the menu only leaves the busy state.
      return false
    } finally {
      setPending(null)
    }
  }

  async function confirmDelete() {
    const ok = await run("delete", onDelete)
    if (ok) setConfirmOpen(false)
  }

  return (
    <>
      {/* Non-modal menu: opening the confirmation dialog from an item would otherwise leave
          the body with pointer-events disabled by the closing menu. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton
            aria-label="Video actions"
            variant="ghost"
            size="sm"
            aria-busy={pending ? true : undefined}
            disabled={pending !== null}
          >
            <MoreVerticalIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={editHref}>Edit</Link>
          </DropdownMenuItem>
          {status === "published" ? (
            <DropdownMenuItem onSelect={() => void run("unpublish", onUnpublish)}>
              Unpublish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={!canPublish}
              onSelect={() => void run("publish", onPublish)}
            >
              {canPublish ? "Publish" : "Publish (available when processing finishes)"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={(open) => pending !== "delete" && setConfirmOpen(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete video?</DialogTitle>
            <DialogDescription>
              &ldquo;{title}&rdquo; and its files will be permanently deleted. This can&rsquo;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending === "delete"}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending === "delete"}
              aria-busy={pending === "delete" ? true : undefined}
            >
              {pending === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { VideoRowActions }
export type { VideoRowActionsProps }
