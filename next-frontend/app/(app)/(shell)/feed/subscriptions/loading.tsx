// Skeleton of the subscriptions feed (derived): title and eight cards (16:9 thumbnail, avatar and
// two lines), in the same grid as the page.
export default function SubscriptionsFeedLoading() {
  return (
    <main className="flex w-full flex-col gap-6 px-6 py-6" aria-busy="true" aria-label="Loading subscriptions">
      <div className="h-8 w-48 animate-pulse rounded-[var(--radius-1)] bg-muted" />
      <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex flex-col gap-4">
            <div className="aspect-video w-full animate-pulse rounded-[var(--radius-4)] bg-muted" />
            <div className="flex gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-[var(--radius-full)] bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-5 w-4/5 animate-pulse rounded-[var(--radius-1)] bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded-[var(--radius-1)] bg-muted" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
