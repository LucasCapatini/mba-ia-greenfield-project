// Skeleton of the panel (not drawn — derived, OQ-7): header, filter row and six rows shaped like
// `VideoListItem` (256×144 thumbnail + title/description/metrics lines).
export default function StudioVideosLoading() {
  return (
    <main className="flex w-full flex-col" aria-busy="true" aria-label="Loading your videos">
      <div className="flex w-full items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-56 animate-pulse rounded-[var(--radius-1)] bg-muted" />
          <div className="h-5 w-64 animate-pulse rounded-[var(--radius-1)] bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-[var(--radius-full)] bg-muted" />
      </div>
      <div className="flex w-full items-center gap-3 border-b border-border px-6 py-4">
        <div className="h-10 w-28 animate-pulse rounded-[var(--radius-4)] bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded-[var(--radius-4)] bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded-[var(--radius-4)] bg-muted" />
      </div>
      <ul className="flex w-full flex-col gap-6 px-6 pt-3 pb-6">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex items-center gap-4 border-b border-border pb-4">
            <div className="h-36 w-64 shrink-0 animate-pulse rounded-[var(--radius-2)] bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-6 w-2/3 animate-pulse rounded-[var(--radius-1)] bg-muted" />
              <div className="h-5 w-1/2 animate-pulse rounded-[var(--radius-1)] bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded-[var(--radius-1)] bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
