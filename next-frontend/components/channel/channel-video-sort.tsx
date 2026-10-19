"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { FilterChip } from "@/components/ui/filter-chip"

const CHANNEL_VIDEO_SORTS = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "oldest", label: "Oldest" },
] as const

type ChannelVideoSort = (typeof CHANNEL_VIDEO_SORTS)[number]["value"]

/** Any value outside latest | popular | oldest falls back to the default (UI Contract). */
function parseChannelVideoSort(value: string | null | undefined): ChannelVideoSort {
  return CHANNEL_VIDEO_SORTS.some((option) => option.value === value)
    ? (value as ChannelVideoSort)
    : "latest"
}

type ChannelVideoSortProps = Omit<React.ComponentProps<"div">, "children" | "role">

/**
 * Figma "Filter chips" (2737:2145): Latest / Popular / Oldest FilterChips, 16px apart, pl-6.
 * The order lives in `?sort=`; changing it replaces the URL without `cursor` (a new order needs
 * a new keyset cursor, TD-06) so the RSC re-reads the listing. Radiogroup semantics with a
 * roving tabindex: arrow keys move focus and selection together.
 */
function ChannelVideoSort({ className, ...props }: ChannelVideoSortProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseChannelVideoSort(searchParams.get("sort"))
  const [selected, setSelected] = React.useOptimistic(current)
  const [isPending, startTransition] = React.useTransition()
  const chipRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  function select(value: ChannelVideoSort) {
    if (value === selected) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", value)
    params.delete("cursor")
    startTransition(() => {
      setSelected(value)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = CHANNEL_VIDEO_SORTS.length - 1
    let next: number | null = null
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1
    if (event.key === "Home") next = 0
    if (event.key === "End") next = last
    if (next === null) return
    event.preventDefault()
    chipRefs.current[next]?.focus()
    select(CHANNEL_VIDEO_SORTS[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Sort videos"
      aria-busy={isPending || undefined}
      data-slot="channel-video-sort"
      className={cn("flex items-start gap-4 pl-6", className)}
      {...props}
    >
      {CHANNEL_VIDEO_SORTS.map((option, index) => {
        const active = option.value === selected
        return (
          <FilterChip
            key={option.value}
            ref={(node) => {
              chipRefs.current[index] = node
            }}
            role="radio"
            active={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </FilterChip>
        )
      })}
    </div>
  )
}

export { ChannelVideoSort, CHANNEL_VIDEO_SORTS, parseChannelVideoSort }
export type { ChannelVideoSort as ChannelVideoSortValue }
