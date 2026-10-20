import * as React from "react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { DownloadIcon } from "@/components/icons/download-icon"

type DownloadMenuItemProps = Omit<React.ComponentProps<typeof DropdownMenuItem>, "asChild" | "children"> & {
  /** Signed `download_url` from `GET /videos/{publicId}/playback` (per watch-page/TD-08). */
  downloadUrl: string
}

/**
 * "Download" entry of the watch page "⋮" menu. The storage answers the signed URL with
 * `Content-Disposition: attachment` (phase-03-videos/TD-09), so a plain navigation
 * downloads the file; anyone who can read the video gets the URL, anonymous included (TD-08).
 */
function DownloadMenuItem({ downloadUrl, ...props }: DownloadMenuItemProps) {
  return (
    <DropdownMenuItem asChild data-slot="download-menu-item" {...props}>
      <a href={downloadUrl} download>
        <DownloadIcon />
        Download
      </a>
    </DropdownMenuItem>
  )
}

export { DownloadMenuItem }
export type { DownloadMenuItemProps }
