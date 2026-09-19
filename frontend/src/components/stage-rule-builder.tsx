import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const FIELD_OPTIONS: { value: string; label: string; boolean?: boolean }[] = [
  { value: "fit_score", label: "Fit score" },
  { value: "engagement_score", label: "Engagement score" },
  { value: "touches_count", label: "Touches count" },
  { value: "meeting_booked", label: "Meeting booked", boolean: true },
]

const COMPARATOR_OPTIONS = [">=", ">", "<=", "<", "=="] as const

interface ParsedRule {
  field: string
  comparator: string
  value: string
}

function parseCriteria(raw: string): ParsedRule | null {
  const match = raw.trim().match(/^(\S+)\s*(>=|<=|==|>|<)\s*(.+)$/)
  if (!match) return null
  return { field: match[1], comparator: match[2], value: match[3].trim() }
}

function serializeCriteria(rule: ParsedRule): string {
  return `${rule.field} ${rule.comparator} ${rule.value}`.trim()
}

export interface StageRuleBuilderProps {
  /** Stored as a plain string (e.g. "fit_score >= 70") — this just gives it a structured editor. */
  value: string
  onChange: (next: string) => void
  className?: string
}

/** One row: field + comparator + value, in place of raw criteria strings or JSON. */
export function StageRuleBuilder({ value, onChange, className }: StageRuleBuilderProps) {
  const parsed = parseCriteria(value)
  const field = parsed?.field ?? FIELD_OPTIONS[0].value
  const comparator = parsed?.comparator ?? ">="
  const ruleValue = parsed?.value ?? ""

  // Legacy/unknown field names still show up as a selectable option, so existing data never disappears silently.
  const fieldOptions = FIELD_OPTIONS.some((f) => f.value === field)
    ? FIELD_OPTIONS
    : [{ value: field, label: field }, ...FIELD_OPTIONS]

  const isBoolean = FIELD_OPTIONS.find((f) => f.value === field)?.boolean

  const update = (patch: Partial<ParsedRule>) => {
    const next = { field, comparator, value: ruleValue, ...patch }
    onChange(next.value ? serializeCriteria(next) : "")
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={field} onValueChange={(v) => update({ field: v, value: ruleValue || (isBoolean ? "" : ruleValue) })}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldOptions.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={comparator} onValueChange={(v) => update({ comparator: v })}>
          <SelectTrigger className="w-20" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARATOR_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isBoolean ? (
          <Select value={ruleValue || "true"} onValueChange={(v) => update({ value: v })}>
            <SelectTrigger className="w-24" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            type="number"
            value={ruleValue}
            placeholder="value"
            className="w-20"
            onChange={(e) => update({ value: e.target.value })}
          />
        )}

        {value && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear rule" onClick={() => onChange("")}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
