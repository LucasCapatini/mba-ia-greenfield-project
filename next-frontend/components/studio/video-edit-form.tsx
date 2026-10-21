"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { loginHref } from "@/lib/auth/return-to"
import { cn } from "@/lib/utils"
import type {
  ApiErrorEnvelope,
  Category,
  UpdateVideoRequest,
  Video,
  VideoUpdateResult,
} from "@/lib/api/contracts"
import { useProcessingPoll } from "@/hooks/use-processing-poll"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionHeader } from "@/components/ui/section-header"
import { Textarea } from "@/components/ui/textarea"
import { FieldError } from "@/components/auth/field-error"
import { CategorySelect } from "@/components/studio/category-select"
import { CopyLinkButton } from "@/components/studio/copy-link-button"
import { PrivacyOption } from "@/components/studio/privacy-option"
import { ThumbnailPreview } from "@/components/studio/thumbnail-preview"
import { ThumbnailUploadButton } from "@/components/studio/thumbnail-upload-button"
import { VideoChecksStatus } from "@/components/studio/video-checks-status"
import { VideoConfigCard } from "@/components/studio/video-config-card"
import { VideoPreview } from "@/components/studio/video-preview"

// Client-side mirror of `UpdateVideoDto` (title 1..100 after trim, description ≤ 5000,
// category uuid or none, visibility public|unlisted) — per phase-02-auth-frontend/TD-04.
export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 5000
const videoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`),
  description: z
    .string()
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer`),
  category_id: z.uuid("Choose a valid category").nullable(),
  visibility: z.enum(["public", "unlisted"]),
})

type VideoFormValues = z.infer<typeof videoSchema>

export const SAVE_MESSAGES = {
  published: "Video published",
  draft: "Changes saved — the video stays a draft until processing finishes",
  saved: "Changes saved",
} as const

function valuesOf(video: Video): VideoFormValues {
  return {
    title: video.title,
    description: video.description ?? "",
    category_id: video.category?.id ?? null,
    visibility: video.visibility,
  }
}

function messageOf(envelope: ApiErrorEnvelope | null, fallback: string): string {
  if (!envelope) return fallback
  return Array.isArray(envelope.message) ? envelope.message.join("; ") : envelope.message
}

type VideoEditFormProps = Omit<React.ComponentProps<"form">, "children" | "onSubmit"> & {
  video: Video
  categories: Category[]
  /** App origin for the public link (`${origin}/watch/{publicId}`, OQ-5). */
  origin: string
  /** Signed stream URL for the preview (only when `ready`). */
  streamUrl?: string | null
  /** ISO expiry of `streamUrl`; the preview player renews the URL after it. */
  streamExpiresAt?: string | null
  /** Replaces the default "Cancel" button (e.g. the upload screen's cancel-with-dialog). */
  cancelAction?: React.ReactNode
  /**
   * Poll `GET /api/videos/{id}` while the video is `uploading|processing` (TD-12). The upload
   * screen turns it off because its status row already polls.
   */
  pollProcessing?: boolean
}

/**
 * Video details form shared by the upload-processing screen (156:2136) and the edit screen
 * (156:2796): "Details" (Title, Description), Thumbnail, Category and Visibility on the left
 * (gap 18px), CardVideoConfig on the right (64px apart), and the footer with the checks status
 * and Cancel / Save Changes.
 *
 * Save → `PATCH /api/videos/{publicId}` with `publish: true` (the BFF chains the publish when the
 * draft is ready, video-channel-management/TD-03) → toast by `published` → `router.refresh()`.
 * Fields validate as they change; Save stays disabled until the form is dirty and valid.
 */
