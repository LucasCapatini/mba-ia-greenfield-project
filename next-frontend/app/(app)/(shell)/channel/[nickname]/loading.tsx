// Skeleton of the public channel page (derived): banner, avatar + info row, tabs, sort chips and
// eight cards (266px, 16:9 thumbnail + two lines).
export default function ChannelLoading() {
  return (
    <main className="flex w-full flex-col gap-6 py-6" aria-busy="true" aria-label="Loading the channel">
      <div className="relative w-full">
        <div className="h-80 w-full animate-pulse bg-muted" />
        <div className="absolute top-70 left-8 size-32 animate-pulse rounded-[var(--radius-full)] border border-border bg-muted" />
        <div className="flex flex-col gap-2 pt-6 pr-8 pl-46">
          <div className="h-8 w-64 animate-pulse rounded-[var(--radius-1)] bg-muted" />
          <div className="h-6 w-80 animate-pulse rounded-[var(--radius-1)] bg-muted" />
        </div>
      </div>
      <div className="h-12 w-full border-b border-border" />
      <div className="flex gap-4 pl-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-10 w-20 animate-pulse rounded-[var(--radius-2)] bg-muted" />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-10 px-6">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex w-66.5 flex-col gap-4">
            <div className="aspect-video w-full animate-pulse rounded-[var(--radius-3)] bg-muted" />
            <div className="h-5 w-4/5 animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-[var(--radius-1)] bg-muted" />
          </li>
        ))}
      </ul>
    </main>
  )
}
