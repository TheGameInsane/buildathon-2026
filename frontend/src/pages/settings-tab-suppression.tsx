import { useMemo, useState } from "react"
import { Search, Undo2 } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useRemoveFromSuppression, useSuppressionEntries } from "@/hooks/use-suppression"
import { timeAgo } from "@/lib/format"
import type { SuppressionEntry, SuppressionReason } from "@/types/domain"

const REASON_LABEL: Record<SuppressionReason, string> = {
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  manual: "Manual",
}

const REASON_CLASS: Record<SuppressionReason, string> = {
  unsubscribed: "bg-status-draft/10 text-status-draft",
  bounced: "bg-status-attention/10 text-status-attention",
  manual: "bg-status-paused/10 text-status-paused",
}

export function SettingsTabSuppression() {
  const { data: entries, isLoading } = useSuppressionEntries()
  const removeEntry = useRemoveFromSuppression()
  const [query, setQuery] = useState("")
  const [confirmTarget, setConfirmTarget] = useState<SuppressionEntry | null>(null)

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.prospectName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
  }, [entries, query])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-secondary" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…" className="pl-8" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-sm text-text-secondary">No suppressed prospects.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary">
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Date added</th>
                <th className="px-4 py-3 font-medium">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-canvas">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{entry.prospectName}</p>
                    <p className="text-xs text-text-secondary">{entry.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", REASON_CLASS[entry.reason])}>
                      {REASON_LABEL[entry.reason]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{timeAgo(entry.addedAt)}</td>
                  <td className="px-4 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmTarget(entry)}>
                      <Undo2 /> Remove from suppression
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={`Remove ${confirmTarget?.prospectName} from suppression?`}
        description="This re-enables outreach to this prospect across all campaigns."
        confirmLabel="Remove from suppression"
        tone="amber"
        onConfirm={() => confirmTarget && removeEntry.mutate(confirmTarget.id)}
      />
    </div>
  )
}
