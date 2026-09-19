import { delay } from "@/api/delay"
import { getCampaignMetrics } from "@/mocks/metrics"
import type { CampaignMetrics } from "@/types/domain"

/** GET /campaigns/:id/metrics */
export async function fetchCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined> {
  await delay()
  return getCampaignMetrics(campaignId)
}
