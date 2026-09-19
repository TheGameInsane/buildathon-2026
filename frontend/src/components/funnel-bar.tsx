import { ChevronRight } from "lucide-react"
import { cn } from "cn"
import { formatCompactNumber } from "@/lib/format"
import { FUNNEL_STAGES } from "@/types/domain"

export interface FunnelBarProps {
  counts: readonly number[]
  onSegmentClick?: (stageIndex: number) => void
  /** "mini" (numbers only, for CampaignCard) or "full" (bar + numbers + labels, for Campaign Overview). */
  variant?: "mini" | "full"
  className?: string
}

export function FunnelBar({ counts, onSegmentClick, variant = "full", className }: FunnelBarProps) {
  const max = Math.max(...counts, 1)

  if (variant === "mini") {
    return (
      <div className={cn("flex min-w-0 items-center gap-1 text-xs text-text-secondary", className)}>
        {counts.map((count, i) => (
          <span key={FUNNEL_STAGES[i]} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onSegmentClick?.(i)}
              className="tabular-nums font-medium text-text-primary hover:text-brand-600 hover:underline"
            >
              {formatCompactNumber(count)}
            </button>
            {i < counts.length - 1 && <ChevronRight className="size-3 shrink-0" />}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="grid grid-cols-[repeat(7,minmax(64px,1fr))] gap-2">
        {counts.map((count, i) => (
          <button
            key={FUNNEL_STAGES[i]}
            type="button"
            onClick={() => onSegmentClick?.(i)}
            className="flex flex-col items-center gap-1.5 rounded-md py-2 text-center hover:bg-canvas"
          >
            <span className="w-full">
              <span
                className="block h-1.5 rounded-full bg-brand-50"
                style={{ position: "relative" }}
              >
                <span
                  className="block h-1.5 rounded-full bg-gradient-to-r from-brand-600 to-accent-cyan"
                  style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
                />
              </span>
            </span>
            <span className="text-lg font-semibold tabular-nums text-text-primary">
              {formatCompactNumber(count)}
            </span>
            <span className="text-xs text-text-secondary">{FUNNEL_STAGES[i]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
