import { Plus, Trash2 } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { ChannelIcon } from "@/components/channel-icon"
import { Field } from "@/components/wizard/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Channel } from "@/types/domain"
import type { SequenceStep, WizardValues } from "@/types/wizard"

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
}

export function WizardStepSequence() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardValues>()
  const enabledChannels = watch("channels")
  const channelOptions = enabledChannels.length > 0 ? enabledChannels : (["email", "whatsapp"] as Channel[])

  return (
    <Field label="Outreach sequence" error={errors.sequenceSteps?.message as string | undefined}>
      <p className="mb-3 text-xs text-text-secondary">
        Each step sends after the wait period following the previous step. The first step sends immediately.
      </p>
      <Controller
        control={control}
        name="sequenceSteps"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            {field.value.map((step, i) => (
              <div key={step.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                  {i + 1}
                </span>
                <Select
                  value={step.channel}
                  onValueChange={(v) => {
                    const next = [...field.value]
                    next[i] = { ...step, channel: v as Channel }
                    field.onChange(next)
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue>
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={step.channel} /> {CHANNEL_LABEL[step.channel]}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  {i === 0 ? (
                    "Sends immediately"
                  ) : (
                    <>
                      Wait
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={step.waitDays}
                        onChange={(e) => {
                          const next = [...field.value]
                          next[i] = { ...step, waitDays: Number(e.target.value) }
                          field.onChange(next)
                        }}
                        className="w-16"
                      />
                      days, then follow up
                    </>
                  )}
                </div>

                {field.value.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Remove step"
                    onClick={() => field.onChange(field.value.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                const newStep: SequenceStep = {
                  id: crypto.randomUUID(),
                  channel: channelOptions[field.value.length % channelOptions.length],
                  waitDays: 3,
                }
                field.onChange([...field.value, newStep])
              }}
            >
              <Plus /> Add follow-up step
            </Button>
          </div>
        )}
      />
    </Field>
  )
}
