"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { CheckIcon } from "@/components/icons/check-icon"
import { CopyIcon } from "@/components/icons/copy-icon"
import { ShareIcon } from "@/components/icons/share-icon"

const FEEDBACK_MS = 2000

type CopyState = "idle" | "copied" | "error"

type CopyLinkButtonProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Absolute URL written to the clipboard. */
  url: string
  /** `default`: icon-only copy button (studio). `pill`: "Share" pill with the share icon (watch page). */
  variant?: "default" | "pill"
}

/**
 * Figma CardVideoConfig › Copy link icon (I156:3122;156:3108): icon-only button beside the public
 * link. Copies the URL (no backend I/O), swaps to a check and announces "Copied" for 2 s. The
 * `pill` variant is the watch page "Share" action (Video show 152:2219), with the same feedback.
 */
function CopyLinkButton({ url, variant = "default", className, ...props }: CopyLinkButtonProps) {
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
      data-variant={variant}
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      {...props}
    >
      {variant === "pill" ? (
        <Button
          type="button"
          variant="secondary"
          onClick={copy}
          className="rounded-[var(--radius-full)]"
        >
          <ShareIcon />
          Share
        </Button>
      ) : (
        <IconButton aria-label="Copy link" variant="ghost" size="sm" onClick={copy}>
          {state === "copied" ? <CheckIcon className="text-success" /> : <CopyIcon />}
        </IconButton>
      )}
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
