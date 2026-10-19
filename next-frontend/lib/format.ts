const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** 432 → "432", 5200 → "5.2K", 124000 → "124K", 1200000 → "1.2M". */
export function formatCompactNumber(value: number): string {
  return compactNumber.format(value)
}

/** 630 → "10:30", 3725 → "1:02:05". Negative or non-finite input yields null. */
export function formatDuration(totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return null
  const rounded = Math.round(totalSeconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const seconds = rounded % 60
  const ss = String(seconds).padStart(2, "0")
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
  return `${minutes}:${ss}`
}

// UTC keeps server-rendered and client-rendered output identical.
const mediumDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

/** "2026-10-17T12:00:00Z" → "Oct 17, 2026". */
export function formatDate(date: Date | string): string {
  return mediumDate.format(typeof date === "string" ? new Date(date) : date)
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" })

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
]

/** "2 days ago", "3 hours ago"; anything under a minute is "just now". */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000))
  for (const [unit, unitSeconds] of UNITS) {
    if (elapsedSeconds >= unitSeconds) {
      return relativeTime.format(-Math.floor(elapsedSeconds / unitSeconds), unit)
    }
  }
  return "just now"
}
