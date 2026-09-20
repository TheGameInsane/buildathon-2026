import { useEffect, useMemo, useState } from "react"
import { useBlocker, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { Check } from "lucide-react"
import { cn } from "cn"
import { CampaignCard } from "@/components/campaign-card"
import { WizardExitDialog } from "@/components/wizard-exit-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateCampaignFromWizard } from "@/hooks/use-campaigns"
import { useDefaultAgentPrompts } from "@/hooks/use-campaign-defaults"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useAuth } from "@/hooks/use-auth"
import { WizardStepAudience } from "@/pages/wizard-step-audience"
import { WizardStepCampaign } from "@/pages/wizard-step-campaign"
import { WizardStepChecklist } from "@/pages/wizard-step-checklist"
import { WizardStepOutreach } from "@/pages/wizard-step-outreach"
import { WizardStepReview } from "@/pages/wizard-step-review"
import { WizardStepSequence } from "@/pages/wizard-step-sequence"
import { WizardStepTone } from "@/pages/wizard-step-tone"
import { STEP_FIELDS, WIZARD_STEPS, wizardDefaultValues, wizardSchema } from "@/types/wizard"
import type { WizardValues } from "@/types/wizard"
import type { Campaign } from "@/types/domain"

const STEP_COMPONENTS = [
  WizardStepCampaign,
  WizardStepAudience,
  WizardStepOutreach,
  WizardStepTone,
  WizardStepSequence,
  WizardStepReview,
]

function WizardForm({ defaultPrompts }: { defaultPrompts: Record<string, string> }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserName = user?.name ?? ""
  const [step, setStep] = useState(0)
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null)
  const createFromWizard = useCreateCampaignFromWizard()

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: wizardDefaultValues(currentUserName, defaultPrompts as WizardValues["agentPrompts"]),
    mode: "onSubmit",
  })
  const { control, trigger, getValues } = form

  const watched = useWatch({ control })
  const debounced = useDebouncedValue(watched, 300)

  const previewCampaign: Campaign = useMemo(() => {
    if (createdCampaign) return createdCampaign
    const channels = debounced.channels ?? []
    return {
      id: "preview",
      name: debounced.name || "Untitled campaign",
      icp: [debounced.industry, debounced.geography].filter(Boolean).join(" · ") || "Not yet defined",
      status: "draft",
      funnelCounts: [0, 0, 0, 0, 0, 0, 0],
      touchCount: 0,
      todayByChannel: Object.fromEntries(channels.map((c) => [c, 0])),
      owner: debounced.owner || currentUserName,
      repCount: (debounced.repIds ?? []).length,
      lastActivityAt: new Date().toISOString(),
    }
  }, [debounced, createdCampaign, currentUserName])

  const isChecklistStep = step === WIZARD_STEPS.length - 1
  const StepComponent = STEP_COMPONENTS[step]

  // Once the campaign has been created (the checklist step), it's already saved —
  // nothing to intercept. Before that, leaving by any route (Cancel, an in-app
  // navigation, or the tab closing) needs the manager to say what happens to it.
  const exitNeedsDecision = !isChecklistStep
  const blocker = useBlocker(exitNeedsDecision)

  // Best-effort for closing the tab: the browser owns this dialog's buttons (it can't
  // be replaced with the three-option one below), but it can still stop an accidental close.
  useEffect(() => {
    if (!exitNeedsDecision) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [exitNeedsDecision])

  const handleContinue = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (!valid) return

    if (step === STEP_FIELDS.length - 1) {
      // Leaving the Review step: create the campaign as Draft (Flow 1).
      createFromWizard.mutate(getValues(), {
        onSuccess: (campaign) => {
          setCreatedCampaign(campaign)
          setStep(step + 1)
        },
      })
    } else {
      setStep(step + 1)
    }
  }

  const handleDontSave = () => blocker.state === "blocked" && blocker.proceed()

  const handleSaveAsDraft = () => {
    if (blocker.state !== "blocked") return
    const values = getValues()
    createFromWizard.mutate(
      { ...values, name: values.name.trim() || "Untitled campaign" },
      { onSuccess: () => blocker.proceed() },
    )
  }

  const handleCloseExitDialog = () => blocker.state === "blocked" && blocker.reset()

  return (
    <FormProvider {...form}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">New Campaign</h1>
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_1fr_280px]">
          {/* Step tracker */}
          <nav className="flex flex-row gap-2 lg:flex-col">
            {WIZARD_STEPS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium",
                  i === step
                    ? "bg-brand-50 text-brand-600"
                    : i < step || createdCampaign
                      ? "text-status-live"
                      : "text-text-secondary",
                )}
              >
                {i < step || (i === step && createdCampaign) ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                    {i + 1}
                  </span>
                )}
                <span className="hidden lg:inline">{label}</span>
              </div>
            ))}
          </nav>

          {/* Current step form */}
          <div className="min-w-0">
            {isChecklistStep ? (
              createdCampaign ? (
                <WizardStepChecklist campaign={createdCampaign} />
              ) : (
                <Skeleton className="h-64 w-full" />
              )
            ) : (
              <StepComponent />
            )}

            {!isChecklistStep && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  Back
                </Button>
                <Button type="button" onClick={handleContinue} disabled={createFromWizard.isPending}>
                  Continue
                </Button>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="hidden flex-col gap-2 lg:flex">
            <p className="text-xs font-semibold text-text-secondary">Live preview</p>
            <CampaignCard campaign={previewCampaign} interactive={false} />
          </div>
        </div>
      </div>

      <WizardExitDialog
        open={blocker.state === "blocked"}
        onDontSave={handleDontSave}
        onSaveAsDraft={handleSaveAsDraft}
        onClose={handleCloseExitDialog}
        saving={createFromWizard.isPending}
      />
    </FormProvider>
  )
}

export function NewCampaignWizard() {
  const { data: defaultPrompts, isLoading } = useDefaultAgentPrompts()

  if (isLoading || !defaultPrompts) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return <WizardForm defaultPrompts={defaultPrompts} />
}
