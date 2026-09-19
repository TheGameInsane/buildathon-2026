import { Controller, useFormContext } from "react-hook-form"
import { Field } from "@/components/wizard/field"
import { TagListInput } from "@/components/wizard/tag-list-input"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { COUNTRIES } from "@/lib/countries"
import { JOB_TITLE_PRESETS } from "@/lib/job-titles"
import type { WizardValues } from "@/types/wizard"

export function WizardStepAudience() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<WizardValues>()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Industry" htmlFor="wizard-industry" error={errors.industry?.message}>
          <Input id="wizard-industry" placeholder="SaaS" {...register("industry")} />
        </Field>
        <Field label="Location" htmlFor="wizard-geography" error={errors.geography?.message}>
          <Controller
            control={control}
            name="geography"
            render={({ field }) => (
              <Combobox
                value={field.value}
                onChange={field.onChange}
                options={[...COUNTRIES]}
                placeholder="Search countries…"
              />
            )}
          />
        </Field>
      </div>

      <Field label="Job titles" error={errors.targetRoles?.message as string | undefined}>
        <Controller
          control={control}
          name="targetRoles"
          render={({ field }) => (
            <MultiCombobox
              value={field.value}
              onChange={field.onChange}
              options={[...JOB_TITLE_PRESETS]}
              placeholder="CTO, VP Engineering…"
            />
          )}
        />
      </Field>

      <Field label="Company size" htmlFor="wizard-company-size" error={errors.companySizeRange?.message}>
        <Input id="wizard-company-size" placeholder="50 to 500 employees" {...register("companySizeRange")} />
      </Field>

      <Field label="Prospect filters: exclude" error={undefined}>
        <Controller
          control={control}
          name="exclusionCriteria"
          render={({ field }) => (
            <TagListInput value={field.value} onChange={field.onChange} placeholder="Existing customers, Competitors" />
          )}
        />
      </Field>

      <Field
        label="Sample / reference companies (up to 3)"
        error={errors.sampleCompanies?.message as string | undefined}
      >
        <Controller
          control={control}
          name="sampleCompanies"
          render={({ field }) => (
            <TagListInput value={field.value} onChange={field.onChange} placeholder="Loop AI, FinEdge" />
          )}
        />
      </Field>
    </div>
  )
}
