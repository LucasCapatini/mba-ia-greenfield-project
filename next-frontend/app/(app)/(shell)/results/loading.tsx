// Skeleton of the search results while the RSC reads the first page: title + grid placeholders.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading results" className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
      <span className="h-8 w-64 max-w-full animate-pulse rounded-[var(--radius-2)] bg-muted" />
      <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <span className="aspect-video w-full animate-pulse rounded-[var(--radius-3)] bg-muted" />
            <span className="flex gap-3">
              <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-11/12 animate-pulse rounded-[var(--radius-1)] bg-muted" />
                <span className="h-3 w-2/3 animate-pulse rounded-[var(--radius-1)] bg-muted" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
