"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import type { UploadState, Video } from "@/lib/api/contracts"
import { useProcessingPoll } from "@/hooks/use-processing-poll"
import { describeProcessingError } from "@/lib/processing-error"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { VideoFileIcon } from "@/components/icons/video-file-icon"
import { UploadStatusBadge, type UploadStatus } from "@/components/upload/upload-status-badge"
import { useUpload } from "@/components/upload/upload-provider"

type UploadStatusRowProps = Omit<React.ComponentProps<"div">, "children"> & {
  fileName: string
  status: UploadStatus
  /** Multipart upload progress 0–100 (only meaningful while uploading). */
  progress?: number
  /** Worker code from `processing_error` when failed. */
  processingError?: string | null
  /** Overrides the status line (e.g. "Upload interrupted — select the file again to resume"). */
  message?: string
}

function clampPercent(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function statusLine(status: UploadStatus, percent: number, processingError: string | null) {
  switch (status) {
    case "uploading":
      return `Uploading… ${percent}%`
    case "processing":
      return "Processing…"
    case "ready":
      return "Upload complete. Your video is ready."
    case "failed":
      return `Failed: ${describeProcessingError(processingError)}`
  }
}

/**
 * Figma "upload info row" (157:1931): video_file icon, file name (body-md) over the status line
 * (caption, muted, live region), status label on the right and a 4px ProgressLinear below.
 * Upload shows the real percentage; processing switches to the indeterminate bar.
 */
function UploadStatusRow({
  fileName,
  status,
  progress,
  processingError = null,
  message,
  className,
  ...props
}: UploadStatusRowProps) {
  const percent = clampPercent(progress)
  const progressValue = status === "uploading" ? percent : status === "processing" ? null : 100

  return (
    <div
      data-slot="upload-status-row"
      data-status={status}
      className={cn("flex w-full flex-col gap-2 border-b border-border pb-4", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <VideoFileIcon className="size-6 shrink-0 text-foreground" />
          <div className="flex min-w-0 flex-col gap-1">
            <p title={fileName} className="truncate text-body-md text-foreground">
              {fileName}
            </p>
            <p
              aria-live="polite"
              data-slot="upload-status-message"
              className={cn(
                "text-caption text-muted-foreground",
                status === "failed" && "text-destructive"
              )}
            >
              {message ?? statusLine(status, percent, processingError)}
            </p>
          </div>
        </div>
        <UploadStatusBadge status={status} />
      </div>
      {status === "failed" ? null : (
        <Progress
          value={progressValue}
          aria-label={status === "uploading" ? "Upload progress" : "Processing progress"}
          className="my-1"
        />
      )}
    </div>
  )
}

const INTERRUPTED = "Upload interrupted — select the file again to resume"

type UploadStatusRowLiveProps = Omit<UploadStatusRowProps, "fileName" | "status" | "progress" | "processingError" | "message"> & {
  video: Pick<Video, "public_id" | "original_filename" | "processing_status" | "processing_error">
}

/**
 * The upload-processing status row wired to the live sources (video-channel-management/TD-11,
 * TD-12): the multipart progress from `UploadProvider` while the file is being sent; after the
 * `complete` 202 a `router.refresh()` so the RSC reflects `processing`, then
 * `useProcessingPoll` until `ready|failed`. Without an upload in flight and with the
 * session still active (page reload), it offers to resume with the same file.
 */
function UploadStatusRowLive({ video, ...props }: UploadStatusRowLiveProps) {
  const router = useRouter()
  const publicId = video.public_id
  const { upload, resume } = useUpload(publicId)
  const resumeInputId = React.useId()
  const [interrupted, setInterrupted] = React.useState(false)

  const inFlight = upload?.status === "uploading"
  const uploadDone = upload?.status === "completed"
  const serverStatus = video.processing_status
  // Upload finished but the RSC still has the `uploading` snapshot: show processing meanwhile.
  const status: UploadStatus =
    inFlight ? "uploading" : uploadDone && serverStatus === "uploading" ? "processing" : serverStatus

  // One RSC refresh once the multipart upload completes (status moves to `processing`).
  React.useEffect(() => {
    if (uploadDone) {
      router.refresh()
    }
  }, [uploadDone, router])

  useProcessingPoll(!inFlight && status === "processing" ? [publicId] : [])

  // Reloaded page: no upload in this tab but the multipart session may still be open.
  const checkSession = serverStatus === "uploading" && !upload
  React.useEffect(() => {
    if (!checkSession) {
      return
    }
    let cancelled = false
    void (async () => {
      const response = await fetch(`/api/videos/${publicId}/upload`).catch(() => null)
      if (!response?.ok || cancelled) return
      const state = (await response.json()) as UploadState
      if (!cancelled) setInterrupted(state.state === "active")
    })()
    return () => {
      cancelled = true
    }
  }, [checkSession, publicId])

  let message: string | undefined
  if (upload?.status === "failed") {
    message = upload.errorCode === "UPLOAD_NOT_ACTIVE" ? "This upload session is no longer active." : (upload.error ?? undefined)
  } else if (checkSession && interrupted) {
    message = INTERRUPTED
  }

  const showResume = (checkSession && interrupted) || (upload?.status === "failed" && upload.errorCode !== "UPLOAD_NOT_ACTIVE")

  return (
    <div className="flex w-full flex-col gap-3">
      <UploadStatusRow
        fileName={video.original_filename}
        status={upload?.status === "failed" ? "failed" : status}
        progress={upload?.progress}
        processingError={video.processing_error}
        message={message}
        {...props}
      />
      {upload?.status === "failed" && upload.errorCode === "UPLOAD_NOT_ACTIVE" ? (
        <p role="alert" className="text-label-md text-destructive">
          The upload can no longer continue.{" "}
          <Link href="/studio/videos" className="text-link underline-offset-4 hover:underline">
            Back to your videos
          </Link>
        </p>
      ) : null}
      {showResume ? (
        <div className="flex items-center gap-3">
          <input
            id={resumeInputId}
            type="file"
            accept="video/mp4,video/webm"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) {
                setInterrupted(false)
                resume(file)
              }
            }}
          />
          <Button asChild variant="outline">
            <label htmlFor={resumeInputId}>Select file to resume</label>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export { UploadStatusRow, UploadStatusRowLive }
export type { UploadStatusRowProps }
