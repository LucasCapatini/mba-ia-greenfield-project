// Skeleton of the home while the RSC reads the categories and the first page (Figma Home 143:948):
// chips bar + a 1/2/3/4-column grid of card placeholders.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading videos" className="flex w-full flex-col">
      <div className="flex gap-3 overflow-hidden border-b border-border px-4 py-3 sm:px-6">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="h-9 w-20 shrink-0 animate-pulse rounded-[var(--radius-2)] bg-muted" />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-10 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-4">
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
