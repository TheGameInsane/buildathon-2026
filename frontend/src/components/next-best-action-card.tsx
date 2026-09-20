import { Check, Pencil, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { ChannelIcon } from "@/components/channel-icon"
import { PersonalizationTierBadge } from "@/components/personalization-tier-badge"
import type { NextBestAction } from "@/types/domain"

export interface NextBestActionCardProps {
  action: NextBestAction
  onApprove?: () => void
  onEdit?: () => void
  onSkip?: () => void
  className?: string
}

export function NextBestActionCard({ action, onApprove, onEdit, onSkip, className }: NextBestActionCardProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4", className)}>
      <p className="text-[15px] font-semibold text-text-primary">Next Best Action</p>

      <p className="inline-flex items-center gap-1.5 text-sm text-text-primary">
        <ChannelIcon channel={action.channel} />
        {action.intent}, {action.when}
        {action.personalizationTier && <PersonalizationTierBadge tier={action.personalizationTier} />}
      </p>
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-primary">Why:</span> {action.reasonText}
      </p>
      {action.draftContent && (
        <p className="rounded-md bg-canvas p-2 text-xs text-text-primary">"{action.draftContent}"</p>
      )}

      {action.requiresApproval ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onApprove}>
            <Check /> Approve
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            <X /> Skip
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-secondary">Will happen automatically</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Override
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
