import { Check, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface PreflightItem {
  label: string
  passed: boolean
  actionLabel?: string
  onAction?: () => void
}

export interface PreflightChecklistProps {
  items: PreflightItem[]
  onActivate: () => void
  activateLabel?: string
  className?: string
}

/** Used in the New Campaign Wizard, and re-shown any time "Activate" is clicked on a Draft. */
export function PreflightChecklist({
  items,
  onActivate,
  activateLabel = "Activate campaign",
  className,
}: PreflightChecklistProps) {
  const missing = items.filter((item) => !item.passed)
  const allPassed = missing.length === 0

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2">
              {item.passed ? (
                <Check className="size-4 text-status-live" />
              ) : (
                <X className="size-4 text-status-attention" />
              )}
              <span className={item.passed ? "text-text-primary" : "text-text-secondary"}>
                {item.label}
              </span>
            </span>
            {!item.passed && item.actionLabel && (
              <Button type="button" variant="outline" size="sm" onClick={item.onAction}>
                {item.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={allPassed ? -1 : 0} className="inline-block">
              <Button type="button" disabled={!allPassed} onClick={onActivate}>
                {activateLabel}
              </Button>
            </span>
          </TooltipTrigger>
          {!allPassed && (
            <TooltipContent>
              Missing: {missing.map((item) => item.label).join(", ")}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
