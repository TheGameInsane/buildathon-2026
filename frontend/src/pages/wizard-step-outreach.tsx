import { Controller, useFormContext } from "react-hook-form"
import { ChannelIcon } from "@/components/channel-icon"
import { Field } from "@/components/wizard/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { Channel } from "@/types/domain"
import type { WizardValues } from "@/types/wizard"

const ALL_CHANNELS: Channel[] = ["email", "whatsapp", "linkedin"]
const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
}

export function WizardStepOutreach() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<WizardValues>()

  return (
    <div className="flex flex-col gap-4">
      <Field label="Channels and daily caps" error={errors.channels?.message}>
        <Controller
          control={control}
          name="channels"
          render={({ field: channelsField }) => (
            <Controller
              control={control}
              name="dailyCaps"
              render={({ field: capsField }) => (
                <div className="flex flex-col gap-2">
                  {ALL_CHANNELS.map((channel) => {
                    const enabled = channelsField.value.includes(channel)
                    return (
                      <div
                        key={channel}
                        className={
                          "flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors " +
                          (enabled ? "border-brand-600/40 bg-brand-50/40" : "border-border")
                        }
                      >
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            channelsField.onChange(
                              checked
                                ? [...channelsField.value, channel]
                                : channelsField.value.filter((c) => c !== channel),
                            )
                          }
                        />
                        <ChannelIcon channel={channel} />
                        <span className="w-24 text-sm text-text-primary">{CHANNEL_LABEL[channel]}</span>
                        <Input
                          type="number"
                          disabled={!enabled}
                          value={capsField.value[channel] ?? ""}
                          onChange={(e) =>
                            capsField.onChange({ ...capsField.value, [channel]: Number(e.target.value) })
                          }
                          placeholder="Daily cap"
                          className="w-28"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            />
          )}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Working hours" htmlFor="wizard-hours" error={errors.workingHours?.message}>
          <Input id="wizard-hours" {...register("workingHours")} />
        </Field>
        <Field label="Timezone" htmlFor="wizard-timezone" error={errors.timezone?.message}>
          <Input id="wizard-timezone" {...register("timezone")} />
        </Field>
      </div>

      <Controller
        control={control}
        name="requiresApprovalOnFirstTouch"
        render={({ field }) => (
          <label className="flex items-center justify-between text-sm text-text-primary">
            Requires approval on first touch
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />

      <Controller
        control={control}
        name="escalateOnPricingOrLegal"
        render={({ field }) => (
          <label className="flex items-center justify-between text-sm text-text-primary">
            Escalate on pricing or legal questions
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />
    </div>
  )
}
