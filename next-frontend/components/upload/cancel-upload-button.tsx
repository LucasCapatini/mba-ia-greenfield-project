"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ApiErrorEnvelope, Video } from "@/lib/api/contracts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useUpload } from "@/components/upload/upload-provider"

type CancelUploadButtonProps = {
  video: Pick<Video, "public_id" | "processing_status">
}

/**
 * "Cancel" of the upload-processing screen: after confirmation, discards the file and the draft.
 * - upload running in this tab → `UploadProvider.cancel()` (aborts the PUTs and calls
 *   `DELETE /api/videos/{id}/upload`);
 * - session still open but no upload here (reloaded page) → `DELETE /api/videos/{id}/upload`;
 * - upload already completed → `DELETE /api/videos/{id}` (the draft goes away).
 * Then back to the panel.
 */
function CancelUploadButton({ video }: CancelUploadButtonProps) {
  const router = useRouter()
  const { upload, cancel } = useUpload(video.public_id)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function discard() {
    setBusy(true)
    try {
      if (upload?.status === "uploading") {
        await cancel()
      } else {
        const sessionOpen = video.processing_status === "uploading" && upload?.status !== "completed"
        const url = sessionOpen
          ? `/api/videos/${video.public_id}/upload`
          : `/api/videos/${video.public_id}`
        const response = await fetch(url, { method: "DELETE" })
        // 404: already gone — nothing left to discard.
        if (!response.ok && response.status !== 404) {
          const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
          toast.error(
            typeof envelope?.message === "string" ? envelope.message : "Could not cancel the upload"
          )
          return
        }
      }
      setOpen(false)
      router.push("/studio/videos")
      router.refresh()
    } catch {
      toast.error("Could not cancel the upload. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancel upload?</DialogTitle>
          <DialogDescription>The file and this draft will be discarded.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Keep uploading
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void discard()}
            disabled={busy}
            data-loading={busy ? "true" : undefined}
          >
            {busy ? "Cancelling…" : "Cancel upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CancelUploadButton }
