// Skeleton of Channel Settings (derived): title, header card (banner + avatar + name) and the form.
export default function ChannelSettingsLoading() {
  return (
    <main
      className="flex w-full flex-col gap-6 px-6 pt-8 pb-6"
      aria-busy="true"
      aria-label="Loading your channel"
    >
      <div className="h-8 w-56 animate-pulse rounded-[var(--radius-1)] bg-muted" />
      <div className="flex w-full flex-col overflow-hidden rounded-[var(--radius-2)] border border-border">
        <div className="h-80 w-full animate-pulse bg-muted" />
        <div className="flex items-start gap-6 p-8">
          <div className="size-32 shrink-0 animate-pulse rounded-[var(--radius-full)] bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-8 w-64 animate-pulse rounded-[var(--radius-1)] bg-muted" />
            <div className="h-5 w-40 animate-pulse rounded-[var(--radius-1)] bg-muted" />
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-4 rounded-[var(--radius-2)] border border-border p-8">
        <div className="h-7 w-48 animate-pulse rounded-[var(--radius-1)] bg-muted" />
        <div className="flex gap-5">
          <div className="h-9 flex-1 animate-pulse rounded-[var(--radius-1)] bg-muted" />
          <div className="h-9 flex-1 animate-pulse rounded-[var(--radius-1)] bg-muted" />
        </div>
        <div className="h-36 w-full animate-pulse rounded-[var(--radius-1)] bg-muted" />
      </div>
    </main>
  )
}
