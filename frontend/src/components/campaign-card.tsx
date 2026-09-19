import { Pause, Play, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChannelIcon } from "@/components/channel-icon"
import { FunnelBar } from "@/components/funnel-bar"
import { Sparkline } from "@/components/sparkline"
import { StatusPill } from "@/components/status-pill"
import { getCampaignFunnelSummary } from "@/lib/campaign-metrics"
import type { Channel } from "@/lib/tokens"
import type { Campaign } from "@/types/domain"

/** Same footprint as CampaignCard, for the loading state — never a blank page. */
export function CampaignCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-3 rounded-[10px] border border-border bg-surface p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-3 w-24" />
      <div className="mt-1 border-t border-border pt-3">
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  )
}

export interface CampaignCardProps {
  campaign: Campaign
  onTogglePause?: (campaign: Campaign) => void
  className?: string
  /** false for the New Campaign Wizard's live preview — renders as a static card, not a link. */
  interactive?: boolean
}

/** The hero component of Mission Control — fully summarises one campaign. */
export function CampaignCard({ campaign, onTogglePause, className, interactive = true }: CampaignCardProps) {
  const channelsToday = Object.entries(campaign.todayByChannel) as [Channel, number][]
  const todayTotal = channelsToday.reduce((sum, [, count]) => sum + count, 0)
  const canPause = interactive && (campaign.status === "live" || campaign.status === "paused")
  const summary = getCampaignFunnelSummary(campaign)

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-text-primary">{campaign.name}</p>
          <p className="text-xs text-text-secondary">{campaign.icp}</p>
        </div>
        <StatusPill status={campaign.status} pulse />
      </div>

      <div className="flex items-center justify-between">
        <FunnelBar counts={campaign.funnelCounts} variant="mini" />
        <Sparkline data={campaign.sparkline} />
      </div>

      <p className="text-xs text-text-secondary">
        {summary.discovered.toLocaleString()} prospects · {campaign.touchCount.toLocaleString()}{" "}
        touches · {summary.meetingsBooked.toLocaleString()} mtgs
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {channelsToday.map(([channel]) => (
            <ChannelIcon key={channel} channel={channel} />
          ))}
          <span className="text-xs text-text-secondary">today: {todayTotal} touches</span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        {canPause ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onTogglePause?.(campaign)
            }}
          >
            {campaign.status === "live" ? (
              <>
                <Pause /> Pause
              </>
            ) : (
              <>
                <Play /> Resume
              </>
            )}
          </Button>
        ) : (
          <span />
        )}
        {interactive && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover/card:opacity-100">
            View details <ArrowRight className="size-3.5" />
          </span>
        )}
      </div>
    </>
  )

  const cardClassName = cn(
    "group/card flex w-full flex-col gap-3 rounded-[10px] border border-border bg-surface p-5 transition-[border-color,box-shadow] duration-200",
    interactive && "hover:border-brand-600/40 hover:shadow-[0_0_0_1px_rgba(46,125,255,0.15),0_12px_32px_-12px_rgba(46,125,255,0.35)]",
    className,
  )

  if (!interactive) {
    return <div className={cardClassName}>{body}</div>
  }

  return (
    <Link to={`/campaigns/${campaign.id}`} className={cardClassName}>
      {body}
    </Link>
  )
}
