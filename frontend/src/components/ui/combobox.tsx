import { useMemo, useState } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Check, ChevronDown, Plus } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  /** Preset options shown in the list; filtered as the manager types. */
  options: string[]
  placeholder?: string
  /** When true, a typed value that isn't in the list can still be committed as a custom entry. */
  allowCustom?: boolean
  className?: string
  triggerClassName?: string
}

/**
 * Searchable typeahead combobox: type to filter a preset list, optionally commit a
 * custom value that isn't in the list. Built on the Popover primitive already used
 * elsewhere, no new dependency.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  allowCustom = false,
  className,
  triggerClassName,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())
  const canAddCustom = allowCustom && query.trim().length > 0 && !exactMatch

  function commit(next: string) {
    onChange(next)
    setOpen(false)
    setQuery("")
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            !value && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
            className,
          )}
        >
          <div className="border-b border-border p-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="h-8"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && !canAddCustom && (
              <p className="px-2 py-3 text-center text-xs text-text-secondary">No matches.</p>
            )}
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => commit(option)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Check className={cn("size-3.5 shrink-0", option === value ? "opacity-100" : "opacity-0")} />
                {option}
              </button>
            ))}
            {canAddCustom && (
              <button
                type="button"
                onClick={() => commit(query.trim())}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-brand-600 hover:bg-accent"
              >
                <Plus className="size-3.5 shrink-0" />
                Add "{query.trim()}"
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
