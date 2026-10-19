"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { CheckIcon } from "@/components/icons/check-icon"
import { CopyIcon } from "@/components/icons/copy-icon"

const FEEDBACK_MS = 2000

type CopyState = "idle" | "copied" | "error"

type CopyLinkButtonProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Absolute URL written to the clipboard. */
  url: string
}

/**
 * Figma CardVideoConfig › Copy link icon (I156:3122;156:3108): icon-only button beside the public
 * link. Copies the URL (no backend I/O), swaps to a check and announces "Copied" for 2 s.
 */
function CopyLinkButton({ url, className, ...props }: CopyLinkButtonProps) {
  const [state, setState] = React.useState<CopyState>("idle")
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function showFeedback(next: CopyState) {
    if (timer.current) clearTimeout(timer.current)
    setState(next)
    timer.current = setTimeout(() => setState("idle"), FEEDBACK_MS)
  }

  async function copy() {
    try {
      // `navigator.clipboard` is missing outside secure contexts; treat that as a failure too.
      await navigator.clipboard.writeText(url)
      showFeedback("copied")
    } catch {
      showFeedback("error")
    }
  }

  return (
    <span
      data-slot="copy-link-button"
      data-state={state}
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      {...props}
    >
      <IconButton aria-label="Copy link" variant="ghost" size="sm" onClick={copy}>
        {state === "copied" ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </IconButton>
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "text-caption text-muted-foreground",
          state === "error" && "text-destructive"
        )}
      >
        {state === "copied" ? "Copied" : state === "error" ? "Couldn't copy" : ""}
      </span>
    </span>
  )
}

export { CopyLinkButton }
export type { CopyLinkButtonProps }
