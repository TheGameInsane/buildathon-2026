import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { cn } from "cn"
import { ApprovalCard, ConflictCard, EscalationCard, PromptApprovalCard } from "@/components/inbox-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns } from "@/hooks/use-campaigns"
import {
  useInboxItems,
  useResolveApproval,
  useResolveConflict,
  useResolveEscalation,
  useResolvePromptApproval,
} from "@/hooks/use-inbox"
import type { InboxItemKind } from "@/types/domain"

type FilterTab = "all" | InboxItemKind

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approval", label: "Approvals" },
  { key: "escalation", label: "Escalations" },
  { key: "conflict", label: "Conflicts" },
]

export function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilter = searchParams.get("filter")
  const initialTab: FilterTab =
    urlFilter === "approvals" ? "approval" : urlFilter === "escalations" ? "escalation" : urlFilter === "conflicts" ? "conflict" : "all"

  const [tab, setTab] = useState<FilterTab>(initialTab)
  const [campaignFilter, setCampaignFilter] = useState<string>("all")
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  const { data: items, isLoading } = useInboxItems()
  const { data: campaigns } = useCampaigns()
  const resolveApproval = useResolveApproval()
  const resolveEscalation = useResolveEscalation()
  const resolveConflict = useResolveConflict()
  const resolvePromptApproval = useResolvePromptApproval()

  const campaignScoped = useMemo(() => {
    if (!items) return []
    if (campaignFilter === "all") return items
    return items.filter((item) => item.campaignName === campaignFilter)
  }, [items, campaignFilter])

  const counts = useMemo(
    () => ({
      all: campaignScoped.length,
      approval: campaignScoped.filter((i) => i.kind === "approval" || i.kind === "prompt_approval").length,
      escalation: campaignScoped.filter((i) => i.kind === "escalation").length,
      conflict: campaignScoped.filter((i) => i.kind === "conflict").length,
      prompt_approval: campaignScoped.filter((i) => i.kind === "prompt_approval").length,
    }),
    [campaignScoped],
  )

  const visible =
    tab === "all"
      ? campaignScoped
      : campaignScoped.filter((i) => i.kind === tab || (tab === "approval" && i.kind === "prompt_approval"))

  const withFade = (id: string, resolve: () => void) => {
    setResolvingIds((prev) => new Set(prev).add(id))
    setTimeout(resolve, 250)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-primary">Inbox</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setSearchParams({})
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                tab === t.key ? "bg-brand-50 text-brand-600" : "text-text-secondary hover:bg-canvas",
              )}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>

        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns?.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-[15px] font-semibold text-text-primary">🎉 Inbox clear</p>
          <p className="text-sm text-text-secondary">Nothing needs you right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <div
              key={item.id}
              className={cn(
                "transition-opacity duration-[250ms]",
                resolvingIds.has(item.id) && "pointer-events-none opacity-0",
              )}
            >
              {item.kind === "approval" && (
                <ApprovalCard
                  item={item}
                  onApprove={() => withFade(item.id, () => resolveApproval.mutate({ id: item.id, resolution: "approve" }))}
                  onReject={() => withFade(item.id, () => resolveApproval.mutate({ id: item.id, resolution: "reject" }))}
                  onSaveEdit={() => withFade(item.id, () => resolveApproval.mutate({ id: item.id, resolution: "edit" }))}
                />
              )}
              {item.kind === "escalation" && (
                <EscalationCard
                  item={item}
                  onTakeOver={() => withFade(item.id, () => resolveEscalation.mutate({ id: item.id, resolution: "takeOver" }))}
                  onReassign={() => withFade(item.id, () => resolveEscalation.mutate({ id: item.id, resolution: "reassign" }))}
                  onDismiss={() => withFade(item.id, () => resolveEscalation.mutate({ id: item.id, resolution: "dismiss" }))}
                />
              )}
              {item.kind === "conflict" && (
                <ConflictCard
                  item={item}
                  onKeepDefault={() => withFade(item.id, () => resolveConflict.mutate(item.id))}
                  onOverride={() => withFade(item.id, () => resolveConflict.mutate(item.id))}
                  onSlowCadence={() => withFade(item.id, () => resolveConflict.mutate(item.id))}
                />
              )}
              {item.kind === "prompt_approval" && (
                <PromptApprovalCard
                  item={item}
                  onApprove={() =>
                    withFade(item.id, () => resolvePromptApproval.mutate({ id: item.id, resolution: "approve" }))
                  }
                  onReject={() =>
                    withFade(item.id, () => resolvePromptApproval.mutate({ id: item.id, resolution: "reject" }))
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
