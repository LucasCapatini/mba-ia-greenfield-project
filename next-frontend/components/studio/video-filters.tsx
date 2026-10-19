"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchInput } from "@/components/ui/search-input"
import { StarsIcon } from "@/components/icons/stars-icon"

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MAX_LENGTH = 100
const FILTER_KEYS = ["status", "visibility", "q", "from", "to"] as const
const ALL = "all"

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
] as const
const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
] as const

type Updates = Partial<Record<(typeof FILTER_KEYS)[number], string | null>>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** `from`/`to` are `YYYY-MM-DD`; anything else is ignored, like an unknown enum value. */
function readDate(value: string | null): string {
  return value && DATE_PATTERN.test(value) ? value : ""
}

function pick<T extends { value: string }>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => option.value === value) ?? null
}

function dateRangeLabel(from: string, to: string): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `From ${formatDate(from)}`
  if (to) return `Until ${formatDate(to)}`
  return "Date"
}

type VideoFiltersProps = Omit<React.ComponentProps<"div">, "children">

/**
 * Figma "videos filter row" (152:2163): Filter / Public / Date buttons (secondary, md) on the
 * left and "Search your videos" on the right; px-6 py-4 with a bottom border. The menus behind
 * the buttons are not drawn: status and visibility use dropdown radio menus, the date range a
 * dialog. Every change rewrites `searchParams` without `cursor` (TD-06) so the RSC list reloads.
 */
function VideoFilters({ className, ...props }: VideoFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const status = pick(STATUS_OPTIONS, searchParams.get("status"))
  const visibility = pick(VISIBILITY_OPTIONS, searchParams.get("visibility"))
  const from = readDate(searchParams.get("from"))
  const to = readDate(searchParams.get("to"))

  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "")
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dateOpen, setDateOpen] = React.useState(false)
  const [draftFrom, setDraftFrom] = React.useState(from)
  const [draftTo, setDraftTo] = React.useState(to)
  const [dateError, setDateError] = React.useState<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [])

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key)) || query.trim() !== ""

  function navigate(updates: Updates) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete("cursor")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function cancelPendingSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current)
      searchTimer.current = null
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    cancelPendingSearch()
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null
      navigate({ q: next.trim() || null })
    }, SEARCH_DEBOUNCE_MS)
  }

  function handleQueryClear() {
    cancelPendingSearch()
    navigate({ q: null })
  }

  function handleDateOpenChange(open: boolean) {
    if (open) {
      setDraftFrom(from)
      setDraftTo(to)
      setDateError(null)
    }
    setDateOpen(open)
  }

  function applyDates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setDateError("The start date must be on or before the end date.")
      return
    }
    navigate({ from: draftFrom || null, to: draftTo || null })
    setDateOpen(false)
  }

  function clearDates() {
    navigate({ from: null, to: null })
    setDateOpen(false)
  }

  function clearAll() {
    cancelPendingSearch()
    setQuery("")
    navigate({ status: null, visibility: null, q: null, from: null, to: null })
  }

  return (
    <div
      data-slot="video-filters"
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={status ? "default" : "secondary"}
              size="md"
              data-slot="video-filters-status"
            >
              <StarsIcon />
              {status ? `Status: ${status.label}` : "Filter"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={status?.value ?? ALL}
              onValueChange={(value) => navigate({ status: value === ALL ? null : value })}
            >
              <DropdownMenuRadioItem value={ALL}>All statuses</DropdownMenuRadioItem>
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={visibility ? "default" : "secondary"}
              size="md"
              data-slot="video-filters-visibility"
            >
              {visibility ? visibility.label : "Visibility"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Visibility</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={visibility?.value ?? ALL}
              onValueChange={(value) => navigate({ visibility: value === ALL ? null : value })}
            >
              <DropdownMenuRadioItem value={ALL}>All visibilities</DropdownMenuRadioItem>
              {VISIBILITY_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={dateOpen} onOpenChange={handleDateOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant={from || to ? "default" : "secondary"}
              size="md"
              data-slot="video-filters-date"
            >
              {dateRangeLabel(from, to)}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={applyDates} noValidate className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Filter by date</DialogTitle>
                <DialogDescription>Show videos uploaded within this range.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-4">
                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <Label htmlFor="video-filters-from">From</Label>
                  <Input
                    id="video-filters-from"
                    type="date"
                    value={draftFrom}
                    max={draftTo || undefined}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={dateError ? "video-filters-date-error" : undefined}
                    onChange={(event) => {
                      setDraftFrom(event.target.value)
                      setDateError(null)
                    }}
                  />
                </div>
                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <Label htmlFor="video-filters-to">To</Label>
                  <Input
                    id="video-filters-to"
                    type="date"
                    value={draftTo}
                    min={draftFrom || undefined}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={dateError ? "video-filters-date-error" : undefined}
                    onChange={(event) => {
                      setDraftTo(event.target.value)
                      setDateError(null)
                    }}
                  />
                </div>
              </div>
              {dateError ? (
                <p id="video-filters-date-error" role="alert" className="text-caption text-destructive">
                  {dateError}
                </p>
              ) : null}
              <DialogFooter>
                {from || to ? (
                  <Button type="button" variant="ghost" onClick={clearDates}>
                    Clear dates
                  </Button>
                ) : (
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                )}
                <Button type="submit">Apply</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {hasFilters ? (
          <Button variant="link" onClick={clearAll} data-slot="video-filters-clear">
            Clear filters
          </Button>
        ) : null}
      </div>

      <SearchInput
        aria-label="Search your videos"
        placeholder="Search your videos"
        maxLength={SEARCH_MAX_LENGTH}
        value={query}
        onValueChange={handleQueryChange}
        onClear={handleQueryClear}
        className="w-65"
      />
    </div>
  )
}

export { VideoFilters }
