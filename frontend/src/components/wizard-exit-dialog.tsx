import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface WizardExitDialogProps {
  open: boolean
  onDontSave: () => void
  onSaveAsDraft: () => void
  onClose: () => void
  saving: boolean
}

/** Shown whenever a manager tries to leave the New Campaign Wizard partway through —
 * Cancel, an in-app navigation away, or (best-effort; the browser owns that dialog's
 * buttons) closing the tab. Three distinct actions, never combined. */
export function WizardExitDialog({ open, onDontSave, onSaveAsDraft, onClose, saving }: WizardExitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this campaign?</DialogTitle>
          <DialogDescription>You're partway through setting this campaign up. Choose what to do with it.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="outline" onClick={onDontSave} disabled={saving}>
            Don't Save
          </Button>
          <Button type="button" onClick={onSaveAsDraft} disabled={saving}>
            Save as Draft
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
