import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { PreflightChecklist, type PreflightItem } from "@/components/preflight-checklist"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useActivateCampaign } from "@/hooks/use-campaigns"
import type { Campaign } from "@/types/domain"
import type { WizardValues } from "@/types/wizard"

export interface WizardStepChecklistProps {
  campaign: Campaign
  values: WizardValues
}

export function WizardStepChecklist({ campaign, values }: WizardStepChecklistProps) {
  const activate = useActivateCampaign()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewed, setPreviewed] = useState(false)
  const [justActivated, setJustActivated] = useState(false)

  const items: PreflightItem[] = [
    { label: "Audience defined", passed: Boolean(values.industry && values.geography) },
    {
      label: `Channels connected: ${values.channels.map((c) => c[0].toUpperCase() + c.slice(1)).join(", ") || "none"}`,
      passed: values.channels.length > 0,
    },
    { label: "Tone selected", passed: values.tones.length > 0 },
    { label: "Outreach sequence configured", passed: values.sequenceSteps.length > 0 },
    { label: "Rep assigned", passed: values.repIds.length > 0 },
    {
      label: "Prompts active for all enabled agents",
      passed: Object.values(values.agentPrompts).every((p) => p.trim().length > 0),
    },
    {
      label: "Sample message previewed",
      passed: previewed,
      actionLabel: previewed ? undefined : "Preview now",
      onAction: () => setPreviewOpen(true),
    },
  ]

  if (justActivated) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
        <CheckCircle2 className="size-8 text-status-live" />
        <p className="text-[15px] font-semibold text-text-primary">{campaign.name} is now Live</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PreflightChecklist
        items={items}
        activateLabel="Activate campaign"
        onActivate={() => {
          activate.mutate(campaign.id, {
            onSuccess: () => {
              setJustActivated(true)
              setTimeout(() => navigate(`/campaigns/${campaign.id}`), 900)
            },
          })
        }}
      />
      <p className="text-xs text-text-secondary">
        {campaign.name} has been saved as a Draft. You can leave it here and finish later from Mission Control.
      </p>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) setPreviewed(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample first message</DialogTitle>
          </DialogHeader>
          <p className="rounded-md bg-canvas p-3 text-sm text-text-primary">
            "Hi, noticed {values.name || "your company"} has been scaling fast. Wanted to share how we've helped
            similar {values.industry || "companies"} teams in {values.geography || "your region"} shorten their
            sales cycle. Worth a quick chat?"
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
