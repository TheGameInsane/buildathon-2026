import { Check } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { cn } from "cn"
import { Field } from "@/components/wizard/field"
import { TONE_OPTIONS } from "@/types/wizard"
import type { WizardValues } from "@/types/wizard"

const TONE_DESCRIPTIONS: Record<(typeof TONE_OPTIONS)[number], string> = {
  Professional: "Polished, formal, business-appropriate",
  Friendly: "Warm and approachable",
  Concise: "Short, to the point, no filler",
  Consultative: "Advisory, asks questions, leads with value",
  Direct: "Gets straight to the ask",
  Casual: "Relaxed, conversational",
  Persuasive: "Confident, benefit-led, drives action",
}

export function WizardStepTone() {
  const {
    control,
    formState: { errors },
  } = useFormContext<WizardValues>()

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Communication tone"
        error={errors.tones?.message as string | undefined}
        className="flex flex-col gap-1"
      >
        <p className="mb-3 text-xs text-text-secondary">
          Select one or more tones. Agents blend these when drafting every message.
        </p>
        <Controller
          control={control}
          name="tones"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((tone) => {
                const selected = field.value.includes(tone)
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() =>
                      field.onChange(
                        selected ? field.value.filter((t) => t !== tone) : [...field.value, tone],
                      )
                    }
                    aria-pressed={selected}
                    title={TONE_DESCRIPTIONS[tone]}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-brand-600 bg-brand-600 text-white shadow-[0_0_16px_-4px_rgba(46,125,255,0.6)]"
                        : "border-border bg-surface text-text-secondary hover:border-brand-600/40 hover:text-text-primary",
                    )}
                  >
                    {selected && <Check className="size-3.5" />}
                    {tone}
                  </button>
                )
              })}
            </div>
          )}
        />
      </Field>
    </div>
  )
}
