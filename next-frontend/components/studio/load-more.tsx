"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

type LoadMoreProps = { nextCursor: string }

/**
 * "Load more" of the panel (not drawn — derived from TD-06): keeps every filter and asks the RSC
 * for the next keyset page through `cursor=next_cursor`; `OwnerVideoList` appends the rows.
 */
function LoadMore({ nextCursor }: LoadMoreProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  function loadMore() {
    const params = new URLSearchParams(searchParams.toString())
    params.set("cursor", nextCursor)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex justify-center">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={loadMore}
        disabled={pending}
        data-loading={pending ? "true" : undefined}
      >
        {pending ? "Loading…" : "Load more"}
      </Button>
    </div>
  )
}

export { LoadMore }
