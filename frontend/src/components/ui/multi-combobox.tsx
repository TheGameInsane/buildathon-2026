import { useMemo, useState, type KeyboardEvent } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Plus, X } from "lucide-react"
import { cn } from "cn"

export interface MultiComboboxProps {
  value: string[]
  onChange: (value: string[]) => void
  /** Preset suggestions, filtered as the manager types. */
  options: string[]
  placeholder?: string
  /** When true (default), typing a value not in the list can still be added as a custom tag. */
  allowCustom?: boolean
  id?: string
  className?: string
}

/**
 * Chip input with a searchable typeahead of presets, plus free custom entries.
 * Titles vary too much across industries for a fixed list to fully cover, so this
 * behaves like a combo box, not a rigid closed dropdown.
 */
export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  id,
  className,
}: MultiComboboxProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter((o) => !value.includes(o) && (q === "" || o.toLowerCase().includes(q))).slice(0, 8)
  }, [options, value, query])

  const exactMatch = value.some((v) => v.toLowerCase() === query.trim().toLowerCase())
  const canAddCustom = allowCustom && query.trim().length > 0 && !exactMatch

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setQuery("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && allowCustom) {
      e.preventDefault()
      addTag(query)
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <PopoverPrimitive.Root open={open && (suggestions.length > 0 || canAddCustom)} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          className={cn(
            "flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5",
            "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
            className,
          )}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : undefined}
            className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="max-h-52 overflow-y-auto p-1">
            {suggestions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => addTag(option)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {option}
              </button>
            ))}
            {canAddCustom && (
              <button
                type="button"
                onClick={() => addTag(query)}
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
