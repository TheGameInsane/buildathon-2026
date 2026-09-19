import { delay } from "@/api/delay"
import { getCampaignSettings, updateCampaignSettings } from "@/mocks/campaign-settings"
import type { CampaignSettingsData } from "@/types/domain"

/** GET /campaigns/:id/settings */
export async function fetchCampaignSettings(campaignId: string): Promise<CampaignSettingsData> {
  await delay()
  return getCampaignSettings(campaignId)
}

/** PATCH /campaigns/:id/settings */
export async function saveCampaignSettings(
  campaignId: string,
  patch: Partial<CampaignSettingsData>,
): Promise<void> {
  await delay()
  updateCampaignSettings(campaignId, patch)
}
