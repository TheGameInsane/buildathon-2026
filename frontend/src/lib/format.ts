/** "Ada Cho" -> "ada-cho". Used to derive stand-in URLs/emails in mock data. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, "-")
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
]

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/** "2 min ago", "just now" — used anywhere a timestamp needs to read at a glance. */
export function timeAgo(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 5) return "just now"

  for (const [unit, secondsInUnit] of UNITS) {
    if (abs >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(seconds / secondsInUnit), unit)
    }
  }
  return "just now"
}

const compactNumberFormat = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })

/** "1.2k" instead of "1,284" — anywhere a large count needs to fit a fixed-width container without wrapping. */
export function formatCompactNumber(value: number): string {
  return compactNumberFormat.format(value)
}

/** "3h 20m left", "Overdue by 40m" — for an action-window countdown badge. */
export function timeUntil(deadline: string | Date): { label: string; expired: boolean; minutesLeft: number } {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline
  const minutesLeft = Math.round((date.getTime() - Date.now()) / 60_000)
  const expired = minutesLeft <= 0
  const minutes = Math.abs(minutesLeft)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  return { label: expired ? `Overdue by ${duration}` : `${duration} left`, expired, minutesLeft }
}
