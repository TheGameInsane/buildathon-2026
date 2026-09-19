import type { Campaign } from "@/types/domain"

/**
 * Single source of truth for every derived campaign number. Every screen
 * (Overview, Campaigns list, Campaign Detail, charts, filters) reads
 * through this function instead of re-deriving or hardcoding its own numbers,
 * so a discovered/contacted/engaged/meetings count always means the same
 * thing everywhere it's shown.
 */
export interface CampaignFunnelSummary {
  discovered: number
  researched: number
  qualified: number
  contacted: number
  engaged: number
  meetingsBooked: number
  opportunities: number
  /** Prospects who progressed past Contacted: Engaged + Meeting + Opportunity. */
  replied: number
  /** Meetings booked as a percentage of prospects discovered. */
  conversionRate: number
}

export function getCampaignFunnelSummary(campaign: Pick<Campaign, "funnelCounts">): CampaignFunnelSummary {
  const [discovered, researched, qualified, contacted, engaged, meetingsBooked, opportunities] =
    campaign.funnelCounts
  const replied = engaged + meetingsBooked + opportunities
  const conversionRate = discovered > 0 ? Number(((meetingsBooked / discovered) * 100).toFixed(1)) : 0

  return {
    discovered,
    researched,
    qualified,
    contacted,
    engaged,
    meetingsBooked,
    opportunities,
    replied,
    conversionRate,
  }
}
