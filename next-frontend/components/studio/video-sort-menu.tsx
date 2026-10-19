"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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

const OWNER_VIDEO_SORTS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "views", label: "Most viewed" },
] as const

type OwnerVideoSort = (typeof OWNER_VIDEO_SORTS)[number]["value"]

/** `GET /channels/me/videos` accepts latest | oldest | views; anything else is the default. */
function parseOwnerVideoSort(value: string | null | undefined): OwnerVideoSort {
  return OWNER_VIDEO_SORTS.some((option) => option.value === value)
    ? (value as OwnerVideoSort)
    : "latest"
}

type VideoSortMenuProps = { className?: string }

/**
 * Figma "Sort actions" (2726:2139): 16px sort glyph + "Sort by: Latest" (caption, muted), 8px
 * apart. The options are not drawn; they follow the API (`sort=latest|oldest|views`). A new order
 * needs a new keyset cursor (TD-06), so choosing one replaces the URL without `cursor`.
 */
function VideoSortMenu({ className }: VideoSortMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseOwnerVideoSort(searchParams.get("sort"))
  const [selected, setSelected] = React.useOptimistic(current)
  const [, startTransition] = React.useTransition()
  const label = OWNER_VIDEO_SORTS.find((option) => option.value === selected)?.label ?? "Latest"

  function choose(value: string) {
    const next = parseOwnerVideoSort(value)
    if (next === selected) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", next)
    params.delete("cursor")
    startTransition(() => {
      setSelected(next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="video-sort-menu"
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-1)] text-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        <SortIcon className="size-4" />
        Sort by: {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selected} onValueChange={choose}>
          {OWNER_VIDEO_SORTS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { VideoSortMenu, OWNER_VIDEO_SORTS, parseOwnerVideoSort }
export type { OwnerVideoSort }
