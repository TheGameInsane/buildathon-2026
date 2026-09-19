import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "cn"
import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { formatCompactNumber } from "@/lib/format"
import { motion } from "@/lib/tokens"
import type { LucideIcon } from "lucide-react"

export interface MetricCardProps {
  value: number
  label: string
  delta?: number
  trend?: "up" | "down"
  format?: "number" | "currency" | "percent"
  /**
   * Which trend direction counts as an improvement: pass explicitly, never
   * infer it from the sign (e.g. cost improving is "down").
   */
  goodDirection?: "up" | "down"
  /** "hero" adds a gradient + glow for a top-level dashboard KPI row. Default stays flat, for dense metric grids. */
  variant?: "default" | "hero"
  icon?: LucideIcon
  className?: string
}

function formatValue(value: number, format: MetricCardProps["format"]) {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value)
    case "percent":
      return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(
        value / 100,
      )
    default:
      return formatCompactNumber(Math.round(value))
  }
}

export function MetricCard({
  value,
  label,
  delta,
  trend,
  format = "number",
  goodDirection,
  variant = "default",
  icon: Icon,
  className,
}: MetricCardProps) {
  const animated = useAnimatedNumber(value, motion.counterMs)
  const isGood = trend && goodDirection ? trend === goodDirection : undefined
  const TrendIcon = trend === "up" ? ArrowUp : ArrowDown
  const isHero = variant === "hero"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] border p-4",
        isHero
          ? "border-brand-600/25 bg-gradient-to-br from-brand-50 via-surface to-surface shadow-[0_0_32px_-16px_rgba(46,125,255,0.5)]"
          : "border-border bg-surface",
        className,
      )}
    >
      {isHero && Icon && (
        <Icon className="pointer-events-none absolute -top-2 -right-2 size-16 text-brand-600/10" />
      )}
      <div className="relative flex items-baseline gap-2">
        <span
          className={cn(
            "font-bold tabular-nums text-text-primary",
            isHero ? "text-4xl" : "text-3xl",
          )}
        >
          {formatValue(animated, format)}
        </span>
        {trend && delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              isGood === undefined
                ? "text-text-secondary"
                : isGood
                  ? "text-status-live"
                  : "text-status-attention",
            )}
          >
            <TrendIcon className="size-3" />
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      <p className="relative mt-1 text-xs text-text-secondary">{label}</p>
    </div>
  )
}
