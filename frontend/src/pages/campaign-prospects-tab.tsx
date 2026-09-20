import { Fragment, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight, Download, ExternalLink, FileUp, Loader2, Search, Sparkles } from "lucide-react"
import { cn } from "cn"
import { ChannelIcon } from "@/components/channel-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useDiscoverProspects, useImportProspects, useProspects } from "@/hooks/use-prospects"
import { downloadCsv, toCsv } from "@/lib/csv"
import { useCampaignContext } from "@/pages/use-campaign-context"
import { FUNNEL_STAGES, PROSPECT_STATUS_LABEL } from "@/types/domain"
import type { KanbanProspect, ProspectStatus } from "@/types/domain"

const IMPORT_ACCEPT = ".csv,.json"
const IMPORT_ACCEPT_LABEL = "CSV or JSON"

function ImportProspectsDialog({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const importProspects = useImportProspects(campaignId)

  const reset = () => {
    setFile(null)
    importProspects.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp /> Import prospects
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import prospects</DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file — columns like name/email/company/role (or full_name,
            email_address, etc.) are recognised automatically. Duplicates by email are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {importProspects.isSuccess ? (
            <div className="flex flex-col items-center gap-1.5 rounded-[10px] border border-status-live/30 bg-status-live/10 p-6 text-center">
              <CheckCircle2 className="size-6 text-status-live" />
              <p className="text-sm font-medium text-text-primary">
                {importProspects.data.imported} imported, {importProspects.data.skipped} skipped
              </p>
              <p className="text-xs text-text-secondary">{file?.name}</p>
            </div>
          ) : file ? (
            <div className="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-canvas p-3">
              <span className="truncate text-sm text-text-primary">{file.name}</span>
              {!importProspects.isPending && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 text-xs text-text-secondary hover:text-text-primary"
                >
                  Remove
                </button>
              )}
              {importProspects.isPending && <span className="shrink-0 text-xs text-text-secondary">Importing…</span>}
            </div>
          ) : (
            <FileDropzone accept={IMPORT_ACCEPT} acceptLabel={IMPORT_ACCEPT_LABEL} onFileSelected={setFile} />
          )}

          {importProspects.isError && (
            <p className="text-xs text-status-attention">{importProspects.error.message}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {importProspects.isSuccess ? "Close" : "Cancel"}
          </Button>
          {!importProspects.isSuccess && (
            <Button
              type="button"
              disabled={!file || importProspects.isPending}
              onClick={() => file && importProspects.mutate(file)}
            >
              {importProspects.isPending ? "Importing…" : "Upload"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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

type StageFilter = "all" | number

type ColumnKey = "name" | "company" | "stage" | "fitScore" | "lastTouch"

interface Column {
  key: ColumnKey
  label: string
  sortable: true
}

const COLUMNS: Column[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "company", label: "Company", sortable: true },
  { key: "stage", label: "Stage", sortable: true },
  { key: "fitScore", label: "Fit score", sortable: true },
  { key: "lastTouch", label: "Last touch", sortable: true },
]

function columnValue(p: KanbanProspect, key: ColumnKey): string | number {
  switch (key) {
    case "name":
      return p.name.toLowerCase()
    case "company":
      return p.company.toLowerCase()
    case "stage":
      return p.stageIndex
    case "fitScore":
      return p.fitScore
    case "lastTouch":
      return p.daysSinceLastTouch
  }
}

function sortProspects(list: KanbanProspect[], key: ColumnKey, direction: "asc" | "desc"): KanbanProspect[] {
  const sign = direction === "asc" ? 1 : -1
  return [...list].sort((a, b) => {
    const av = columnValue(a, key)
    const bv = columnValue(b, key)
    if (typeof av === "string" || typeof bv === "string") return sign * String(av).localeCompare(String(bv))
    return sign * (av - bv)
  })
}

export function CampaignProspectsTab() {
  const { campaign } = useCampaignContext()
  const { data: prospects, isLoading } = useProspects(campaign.id)
  const discoverProspects = useDiscoverProspects()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [stageFilter, setStageFilter] = useState<StageFilter>("all")
  const [sort, setSort] = useState<{ key: ColumnKey; direction: "asc" | "desc" }>({
    key: "lastTouch",
    direction: "asc",
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const filtered = useMemo(() => {
    let list = searched
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter)
    if (stageFilter !== "all") list = list.filter((p) => p.stageIndex === stageFilter)
    return sortProspects(list, sort.key, sort.direction)
  }, [searched, statusFilter, stageFilter, sort])

  const toggleSort = (key: ColumnKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    )
  }

  /** Exports exactly what's visible: the current search/stage/status filter, every column shown in the table. */
  const handleDownloadCsv = () => {
    const csv = toCsv(filtered, [
      { header: "Name", value: (p) => p.name },
      { header: "Company", value: (p) => p.company },
      { header: "Stage", value: (p) => FUNNEL_STAGES[p.stageIndex] },
      { header: "Fit score", value: (p) => p.fitScore },
      { header: "Last touch", value: (p) => (p.daysSinceLastTouch === 0 ? "Today" : `${p.daysSinceLastTouch}d ago`) },
      { header: "Next action", value: (p) => p.nextActionChannel ?? "None" },
      { header: "LinkedIn URL", value: (p) => p.linkedinUrl },
      { header: "Status", value: (p) => PROSPECT_STATUS_LABEL[p.status] },
    ])
    downloadCsv(`${campaign.name.toLowerCase().replace(/\s+/g, "-")}-prospects.csv`, csv)
  }

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

        <Select value={stageFilter === "all" ? "all" : String(stageFilter)} onValueChange={(v) => setStageFilter(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {FUNNEL_STAGES.map((stage, i) => (
              <SelectItem key={stage} value={String(i)}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all" ? "All statuses" : PROSPECT_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => discoverProspects.mutate(campaign.id)}
            disabled={discoverProspects.isPending}
          >
            {discoverProspects.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {discoverProspects.isPending ? "Finding prospects…" : "Discover prospects"}
          </Button>
          <ImportProspectsDialog campaignId={campaign.id} />
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadCsv} disabled={!filtered.length}>
            <Download /> Download CSV
          </Button>
          <span className="text-xs text-text-secondary">{filtered.length.toLocaleString()} prospects</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-sm text-text-secondary">No prospects match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs text-text-secondary">
                <th className="w-8 px-2 py-2" />
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-text-primary"
                    >
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Next action</th>
                <th className="px-3 py-2 font-medium">LinkedIn</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-canvas">
              {filtered.map((p) => {
                const expanded = expandedId === p.id
                return (
                  <Fragment key={p.id}>
                    <tr
                      className={cn(
                        "group cursor-pointer hover:bg-surface",
                        highlightedStage === String(p.stageIndex) && "bg-brand-50/40",
                      )}
                      onClick={() => navigate(`/campaigns/${campaign.id}/prospects/${p.id}`)}
                    >
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-label={expanded ? "Collapse row" : "Expand row"}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setExpandedId(expanded ? null : p.id)
                          }}
                          className="flex size-5 items-center justify-center rounded text-text-secondary hover:bg-canvas hover:text-text-primary"
                        >
                          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-600">
                            {initials(p.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text-primary group-hover:text-brand-600">
                              {p.name}
                            </p>
                            <p className="truncate text-xs text-text-secondary">{p.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-primary">{p.company}</td>
                      <td className="px-3 py-2 text-text-secondary">{FUNNEL_STAGES[p.stageIndex]}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", fitBadgeClassName(p.fitScore))}>
                          {p.fitScore}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-text-secondary">
                          {p.nextActionChannel && <ChannelIcon channel={p.nextActionChannel} size="sm" />}
                          {p.daysSinceLastTouch === 0 ? "Today" : `${p.daysSinceLastTouch}d ago`}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {p.nextActionChannel ? (
                          <ChannelIcon channel={p.nextActionChannel} size="sm" />
                        ) : (
                          <span className="text-text-secondary">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.linkedinUrl ? (
                          <a
                            href={p.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-text-secondary hover:text-brand-600"
                          >
                            Profile <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE_CLASS[p.status])}>
                          {PROSPECT_STATUS_LABEL[p.status]}
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-surface">
                        <td />
                        <td colSpan={COLUMNS.length + 3} className="px-3 py-3">
                          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-text-secondary">
                            <span>Engagement score: <span className="font-medium text-text-primary">{p.engagementScore}</span></span>
                            <span>Discovered: <span className="font-medium text-text-primary">{new Date(p.discoveredAt).toLocaleDateString()}</span></span>
                            <span>
                              Last reply:{" "}
                              <span className="font-medium text-text-primary">
                                {p.lastRepliedAt ? new Date(p.lastRepliedAt).toLocaleDateString() : "None yet"}
                              </span>
                            </span>
                            <Link
                              to={`/campaigns/${campaign.id}/prospects/${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-auto inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                            >
                              Open full profile <ChevronDown className="-rotate-90 size-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
