"use client"

import * as React from "react"

import type { VideoListItem as VideoListItemData } from "@/lib/api/contracts"
import { VideoListItem } from "@/components/studio/video-list-item"
import { VideoRowActions } from "@/components/studio/video-row-actions"

type OwnerVideoRowProps = {
  video: VideoListItemData
  /** Mutations (BFF + refresh) owned by the list; a rejected promise keeps the menu/dialog open. */
  onPublish: () => Promise<void>
  onUnpublish: () => Promise<void>
  onDelete: () => Promise<void>
}

/** One row of the owner's panel: `VideoListItem` (title links to the edit page) + kebab menu. */
function OwnerVideoRow({ video, onPublish, onUnpublish, onDelete }: OwnerVideoRowProps) {
  const editHref = `/studio/videos/${video.public_id}/edit`

  return (
    <VideoListItem
      video={video}
      href={editHref}
      data-public-id={video.public_id}
      actions={
        <VideoRowActions
          publicId={video.public_id}
          title={video.title}
          status={video.status}
          processingStatus={video.processing_status}
          editHref={editHref}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
        />
      }
    />
  )
}

export { OwnerVideoRow }
