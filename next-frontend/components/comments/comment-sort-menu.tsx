"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SortIcon } from "@/components/icons/sort-icon"

const COMMENT_SORTS = [
  { value: "latest", label: "Latest" },
  { value: "top", label: "Top" },
] as const

type CommentSort = (typeof COMMENT_SORTS)[number]["value"]

type CommentSortMenuProps = {
  value: CommentSort
  onValueChange: (value: CommentSort) => void
  disabled?: boolean
  className?: string
}

/**
 * Figma Video show "Sort by: Latest" (152:2219): sort glyph + label. The options are not drawn;
 * they follow `GET /videos/{publicId}/comments?sort=latest|top` (social-interactions/TD-06).
 * Controlled — the comment section refetches the first page on change.
 */
function CommentSortMenu({ value, onValueChange, disabled, className }: CommentSortMenuProps) {
  const label = COMMENT_SORTS.find((option) => option.value === value)?.label ?? "Latest"

  function choose(next: string) {
    const option = COMMENT_SORTS.find((candidate) => candidate.value === next)
    if (!option || option.value === value) return
    onValueChange(option.value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        data-slot="comment-sort-menu"
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-1)] text-label-lg text-foreground outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          className
        )}
      >
        <SortIcon className="size-6" />
        Sort by: {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={choose}>
          {COMMENT_SORTS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { CommentSortMenu, COMMENT_SORTS }
export type { CommentSort }
