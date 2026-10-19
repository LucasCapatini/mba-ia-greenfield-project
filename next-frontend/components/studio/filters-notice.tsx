"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export const INVALID_FILTERS_NOTICE = "invalid-filters"

/**
 * The panel's RSC redirects here with `?notice=invalid-filters` when the upstream rejected the
 * filters or the cursor (`VALIDATION_ERROR`): a discreet toast, then the flag leaves the URL.
 */
function FiltersNotice() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const notice = searchParams.get("notice")

  React.useEffect(() => {
    if (notice !== INVALID_FILTERS_NOTICE) return
    toast.error("Some filters were not valid and were cleared.")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("notice")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [notice, pathname, router, searchParams])

  return null
}

export { FiltersNotice }
