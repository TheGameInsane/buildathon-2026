import { Link } from "react-router-dom"
import { AlertTriangle, GitMerge, ShieldAlert } from "lucide-react"
import { cn } from "cn"
import type { InboxCounts } from "@/mocks/inbox-counts"

export interface AlertsStripProps {
  counts: InboxCounts
  /** "compact" for the top bar (every screen), "full" for the Overview zone. */
  variant?: "compact" | "full"
  className?: string
}

const items = [
  { key: "approvals" as const, label: "approval", icon: ShieldAlert, color: "text-status-paused", filter: "approvals" },
  { key: "conflicts" as const, label: "conflict", icon: GitMerge, color: "text-slate-500", filter: "conflicts" },
  { key: "escalations" as const, label: "escalation", icon: AlertTriangle, color: "text-status-attention", filter: "escalations" },
]

/** Empty state: render nothing at all if every count is 0. */
export function AlertsStrip({ counts, variant = "compact", className }: AlertsStripProps) {
  const active = items.filter((item) => counts[item.key] > 0)
  if (active.length === 0) return null

  if (variant === "full") {
    return (
      <div className={cn("flex flex-wrap items-center gap-4 rounded-[10px] border border-border bg-surface px-4 py-3", className)}>
        {active.map((item) => (
          <Link
            key={item.key}
            to={`/inbox?filter=${item.filter}`}
            className={cn("inline-flex items-center gap-1.5 text-sm font-medium hover:underline", item.color)}
          >
            <item.icon className="size-4" />
            {counts[item.key]} {item.label}
            {counts[item.key] > 1 ? "s" : ""}
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {active.map((item) => (
        <Link
          key={item.key}
          to={`/inbox?filter=${item.filter}`}
          className={cn("inline-flex items-center gap-1 font-medium hover:underline", item.color)}
        >
          <item.icon className="size-3.5" />
          {counts[item.key]} {item.label}
          {counts[item.key] > 1 ? "s" : ""}
        </Link>
      ))}
    </div>
  )
}
