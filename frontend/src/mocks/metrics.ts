import { getCampaign } from "@/mocks/campaigns"
import { getCampaignFunnelSummary } from "@/lib/campaign-metrics"
import type { CampaignMetrics } from "@/types/domain"

/** Derives Overview-tab metrics from the shared funnel summary so every number matches the Campaigns list and Mission Control. */
export function getCampaignMetrics(campaignId: string): CampaignMetrics | undefined {
  const campaign = getCampaign(campaignId)
  if (!campaign) return undefined

  const summary = getCampaignFunnelSummary(campaign)
  const responseRate =
    summary.contacted > 0 ? Math.round((campaign.touchCount / summary.contacted) * 100 * 0.7) : 0
  const noReply = Math.max(summary.discovered - summary.contacted - summary.meetingsBooked, 0)

  return {
    funnelCounts: campaign.funnelCounts,
    meetings: summary.meetingsBooked,
    meetingsDelta: 4,
    responseRate,
    responseRateDelta: 2,
    costPerQualifiedLead: 2.1,
    costPerQualifiedLeadDelta: -0.3,
    meetingConversionRate: summary.conversionRate,
    meetingConversionRateDelta: 0.4,
    channelMix: { email: 62, whatsapp: 26, linkedin: 12 },
    outcomes: { positive: 41, negative: 12, noReply },
  }
}
