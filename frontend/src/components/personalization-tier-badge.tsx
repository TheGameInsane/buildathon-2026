import { FileText, Sparkles } from "lucide-react"
import { cn } from "cn"
import type { PersonalizationTier } from "@/types/domain"

const TIER_META: Record<PersonalizationTier, { label: string; icon: typeof FileText; className: string }> = {
  template: { label: "Template", icon: FileText, className: "bg-status-draft/10 text-status-draft" },
  ai: { label: "AI", icon: Sparkles, className: "bg-brand-50 text-brand-600" },
}

export interface PersonalizationTierBadgeProps {
  tier: PersonalizationTier
  className?: string
}

/** Which pipeline produced this touch: merge-tag only, full LLM draft, or a draft plus a personalized visual. */
export function PersonalizationTierBadge({ tier, className }: PersonalizationTierBadgeProps) {
  const meta = TIER_META[tier]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  )
}
