import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface CampaignCompletionSummary {
  prospectsProcessed: number
  touchesSent: number
  meetingsBooked: number
  responseRate: number
  costPerQualifiedLead: number
}

export interface CampaignCompletionModalProps {
  campaignName: string
  summary: CampaignCompletionSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (feedback: string) => void
  submitting?: boolean
}

/** Shown right after a campaign is marked Completed: performance recap + freeform feedback. */
export function CampaignCompletionModal({
  campaignName,
  summary,
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: CampaignCompletionModalProps) {
  const [feedback, setFeedback] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaignName} is complete</DialogTitle>
          <DialogDescription>Here's how it performed. Feedback here is saved on the campaign.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Prospects processed", value: summary.prospectsProcessed.toLocaleString() },
            { label: "Touches sent", value: summary.touchesSent.toLocaleString() },
            { label: "Meetings booked", value: summary.meetingsBooked.toLocaleString() },
            { label: "Response rate", value: `${summary.responseRate}%` },
            { label: "Cost / qualified lead", value: `$${summary.costPerQualifiedLead.toFixed(2)}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-canvas p-3">
              <p className="text-lg font-semibold tabular-nums text-text-primary">{stat.value}</p>
              <p className="text-xs text-text-secondary">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="completion-feedback">What worked, what didn't?</Label>
          <Textarea
            id="completion-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional, but helps tune the next campaign…"
            rows={4}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={!feedback.trim() || submitting}
            onClick={() => {
              onSubmit(feedback.trim())
              onOpenChange(false)
            }}
          >
            Save feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
