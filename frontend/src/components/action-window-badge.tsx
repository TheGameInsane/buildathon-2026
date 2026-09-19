import { AlertTriangle, Clock } from "lucide-react"
import { cn } from "cn"
import { timeUntil } from "@/lib/format"

export interface ActionWindowBadgeProps {
  stageEnteredAt: string
  actionWindowHours: number
  className?: string
}

/** "Contact within 24h" countdown: neutral, then amber under 25% of the window left, then red once it lapses. */
export function ActionWindowBadge({ stageEnteredAt, actionWindowHours, className }: ActionWindowBadgeProps) {
  const deadline = new Date(stageEnteredAt).getTime() + actionWindowHours * 3_600_000
  const { label, expired, minutesLeft } = timeUntil(new Date(deadline))
  const nearingExpiry = !expired && minutesLeft <= actionWindowHours * 60 * 0.25

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        expired
          ? "bg-status-attention/10 text-status-attention"
          : nearingExpiry
            ? "bg-status-paused/10 text-status-paused"
            : "bg-status-draft/10 text-status-draft",
        className,
      )}
    >
      {expired ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
      {label}
    </span>
  )
}
