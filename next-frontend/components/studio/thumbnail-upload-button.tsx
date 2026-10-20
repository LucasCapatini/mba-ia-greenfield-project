"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ApiErrorEnvelope } from "@/lib/api/contracts"
import { loginHref } from "@/lib/auth/return-to"
import { Button } from "@/components/ui/button"
import { StarsIcon } from "@/components/icons/stars-icon"
import { FieldError } from "@/components/auth/field-error"

// Rules of `PUT /videos/{publicId}/thumbnail` (video-channel-management/TD-04).
export const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024

export const THUMBNAIL_MESSAGES = {
  THUMBNAIL_INVALID: "Use a JPEG, PNG or WebP image of at least 640×360",
  THUMBNAIL_TOO_LARGE: "Max 5 MB",
} as const

type ThumbnailUploadButtonProps = {
  publicId: string
  /** Shows "Remove custom thumbnail" (back to the automatic one). */
  hasCustomThumbnail: boolean
}

function messageOf(envelope: ApiErrorEnvelope | null, fallback: string): string {
  if (!envelope) return fallback
  return Array.isArray(envelope.message) ? envelope.message.join("; ") : envelope.message
}

/**
 * "Change Thumbnail" (outline, Figma 156:2616) wrapping a real file input: validates type and size
 * before sending, `PUT /api/videos/{id}/thumbnail` (multipart `file`), then `router.refresh()` so
 * the preview gets the new stable URL (`?v=`, TD-10). With a custom thumbnail it also offers
 * "Remove custom thumbnail" (`DELETE`). Errors of the image stay inline in the Thumbnail section.
 */
function ThumbnailUploadButton({ publicId, hasCustomThumbnail }: ThumbnailUploadButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const inputId = React.useId()
  const errorId = `${inputId}-error`
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null)

  async function send(method: "PUT" | "DELETE", file?: File): Promise<void> {
    setBusy(method === "PUT" ? "upload" : "remove")
    try {
      let body: FormData | undefined
      if (file) {
        body = new FormData()
        body.append("file", file, file.name)
      }
      const response = await fetch(`/api/videos/${publicId}/thumbnail`, { method, body })
      if (response.status === 401) {
        router.push(loginHref(pathname))
        return
      }
      if (!response.ok) {
        const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
        const inline =
          envelope?.error === "THUMBNAIL_INVALID" || envelope?.error === "THUMBNAIL_TOO_LARGE"
            ? THUMBNAIL_MESSAGES[envelope.error]
            : null
        if (inline) {
          setError(inline)
        } else if (envelope?.error === "STORAGE_UNAVAILABLE") {
          toast.error("Storage is temporarily unavailable.", {
            action: { label: "Retry", onClick: () => void send(method, file) },
          })
        } else {
          toast.error(messageOf(envelope, "Could not update the thumbnail"))
        }
        return
      }
      setError(null)
      toast.success(method === "PUT" ? "Thumbnail updated" : "Custom thumbnail removed")
      router.refresh()
    } catch {
      toast.error("Could not update the thumbnail. Try again.")
    } finally {
      setBusy(null)
    }
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!(THUMBNAIL_TYPES as readonly string[]).includes(file.type)) {
      setError(THUMBNAIL_MESSAGES.THUMBNAIL_INVALID)
      return
    }
    if (file.size > THUMBNAIL_MAX_BYTES) {
      setError(THUMBNAIL_MESSAGES.THUMBNAIL_TOO_LARGE)
      return
    }
    setError(null)
    void send("PUT", file)
  }

  return (
    <div data-slot="thumbnail-upload-button" className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={inputId}
          type="file"
          accept={THUMBNAIL_TYPES.join(",")}
          className="sr-only"
          disabled={busy !== null}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={onChange}
        />
        <Button asChild variant="outline" data-loading={busy === "upload" ? "true" : undefined}>
          <label htmlFor={inputId} aria-disabled={busy !== null || undefined}>
            <StarsIcon />
            {busy === "upload" ? "Uploading…" : "Change Thumbnail"}
          </label>
        </Button>
        {hasCustomThumbnail ? (
          <Button
            type="button"
            variant="link"
            onClick={() => void send("DELETE")}
            disabled={busy !== null}
          >
            {busy === "remove" ? "Removing…" : "Remove custom thumbnail"}
          </Button>
        ) : null}
      </div>
      <FieldError id={errorId} role="alert" message={error ?? undefined} />
    </div>
  )
}

export { ThumbnailUploadButton }
