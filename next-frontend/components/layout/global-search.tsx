"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { SearchInput } from "@/components/ui/search-input"
import { ArrowBackIcon } from "@/components/icons/arrow-back-icon"
import { SearchIcon } from "@/components/icons/search-icon"

/** `q` is trimmed and capped at 100 characters before it reaches the URL (home-search-production/TD-02). */
const SEARCH_QUERY_MAX_LENGTH = 100

type GlobalSearchProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Current term on `/results`, shown as the field's starting value. */
  initialQuery?: string
}

/**
 * Header search (Figma TopNav 62:1879 + 62:1881). Submitting (Enter or the button) navigates to
 * `/results?q=<term>`; an empty or whitespace-only field does not submit and there is no
 * autocomplete (home-search-production/TD-02, Revisions 2026-10-20). Below `md` it collapses into
 * a search icon that expands the field over the header.
 */
function GlobalSearch({ initialQuery = "", className, ...props }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState(initialQuery)
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH)
    if (!term) return
    setExpanded(false)
    router.push(`/results?q=${encodeURIComponent(term)}`)
  }

  return (
    <div data-slot="global-search" className={cn("flex min-w-0 items-center", className)} {...props}>
      <IconButton
        aria-label="Search"
        aria-expanded={expanded}
        className={cn("md:hidden", expanded && "hidden")}
        onClick={() => setExpanded(true)}
      >
        <SearchIcon />
      </IconButton>
      <form
        role="search"
        aria-label="Search videos"
        onSubmit={handleSubmit}
        data-expanded={expanded ? "true" : "false"}
        className={cn(
          "min-w-0 flex-1 items-center gap-2",
          expanded
            ? "absolute inset-0 z-10 flex bg-background px-4 md:static md:px-0"
            : "hidden md:flex"
        )}
      >
        <IconButton
          aria-label="Close search"
          className="md:hidden"
          onClick={() => setExpanded(false)}
        >
          <ArrowBackIcon />
        </IconButton>
        <div className="relative min-w-0 flex-1">
          <SearchInput
            ref={inputRef}
            aria-label="Search"
            placeholder="Search"
            name="q"
            maxLength={SEARCH_QUERY_MAX_LENGTH}
            value={query}
            onValueChange={setQuery}
          />
          {/* Figma 62:1881 has a single magnifier, the submit: while the field is empty it is the
              field's own search segment; with text that segment becomes "Clear search", so the
              submit moves next to the field. */}
          {query ? null : (
            <button
              type="submit"
              aria-label="Submit search"
              className="absolute inset-y-0 right-0 w-18 rounded-r-[var(--radius-full)] outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>
        {query ? (
          <IconButton type="submit" aria-label="Submit search" variant="secondary" size="lg">
            <SearchIcon />
          </IconButton>
        ) : null}
      </form>
    </div>
  )
}

export { GlobalSearch, SEARCH_QUERY_MAX_LENGTH }
export type { GlobalSearchProps }
