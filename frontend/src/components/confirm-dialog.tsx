import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ConfirmTone = "amber" | "red" | "green"

const toneStyles: Record<ConfirmTone, string> = {
  amber: "bg-status-paused text-white hover:bg-status-paused/90",
  red: "bg-status-attention text-white hover:bg-status-attention/90",
  green: "bg-status-live text-white hover:bg-status-live/90",
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** One-sentence consequence description. */
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone: ConfirmTone
  onConfirm: () => void
}

/** Generic confirm for every destructive/hard-to-reverse action (pause, activate, offboard, kill switch). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" autoFocus onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn(toneStyles[tone])}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
