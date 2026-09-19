import { StatusPill } from "@/components/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeliverability } from "@/hooks/use-deliverability"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { Status } from "@/types/domain"

const HEALTH_LABEL: Partial<Record<Status, string>> = { live: "Healthy", paused: "Warning", attention: "At risk" }

export function CampaignDeliverabilityTab() {
  const { campaign } = useCampaignContext()
  const { data: mailboxes, isLoading } = useDeliverability(campaign.id)

  if (isLoading || !mailboxes) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-secondary">
        Send health per connected mailbox. A hard bounce auto-suppresses that prospect after exactly one.
      </p>
      <div className="flex flex-col divide-y divide-border rounded-[10px] border border-border bg-surface">
        {mailboxes.map((mailbox) => (
          <div key={mailbox.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{mailbox.email}</p>
                <p className="text-xs text-text-secondary">
                  {mailbox.sentToday} sent today · {mailbox.bounceRate}% bounce rate
                </p>
              </div>
              <StatusPill status={mailbox.health} label={HEALTH_LABEL[mailbox.health]} />
            </div>
            {mailbox.warmupProgressPct !== null && (
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-text-secondary">Warming up</span>
                <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                  <span
                    className="block h-1.5 rounded-full bg-gradient-to-r from-brand-600 to-accent-cyan"
                    style={{ width: `${mailbox.warmupProgressPct}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-text-primary">
                  {mailbox.warmupProgressPct}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
