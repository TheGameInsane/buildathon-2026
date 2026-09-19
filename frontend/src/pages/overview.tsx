import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Calendar, Plus, Target, TrendingUp, Zap } from "lucide-react"
import { ActivityFeedItem, ActivityFeedItemSkeleton } from "@/components/activity-feed-item"
import { AlertsStrip } from "@/components/shell/alerts-strip"
import { CampaignCard, CampaignCardSkeleton } from "@/components/campaign-card"
import { CampaignPauseResumeDialog } from "@/components/campaign-pause-resume-dialog"
import { MetricCard } from "@/components/metric-card"
import { OverviewTrendChart } from "@/components/overview-trend-chart"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityFeed } from "@/hooks/use-activity-feed"
import { useCampaigns, useToggleCampaignPause } from "@/hooks/use-campaigns"
import { useInboxCounts } from "@/hooks/use-inbox-counts"
import { useOverviewTouchesTrend } from "@/hooks/use-overview-trend"
import { getCampaignFunnelSummary } from "@/lib/campaign-metrics"
import type { Campaign } from "@/types/domain"

const EMPTY_COUNTS = { approvals: 0, escalations: 0, conflicts: 0 }

export function Overview() {
  const { data: campaigns, isLoading: campaignsLoading, isError: campaignsErrored } = useCampaigns()
  const { data: events, isLoading: feedLoading } = useActivityFeed()
  const { data: inboxCounts = EMPTY_COUNTS } = useInboxCounts()
  const { data: touchesTrend } = useOverviewTouchesTrend()
  const togglePause = useToggleCampaignPause()

  const [confirmTarget, setConfirmTarget] = useState<Campaign | null>(null)

  const feedRef = useRef<HTMLDivElement>(null)
  const [pinnedToTop, setPinnedToTop] = useState(true)
  useEffect(() => {
    if (pinnedToTop) feedRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [events, pinnedToTop])

  const kpis = useMemo(() => {
    if (!campaigns?.length) return null
    const summaries = campaigns.map(getCampaignFunnelSummary)
    const discovered = summaries.reduce((sum, s) => sum + s.discovered, 0)
    const meetings = summaries.reduce((sum, s) => sum + s.meetingsBooked, 0)
    return {
      liveCampaigns: campaigns.filter((c) => c.status === "live").length,
      discovered,
      meetings,
      conversionRate: discovered > 0 ? Number(((meetings / discovered) * 100).toFixed(1)) : 0,
    }
  }, [campaigns])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Overview</h1>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus /> New Campaign
          </Link>
        </Button>
      </div>

      {kpis ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard variant="hero" icon={Zap} value={kpis.liveCampaigns} label="Live campaigns" />
            <MetricCard variant="hero" icon={Target} value={kpis.discovered} label="Prospects discovered" />
            <MetricCard variant="hero" icon={Calendar} value={kpis.meetings} label="Meetings booked" />
            <MetricCard
              variant="hero"
              icon={TrendingUp}
              value={kpis.conversionRate}
              format="percent"
              label="Overall conversion rate"
            />
          </div>
          <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-text-primary">Touches by channel, all campaigns</p>
            <p className="text-xs text-text-secondary">Last 7 days</p>
            {touchesTrend ? (
              <OverviewTrendChart data={touchesTrend} className="mt-1" />
            ) : (
              <Skeleton className="mt-1 h-[200px] w-full" />
            )}
          </div>
        </div>
      ) : (
        <Skeleton className="h-40 w-full" />
      )}

      <AlertsStrip counts={inboxCounts} variant="full" />

      {campaignsErrored && (
        <div className="rounded-md bg-status-paused/10 px-3 py-2 text-sm text-status-paused">
          Couldn't refresh, retrying…
        </div>
      )}

      {campaignsLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : !campaigns?.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-[15px] font-semibold text-text-primary">No campaigns yet</p>
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus /> Create your first campaign
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} onTogglePause={setConfirmTarget} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Live Activity</h2>
        <div
          ref={feedRef}
          onScroll={(e) => setPinnedToTop(e.currentTarget.scrollTop < 8)}
          className="flex max-h-80 flex-col overflow-y-auto rounded-[10px] border border-border bg-surface p-2"
        >
          {feedLoading
            ? Array.from({ length: 5 }).map((_, i) => <ActivityFeedItemSkeleton key={i} />)
            : events?.map((event) => <ActivityFeedItem key={event.id} event={event} />)}
        </div>
      </div>

      {confirmTarget && (
        <CampaignPauseResumeDialog
          action={confirmTarget.status === "live" ? "pause" : "resume"}
          open={confirmTarget !== null}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          onConfirm={() => togglePause.mutate(confirmTarget)}
        />
      )}
    </div>
  )
}
