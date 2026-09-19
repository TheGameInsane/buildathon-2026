/** Shared pause/resume confirmation copy so Mission Control, Campaign Detail, and the Campaigns list never drift. */
export const PAUSE_CAMPAIGN_COPY = {
  title: "Pause campaign?",
  description:
    "Pausing this campaign will stop all scheduled outreach and prevent new messages from being sent. Existing prospect data and activity history will be preserved. You can resume the campaign at any time.",
  confirmLabel: "Pause Campaign",
} as const

export const RESUME_CAMPAIGN_COPY = {
  title: "Resume campaign?",
  description:
    "Resuming this campaign will restart scheduled outreach for eligible prospects. Messages will continue according to your campaign settings and sending limits.",
  confirmLabel: "Resume Campaign",
} as const
