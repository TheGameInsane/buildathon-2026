import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

export interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
  className?: string
}

/** Invalid fields get inline red helper text here, never a toast (Wizard > Interactions & states). */
export function Field({ label, htmlFor, error, children, className }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-status-attention">{error}</p>}
    </div>
  )
}
