/**
 * `fetchCampaignMetrics` is wired to the real backend (`GET /campaigns/:id/metrics`,
 * backend/api/campaigns.py) — every number is computed live from touches/agent_runs,
 * not sample data. The delta fields (`meetingsDelta`, ...) are honest zeros: nothing
 * stores a historical baseline to diff against yet, so a fabricated trend would be
 * worse than no trend.
 *
 * `fetchOverviewTouchesTrend` (the dashboard-wide trend chart, not per-campaign) has no
 * backend route yet (see docs/api_contract.md's "Not built yet" section) — still on
 * mock data.
 */
import { apiFetch } from "@/lib/api-client"
import { FUNNEL_KEYS } from "@/api/campaigns"
import { delay } from "@/api/delay"
import { getOverviewTouchesTrend } from "@/mocks/overview-trend"
import type { CampaignMetrics, Channel, DailyChannelTouches } from "@/types/domain"

interface BackendCampaignMetrics {
  funnel: Record<string, number>
  outreach: Record<string, { sent: number; replies: number }>
  outcomes: {
    positive: number
    negative: number
    no_reply: number
    meetings: number
    opportunities: number
    conversion_rate: number
  }
  cost: { total_usd: number; per_prospect: number; per_qualified_lead: number; per_conversation: number }
  response_rates: { reply_rate: number; positive_reply_rate: number; meeting_rate: number }
  touches_sent_today: number
  prospects_researched_today: number
}

function toChannelMix(outreach: BackendCampaignMetrics["outreach"]): Partial<Record<Channel, number>> {
  const totalSent = Object.values(outreach).reduce((sum, o) => sum + o.sent, 0)
  if (totalSent === 0) return {}
  const mix: Partial<Record<Channel, number>> = {}
  for (const [channel, o] of Object.entries(outreach)) {
    mix[channel as Channel] = Math.round((o.sent / totalSent) * 100)
  }
  return mix
}

/** GET /campaigns/:id/metrics */
export async function fetchCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const row = await apiFetch<BackendCampaignMetrics>(`/campaigns/${campaignId}/metrics`)
  const funnelCounts = FUNNEL_KEYS.map((key) => row.funnel[key] ?? 0) as CampaignMetrics["funnelCounts"]

  return {
    funnelCounts,
    touchesSentToday: row.touches_sent_today,
    prospectsResearchedToday: row.prospects_researched_today,
    meetings: row.outcomes.meetings,
    meetingsDelta: 0,
    responseRate: row.response_rates.reply_rate,
    responseRateDelta: 0,
    costPerQualifiedLead: row.cost.per_qualified_lead,
    costPerQualifiedLeadDelta: 0,
    meetingConversionRate: row.response_rates.meeting_rate,
    meetingConversionRateDelta: 0,
    channelMix: toChannelMix(row.outreach),
    outcomes: {
      positive: row.outcomes.positive,
      negative: row.outcomes.negative,
      noReply: row.outcomes.no_reply,
    },
  }
}

/** GET /metrics/overview-touches-trend — a slow-moving trend view, not part of the 5s live poll. */
export async function fetchOverviewTouchesTrend(): Promise<DailyChannelTouches[]> {
  await delay()
  return getOverviewTouchesTrend()
}
