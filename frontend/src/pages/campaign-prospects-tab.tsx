import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search } from "lucide-react"
import { cn } from "cn"
import { ChannelIcon } from "@/components/channel-icon"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useProspects } from "@/hooks/use-prospects"
import { useCampaignContext } from "@/pages/use-campaign-context"
import { FUNNEL_STAGES, PROSPECT_STATUS_LABEL } from "@/types/domain"
import type { KanbanProspect, ProspectStatus } from "@/types/domain"

function fitBadgeClassName(score: number) {
  if (score >= 80) return "bg-status-live/10 text-status-live"
  if (score >= 50) return "bg-status-paused/10 text-status-paused"
  return "bg-status-attention/10 text-status-attention"
}

const STATUS_BADGE_CLASS: Record<ProspectStatus, string> = {
  discovered: "bg-status-draft/10 text-status-draft",
  contacted: "bg-brand-50 text-brand-600",
  engaged: "bg-accent-cyan/10 text-accent-cyan",
  replied: "bg-accent-lime/10 text-accent-lime",
  interested: "bg-accent-lime/10 text-accent-lime",
  meeting_booked: "bg-status-live/10 text-status-live",
  not_interested: "bg-status-draft/10 text-status-draft",
  failed: "bg-status-attention/10 text-status-attention",
  paused: "bg-status-paused/10 text-status-paused",
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function ProspectCard({ prospect, campaignId }: { prospect: KanbanProspect; campaignId: string }) {
  return (
    <Link
      to={`/campaigns/${campaignId}/prospects/${prospect.id}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 transition-shadow hover:border-brand-600/30 hover:shadow-[0_0_0_1px_rgba(46,125,255,0.1),0_8px_20px_-8px_rgba(46,125,255,0.3)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-600">
            {initials(prospect.name)}
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">{prospect.name}</p>
            <p className="text-xs text-text-secondary">
              {prospect.title}, {prospect.company}
            </p>
          </div>
        </div>
        {prospect.nextActionChannel && <ChannelIcon channel={prospect.nextActionChannel} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", fitBadgeClassName(prospect.fitScore))}>
          Fit {prospect.fitScore}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE_CLASS[prospect.status])}>
          {PROSPECT_STATUS_LABEL[prospect.status]}
        </span>
      </div>
      <span className="text-xs text-text-secondary">
        {prospect.daysSinceLastTouch === 0 ? "Contacted today" : `Contacted ${prospect.daysSinceLastTouch}d ago`}
      </span>
    </Link>
  )
}

type StatusFilter = "all" | ProspectStatus
const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "discovered",
  "contacted",
  "engaged",
  "replied",
  "interested",
  "meeting_booked",
  "not_interested",
  "failed",
  "paused",
]

type SortKey =
  | "recentlyDiscovered"
  | "recentlyContacted"
  | "mostEngaged"
  | "leastEngaged"
  | "mostRecentReply"
  | "company"
  | "jobTitle"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recentlyDiscovered", label: "Recently discovered" },
  { value: "recentlyContacted", label: "Recently contacted" },
  { value: "mostEngaged", label: "Most engaged" },
  { value: "leastEngaged", label: "Least engaged" },
  { value: "mostRecentReply", label: "Most recent reply" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job title" },
]

function sortProspects(list: KanbanProspect[], key: SortKey): KanbanProspect[] {
  const copy = [...list]
  switch (key) {
    case "recentlyDiscovered":
      return copy.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
    case "recentlyContacted":
      return copy.sort((a, b) => a.daysSinceLastTouch - b.daysSinceLastTouch)
    case "mostEngaged":
      return copy.sort((a, b) => b.engagementScore - a.engagementScore)
    case "leastEngaged":
      return copy.sort((a, b) => a.engagementScore - b.engagementScore)
    case "mostRecentReply":
      return copy.sort((a, b) => {
        if (!a.lastRepliedAt && !b.lastRepliedAt) return 0
        if (!a.lastRepliedAt) return 1
        if (!b.lastRepliedAt) return -1
        return new Date(b.lastRepliedAt).getTime() - new Date(a.lastRepliedAt).getTime()
      })
    case "company":
      return copy.sort((a, b) => a.company.localeCompare(b.company))
    case "jobTitle":
      return copy.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return copy
  }
}

export function CampaignProspectsTab() {
  const { campaign } = useCampaignContext()
  const { data: prospects, isLoading } = useProspects(campaign.id)
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("recentlyDiscovered")

  const highlightedStage = searchParams.get("stage")

  const searched = useMemo(() => {
    if (!prospects) return []
    const q = query.trim().toLowerCase()
    if (!q) return prospects
    return prospects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    )
  }, [prospects, query])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: searched.length } as Record<StatusFilter, number>
    for (const status of STATUS_FILTERS) {
      if (status === "all") continue
      counts[status] = searched.filter((p) => p.status === status).length
    }
    return counts
  }, [searched])

  const filtered = useMemo(() => {
    const byStatus = statusFilter === "all" ? searched : searched.filter((p) => p.status === statusFilter)
    return sortProspects(byStatus, sortKey)
  }, [searched, statusFilter, sortKey])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, or title…"
            className="pl-8"
          />
        </div>
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

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              statusFilter === status
                ? "bg-brand-600 text-white"
                : "bg-surface text-text-secondary hover:bg-canvas",
            )}
          >
            {status === "all" ? "All" : PROSPECT_STATUS_LABEL[status]} ({statusCounts[status] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(7,minmax(180px,1fr))] gap-3 overflow-x-auto">
          {FUNNEL_STAGES.map((stage) => (
            <Skeleton key={stage} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(7,minmax(180px,1fr))] gap-3 overflow-x-auto">
          {FUNNEL_STAGES.map((stage, stageIndex) => {
            const stageProspects = filtered.filter((p) => p.stageIndex === stageIndex)
            return (
              <div
                key={stage}
                className={cn(
                  "flex flex-col gap-2 rounded-[10px] border border-border bg-canvas p-2",
                  highlightedStage === String(stageIndex) && "ring-2 ring-brand-600",
                )}
              >
                <p className="flex items-center justify-between px-1 text-xs font-semibold text-text-secondary">
                  {stage}
                  <span className="tabular-nums">{stageProspects.length}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {stageProspects.map((p) => (
                    <ProspectCard key={p.id} prospect={p} campaignId={campaign.id} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
