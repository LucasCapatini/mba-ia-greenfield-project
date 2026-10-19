import * as React from "react"

import { cn } from "@/lib/utils"
import type { Category, Video } from "@/lib/api/contracts"
import { Card } from "@/components/ui/card"
import { VideoEditForm } from "@/components/studio/video-edit-form"
import { CancelUploadButton } from "@/components/upload/cancel-upload-button"
import { UploadStatusRowLive } from "@/components/upload/upload-status-row"

type UploadVideoFormProps = Omit<React.ComponentProps<"div">, "children"> & {
  video: Video
  categories: Category[]
  origin: string
}

/**
 * Figma "Channel card" (156:2136) of the upload-processing screen: one card (32px padding, 24px
 * gap) with the live upload/processing row on top and the shared `VideoEditForm` below, whose
 * "Cancel" becomes the discard-upload dialog. The details can be saved while the video
 * processes; the BFF publishes on save once it is ready (video-channel-management/TD-03).
 */
function UploadVideoForm({ video, categories, origin, className, ...props }: UploadVideoFormProps) {
  return (
    <Card data-slot="upload-video-form" className={cn("w-full gap-6 p-8", className)} {...props}>
      <UploadStatusRowLive video={video} />
      <VideoEditForm
        key={video.public_id}
        video={video}
        categories={categories}
        origin={origin}
        cancelAction={<CancelUploadButton video={video} />}
        pollProcessing={false}
      />
    </Card>
  )
}

export { UploadVideoForm }
