import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Pause, Play, Plus, Search } from "lucide-react"
import { CampaignPauseResumeDialog } from "@/components/campaign-pause-resume-dialog"
import { StatusPill } from "@/components/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useToggleCampaignPause } from "@/hooks/use-campaigns"
import { getCampaignFunnelSummary } from "@/lib/campaign-metrics"
import { timeAgo } from "@/lib/format"
import type { Campaign, Status } from "@/types/domain"

type StatusFilter = "all" | Status

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "attention", label: "Needs attention" },
]

type SortKey = "name" | "prospects" | "engaged" | "meetings" | "conversion" | "lastActivity"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "lastActivity", label: "Last activity" },
  { value: "name", label: "Campaign name" },
  { value: "prospects", label: "Most prospects" },
  { value: "engaged", label: "Most engaged" },
  { value: "meetings", label: "Most meetings booked" },
  { value: "conversion", label: "Highest conversion rate" },
]

function sortCampaigns(campaigns: Campaign[], sortKey: SortKey): Campaign[] {
  const withSummary = campaigns.map((c) => ({ campaign: c, summary: getCampaignFunnelSummary(c) }))

  withSummary.sort((a, b) => {
    switch (sortKey) {
      case "name":
        return a.campaign.name.localeCompare(b.campaign.name)
      case "prospects":
        return b.summary.discovered - a.summary.discovered
      case "engaged":
        return b.summary.engaged - a.summary.engaged
      case "meetings":
        return b.summary.meetingsBooked - a.summary.meetingsBooked
      case "conversion":
        return b.summary.conversionRate - a.summary.conversionRate
      case "lastActivity":
      default:
        return new Date(b.campaign.lastActivityAt).getTime() - new Date(a.campaign.lastActivityAt).getTime()
    }
  })

  return withSummary.map((w) => w.campaign)
}

export function CampaignsList() {
  const { data: campaigns, isLoading } = useCampaigns()
  const togglePause = useToggleCampaignPause()

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("lastActivity")
  const [confirmTarget, setConfirmTarget] = useState<Campaign | null>(null)

  const visible = useMemo(() => {
    if (!campaigns) return []
    const q = query.trim().toLowerCase()
    const filtered = campaigns.filter((c) => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.icp.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || c.status === statusFilter
      return matchesQuery && matchesStatus
    })
    return sortCampaigns(filtered, sortKey)
  }, [campaigns, query, statusFilter, sortKey])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Campaigns</h1>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus /> New Campaign
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                Sort: {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !visible.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-[15px] font-semibold text-text-primary">No campaigns match these filters</p>
          <Button variant="outline" onClick={() => { setQuery(""); setStatusFilter("all") }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Prospects</th>
                <th className="px-4 py-3 text-right font-medium">Contacted</th>
                <th className="px-4 py-3 text-right font-medium">Engaged</th>
                <th className="px-4 py-3 text-right font-medium">Replied</th>
                <th className="px-4 py-3 text-right font-medium">Meetings</th>
                <th className="px-4 py-3 text-right font-medium">Conversion</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((campaign) => {
                const summary = getCampaignFunnelSummary(campaign)
                const canPause = campaign.status === "live" || campaign.status === "paused"
                return (
                  <tr key={campaign.id} className="hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        className="font-medium text-text-primary hover:text-brand-600 hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-xs text-text-secondary">{campaign.icp}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={campaign.status} pulse />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                      {summary.discovered.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                      {summary.contacted.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                      {summary.engaged.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                      {summary.replied.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                      {summary.meetingsBooked.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                      {summary.conversionRate}%
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{timeAgo(campaign.lastActivityAt)}</td>
                    <td className="px-4 py-3">
                      {canPause && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmTarget(campaign)}
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
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
