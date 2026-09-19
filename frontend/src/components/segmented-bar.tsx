import { cn } from "cn"

export interface SegmentedBarSegment {
  key: string
  label: string
  value: number
  color: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export interface SegmentedBarProps {
  segments: SegmentedBarSegment[]
  className?: string
}

/** A single stacked bar + legend — e.g. Campaign Overview's channel mix. 2px gaps between fills. */
export function SegmentedBar({ segments, className }: SegmentedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-canvas">
        {segments.map((s, i) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value}%`}
            className={cn("h-full", i > 0 && "ml-0.5")}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-xs text-text-primary">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.icon && <s.icon className="size-3.5 text-text-secondary" />}
            {s.label} <span className="tabular-nums text-text-secondary">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
