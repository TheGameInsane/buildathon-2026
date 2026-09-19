import { Input } from "@/components/ui/input"

export interface TagListInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  id?: string
}

/** Comma-separated text in, string array out — a plain-input stand-in for a full tag editor. */
export function TagListInput({ value, onChange, placeholder, id }: TagListInputProps) {
  return (
    <Input
      id={id}
      placeholder={placeholder}
      defaultValue={value.join(", ")}
      onBlur={(e) =>
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  )
}
