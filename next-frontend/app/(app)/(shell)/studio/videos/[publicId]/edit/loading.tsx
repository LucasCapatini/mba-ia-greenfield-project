// Skeleton of the edit form (derived): title, then the card with the fields column and the
// 328px CardVideoConfig on the right, and the footer.
export default function EditVideoLoading() {
  return (
    <main
      className="flex w-full flex-col gap-6 px-6 pt-8 pb-6"
      aria-busy="true"
      aria-label="Loading the video"
    >
      <div className="h-8 w-40 animate-pulse rounded-[var(--radius-1)] bg-muted" />
      <div className="flex w-full flex-col gap-6 rounded-[var(--radius-2)] border border-border p-8">
        <div className="flex w-full items-start gap-16">
          <div className="flex min-w-0 flex-1 flex-col gap-4.5">
            <div className="h-7 w-24 animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="h-48 w-full animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="aspect-video w-66.5 animate-pulse rounded-[var(--radius-4)] bg-muted" />
            <div className="h-9 w-full max-w-md animate-pulse rounded-[var(--radius-1-5)] bg-muted" />
          </div>
          <div className="h-96 w-82 shrink-0 animate-pulse rounded-[var(--radius-3)] bg-muted" />
        </div>
        <div className="h-9 w-full animate-pulse rounded-[var(--radius-1)] bg-muted" />
      </div>
    </main>
  )
}
