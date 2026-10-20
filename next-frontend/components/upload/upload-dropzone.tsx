"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import type { ApiErrorEnvelope, CreateVideoInput, VideoCreated } from "@/lib/api/contracts"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { VideoFileIcon } from "@/components/icons/video-file-icon"
import { useUploads } from "@/components/upload/upload-provider"

export type UploadDropzoneState = "idle" | "dragging" | "creating" | "error"

// Client-side mirror of `POST /videos` (phase-03-videos/TD-03, TD-14).
const ACCEPTED_TYPES = ["video/mp4", "video/webm"] as const
const ACCEPT = ACCEPTED_TYPES.join(",")
export const MAX_VIDEO_BYTES = 10 * 1024 ** 3
const MAX_FILENAME_LENGTH = 255

const MESSAGES = {
  unsupported: "Only MP4 and WebM files are supported",
  tooLarge: "Files must be 10 GB or smaller",
  empty: "The selected file is empty",
  filename: "File names must be 255 characters or fewer",
  storage: "Storage is temporarily unavailable. Try again in a moment.",
  generic: "Something went wrong while starting the upload. Try again.",
} as const

type Failure = { message: string; retryable: boolean }
/** Falha exibida; `retryFile` presente quando o erro é transitório e vale tentar de novo. */
type ShownFailure = { message: string; retryFile: File | null }

/** Erro de validação local (antes de qualquer chamada) ou `null` quando o arquivo é aceito. */
export function validateVideoFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return MESSAGES.unsupported
  }
  if (file.size < 1) {
    return MESSAGES.empty
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return MESSAGES.tooLarge
  }
  if (file.name.length < 1 || file.name.length > MAX_FILENAME_LENGTH) {
    return MESSAGES.filename
  }
  return null
}

function failureFrom(envelope: ApiErrorEnvelope | null): Failure {
  switch (envelope?.error) {
    case "VIDEO_UNSUPPORTED_MEDIA_TYPE":
      return { message: MESSAGES.unsupported, retryable: false }
    case "VIDEO_TOO_LARGE":
      return { message: MESSAGES.tooLarge, retryable: false }
    case "STORAGE_UNAVAILABLE":
      return { message: MESSAGES.storage, retryable: true }
    default:
      return { message: MESSAGES.generic, retryable: true }
  }
}

/**
 * File picker of the upload screen (`/studio/upload`). The Figma frame (154:1724) could not be
 * read (MCP quota); the visual follows the UI Contract and the sibling processing screen
 * (156:2110): bordered card, 32px padding, muted instructions, primary "Select file" button. The
 * button is the `<label>` of a real file input, so keyboard and screen readers get the native
 * picker; drag-and-drop decorates the same card.
 *
 * Accepting a file: local validation → `POST /api/videos` → `UploadProvider.start` →
 * `/studio/upload/{publicId}` with the multipart upload already running
 * (video-channel-management/TD-11).
 */
function UploadDropzone({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
  const router = useRouter()
  const { start } = useUploads()
  const inputId = React.useId()
  const statusId = `${inputId}-status`
  const [state, setState] = React.useState<UploadDropzoneState>("idle")
  const [failure, setFailure] = React.useState<ShownFailure | null>(null)
  const busy = state === "creating"

  function fail(file: File, { message, retryable }: Failure) {
    setFailure({ message, retryFile: retryable ? file : null })
    setState("error")
  }

  async function accept(file: File) {
    if (busy) {
      return
    }
    const invalid = validateVideoFile(file)
    if (invalid) {
      fail(file, { message: invalid, retryable: false })
      return
    }
    setFailure(null)
    setState("creating")

    const body: CreateVideoInput = {
      original_filename: file.name,
      content_type: file.type as CreateVideoInput["content_type"],
      size_bytes: file.size,
    }
    let response: Response
    try {
      response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } catch {
      fail(file, { message: MESSAGES.generic, retryable: true })
      return
    }

    if (response.status === 401) {
      router.push("/login?returnTo=/studio/upload")
      return
    }
    if (response.status !== 201) {
      const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
      fail(file, failureFrom(envelope))
      return
    }
    const created = (await response.json()) as VideoCreated
    start(file, created)
    router.push(`/studio/upload/${created.public_id}`)
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Allows picking the same file again after an error.
    event.target.value = ""
    if (file) {
      void accept(file)
    }
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!busy && state !== "dragging") {
      setState("dragging")
    }
  }

  function onDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }
    setState((current) => (current === "dragging" ? (failure ? "error" : "idle") : current))
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) {
      setState(failure ? "error" : "idle")
      return
    }
    void accept(file)
  }

  return (
    <Card
      data-slot="upload-dropzone"
      data-state={state}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "w-full items-center gap-6 border-dashed p-8 text-center transition-colors",
        state === "dragging" && "border-primary bg-muted/40",
        state === "error" && "border-destructive",
        className
      )}
      {...props}
    >
      <VideoFileIcon className="size-12 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-h3 text-foreground">Drag and drop a video file or select one</p>
        <p className="text-body-md text-muted-foreground">MP4 or WebM, up to 10 GB</p>
      </div>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-describedby={statusId}
        aria-invalid={state === "error" || undefined}
        disabled={busy}
        onChange={onInputChange}
      />
      <Button asChild data-loading={busy ? "true" : undefined}>
        <label htmlFor={inputId} aria-disabled={busy || undefined}>
          {busy ? "Creating upload…" : "Select file"}
        </label>
      </Button>
      <div id={statusId} aria-live="polite" className="flex min-h-5 flex-col items-center gap-3">
        {state === "error" && failure ? (
          <>
            <p className="text-label-md text-destructive">{failure.message}</p>
            {failure.retryFile ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => failure.retryFile && void accept(failure.retryFile)}
              >
                Try again
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  )
}

export { UploadDropzone }
