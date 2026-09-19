import { cn } from "cn"
import type { Status } from "@/lib/tokens"
import { statusMeta } from "@/lib/tokens"

const statusStyles: Record<Status, string> = {
  live: "bg-status-live/10 text-status-live",
  paused: "bg-status-paused/10 text-status-paused",
  draft: "bg-status-draft/10 text-status-draft",
  completed: "bg-status-completed/10 text-status-completed",
  attention: "bg-status-attention/10 text-status-attention",
}

const dotStyles: Record<Status, string> = {
  live: "bg-status-live",
  paused: "bg-status-paused",
  draft: "bg-status-draft",
  completed: "bg-status-completed",
  attention: "bg-status-attention",
}

export interface StatusPillProps {
  status: Status
  /** Only ever true for "live"; renders the animated dot. */
  pulse?: boolean
  /** Defaults to the capitalised status if omitted. Pass a count for "attention", e.g. "3 Alerts". */
  label?: string
  className?: string
}

export function StatusPill({ status, pulse, label, className }: StatusPillProps) {
  const meta = statusMeta[status]
  const Icon = meta.icon
  const isLiveDot = status === "live" && pulse

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        statusStyles[status],
        className,
      )}
    >
      {isLiveDot ? (
        <span className="relative flex size-2">
          <span
            className={cn(
              "absolute inline-flex size-2 rounded-full opacity-75 animate-[pulse_1.6s_ease-in-out_infinite]",
              dotStyles[status],
            )}
          />
          <span className={cn("relative inline-flex size-2 rounded-full", dotStyles[status])} />
        </span>
      ) : (
        <Icon className="size-3" />
      )}
      {label ?? meta.label}
    </span>
  )
}
