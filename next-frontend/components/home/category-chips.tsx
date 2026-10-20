import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { filterChipVariants } from "@/components/ui/filter-chip"
import type { Category } from "@/lib/api/contracts"

type CategoryChipsProps = Omit<React.ComponentProps<"nav">, "children"> & {
  /** Categories from `GET /categories`, already in `sort_order`. */
  categories: Category[]
  /** Slug of the active filter; `null` (or unknown) selects "All". */
  activeSlug: string | null
}

/** `/?category=<slug>`, or `/` for "All" (home-search-production/TD-01). */
function categoryHref(slug: string | null): string {
  return slug ? `/?category=${encodeURIComponent(slug)}` : "/"
}

/**
 * Figma Home (Catalog Show 143:948) chips bar: "All" + one FilterChip per category. Each chip is
 * a link — the filter lives in the URL, so changing it is a navigation that re-runs the RSC
 * (home-search-production/TD-01). Scrolls horizontally when it does not fit, with the right edge
 * faded like the frame.
 */
function CategoryChips({ categories, activeSlug, className, ...props }: CategoryChipsProps) {
  const isKnown = categories.some((category) => category.slug === activeSlug)
  const active = isKnown ? activeSlug : null
  const chips = [
    { slug: null, label: "All" },
    ...categories.map((category) => ({ slug: category.slug, label: category.name })),
  ]

  return (
    <nav
      aria-label="Categories"
      data-slot="category-chips"
      className={cn("relative min-w-0", className)}
      {...props}
    >
      <ul className="flex gap-3 overflow-x-auto pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => {
          const isActive = chip.slug === active
          return (
            <li key={chip.slug ?? "all"} className="shrink-0">
              <Link
                href={categoryHref(chip.slug)}
                data-slot="category-chip"
                data-state={isActive ? "active" : "default"}
                aria-current={isActive ? "page" : undefined}
                className={cn(filterChipVariants({ state: isActive ? "active" : "default" }))}
              >
                {chip.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent"
      />
    </nav>
  )
}

export { CategoryChips, categoryHref }
export type { CategoryChipsProps }
