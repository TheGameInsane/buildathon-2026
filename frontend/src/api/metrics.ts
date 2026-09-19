import { delay } from "@/api/delay"
import { getCampaignMetrics } from "@/mocks/metrics"
import { getOverviewTouchesTrend } from "@/mocks/overview-trend"
import type { CampaignMetrics, DailyChannelTouches } from "@/types/domain"

/** GET /campaigns/:id/metrics */
export async function fetchCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined> {
  await delay()
  return getCampaignMetrics(campaignId)
}

/** GET /metrics/overview-touches-trend — a slow-moving trend view, not part of the 5s live poll. */
export async function fetchOverviewTouchesTrend(): Promise<DailyChannelTouches[]> {
  await delay()
  return getOverviewTouchesTrend()
}
