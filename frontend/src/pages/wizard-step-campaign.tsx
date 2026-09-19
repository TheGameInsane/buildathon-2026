import { useFormContext } from "react-hook-form"
import { Field } from "@/components/wizard/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { WizardValues } from "@/types/wizard"

export function WizardStepCampaign() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WizardValues>()

  return (
    <div className="flex flex-col gap-4">
      <Field label="Campaign name" htmlFor="wizard-name" error={errors.name?.message}>
        <Input id="wizard-name" placeholder="US SaaS CTO Outreach" {...register("name")} />
      </Field>

      <Field label="Description" htmlFor="wizard-description">
        <Textarea
          id="wizard-description"
          rows={4}
          placeholder="What is this campaign trying to achieve, and for whom?"
          {...register("description")}
        />
      </Field>
    </div>
  )
}
