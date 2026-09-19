import type { DailyChannelTouches } from "@/types/domain"

const DAY_LABELS = ["-6d", "-5d", "-4d", "-3d", "-2d", "-1d", "Today"]

/**
 * Cross-campaign touches by channel, last 7 days. A trend view, not a live counter:
 * the Overview page polls this on its own slow interval, separate from the 5s poll
 * used for campaigns/activity. See src/lib/tokens.ts > overviewTrendPollIntervalMs.
 */
export function getOverviewTouchesTrend(): DailyChannelTouches[] {
  const email = [18, 22, 19, 26, 24, 29, 31]
  const whatsapp = [6, 8, 7, 9, 10, 11, 13]
  const linkedin = [4, 5, 6, 5, 7, 8, 9]

  return DAY_LABELS.map((day, i) => ({
    day,
    email: email[i],
    whatsapp: whatsapp[i],
    linkedin: linkedin[i],
  }))
}
