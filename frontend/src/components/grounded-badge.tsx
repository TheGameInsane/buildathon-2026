import { AlertTriangle } from "lucide-react"
import { cn } from "cn"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { icons } from "@/lib/tokens"

export interface GroundedClaim {
  text: string
  supported: boolean
  sourceUrl?: string
}

export interface GroundedBadgeProps {
  groundedOk: boolean
  /** Claim-by-claim breakdown from the grounding check, shown on hover/click. */
  claims?: GroundedClaim[]
  className?: string
}

export function GroundedBadge({ groundedOk, claims, className }: GroundedBadgeProps) {
  const Icon = groundedOk ? icons.grounded : AlertTriangle

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        groundedOk ? "bg-status-live/10 text-status-live" : "bg-status-paused/10 text-status-paused",
        className,
      )}
    >
      <Icon className="size-3" />
      {groundedOk ? "Grounded" : "Needs review"}
    </span>
  )

  if (!claims?.length) return badge

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-default">
          {badge}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <p className="mb-2 text-xs font-semibold text-text-primary">Claim-by-claim check</p>
        <ul className="space-y-1.5">
          {claims.map((claim, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span
                className={cn(
                  "mt-0.5 size-1.5 shrink-0 rounded-full",
                  claim.supported ? "bg-status-live" : "bg-status-attention",
                )}
              />
              <span className="text-text-secondary">{claim.text}</span>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )
}
