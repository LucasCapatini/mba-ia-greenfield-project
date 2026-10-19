"use client"

import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { CheckCircleIcon } from "@/components/icons/check-circle-icon"
import { ErrorOutlineIcon } from "@/components/icons/error-outline-icon"

// shadcn `sonner`, reconciled with the project: the theme follows `prefers-color-scheme` (no
// `next-themes` provider in this app), icons come from `components/icons`, and colors/radius are
// the DS tokens (popover surface, border, radius-2).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4 text-success" />,
        error: <ErrorOutlineIcon className="size-4 text-destructive" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-2)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "text-body-md",
          description: "text-caption",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
