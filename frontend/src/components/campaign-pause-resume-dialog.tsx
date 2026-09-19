import { ConfirmDialog } from "@/components/confirm-dialog"
import { PAUSE_CAMPAIGN_COPY, RESUME_CAMPAIGN_COPY } from "@/lib/campaign-copy"

export interface CampaignPauseResumeDialogProps {
  action: "pause" | "resume"
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** The one place pause/resume confirmation copy lives, so every screen that can pause or resume a campaign says the same thing. */
export function CampaignPauseResumeDialog({ action, open, onOpenChange, onConfirm }: CampaignPauseResumeDialogProps) {
  const copy = action === "pause" ? PAUSE_CAMPAIGN_COPY : RESUME_CAMPAIGN_COPY

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      tone={action === "pause" ? "amber" : "green"}
      onConfirm={onConfirm}
    />
  )
}
