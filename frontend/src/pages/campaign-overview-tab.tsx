import { useNavigate } from "react-router-dom"
import { FunnelBar } from "@/components/funnel-bar"
import { MetricCard } from "@/components/metric-card"
import { SegmentedBar } from "@/components/segmented-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaignMetrics } from "@/hooks/use-campaign-metrics"
import { channelChartColors, channelIcons } from "@/lib/tokens"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { Channel } from "@/types/domain"

const CHANNEL_ORDER: Channel[] = ["email", "whatsapp", "linkedin"]
const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
}

export function CampaignOverviewTab() {
  const { campaign } = useCampaignContext()
  const { data: metrics, isLoading } = useCampaignMetrics(campaign.id)
  const navigate = useNavigate()

  if (isLoading || !metrics) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const channelSegments = CHANNEL_ORDER.filter((c) => metrics.channelMix[c] !== undefined).map((c) => ({
    key: c,
    label: CHANNEL_LABEL[c],
    value: metrics.channelMix[c]!,
    color: channelChartColors[c],
    icon: channelIcons[c],
  }))

  const outcomeItems = [
    { key: "positive", label: "Positive", value: metrics.outcomes.positive, color: "bg-status-live" },
    { key: "negative", label: "Negative", value: metrics.outcomes.negative, color: "bg-status-attention" },
    { key: "noReply", label: "No reply", value: metrics.outcomes.noReply, color: "bg-status-draft" },
  ]
  const maxOutcome = Math.max(...outcomeItems.map((o) => o.value), 1)

  return (
    <div className="flex flex-col gap-4">
      {campaign.completionFeedback && (
        <div className="rounded-[10px] border border-status-completed/30 bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Completion feedback</p>
          <p className="mt-1 text-sm text-text-primary">{campaign.completionFeedback.text}</p>
          <p className="mt-2 text-xs text-text-secondary">
            {campaign.completionFeedback.submittedBy} · {new Date(campaign.completionFeedback.submittedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="rounded-[10px] border border-border bg-surface p-4">
        <FunnelBar
          counts={metrics.funnelCounts}
          onSegmentClick={(stageIndex) => navigate(`../prospects?stage=${stageIndex}`)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Input</p>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <MetricCard value={metrics.touchesSentToday} label="Touches sent today" />
          <MetricCard value={metrics.prospectsResearchedToday} label="Prospects researched today" />
          <MetricCard value={campaign.todayByChannel.email ?? 0} label="Email actions today" />
          <MetricCard value={campaign.todayByChannel.whatsapp ?? 0} label="WhatsApp actions today" />
          <MetricCard value={campaign.todayByChannel.linkedin ?? 0} label="LinkedIn actions today" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Output</p>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard value={metrics.meetings} label="Meetings" delta={metrics.meetingsDelta} trend="up" goodDirection="up" />
          <MetricCard
            value={metrics.responseRate}
            label="Response rate"
            delta={metrics.responseRateDelta}
            trend="up"
            goodDirection="up"
            format="percent"
          />
          <MetricCard
            value={metrics.costPerQualifiedLead}
            label="Cost / qualified lead"
            delta={metrics.costPerQualifiedLeadDelta}
            trend="down"
            goodDirection="down"
            format="currency"
          />
          <MetricCard
            value={metrics.meetingConversionRate}
            label="→ meeting conversion"
            delta={metrics.meetingConversionRateDelta}
            trend="up"
            goodDirection="up"
            format="percent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">Channel mix</p>
          <SegmentedBar segments={channelSegments} />
        </div>

        <div className="rounded-[10px] border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">Outcomes</p>
          <ul className="flex flex-col gap-2">
            {outcomeItems.map((o) => (
              <li key={o.key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-text-secondary">{o.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                  <span
                    className={`block h-full rounded-full ${o.color}`}
                    style={{ width: `${(o.value / maxOutcome) * 100}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-text-primary">{o.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
