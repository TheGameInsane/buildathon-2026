import { useOutletContext } from "react-router-dom"
import type { Campaign } from "@/types/domain"

export interface CampaignContext {
  campaign: Campaign
}

/** Every Campaign Detail tab route reads the shared campaign object from here instead of re-fetching it. */
export function useCampaignContext() {
  return useOutletContext<CampaignContext>()
}
