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