function VideoEditForm({
  video,
  categories,
  origin,
  streamUrl = null,
  streamExpiresAt = null,
  cancelAction,
  pollProcessing = true,
  className,
  ...props
}: VideoEditFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const ids = React.useId()
  const titleId = `${ids}-title`
  const descriptionId = `${ids}-description`
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const watchUrl = `${origin}/watch/${video.public_id}`

  const inFlight = video.processing_status === "uploading" || video.processing_status === "processing"
  useProcessingPoll(pollProcessing && inFlight ? [video.public_id] : [])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: valuesOf(video),
    mode: "onChange",
  })
  const descriptionLength = useWatch({ control, name: "description" })?.length ?? 0

  function toLogin() {
    router.push(loginHref(pathname))
  }

  async function save(values: VideoFormValues): Promise<void> {
    const body: UpdateVideoRequest = {
      title: values.title,
      description: values.description.trim() === "" ? null : values.description,
      category_id: values.category_id,
      visibility: values.visibility,
      publish: true,
    }
    let response: Response
    try {
      response = await fetch(`/api/videos/${video.public_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } catch {
      toast.error("Could not save the changes. Check your connection and try again.")
      return
    }

    if (response.status === 401) {
      toLogin()
      return
    }
    if (!response.ok) {
      const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
      const message = messageOf(envelope, "Could not save the changes")
      switch (envelope?.error) {
        case "CATEGORY_NOT_FOUND":
          setError("category_id", { message: "This category no longer exists" })
          return
        case "VALIDATION_ERROR":
          if (/title/i.test(message)) setError("title", { message })
          else if (/description/i.test(message)) setError("description", { message })
          else setError("root.serverError", { message })
          return
        case "VIDEO_FORBIDDEN":
        case "VIDEO_NOT_FOUND":
          toast.error("This video is no longer available.")
          router.push("/studio/videos")
          return
        case "STORAGE_UNAVAILABLE":
          toast.error("Storage is temporarily unavailable.", {
            action: { label: "Retry", onClick: () => void save(values) },
          })
          return
        default:
          toast.error(message)
          return
      }
    }

    const result = (await response.json()) as VideoUpdateResult
    if (result.published) {
      toast.success(SAVE_MESSAGES.published)
    } else if (result.video.status === "draft" && result.video.processing_status !== "ready") {
      toast.success(SAVE_MESSAGES.draft)
    } else {
      toast.success(SAVE_MESSAGES.saved)
    }
    reset(valuesOf(result.video))
    router.refresh()
  }

  function cancel() {
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    router.push("/studio/videos")
  }

  return (
    <form
      data-slot="video-edit-form"
      noValidate
      onSubmit={handleSubmit(save)}
      className={cn("flex w-full flex-col gap-6", className)}
      {...props}
    >
      {/* Single column below `md`, the config card under the fields (home-search-production/TD-05). */}
      <div className="flex w-full flex-col items-start gap-8 md:flex-row md:gap-16">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4.5">
          <h2 className="text-h2 text-foreground">Details</h2>

          {errors.root?.serverError?.message ? (
            <p role="alert" className="text-label-md text-destructive">
              {errors.root.serverError.message}
            </p>
          ) : null}

          <div className="flex w-full flex-col gap-1">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? `${titleId}-error` : undefined}
              {...register("title")}
            />
            <FieldError id={`${titleId}-error`} message={errors.title?.message} />
          </div>

          <div className="flex w-full flex-col gap-1">
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={`${descriptionId}-counter${errors.description ? ` ${descriptionId}-error` : ""}`}
              className="h-48 resize-none [field-sizing:fixed]"
              {...register("description")}
            />
            <div className="flex justify-between gap-4">
              <FieldError id={`${descriptionId}-error`} message={errors.description?.message} />
              <p
                id={`${descriptionId}-counter`}
                className={cn(
                  "ml-auto text-caption text-muted-foreground",
                  descriptionLength > DESCRIPTION_MAX && "text-destructive"
                )}
              >
                {descriptionLength}/{DESCRIPTION_MAX}
              </p>
            </div>
          </div>

          <SectionHeader
            id={`${ids}-thumbnail`}
            title="Thumbnail"
            description="Select or upload a picture that shows what's in your video."
          />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <ThumbnailPreview
              src={video.thumbnail_url}
              alt={`Thumbnail of ${video.title}`}
              durationSeconds={video.duration_seconds}
            />
            <ThumbnailUploadButton
              publicId={video.public_id}
              hasCustomThumbnail={video.has_custom_thumbnail}
            />
          </div>

          <SectionHeader
            id={`${ids}-category`}
            title="Category"
            description="Add your video to a category so viewers can find it more easily."
          />
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <CategorySelect
                  categories={categories}
                  value={field.value}
                  onValueChange={field.onChange}
                  name={field.name}
                  aria-invalid={errors.category_id ? true : undefined}
                  aria-describedby={`${ids}-category-description`}
                />
              )}
            />
            <FieldError message={errors.category_id?.message} />
          </div>

          <SectionHeader
            id={`${ids}-visibility`}
            title="Visibility"
            description="Choose who can see your video."
          />
          <Controller
            control={control}
            name="visibility"
            render={({ field }) => (
              <PrivacyOption
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                aria-describedby={`${ids}-visibility-description`}
              />
            )}
          />
        </div>

        <VideoConfigCard
          publicId={video.public_id}
          origin={origin}
          originalFilename={video.original_filename}
          processingStatus={video.processing_status}
          height={video.height}
          preview={
            <VideoPreview
              title={video.title}
              publicId={video.public_id}
              streamUrl={streamUrl}
              expiresAt={streamExpiresAt}
              posterUrl={video.thumbnail_url}
              durationSeconds={video.duration_seconds}
            />
          }
          copyAction={<CopyLinkButton url={watchUrl} />}
        />
      </div>

      <div className="flex w-full flex-col items-stretch gap-4 border-t border-border pt-4.5 sm:flex-row sm:items-center sm:justify-between">
        <VideoChecksStatus
          processingStatus={video.processing_status}
          status={video.status}
          processingError={video.processing_error}
          publishedAt={video.published_at}
        />
        <div className="flex items-center justify-end gap-6">
          {cancelAction ?? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="min-w-42"
            disabled={!isDirty || !isValid || isSubmitting}
            data-loading={isSubmitting ? "true" : undefined}
          >
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>Your unsaved changes to this video will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Keep editing
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={() => router.push("/studio/videos")}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

export { VideoEditForm }
export type { VideoEditFormProps }
