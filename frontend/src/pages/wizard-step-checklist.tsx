import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { PreflightChecklist, type PreflightItem } from "@/components/preflight-checklist"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api-client"
import { useActivateCampaign, useCampaignPreflight } from "@/hooks/use-campaigns"
import type { Campaign } from "@/types/domain"

export interface WizardStepChecklistProps {
  campaign: Campaign
}

export function WizardStepChecklist({ campaign }: WizardStepChecklistProps) {
  const activate = useActivateCampaign()
  const { data: preflight, isLoading } = useCampaignPreflight(campaign.id)
  const navigate = useNavigate()
  const [justActivated, setJustActivated] = useState(false)

  if (justActivated) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
        <CheckCircle2 className="size-8 text-status-live" />
        <p className="text-[15px] font-semibold text-text-primary">{campaign.name} is now Live</p>
      </div>
    )
  }

  if (isLoading || !preflight) {
    return <Skeleton className="h-64 w-full" />
  }

  // Real checks from the backend's own gate (GET /campaigns/:id/preflight) — the same
  // checklist `/activate` enforces, not a client-side guess at readiness. Some of these
  // (a company profile, 5+ KB docs, a live channel integration) can't be satisfied from
  // inside this wizard at all; they link out to where they're actually fixed.
  const items: PreflightItem[] = preflight.checks.map((check) => ({
    label: check.message,
    passed: check.ok,
  }))

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
            onError: (err) => {
              const message =
                err instanceof ApiError ? err.message : "Could not activate this campaign."
              toast.error(message)
            },
          })
        }}
      />
      <p className="text-xs text-text-secondary">
        {campaign.name} has been saved as a Draft. You can leave it here and finish later from Overview.
      </p>
    </div>
  )
}
