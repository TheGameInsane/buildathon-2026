import { useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { Plus } from "lucide-react"
import { ChannelIcon } from "@/components/channel-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateRep, useReps } from "@/hooks/use-reps"
import type { Channel } from "@/types/domain"
import type { WizardValues } from "@/types/wizard"

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
}

function estimateProspectRange(values: WizardValues): [number, number] {
  let base = 600
  base -= values.targetRoles.length * 40
  base -= values.exclusionCriteria.length * 30
  base = Math.max(base, 60)
  return [Math.round((base * 0.7) / 10) * 10, Math.round((base * 1.3) / 10) * 10]
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-right text-sm text-text-primary">{value}</span>
    </div>
  )
}

export function WizardStepReview() {
  const { control, watch } = useFormContext<WizardValues>()
  const values = watch()
  const { data: reps, isLoading } = useReps()
  const createRep = useCreateRep()
  const [newRepName, setNewRepName] = useState("")
  const [adding, setAdding] = useState(false)

  const [low, high] = estimateProspectRange(values)
  const estimatedTouchesPerWeek = values.sequenceSteps.length * Math.max(low, 1) * 0.2

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[10px] border border-border bg-surface p-4">
        <p className="mb-1 text-sm font-semibold text-text-primary">Review before launch</p>
        <div className="divide-y divide-border">
          <SummaryRow
            label="Target audience"
            value={`${values.industry || "Any industry"}, ${values.geography || "any location"}`}
          />
          <SummaryRow label="Job titles" value={values.targetRoles.join(", ") || "None specified"} />
          <SummaryRow label="Estimated prospects" value={`${low.toLocaleString()}–${high.toLocaleString()}`} />
          <SummaryRow
            label="Channels"
            value={
              <span className="inline-flex items-center gap-1.5">
                {values.channels.map((c) => (
                  <ChannelIcon key={c} channel={c} />
                ))}
                {values.channels.map((c) => CHANNEL_LABEL[c]).join(", ") || "None selected"}
              </span>
            }
          />
          <SummaryRow label="Sequence" value={`${values.sequenceSteps.length} step(s)`} />
          <SummaryRow label="Tone" value={values.tones.join(", ") || "None selected"} />
          <SummaryRow
            label="Estimated outreach volume"
            value={`~${Math.round(estimatedTouchesPerWeek).toLocaleString()} touches / week`}
          />
        </div>
      </div>

      <div className="rounded-[10px] border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-semibold text-text-primary">Assign reps</p>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <Controller
            control={control}
            name="repIds"
            render={({ field }) => (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  {reps?.map((rep) => {
                    const checked = field.value.includes(rep.id)
                    return (
                      <label
                        key={rep.id}
                        className="flex items-center gap-2 rounded-md border border-border p-2 text-sm text-text-primary"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-600"
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, rep.id]
                                : field.value.filter((id) => id !== rep.id),
                            )
                          }
                        />
                        {rep.name}
                      </label>
                    )
                  })}
                </div>

                {adding ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="Rep name"
                      value={newRepName}
                      onChange={(e) => setNewRepName(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newRepName.trim()}
                      onClick={() => {
                        createRep.mutate(newRepName.trim(), {
                          onSuccess: (rep) => {
                            field.onChange([...field.value, rep.id])
                            setNewRepName("")
                            setAdding(false)
                          },
                        })
                      }}
                    >
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setAdding(true)}
                  >
                    <Plus /> Add new rep
                  </Button>
                )}
              </div>
            )}
          />
        )}
      </div>
    </div>
  )
}
